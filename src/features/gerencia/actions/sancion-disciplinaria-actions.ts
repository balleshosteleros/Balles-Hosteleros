"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentidadEmpresa } from "@/features/empresa/services/identidad-empresa";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { sha256, generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento } from "@/features/rrhh/services/firmas/audit";
import { enviarInvitacionFirma } from "@/features/rrhh/services/firmas/email";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import {
  generarSancionPdf,
  GRAVEDAD_LABEL,
  type GravedadSancion,
} from "@/features/gerencia/services/sancion-disciplinaria-pdf";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { claveDiaEnZona, formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";

const BUCKET = "firmas";
const TIPO_DOC = "sancion_disciplinaria";

async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") || null };
}

async function requireAdmin(): Promise<{ userId: string; empresaId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "RECURSOS HUMANOS")) {
    throw new Error("Sin permisos: necesitas Recursos Humanos para emitir sanciones disciplinarias");
  }

  const { empresaId } = await getAppContext();
  if (!empresaId) throw new Error("Empresa no resuelta para el usuario actual");

  // No se devuelve el nombre a propósito: la sanción la impone la EMPRESA y en
  // ningún papel figura quién de la plantilla pulsó el botón. Para el registro
  // interno basta con `userId`, que es lo que se guarda en `enviado_por`.
  return { userId: user.id, empresaId };
}

/** Una línea con lo esencial de la sanción, para el listado y la ficha de firmas. */
function resumenSancion(input: SancionInput): string {
  const partes = [GRAVEDAD_LABEL[input.gravedad]];
  if (input.fechaHechos) partes.push(`hechos del ${fmtFechaEs(input.fechaHechos)}`);
  return partes.join(" · ");
}

function fmtFechaEs(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export interface SancionInput {
  empleadoId: string;
  gravedad: GravedadSancion;
  /** Obligatoria: el art. 58.2 ET exige hacer constar la fecha de los hechos. */
  fechaHechos: string;
  hechos: string;
  /**
   * El día que se emite. No se elige: es el día en que SALE, en la hora de la
   * empresa, y lo pone el servidor. Poner una fecha a mano y mandarla hoy solo
   * servía para que el papel dijera una cosa y el correo otra.
   */
  fechaEmision?: string;
  /** Días de plazo para firmar el acuse de recibo. */
  plazoDias?: number;
}

export type CrearSancionResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

/**
 * Emite una SANCIÓN DISCIPLINARIA: genera el PDF oficial, lo registra en el
 * pipeline de firmas (`firmas_documentos`, modalidad manuscrita) y avisa al
 * trabajador por email + notificación in-app para que lo firme como «leído».
 * Al firmar, el motor de firma archiva el PDF firmado en la carpeta de
 * documentos del empleado (categoría `sanciones`).
 */
export async function crearSancionDisciplinaria(
  input: SancionInput,
): Promise<CrearSancionResult> {
  try {
    const { userId, empresaId } = await requireAdmin();
    return await emitirSancion({ ...input, empresaId, emitidaPor: userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sancion] crearSancionDisciplinaria:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * El trabajo de emitir, sin preguntar quién lo pide.
 *
 * Vive aparte porque la sanción se emite por DOS caminos: cuando alguien pulsa
 * «Enviar», y cuando el cron publica una que estaba programada para hoy. El
 * segundo no tiene sesión de nadie, así que el permiso se comprueba fuera.
 *
 * `comunicadoId` es el comunicado que ya existe (el programado que acaba de
 * publicarse). Si no viene, se crea uno nuevo para que le salga al trabajador.
 */
export async function emitirSancion(
  input: SancionInput & {
    empresaId: string;
    emitidaPor: string | null;
    comunicadoId?: string;
  },
): Promise<CrearSancionResult> {
  try {
    const { empresaId } = input;
    const userId = input.emitidaPor;
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const empleadoId = (input.empleadoId ?? "").trim();
    if (!empleadoId) return { ok: false, error: "Falta el trabajador destinatario" };
    if (!input.hechos?.trim()) return { ok: false, error: "Describe los hechos que motivan la sanción" };
    // Sin fecha de los hechos la comunicación no cumple el art. 58.2 ET.
    if (!input.fechaHechos) return { ok: false, error: "Falta la fecha de los hechos" };

    // El día de emisión es HOY en la hora de la empresa, no la del navegador de
    // quien la escribe: un gerente en otro huso fechaba el papel en otro día.
    const tz = await getZonaHorariaEmpresa(admin, empresaId);
    const emitidaEn = new Date().toISOString();
    const fechaEmision = input.fechaEmision || claveDiaEnZona(emitidaEn, tz);
    const horaEmision = formatHoraEnZona(emitidaEn, tz);

    const plazoDias = Math.max(1, Math.min(60, Number(input.plazoDias ?? 15) || 15));

    // El selector de la pantalla trabaja con el id de USUARIO (el del acceso), y
    // la ficha del trabajador vive en `empleados` con su propio id. Son cosas
    // distintas y nunca coinciden, así que se acepta cualquiera de los dos: se
    // busca primero por la ficha y, si no aparece, por el usuario al que pertenece.
    const CAMPOS_EMPLEADO =
      "id, user_id, nombre, apellidos, dni_nie, puesto, email_empresa, email_personal, empresa_id, estado, departamentos!empleados_departamento_id_fkey ( nombre )";

    const { data: porFicha, error: empErr } = await admin
      .from("empleados")
      .select(CAMPOS_EMPLEADO)
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr) return { ok: false, error: "Trabajador no encontrado" };

    let emp = porFicha;
    if (!emp) {
      // Un mismo usuario puede tener ficha en varias empresas (espejos), así que
      // se acota a la empresa activa para quedarse con la que toca.
      const { data: porUsuario } = await admin
        .from("empleados")
        .select(CAMPOS_EMPLEADO)
        .eq("user_id", empleadoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      emp = porUsuario;
    }
    if (!emp) return { ok: false, error: "Trabajador no encontrado" };
    if (emp.empresa_id !== empresaId) return { ok: false, error: "El trabajador no pertenece a tu empresa" };
    if (emp.estado !== "Activo") return { ok: false, error: "El trabajador no está activo" };

    const destino = (emp.email_empresa as string | null) || (emp.email_personal as string | null);
    if (!destino) return { ok: false, error: "El trabajador no tiene email; añádelo antes de enviar" };

    // Quién sanciona sale de Ajustes → Empresa: razón social, NIF y domicilio.
    const empresa = await getIdentidadEmpresa(admin, empresaId);
    const empresaNombre = empresa.nombre;
    const empresaLogoUrl = empresa.marcaUrl;

    // A partir de aquí SIEMPRE el id de la ficha: `empleadoId` es lo que llegó de
    // la pantalla y puede ser el id del usuario, que no vale para guardar.
    const fichaId = emp.id as string;
    const empleadoNombre = `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim();
    const departamento =
      (emp as unknown as { departamentos?: { nombre?: string | null } | null }).departamentos?.nombre ?? null;

    // 1) Generar el PDF oficial de la sanción.
    const { bytes: pdfBytes, posicionFirma } = await generarSancionPdf({
      empresaNombre,
      empresaRazonSocial: empresa.razonSocial,
      empresaCif: empresa.cif,
      empresaDomicilio: empresa.domicilio,
      empleadoNombre: empleadoNombre || "Trabajador/a",
      empleadoDni: (emp.dni_nie as string | null) ?? null,
      puesto: (emp.puesto as string | null) ?? null,
      departamento,
      gravedad: input.gravedad,
      fechaHechos: input.fechaHechos,
      hechos: input.hechos.trim(),
      fechaEmision,
      horaEmision,
    });
    const pdfBuffer = Buffer.from(pdfBytes);
    const sha256Original = sha256(pdfBuffer);

    // La banda de firma la mide el propio generador: el motor estampa el trazo
    // justo en el recuadro, sea cual sea la página en la que acabe el documento.
    const posicionFirmaDefault = [posicionFirma];

    const titulo = `Sanción disciplinaria — ${empleadoNombre || "Trabajador/a"}`;
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + plazoDias * 86_400_000);

    // 2) Registrar el documento firmable.
    const { data: docIns, error: docErr } = await admin
      .from("firmas_documentos")
      .insert({
        empresa_id: empresaId,
        empleado_id: fichaId,
        titulo,
        tipo: TIPO_DOC,
        modalidad: "manuscrita_digital",
        validez: "eidas_simple",
        estado: "pendiente",
        pdf_original_path: "pending",
        sha256_original: sha256Original,
        enviado_por: userId,
        enviado_en: ahora.toISOString(),
        expira_en: expira.toISOString(),
        posicion_firma_default: posicionFirmaDefault,
        // Resumen en una línea: es lo que el listado usa para enseñar la
        // calificación de la falta sin abrir el PDF, y lo que se lee tal cual en
        // la ficha del documento dentro de RRHH → Firmas.
        observaciones: resumenSancion(input),
      })
      .select("id")
      .single();
    if (docErr || !docIns) {
      return { ok: false, error: docErr?.message ?? "No se pudo registrar la sanción" };
    }
    const documentoId = docIns.id as string;
    const path = `${empresaId}/${documentoId}/original.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, pdfBuffer, { upsert: false, contentType: "application/pdf" });
    if (upErr) {
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `Subida a Storage falló: ${upErr.message}` };
    }
    await admin.from("firmas_documentos").update({ pdf_original_path: path }).eq("id", documentoId);

    await registrarEvento({
      documentoId,
      tipo: "creado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { titulo, tipo: TIPO_DOC, gravedad: input.gravedad, sha256Original },
    });

    // 3) Token de firma de un solo uso.
    const token = generarToken();
    const { error: tokenErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: hashToken(token),
      expira_en: expira.toISOString(),
    });
    if (tokenErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `No se pudo crear el token: ${tokenErr.message}` };
    }

    // 4) Email de invitación (con tono de acuse de recibo) + notificación in-app.
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre: empleadoNombre || "Trabajador/a",
      tituloDocumento: titulo,
      // La sanción la impone la empresa: en el correo tampoco se señala a nadie.
      enviadoPor: empresaNombre,
      token,
      expiraEn: expira,
      asuntoOverride: `Comunicación de sanción disciplinaria — ${empresaNombre}`,
      introOverride:
        `Hola ${empleadoNombre || ""},\n\n` +
        `La dirección de ${empresa.razonSocial} te comunica una sanción disciplinaria. ` +
        `Debes firmar el documento como acuse de recibo (leído/informado). ` +
        `La firma NO implica conformidad: conservas tu derecho a impugnarla.`,
    });

    await registrarEvento({
      documentoId,
      tipo: "enviado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { destino, emailOk: sendResult.ok },
    });

    try {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
      await emitirNotificacion({
        empresaId,
        // El MISMO tipo y la misma clave de deduplicación que cualquier otro
        // documento firmable: así el aviso se marca solo al firmar y reenviar la
        // sanción no le deja dos avisos distintos de lo mismo en la bandeja.
        tipo: "firma_pendiente",
        // El aviso solo dice QUÉ es. Lo que hay que hacer con ella —firmarla
        // como acuse de recibo— se lee ya dentro, con el documento delante
        // (Iván, 12-09-2026): el aviso no es el sitio para exigir nada.
        titulo: "Sanción disciplinaria",
        mensaje: "Has recibido una comunicación de sanción disciplinaria.",
        segmento: { tipo: "empleados", empleadoIds: [fichaId] },
        accionLabel: "Leer",
        accionUrl: `${base}/firmar/${encodeURIComponent(token)}`,
        refTabla: "firmas_documentos",
        refId: documentoId,
        dedupeKey: `firma-${documentoId}`,
        system: true,
      });
    } catch (e) {
      console.error("[sancion] notificar:", e);
    }

    // 5) LA SANCIÓN LE SALE EN SUS COMUNICADOS. Es una comunicación de la
    // empresa y ahí es donde el trabajador las busca: se le deja publicada,
    // marcada con su tipo, y a él solo. No se avisa por esta vía —ni push ni
    // campana ni correo—: el aviso de firma que acaba de salir es el bueno, y
    // dos avisos de lo mismo son ruido.
    const userIdEmpleado = (emp.user_id as string | null) ?? null;
    if (userIdEmpleado && !input.comunicadoId) {
      const { error: comErr } = await admin.from("comunicados").insert({
        empresa_id: empresaId,
        titulo,
        cuerpo: input.hechos.trim(),
        estado: "publicado",
        tipo: "sancion",
        recurrencia: "sin_repeticion",
        toda_empresa: false,
        roles_destinatarios: [],
        empleados_destinatarios: [userIdEmpleado],
        departamentos_destinatarios: [],
        envio: ahora.toISOString(),
        adjuntos: [],
        enviar_email: false,
        creador_id: userId,
      });
      if (comErr) console.error("[sancion] comunicado del trabajador:", comErr.message);
    }

    revalidatePath("/gerencia/comunicados");
    return { ok: true, documentoId, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sancion] emitirSancion:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * DEJAR UNA SANCIÓN PROGRAMADA. No se emite nada todavía: se guarda como un
 * comunicado de tipo sanción en estado `programado`, con la falta, el día de
 * los hechos y el plazo de firma esperando en su sitio. El día y la hora que
 * se haya puesto, el cron de comunicados lo publica y ES ENTONCES cuando se
 * monta el documento y le llega al trabajador.
 *
 * Con `comunicadoId` se reescribe una que ya estaba programada.
 */
export async function programarSancion(input: {
  comunicadoId?: string;
  empleadoId: string;
  gravedad: GravedadSancion;
  fechaHechos: string;
  hechos: string;
  plazoDias?: number;
  /** Cuándo tiene que salir, en UTC. */
  envio: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { userId, empresaId } = await requireAdmin();
    const admin = createAdminClient();

    if (!input.empleadoId) return { ok: false, error: "Falta el trabajador destinatario" };
    if (!input.hechos?.trim()) return { ok: false, error: "Describe los hechos que motivan la sanción" };
    if (!input.fechaHechos) return { ok: false, error: "Falta la fecha de los hechos" };
    if (!input.envio) return { ok: false, error: "Falta el día en que tiene que salir" };

    // El destinatario se guarda por su USUARIO, que es lo que mira el panel del
    // trabajador. El selector ya trabaja con él, pero puede llegar el id de la
    // ficha: se acepta cualquiera de los dos.
    const { data: porUsuario } = await admin
      .from("empleados")
      .select("id, user_id, nombre, apellidos, estado, empresa_id")
      .eq("user_id", input.empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const { data: porFicha } = porUsuario
      ? { data: null }
      : await admin
          .from("empleados")
          .select("id, user_id, nombre, apellidos, estado, empresa_id")
          .eq("id", input.empleadoId)
          .eq("empresa_id", empresaId)
          .maybeSingle();
    const emp = porUsuario ?? porFicha;
    if (!emp) return { ok: false, error: "Trabajador no encontrado" };
    if (emp.estado !== "Activo") return { ok: false, error: "El trabajador no está activo" };
    const userIdEmpleado = emp.user_id as string | null;
    if (!userIdEmpleado) {
      return { ok: false, error: "El trabajador no tiene acceso al software; no se le puede programar una sanción" };
    }

    const fila = {
      empresa_id: empresaId,
      titulo: `Sanción disciplinaria — ${`${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "Trabajador/a"}`,
      cuerpo: input.hechos.trim(),
      estado: "programado",
      tipo: "sancion",
      recurrencia: "sin_repeticion",
      toda_empresa: false,
      roles_destinatarios: [],
      empleados_destinatarios: [userIdEmpleado],
      departamentos_destinatarios: [],
      envio: input.envio,
      adjuntos: [],
      enviar_email: false,
      creador_id: userId,
      sancion: {
        gravedad: input.gravedad,
        fechaHechos: input.fechaHechos,
        plazoDias: Math.max(1, Math.min(60, Number(input.plazoDias ?? 15) || 15)),
      },
    };

    const { data, error } = input.comunicadoId
      ? await admin.from("comunicados").update(fila).eq("id", input.comunicadoId).select("id").single()
      : await admin.from("comunicados").insert(fila).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo programar la sanción" };

    revalidatePath("/gerencia/comunicados");
    return { ok: true, id: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sancion] programarSancion:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * La empresa tal y como va a salir IMPRESA en la sanción, para que la
 * previsualización enseñe lo mismo que el PDF y no el rótulo del local.
 * Sale de Ajustes → Empresa.
 */
export async function getEmpresaDeLaSancion(): Promise<
  | { ok: true; data: { nombre: string; razonSocial: string; cif: string | null; domicilio: string | null } }
  | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const e = await getIdentidadEmpresa(supabase, empresaId);
    return {
      ok: true,
      data: { nombre: e.nombre, razonSocial: e.razonSocial, cif: e.cif, domicilio: e.domicilio },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export interface SancionResumen {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  /** Calificación de la falta, si se puede leer del resumen guardado. */
  gravedad: GravedadSancion | null;
  /** Resumen de una línea: calificación · fecha de los hechos. */
  resumen: string;
  estado: string;
  enviadoEn: string;
  expiraEn: string;
  firmadoEn: string | null;
  /**
   * Cuándo la ABRIÓ el trabajador (null = todavía no la ha abierto).
   *
   * Una sanción va a una sola persona, pero se persigue igual que cualquier
   * comunicado: hace falta saber si la ha leído (Iván, 12-09-2026). Sale del
   * acta del documento, que es lo único que lo prueba.
   */
  vistoEl: string | null;
}

/** Recupera la calificación de la falta del resumen guardado en `observaciones`. */
function gravedadDelResumen(resumen: string | null): GravedadSancion | null {
  const primera = (resumen ?? "").split("·")[0]?.trim().toLowerCase();
  if (!primera) return null;
  const par = (Object.entries(GRAVEDAD_LABEL) as [GravedadSancion, string][]).find(
    ([, label]) => label.toLowerCase() === primera,
  );
  return par?.[0] ?? null;
}

/**
 * Cuándo abrió el trabajador cada sanción, de su acta.
 *
 * Vale cualquiera de las tres huellas de que la tuvo delante: la abrió
 * (`abierto`), la dio por leída sin firmar (`leido`) o la firmó (`firmado`).
 * Se queda la PRIMERA de todas: interesa cuándo la vio por primera vez.
 */
async function aperturasDeSanciones(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  documentoIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (documentoIds.length === 0) return out;
  const { data, error } = await supabase
    .from("firmas_eventos")
    .select("documento_id, ocurrido_en")
    .in("documento_id", documentoIds)
    .in("tipo", ["abierto", "leido", "firmado"])
    .order("ocurrido_en", { ascending: true });
  if (error) {
    console.error("[sancion] aperturas:", error.message);
    return out;
  }
  for (const row of (data ?? []) as { documento_id: string; ocurrido_en: string }[]) {
    if (!out.has(row.documento_id)) out.set(row.documento_id, row.ocurrido_en);
  }
  return out;
}

/** Lista las sanciones disciplinarias emitidas por la empresa. */
export async function listSancionesDisciplinarias(): Promise<
  { ok: true; data: SancionResumen[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("firmas_documentos")
      .select(`
        id, estado, empleado_id, enviado_en, expira_en, firmado_en, observaciones,
        empleados!firmas_documentos_empleado_id_fkey ( nombre, apellidos, departamentos!empleados_departamento_id_fkey ( nombre ) )
      `)
      .eq("empresa_id", empresaId)
      .eq("tipo", TIPO_DOC)
      .order("enviado_en", { ascending: false });
    if (error) throw error;

    type Row = {
      id: string;
      estado: string;
      empleado_id: string;
      enviado_en: string;
      expira_en: string;
      firmado_en: string | null;
      observaciones: string | null;
      empleados: { nombre: string | null; apellidos: string | null; departamentos: { nombre: string | null } | null } | null;
    };
    const rows = data as unknown as Row[];
    const abiertaEn = await aperturasDeSanciones(supabase, rows.map((r) => r.id));
    const items: SancionResumen[] = rows.map((r) => ({
      id: r.id,
      empleadoId: r.empleado_id,
      empleadoNombre: `${r.empleados?.nombre ?? ""} ${r.empleados?.apellidos ?? ""}`.trim() || "—",
      departamento: r.empleados?.departamentos?.nombre ?? "—",
      gravedad: gravedadDelResumen(r.observaciones),
      resumen: r.observaciones ?? "",
      estado: r.estado,
      enviadoEn: r.enviado_en,
      expiraEn: r.expira_en,
      firmadoEn: r.firmado_en,
      // Si la firmó, la vio: el acta lo dice, pero la fecha de firma es la
      // prueba definitiva cuando el evento de apertura no se pudo grabar.
      vistoEl: abiertaEn.get(r.id) ?? r.firmado_en,
    }));
    return { ok: true, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error listando sanciones";
    console.error("[sancion] listSancionesDisciplinarias:", msg);
    return { ok: false, error: msg };
  }
}
