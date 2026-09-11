import "server-only";

/**
 * Aviso de BAJA MÉDICA a la gestoría, que sale cuando RRHH la APRUEBA.
 *
 * Antes salía en cuanto el trabajador la pedía: la gestoría se enteraba de una
 * baja que nadie había revisado, y si luego se rechazaba ya la había recibido.
 * Ahora no sale nada de la empresa hasta que hay visto bueno, y quien aprueba
 * decide en ese momento si avisa (ver `aprobarSolicitud`).
 *
 * El correo lleva, por este orden:
 *   1. La baja y quién es el trabajador — lo que hay que leer.
 *   2. El botón para devolver el comprobante — lo que hay que hacer.
 *   3. Empresa y centro de trabajo, plegados al pie — lo que casi nunca se mira.
 *
 * El orden no es estético: la gestoría abre esto en el móvil y lo primero que
 * necesita es la fecha y el nombre, no el CIF, que es siempre el mismo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape-html";
import {
  camposFiscalesEmpresa,
  camposCentroTrabajo,
  type CampoGestoria,
  type LocalParaGestoria,
} from "@/features/rrhh/services/datos-empresa-gestoria";
import type { DatosGenerales } from "@/features/ajustes/data/ajustes";
import {
  registrarComunicacion,
  DESTINATARIO_GESTORIA,
  DESTINATARIO_GERENCIA,
} from "@/features/comunicaciones/services/registro";
import {
  crearTokenComprobante,
  botonComprobanteHtml,
  urlSubidaComprobante,
  archivarEnCarpetaBajas,
  fechaEs,
  TITULO_PARTE,
} from "@/features/rrhh/services/gestoria/baja-medica-documentos";

const BUCKET_PARTES = "bajas-medicas";

// ── Piezas del correo ───────────────────────────────────────────────────────

const fila = (k: string, v: string | null | undefined) =>
  `<tr>
      <td style="padding:9px 15px;color:#64748b;font-size:12.5px;border-bottom:1px solid #eef2f7;white-space:nowrap;">${escapeHtml(k)}</td>
      <td style="padding:9px 15px;color:#0f172a;font-weight:600;font-size:13.5px;border-bottom:1px solid #eef2f7;text-align:right;">${escapeHtml(v) || "—"}</td>
    </tr>`;

const tarjeta = (titulo: string, filas: string) => `
    <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0;margin:16px 0;max-width:520px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <tr><td colspan="2" style="background:#ffffff;padding:11px 15px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">${escapeHtml(titulo)}</td></tr>
      ${filas}
    </table>`;

/** Fila discreta del bloque plegado del pie: gris, pequeña, sin bordes. */
const filaTenue = (k: string, v: string) =>
  `<tr>
      <td style="padding:4px 10px 4px 0;color:#94a3b8;font-size:12px;white-space:nowrap;">${escapeHtml(k)}</td>
      <td style="padding:4px 0;color:#475569;font-size:12px;font-weight:500;text-align:right;">${escapeHtml(v)}</td>
    </tr>`;

const tablaTenue = (titulo: string, campos: CampoGestoria[]) => `
    <table role="presentation" width="100%" style="border-collapse:collapse;margin:2px 0 14px 0;">
      <tr><td colspan="2" style="padding:6px 0 5px 0;font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#b0b8c4;">${escapeHtml(titulo)}</td></tr>
      ${campos.map((c) => filaTenue(c.label, c.value)).join("")}
    </table>`;

/**
 * Empresa y centro, al pie y plegados.
 *
 * Se monta con `<details>` a sabiendas de que **Gmail no lo entiende** y los
 * enseñará siempre abiertos — y la gestoría lee en Gmail. No importa: abiertos
 * siguen siendo gris pequeño al final del todo, que era el objetivo. En el móvil
 * y en Apple Mail sí se pliegan de verdad. Así nunca queda mal.
 */
function pieEmpresaYCentro(
  empresaRow: { nombre?: string | null; datos_generales?: unknown } | null,
  local: LocalParaGestoria | null,
): { html: string; texto: string } {
  const fiscales = camposFiscalesEmpresa(
    (empresaRow?.datos_generales ?? null) as Partial<DatosGenerales> | null,
    empresaRow?.nombre ?? undefined,
  );
  const centro = camposCentroTrabajo(local);
  const aTexto = (c: CampoGestoria[]) => c.map((x) => `${x.label}: ${x.value}`).join("\n");
  return {
    html: `
      <div style="border-top:1px solid #eef2f7;margin-top:22px;padding-top:4px;">
        <details>
          <summary style="cursor:pointer;padding:10px 0;font-size:12px;color:#94a3b8;">Datos de la empresa y del centro de trabajo</summary>
          ${tablaTenue("Datos fiscales", fiscales)}
          ${tablaTenue("Centro de trabajo", centro)}
        </details>
      </div>`,
    texto: `\nDATOS FISCALES\n${aTexto(fiscales)}\n\nCENTRO DE TRABAJO\n${aTexto(centro)}`,
  };
}

/** El local del empleado tal como lo devuelve el embed (objeto o lista). */
function localDe(emp: { locales?: unknown } | null): LocalParaGestoria | null {
  const l = emp?.locales;
  if (!l) return null;
  return (Array.isArray(l) ? l[0] : l) as LocalParaGestoria;
}

/** Días naturales entre dos fechas de calendario, ambas incluidas. */
function diasDeBaja(inicioIso: string, finIso: string | null): number | null {
  if (!finIso) return null;
  const a = new Date(`${inicioIso}T00:00:00Z`).getTime();
  const b = new Date(`${finIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

// ── Envío ───────────────────────────────────────────────────────────────────

export interface ResultadoAvisoBajaMedica {
  ok: boolean;
  error?: string;
  /** Datos que faltan en la ficha y que impiden mandar una baja completa. */
  faltan?: string[];
}

/**
 * Manda la baja médica aprobada a la gestoría (y el aviso informativo a
 * gerencia), archiva el parte en la carpeta del trabajador y lo apunta todo en
 * el historial de la solicitud.
 *
 * `quien` es quien aprobó: sale en el correo («Aprobada por …») y en el
 * historial. Sin él, se apunta como envío automático.
 */
export async function enviarBajaMedicaGestoria(args: {
  solicitudId: string;
  quien?: { userId: string | null; nombre: string } | null;
  /** true = lo dispara un cron o un reenvío automático. */
  automatico?: boolean;
}): Promise<ResultadoAvisoBajaMedica> {
  const admin = createAdminClient();

  const { data: sol } = await admin
    .from("solicitudes_personal")
    .select("id, empresa_id, user_id, empleado_nombre, subtipo, fecha_inicio, fecha_fin, motivo, justificante_path, created_at, revisado_at")
    .eq("id", args.solicitudId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitud no encontrada" };
  if (sol.subtipo !== "baja_medica") {
    return { ok: false, error: "Esta solicitud no es una baja médica" };
  }

  const empresaId = sol.empresa_id as string;
  const fechaInicio = sol.fecha_inicio as string;
  const fechaFin = (sol.fecha_fin as string | null) ?? null;

  const { data: emp } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, dni_nie, numero_ss, fecha_nacimiento, telefono, email_personal, email_empresa, puesto, fecha_alta, locales(nombre, direccion, ciudad, provincia, codigo_postal, ccc, tipo_establecimiento, clase_restaurante, convenio)")
    .eq("empresa_id", empresaId)
    .eq("user_id", sol.user_id as string)
    .maybeSingle();
  if (!emp) {
    return { ok: false, error: "No se encontró la ficha del trabajador en esta empresa." };
  }

  const nombre =
    `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() ||
    (sol.empleado_nombre as string | null) ||
    "Trabajador";
  const local = localDe(emp);

  // INTEGRIDAD: la gestoría no debe recibir una baja con los datos identificativos
  // en blanco — tramitar una incapacidad temporal sin número de afiliación o sin
  // saber a qué cuenta de cotización pertenece no se puede. Se avisa de qué falta
  // en vez de mandar una ficha con rayas.
  const faltan: string[] = [];
  if (!(emp.dni_nie as string | null)?.trim()) faltan.push("DNI / NIE");
  if (!(emp.numero_ss as string | null)?.trim()) faltan.push("Nº Seguridad Social");
  if (!local?.nombre?.trim()) faltan.push("Centro de trabajo");
  if (!local?.ccc?.trim()) faltan.push("CCC del centro");
  if (faltan.length > 0) {
    return {
      ok: false,
      faltan,
      error:
        `No se puede avisar a la gestoría de la baja de ${nombre}: faltan datos obligatorios ` +
        `(${faltan.join(", ")}). Complétalos en su ficha y vuelve a enviarlo.`,
    };
  }

  const { data: empresaRow } = await admin
    .from("empresas")
    .select("nombre, datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  const empresaNombre = (empresaRow?.nombre as string | undefined) ?? "la empresa";

  // Tipo de contrato de las condiciones VIGENTES (histórico: vigente_hasta null).
  const { data: condRows } = await admin
    .from("empleado_condiciones")
    .select("tipo_contrato, vigente_hasta, vigente_desde")
    .eq("empleado_id", emp.id as string)
    .order("vigente_desde", { ascending: false, nullsFirst: false })
    .limit(20);
  const cond = (condRows ?? []).find((r) => r.vigente_hasta == null) ?? condRows?.[0] ?? null;

  // El parte del médico, si lo aportó. Se adjunta al correo y se archiva en la
  // carpeta del trabajador, que hasta ahora no lo veía en ningún sitio.
  let parte: Buffer | null = null;
  const justificantePath = (sol.justificante_path as string | null) ?? null;
  if (justificantePath) {
    try {
      const dl = await admin.storage.from(BUCKET_PARTES).download(justificantePath);
      if (!dl.error && dl.data) parte = Buffer.from(await dl.data.arrayBuffer());
    } catch (e) {
      console.error("[baja-medica] no se pudo leer el parte:", e);
    }
  }
  if (parte) {
    await archivarEnCarpetaBajas(admin, {
      empresaId,
      empleadoId: emp.id as string,
      solicitudId: sol.id as string,
      fechaInicioIso: fechaInicio,
      titulo: TITULO_PARTE,
      buffer: parte,
    });
  }

  // Enlace de vuelta: el comprobante de haberla tramitado.
  const tk = await crearTokenComprobante(admin, {
    empresaId,
    solicitudId: sol.id as string,
    empleadoId: emp.id as string,
    fechaInicioIso: fechaInicio,
  });

  const dias = diasDeBaja(fechaInicio, fechaFin);
  const aprobadaPor = args.quien?.nombre?.trim() || "Recursos Humanos";
  const fechaAprobacion = ((sol.revisado_at as string | null) ?? new Date().toISOString()).slice(0, 10);
  const fechaComunicacion = ((sol.created_at as string | null) ?? "").slice(0, 10);

  const filasBaja = [
    fila("Primer día de baja", fechaEs(fechaInicio)),
    fila("Fin estimado", fechaFin ? fechaEs(fechaFin) : "Sin determinar"),
    fila("Días previstos", dias != null ? String(dias) : "—"),
    fila("Comunicada por el trabajador", fechaComunicacion ? fechaEs(fechaComunicacion) : "—"),
    fila("Aprobada por", `${aprobadaPor} · ${fechaEs(fechaAprobacion)}`),
  ].join("");

  const filasTrabajador = [
    fila("Nombre", nombre),
    fila("DNI / NIE", emp.dni_nie as string | null),
    fila("Nº Seguridad Social", emp.numero_ss as string | null),
    fila("Fecha de nacimiento", emp.fecha_nacimiento ? fechaEs(emp.fecha_nacimiento as string) : null),
    fila("Teléfono", emp.telefono as string | null),
    fila("Puesto", emp.puesto as string | null),
    fila("Tipo de contrato", (cond?.tipo_contrato as string | null) ?? null),
    fila("Alta en la empresa", emp.fecha_alta ? fechaEs(emp.fecha_alta as string) : null),
    fila("Centro de trabajo", local?.nombre ?? null),
  ].join("");

  const pie = pieEmpresaYCentro(empresaRow ?? null, local);

  const bloqueParte = parte
    ? `<p style="margin:4px 0 14px 0;font-size:13px;line-height:1.6;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:11px 13px;">📎 Se adjunta el <strong>parte de baja</strong> aportado por el trabajador (PDF).</p>`
    : `<p style="margin:4px 0 14px 0;font-size:13px;line-height:1.6;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:11px 13px;">⚠️ El trabajador <strong>aún no ha aportado el parte de baja</strong>. Os lo enviaremos en cuanto lo suba.</p>`;

  const motivo = (sol.motivo as string | null)?.trim() || "";
  const bloqueMotivo = motivo
    ? `<div style="border-left:3px solid #e2e8f0;padding-left:13px;margin:4px 0 16px 0;">
         <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#94a3b8;">Detalles indicados por el trabajador</p>
         <p style="margin:0;font-size:13.5px;color:#334155;line-height:1.6;font-style:italic;">«${escapeHtml(motivo)}»</p>
       </div>`
    : "";

  /** El mismo correo, con el encabezado cambiado según a quién va. */
  const componer = (destino: "gestoria" | "gerencia") => {
    const esGestoria = destino === "gestoria";
    const subject = esGestoria
      ? `${empresaNombre} · Baja médica a tramitar: ${nombre}`
      : `${empresaNombre} · Aviso de baja médica: ${nombre}`;
    const intro = esGestoria
      ? `Un trabajador de <strong>${escapeHtml(empresaNombre)}</strong> ha comunicado una baja médica y <strong>Recursos Humanos la ha aprobado</strong>. Os trasladamos los datos para que procedáis a su tramitación.`
      : `Os informamos de que un trabajador de <strong>${escapeHtml(empresaNombre)}</strong> causa <strong>baja médica</strong>. Es un aviso informativo: la gestoría ya tiene los datos para tramitarla.`;

    const html = `
      <h1 style="margin:0 0 4px 0;font-size:21px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${esGestoria ? "Baja médica a tramitar" : "Aviso de baja médica"}</h1>
      <p style="margin:0 0 16px 0;font-size:12.5px;color:#64748b;">${escapeHtml(empresaNombre)}</p>
      <p style="margin:0 0 14px 0;font-size:14px;line-height:1.62;color:#334155;">${intro}</p>
      ${tarjeta("Datos de la baja", filasBaja)}
      ${tarjeta("Trabajador", filasTrabajador)}
      ${bloqueParte}
      ${bloqueMotivo}
      ${esGestoria && tk.ok ? botonComprobanteHtml(tk.token) : ""}
      ${pie.html}
      <p style="border-top:1px solid #eef2f7;margin-top:18px;padding-top:14px;font-size:11.5px;color:#94a3b8;line-height:1.6;">Correo automático de ${escapeHtml(empresaNombre)}. No respondáis a esta dirección: para cualquier duda escribid a Recursos Humanos.</p>`;

    const text = [
      esGestoria ? "BAJA MÉDICA A TRAMITAR" : "AVISO DE BAJA MÉDICA",
      empresaNombre,
      "",
      `Primer día de baja: ${fechaEs(fechaInicio)}`,
      `Fin estimado: ${fechaFin ? fechaEs(fechaFin) : "Sin determinar"}`,
      `Días previstos: ${dias ?? "—"}`,
      `Aprobada por: ${aprobadaPor} · ${fechaEs(fechaAprobacion)}`,
      "",
      `Trabajador: ${nombre}`,
      `DNI/NIE: ${emp.dni_nie ?? "—"}`,
      `Nº Seguridad Social: ${emp.numero_ss ?? "—"}`,
      `Puesto: ${emp.puesto ?? "—"}`,
      `Centro de trabajo: ${local?.nombre ?? "—"}`,
      motivo ? `\nDetalles: ${motivo}` : "",
      esGestoria && tk.ok ? `\nSubir el comprobante de la baja: ${urlSubidaComprobante(tk.token)}` : "",
      pie.texto,
    ].join("\n");

    return { subject, html, text };
  };

  // Destinos: fuente única de Ajustes → Empresa → «Correos electrónicos».
  const { resolverDestinatario } = await import(
    "@/features/rrhh/services/email-plantillas/resolver"
  );
  const [gestoria, gerencia] = await Promise.all([
    resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", null),
    resolverDestinatario(admin, empresaId, "departamento", "correoGerencia", null),
  ]);

  const adjuntos = parte
    ? [
        {
          filename: `Parte-baja-${nombre.replace(/\s+/g, "-")}.pdf`,
          content: parte,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  /** Envía a un destino y deja constancia, salga o no salga. */
  const avisar = async (destino: "gestoria" | "gerencia", to: string): Promise<boolean> => {
    const etiqueta = destino === "gestoria" ? DESTINATARIO_GESTORIA : DESTINATARIO_GERENCIA;
    const { subject, html, text } = componer(destino);

    if (!to) {
      await registrarComunicacion({
        empresaId,
        refTabla: "solicitudes_personal",
        refId: sol.id as string,
        via: "email",
        asunto: subject,
        destinatario: etiqueta,
        estado: "fallido",
        error: `Sin correo de ${etiqueta.toLowerCase()} configurado en Ajustes → Empresa.`,
        automatico: args.automatico ?? false,
        enviadoPor: args.quien?.userId ?? null,
        enviadoPorNombre: args.quien?.nombre ?? null,
      });
      return false;
    }

    const res = await sendEmail({ to, subject, html, text, empresaId, attachments: adjuntos });
    await registrarComunicacion({
      empresaId,
      refTabla: "solicitudes_personal",
      refId: sol.id as string,
      via: "email",
      asunto: subject,
      destinatario: etiqueta,
      destinoEmail: to,
      estado: res.ok ? "enviado" : "fallido",
      error: res.ok ? null : ("error" in res ? String(res.error) : "No se pudo enviar"),
      automatico: args.automatico ?? false,
      enviadoPor: args.quien?.userId ?? null,
      enviadoPorNombre: args.quien?.nombre ?? null,
    });
    if (!res.ok) {
      console.error(`[baja-medica] email a ${destino} NO enviado:`, res);
    }
    return res.ok;
  };

  const gestoriaOk = await avisar("gestoria", gestoria.to);

  // Gerencia: se omite si comparte buzón con gestoría, para no duplicar.
  const mismoBuzon =
    !!gerencia.to && gerencia.to.toLowerCase() === (gestoria.to ?? "").toLowerCase();
  if (!mismoBuzon) await avisar("gerencia", gerencia.to);

  // El token se creó ANTES de enviar (el correo necesita el enlace). Si el correo
  // no salió, ese enlace es un fantasma: su valor en claro solo existía en el
  // correo que nunca llegó. Se borra para que el reenvío cree uno limpio.
  if (!gestoriaOk && tk.ok) {
    await admin.from("baja_medica_doc_tokens").delete().eq("id", tk.tokenId);
  }

  if (!gestoriaOk) {
    await escalarAvisoInterno(admin, {
      empresaId,
      solicitudId: sol.id as string,
      nombre,
      fechaInicio,
      sinCorreo: !gestoria.to,
    });
    return {
      ok: false,
      error: gestoria.to
        ? "No se pudo enviar el correo a la gestoría. Se ha avisado a RRHH para que lo reintente."
        : "Configura el «Correo gestoría» en Ajustes → Empresa → Correos electrónicos.",
    };
  }

  return { ok: true };
}

/**
 * Red de seguridad: si la gestoría no recibió el aviso, alguien de la empresa
 * tiene que enterarse. Antes esto solo se veía en el log del servidor.
 */
async function escalarAvisoInterno(
  admin: SupabaseClient,
  args: {
    empresaId: string;
    solicitudId: string;
    nombre: string;
    fechaInicio: string;
    sinCorreo: boolean;
  },
): Promise<void> {
  try {
    const { emitirNotificacion } = await import(
      "@/features/notificaciones/actions/notificaciones-actions"
    );
    await emitirNotificacion({
      system: true,
      empresaId: args.empresaId,
      segmento: { tipo: "area", area: "ADMINISTRATIVA" },
      tipo: "alerta",
      titulo: "Baja médica SIN avisar a la gestoría",
      mensaje:
        `La baja médica de ${args.nombre} (desde el ${fechaEs(args.fechaInicio)}) está aprobada, ` +
        `pero el aviso a la gestoría NO salió: ` +
        (args.sinCorreo
          ? "no hay «Correo gestoría» configurado en Ajustes → Empresa."
          : "falló el envío.") +
        " Entra en la solicitud y vuelve a enviarlo, o comunícalo a mano.",
      refTabla: "solicitudes_personal",
      refId: args.solicitudId,
      dedupeKey: `baja_medica_sin_avisar:${args.solicitudId}`,
    });
  } catch (e) {
    console.error("[baja-medica] no se pudo escalar el aviso interno:", e);
  }
}
