import "server-only";

/**
 * ALTA MÉDICA: el cierre de la baja.
 *
 * Una baja se abría y no se cerraba nunca. La fecha de fin era una estimación que
 * nadie corregía, y cuando el trabajador volvía, ni RRHH ni la gestoría se
 * enteraban salvo que alguien lo dijera de palabra.
 *
 * El alta la comunica el propio trabajador desde su panel, el día que se la dan,
 * sobre la MISMA solicitud de baja. A partir de ahí:
 *   · La baja se cierra en su fecha real, no en la estimada.
 *   · Se calcula el primer día que le toca turno, con SU horario.
 *   · RRHH lo recibe por las dos vías: aviso en el programa y correo.
 *   · La gestoría recibe su correo de alta, igual que recibió el de baja.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape-html";
import { getHorarioDia } from "@/features/rrhh/utils/horario-empleado";
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
} from "@/features/comunicaciones/services/registro";
import { fechaEs } from "@/features/rrhh/services/gestoria/baja-medica-documentos";

/** Hasta dónde se busca el próximo día con turno antes de rendirse. */
const DIAS_BUSQUEDA_REINCORPORACION = 60;

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

/** El local del empleado tal como lo devuelve el embed (objeto o lista). */
function localDe(emp: { locales?: unknown } | null): LocalParaGestoria | null {
  const l = emp?.locales;
  if (!l) return null;
  return (Array.isArray(l) ? l[0] : l) as LocalParaGestoria;
}

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Primer día con turno a partir del alta (incluido el propio día del alta).
 *
 * Si el alta se la dan un jueves y ese jueves libra, se incorpora el viernes. Se
 * calcula con el motor de horarios real, el mismo que usa RRHH, para no decirle
 * al trabajador un día que luego no le toca.
 *
 * NUNCA devuelve un día pasado. El parte de alta puede ser de hace unos días
 * —te la dan el viernes y lo comunicas el lunes— y decir «te reincorporas el
 * viernes» no significa nada: ese día ya pasó. Cuando el alta es anterior a hoy,
 * se busca a partir de HOY.
 *
 * Devuelve null si en dos meses no tiene ningún turno asignado: eso no es un día
 * de descanso, es que no tiene horario, y entonces lo decide RRHH a mano.
 */
export async function calcularReincorporacion(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoId: string,
  altaIso: string,
  /** Suelo: ningún día anterior a este. Por defecto, hoy. */
  noAntesDe?: string,
): Promise<string | null> {
  const suelo = noAntesDe ?? new Date().toISOString().slice(0, 10);
  const arranque = altaIso > suelo ? altaIso : suelo;

  for (let i = 0; i < DIAS_BUSQUEDA_REINCORPORACION; i++) {
    const dia = sumarDias(arranque, i);
    const horario = await getHorarioDia(supabase, empresaId, empleadoId, dia);
    if (horario.tipo !== "ninguno") return dia;
  }
  return null;
}

export interface ResultadoAltaMedica {
  ok: boolean;
  error?: string;
  reincorporacion?: string | null;
}

/**
 * Cierra la baja con su alta y avisa a todo el mundo.
 *
 * `quien` es el trabajador que la comunica. El aviso a RRHH sale por las DOS
 * vías (programa y correo) a propósito: una reincorporación cambia el cuadrante
 * del día siguiente y no puede depender de que alguien mire la campana.
 */
export async function comunicarAltaMedica(args: {
  solicitudId: string;
  altaIso: string;
  quien: { userId: string; nombre: string };
}): Promise<ResultadoAltaMedica> {
  const admin = createAdminClient();

  const { data: sol } = await admin
    .from("solicitudes_personal")
    .select("id, empresa_id, user_id, empleado_nombre, subtipo, estado, fecha_inicio, fecha_fin, alta_medica_comunicada_en")
    .eq("id", args.solicitudId)
    .maybeSingle();
  if (!sol) return { ok: false, error: "Solicitud no encontrada" };
  if (sol.subtipo !== "baja_medica" || sol.estado !== "aprobada") {
    return { ok: false, error: "Esta solicitud no es una baja médica aprobada." };
  }
  if (sol.alta_medica_comunicada_en) {
    return { ok: false, error: "El alta de esta baja ya está comunicada." };
  }
  // Quien comunica el alta es el propio trabajador de la baja, nadie más.
  if (sol.user_id !== args.quien.userId) {
    return { ok: false, error: "Solo el trabajador de esta baja puede comunicar su alta." };
  }

  const empresaId = sol.empresa_id as string;
  const fechaInicio = sol.fecha_inicio as string;
  if (args.altaIso < fechaInicio) {
    return {
      ok: false,
      error: `El alta no puede ser anterior al primer día de la baja (${fechaEs(fechaInicio)}).`,
    };
  }
  // Un parte de alta se comunica cuando te lo dan, no con meses de antelación.
  // El tope evita que un dedazo en el año cierre la baja en 2030.
  const tope = sumarDias(new Date().toISOString().slice(0, 10), 90);
  if (args.altaIso > tope) {
    return { ok: false, error: "Esa fecha de alta está demasiado lejos. Revísala." };
  }

  const { data: emp } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, dni_nie, numero_ss, telefono, puesto, locales!empleados_centro_id_fkey(nombre, direccion, ciudad, provincia, codigo_postal, ccc, tipo_establecimiento, clase_restaurante, convenio)")
    .eq("empresa_id", empresaId)
    .eq("user_id", sol.user_id as string)
    .maybeSingle();
  if (!emp) return { ok: false, error: "No se encontró tu ficha en esta empresa." };

  const nombre =
    `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() ||
    (sol.empleado_nombre as string | null) ||
    args.quien.nombre;

  const reincorporacion = await calcularReincorporacion(
    admin as unknown as SupabaseClient,
    empresaId,
    emp.id as string,
    args.altaIso,
  );

  // La baja cubre hasta el día ANTERIOR al alta: el día del alta ya está
  // disponible, aunque su turno no empiece hasta más adelante.
  const ultimoDiaBaja = sumarDias(args.altaIso, -1);
  const fechaFinBaja = ultimoDiaBaja < fechaInicio ? fechaInicio : ultimoDiaBaja;

  const { error: updErr } = await admin
    .from("solicitudes_personal")
    .update({
      alta_medica_fecha: args.altaIso,
      alta_medica_comunicada_en: new Date().toISOString(),
      alta_medica_reincorporacion: reincorporacion,
      // La fecha estimada se sustituye por la REAL: el calendario deja de pintar
      // en rojo desde aquí, sin que nadie lo corrija a mano.
      fecha_fin: fechaFinBaja,
    })
    .eq("id", sol.id as string);
  if (updErr) return { ok: false, error: updErr.message };

  const { data: empresaRow } = await admin
    .from("empresas")
    .select("nombre, datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  const empresaNombre = (empresaRow?.nombre as string | undefined) ?? "la empresa";

  const datos = {
    solicitudId: sol.id as string,
    empresaId,
    empresaNombre,
    nombre,
    dniNie: (emp.dni_nie as string | null) ?? null,
    numeroSs: (emp.numero_ss as string | null) ?? null,
    puesto: (emp.puesto as string | null) ?? null,
    local: localDe(emp),
    empresaRow: empresaRow ?? null,
    fechaInicio,
    altaIso: args.altaIso,
    reincorporacion,
  };

  // Los avisos no bloquean: el alta ya está registrada y su calendario corregido.
  await avisarRrhh(admin, datos).catch((e) =>
    console.error("[alta-medica] aviso a RRHH:", e),
  );
  await avisarGestoria(admin, datos).catch((e) =>
    console.error("[alta-medica] aviso a gestoría:", e),
  );

  return { ok: true, reincorporacion };
}

interface DatosAlta {
  solicitudId: string;
  empresaId: string;
  empresaNombre: string;
  nombre: string;
  dniNie: string | null;
  numeroSs: string | null;
  puesto: string | null;
  local: LocalParaGestoria | null;
  empresaRow: { nombre?: string | null; datos_generales?: unknown } | null;
  fechaInicio: string;
  altaIso: string;
  reincorporacion: string | null;
}

/** Cuándo vuelve, en una frase. Es el dato que a RRHH le cambia el cuadrante. */
function fraseReincorporacion(d: DatosAlta): string {
  return d.reincorporacion
    ? `Se reincorpora el ${fechaEs(d.reincorporacion)}`
    : "No tiene turnos asignados: hay que decidir a mano cuándo se reincorpora";
}

/**
 * RRHH lo recibe por las DOS vías. Una reincorporación cambia el cuadrante del
 * día siguiente: no puede depender de que alguien mire la campana a tiempo.
 */
async function avisarRrhh(admin: SupabaseClient, d: DatosAlta): Promise<void> {
  const titulo = `Alta médica: ${d.nombre}`;
  const mensaje =
    `${d.nombre} ha comunicado su alta médica con fecha ${fechaEs(d.altaIso)}. ` +
    `${fraseReincorporacion(d)}.`;

  // 1) Dentro del programa.
  const { emitirNotificacion } = await import(
    "@/features/notificaciones/actions/notificaciones-actions"
  );
  await emitirNotificacion({
    system: true,
    empresaId: d.empresaId,
    segmento: { tipo: "rol", rolLabel: "RECURSOS HUMANOS" },
    tipo: "info",
    titulo,
    mensaje,
    refTabla: "solicitudes_personal",
    refId: d.solicitudId,
    accionUrl: "/rrhh/solicitudes",
    accionLabel: "Ver solicitud",
    dedupeKey: `alta_medica:${d.solicitudId}`,
  });

  await registrarComunicacion({
    empresaId: d.empresaId,
    refTabla: "solicitudes_personal",
    refId: d.solicitudId,
    via: "notificacion",
    asunto: titulo,
    destinatario: "Recursos Humanos",
    automatico: true,
    enviadoPorNombre: d.nombre,
  });

  // 2) Por correo.
  const { resolverDestinatario } = await import(
    "@/features/rrhh/services/email-plantillas/resolver"
  );
  const dst = await resolverDestinatario(admin, d.empresaId, "departamento", "correoRrhh", null);
  if (!dst.to) {
    console.warn("[alta-medica] sin correo de RRHH en Ajustes para", d.empresaId);
    return;
  }

  const subject = `${d.empresaNombre} · Alta médica: ${d.nombre}`;
  const html = `
    <h1 style="margin:0 0 4px 0;font-size:21px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">Alta médica</h1>
    <p style="margin:0 0 16px 0;font-size:12.5px;color:#64748b;">${escapeHtml(d.empresaNombre)}</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.62;color:#334155;">
      <strong>${escapeHtml(d.nombre)}</strong> ha comunicado su alta médica. Su baja queda cerrada.
    </p>
    ${tarjeta(
      "El alta",
      [
        fila("Fecha del alta", fechaEs(d.altaIso)),
        fila("Primer día de la baja", fechaEs(d.fechaInicio)),
        fila(
          "Se reincorpora",
          d.reincorporacion ? fechaEs(d.reincorporacion) : "Sin turnos asignados",
        ),
        fila("Puesto", d.puesto),
        fila("Centro de trabajo", d.local?.nombre ?? null),
      ].join(""),
    )}
    ${
      d.reincorporacion
        ? `<p style="margin:0 0 14px 0;font-size:13.5px;line-height:1.6;color:#334155;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;">Contad con ${escapeHtml(d.nombre)} en el cuadrante a partir del <strong>${fechaEs(d.reincorporacion)}</strong>, que es el primer día que le toca turno.</p>`
        : `<p style="margin:0 0 14px 0;font-size:13.5px;line-height:1.6;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;">⚠️ No tiene turnos asignados en los próximos dos meses, así que no se ha podido calcular cuándo vuelve. Hay que decidirlo a mano.</p>`
    }
    <p style="border-top:1px solid #eef2f7;margin-top:18px;padding-top:14px;font-size:11.5px;color:#94a3b8;line-height:1.6;">Correo automático de ${escapeHtml(d.empresaNombre)}. No respondáis a esta dirección.</p>`;

  const text = [
    "ALTA MÉDICA",
    d.empresaNombre,
    "",
    `${d.nombre} ha comunicado su alta médica. Su baja queda cerrada.`,
    "",
    `Fecha del alta: ${fechaEs(d.altaIso)}`,
    `Primer día de la baja: ${fechaEs(d.fechaInicio)}`,
    `Se reincorpora: ${d.reincorporacion ? fechaEs(d.reincorporacion) : "sin turnos asignados, hay que decidirlo a mano"}`,
    `Puesto: ${d.puesto ?? "—"}`,
    `Centro de trabajo: ${d.local?.nombre ?? "—"}`,
  ].join("\n");

  const res = await sendEmail({ to: dst.to, subject, html, text, empresaId: d.empresaId });
  await registrarComunicacion({
    empresaId: d.empresaId,
    refTabla: "solicitudes_personal",
    refId: d.solicitudId,
    via: "email",
    asunto: subject,
    destinatario: "Recursos Humanos",
    destinoEmail: dst.to,
    estado: res.ok ? "enviado" : "fallido",
    error: res.ok ? null : "No se pudo enviar",
    automatico: true,
    enviadoPorNombre: d.nombre,
  });
}

/** El alta a la gestoría: mismo formato que la baja, pero cerrándola. */
async function avisarGestoria(admin: SupabaseClient, d: DatosAlta): Promise<void> {
  const { resolverDestinatario } = await import(
    "@/features/rrhh/services/email-plantillas/resolver"
  );
  const dst = await resolverDestinatario(
    admin,
    d.empresaId,
    "departamento",
    "correoGestoria",
    null,
  );

  const subject = `${d.empresaNombre} · Alta médica a tramitar: ${d.nombre}`;

  if (!dst.to) {
    await registrarComunicacion({
      empresaId: d.empresaId,
      refTabla: "solicitudes_personal",
      refId: d.solicitudId,
      via: "email",
      asunto: subject,
      destinatario: DESTINATARIO_GESTORIA,
      estado: "fallido",
      error: "Sin correo de gestoría configurado en Ajustes → Empresa.",
      automatico: true,
      enviadoPorNombre: d.nombre,
    });
    return;
  }

  const fiscales = camposFiscalesEmpresa(
    (d.empresaRow?.datos_generales ?? null) as Partial<DatosGenerales> | null,
    d.empresaRow?.nombre ?? undefined,
  );
  const centro = camposCentroTrabajo(d.local);
  const aTexto = (c: CampoGestoria[]) => c.map((x) => `${x.label}: ${x.value}`).join("\n");

  const html = `
    <h1 style="margin:0 0 4px 0;font-size:21px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">Alta médica a tramitar</h1>
    <p style="margin:0 0 16px 0;font-size:12.5px;color:#64748b;">${escapeHtml(d.empresaNombre)}</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.62;color:#334155;">
      Un trabajador de <strong>${escapeHtml(d.empresaNombre)}</strong> ha comunicado su <strong>alta médica</strong>.
      Os trasladamos los datos para que procedáis a su tramitación. Cierra la baja que os comunicamos el ${fechaEs(d.fechaInicio)}.
    </p>
    ${tarjeta(
      "Datos del alta",
      [
        fila("Fecha del alta", fechaEs(d.altaIso)),
        fila("Primer día de la baja", fechaEs(d.fechaInicio)),
        fila(
          "Se reincorpora",
          d.reincorporacion ? fechaEs(d.reincorporacion) : "Pendiente de asignar turno",
        ),
      ].join(""),
    )}
    ${tarjeta(
      "Trabajador",
      [
        fila("Nombre", d.nombre),
        fila("DNI / NIE", d.dniNie),
        fila("Nº Seguridad Social", d.numeroSs),
        fila("Puesto", d.puesto),
        fila("Centro de trabajo", d.local?.nombre ?? null),
      ].join(""),
    )}
    <div style="border-top:1px solid #eef2f7;margin-top:22px;padding-top:4px;">
      <details>
        <summary style="cursor:pointer;padding:10px 0;font-size:12px;color:#94a3b8;">Datos de la empresa y del centro de trabajo</summary>
        ${tablaTenue("Datos fiscales", fiscales)}
        ${tablaTenue("Centro de trabajo", centro)}
      </details>
    </div>
    <p style="border-top:1px solid #eef2f7;margin-top:18px;padding-top:14px;font-size:11.5px;color:#94a3b8;line-height:1.6;">Correo automático de ${escapeHtml(d.empresaNombre)}. No respondáis a esta dirección: para cualquier duda escribid a Recursos Humanos.</p>`;

  const text = [
    "ALTA MÉDICA A TRAMITAR",
    d.empresaNombre,
    "",
    `Fecha del alta: ${fechaEs(d.altaIso)}`,
    `Primer día de la baja: ${fechaEs(d.fechaInicio)}`,
    `Se reincorpora: ${d.reincorporacion ? fechaEs(d.reincorporacion) : "pendiente de asignar turno"}`,
    "",
    `Trabajador: ${d.nombre}`,
    `DNI/NIE: ${d.dniNie ?? "—"}`,
    `Nº Seguridad Social: ${d.numeroSs ?? "—"}`,
    `Puesto: ${d.puesto ?? "—"}`,
    `Centro de trabajo: ${d.local?.nombre ?? "—"}`,
    "",
    `DATOS FISCALES\n${aTexto(fiscales)}`,
    "",
    `CENTRO DE TRABAJO\n${aTexto(centro)}`,
  ].join("\n");

  const res = await sendEmail({ to: dst.to, subject, html, text, empresaId: d.empresaId });
  await registrarComunicacion({
    empresaId: d.empresaId,
    refTabla: "solicitudes_personal",
    refId: d.solicitudId,
    via: "email",
    asunto: subject,
    destinatario: DESTINATARIO_GESTORIA,
    destinoEmail: dst.to,
    estado: res.ok ? "enviado" : "fallido",
    error: res.ok ? null : "No se pudo enviar",
    automatico: true,
    enviadoPorNombre: d.nombre,
  });
}
