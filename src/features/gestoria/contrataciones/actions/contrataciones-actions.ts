"use server";

/**
 * Visor de CONTRATACIONES (Gestoría) — lectura, salvo el reenvío del alta.
 *
 * LEE el histórico de lo que RRHH ya ha comunicado a la gestoría. La fuente de
 * verdad es RRHH; esta pantalla es un espejo para que la gestoría (que entra
 * como una usuaria más con acceso al departamento) vea todo lo que se le ha
 * mandado.
 *
 * ÚNICA escritura: `reenviarAltaGestoria`, reservada a quien puede editar RRHH
 * (la gestoría no la ve). Es el único punto de reintento cuando el correo del
 * alta no llegó a salir — ver el comentario de esa función.
 *
 * Fuentes reales por tipo:
 *   · altas          → `gestoria_contrato_tokens` + ficha/condiciones del empleado
 *   · bajas          → `gestoria_bajas`
 *   · modificaciones → `empleado_promociones` (avisadas: gestoria_enviado_at)
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContratacionRow,
  MotivoPendiente,
  TipoContratacion,
} from "@/features/gestoria/contrataciones/types";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

/** Nombre completo a partir de la ficha (o el copiado en el histórico). */
function nombreDe(nombre: unknown, apellidos: unknown): string {
  return `${(nombre as string) ?? ""} ${(apellidos as string) ?? ""}`.trim();
}

/**
 * Marca de PELIGRO: el trámite sigue pendiente y su fecha clave ya llegó o pasó.
 *
 * Es el caso que pidió Iván: un alta cuyo contrato no está cerrado y el
 * trabajador ya empieza HOY (o empezó) — trabaja sin contrato firmado. Se
 * compara contra «hoy» en la zona horaria de la empresa, no la del servidor.
 */
function calcularAviso(
  pendiente: boolean,
  fechaEvento: string | null,
  hoy: string,
  textos: { hoy: string; pasado: string },
): { aviso: "ninguno" | "peligro"; aviso_texto: string | null } {
  if (!pendiente || !fechaEvento) return { aviso: "ninguno", aviso_texto: null };
  if (fechaEvento > hoy) return { aviso: "ninguno", aviso_texto: null };
  return {
    aviso: "peligro",
    aviso_texto: fechaEvento === hoy ? textos.hoy : textos.pasado,
  };
}

/**
 * Histórico completo de lo enviado a la gestoría, ya resuelto y ordenado
 * (lo más reciente primero). Se devuelven los tres tipos juntos; la vista los
 * separa por pestañas.
 */
export async function listContrataciones(): Promise<{
  ok: boolean;
  data: ContratacionRow[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "Sin empresa" };

    const tz = await getZonaHorariaEmpresa(supabase as unknown as SupabaseClient, empresaId);
    const hoy = hoyEnZona(tz);

    const [altas, bajas, modificaciones] = await Promise.all([
      listAltas(supabase, empresaId, hoy),
      listBajas(supabase, empresaId, hoy),
      listModificaciones(supabase, empresaId),
    ]);

    const data = [...altas, ...bajas, ...modificaciones].sort((a, b) =>
      a.enviado_en < b.enviado_en ? 1 : a.enviado_en > b.enviado_en ? -1 : 0,
    );
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/**
 * ALTAS. Una fila por alta enviada (`gestoria_contrato_tokens`). El estado sigue
 * el circuito del documento: la gestoría sube el contrato → el trabajador firma.
 *   · correcto  → contrato subido Y firmado
 *   · pendiente → falta el contrato de la gestoría, o falta la firma, o el
 *                 enlace de subida caducó sin que subieran nada
 */
async function listAltas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  hoy: string,
): Promise<ContratacionRow[]> {
  const { data, error } = await supabase
    .from("gestoria_contrato_tokens")
    .select("id, empleado_id, alta_enviada_en, expira_en, contrato_subido_en, firma_documento_id")
    .eq("empresa_id", empresaId)
    .order("alta_enviada_en", { ascending: false });
  if (error) throw error;
  const filas = data ?? [];

  // Altas que NUNCA se comunicaron: empleados con ficha creada desde
  // Reclutamiento pero sin token de subida. El token se crea al enviar el alta,
  // así que su ausencia significa que el correo no llegó a salir (o que se
  // borró tras fallar el envío). Sin esto quedaban INVISIBLES aquí: el trámite
  // no existía para nadie y nadie podía reintentarlo.
  const sinEnviar = await listAltasNuncaEnviadas(
    supabase,
    empresaId,
    hoy,
    new Set(filas.map((f) => f.empleado_id as string).filter(Boolean)),
  );

  if (filas.length === 0) return sinEnviar;

  const empleadoIds = Array.from(new Set(filas.map((f) => f.empleado_id as string).filter(Boolean)));
  const firmaIds = filas.map((f) => f.firma_documento_id as string | null).filter(Boolean) as string[];

  // Ficha del trabajador, primer día pactado (condiciones vigentes) y estado de
  // la firma. Todo en lote, para no disparar una consulta por fila.
  const [empleadosRes, condicionesRes, firmasRes] = await Promise.all([
    empleadoIds.length
      ? supabase.from("empleados").select("id, nombre, apellidos, dni_nie, puesto, fecha_alta").in("id", empleadoIds)
      : Promise.resolve({ data: [], error: null }),
    empleadoIds.length
      ? supabase
          .from("empleado_condiciones")
          .select("empleado_id, primer_dia, vigente_hasta, vigente_desde")
          .in("empleado_id", empleadoIds)
          .order("vigente_desde", { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [], error: null }),
    firmaIds.length
      ? supabase.from("firmas_documentos").select("id, estado").in("id", firmaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const empleados = new Map(
    (empleadosRes.data ?? []).map((e) => [(e as Record<string, unknown>).id as string, e as Record<string, unknown>]),
  );
  // Primer día = fila VIGENTE de condiciones (`vigente_hasta IS NULL`), que es el
  // criterio del histórico en RRHH. Si el empleado no tiene ninguna vigente (alta
  // antigua / manual), vale la más reciente. Las filas vienen ordenadas por
  // `vigente_desde` DESC, así que la primera de cada empleado es la más reciente:
  // una vigente SIEMPRE gana, y entre no vigentes gana la primera vista.
  const primerDia = new Map<string, string | null>();
  const tieneVigente = new Set<string>();
  for (const c of (condicionesRes.data ?? []) as Array<Record<string, unknown>>) {
    const empId = c.empleado_id as string;
    const vigente = c.vigente_hasta == null;
    if (tieneVigente.has(empId)) continue; // ya fijada por su fila vigente
    if (vigente || !primerDia.has(empId)) {
      primerDia.set(empId, (c.primer_dia as string | null) ?? null);
      if (vigente) tieneVigente.add(empId);
    }
  }
  const firmas = new Map(
    (firmasRes.data ?? []).map((f) => [
      (f as Record<string, unknown>).id as string,
      (f as Record<string, unknown>).estado as string,
    ]),
  );

  return [...sinEnviar, ...filas.map((f) => {
    const empId = f.empleado_id as string;
    const emp = empleados.get(empId);
    const subido = f.contrato_subido_en != null;
    const estadoFirma = f.firma_documento_id ? firmas.get(f.firma_documento_id as string) : null;
    const firmado = estadoFirma === "firmado";
    const caducado = !subido && new Date(f.expira_en as string).getTime() < Date.now();

    let pendienteDe: MotivoPendiente | null = null;
    if (!subido) pendienteDe = caducado ? "enlace_caducado" : "contrato_gestoria";
    else if (!firmado) pendienteDe = "firma_trabajador";

    const pendiente = pendienteDe !== null;
    // Día de comienzo: el pactado en condiciones; si no hay, el alta de la ficha.
    const fechaEvento = primerDia.get(empId) ?? (emp?.fecha_alta as string | null) ?? null;

    return {
      id: f.id as string,
      tipo: "alta" as TipoContratacion,
      empleado_id: empId ?? null,
      nombre: nombreDe(emp?.nombre, emp?.apellidos) || "Trabajador",
      dni_nie: (emp?.dni_nie as string | null) ?? null,
      puesto: (emp?.puesto as string | null) ?? null,
      enviado_en: f.alta_enviada_en as string,
      fecha_evento: fechaEvento,
      estado: pendiente ? ("pendiente" as const) : ("correcto" as const),
      pendiente_de: pendienteDe,
      ...calcularAviso(pendiente, fechaEvento, hoy, {
        hoy: "Empieza HOY y el contrato sigue sin cerrar",
        pasado: "Ya ha empezado a trabajar y el contrato sigue sin cerrar",
      }),
    };
  })];
}

/**
 * Altas que NUNCA llegaron a comunicarse a la gestoría.
 *
 * El alta se envía una sola vez, dentro del flujo de contratación, y el token de
 * subida se crea en ese mismo envío. Un empleado promovido desde Reclutamiento
 * SIN token es, por tanto, un alta que no salió: el caso real fue el guard de
 * enlaces bloqueando el correo porque se lanzó desde una copia local y el botón
 * apuntaba a `localhost`.
 *
 * Antes estas altas no aparecían en ninguna parte — ni pendientes ni nada — y el
 * trámite se quedaba muerto en silencio. Ahora salen como pendientes por
 * `email_fallido`, con su botón de reenvío.
 */
async function listAltasNuncaEnviadas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  hoy: string,
  conToken: Set<string>,
): Promise<ContratacionRow[]> {
  // Candidatos ya promovidos a empleado: es el momento en que el alta debía salir.
  const { data, error } = await supabase
    .from("candidatos")
    .select("empleado_id, promovido_at")
    .eq("empresa_id", empresaId)
    .not("empleado_id", "is", null)
    .not("promovido_at", "is", null);
  if (error) throw error;

  const huerfanos = (data ?? [])
    .filter((c) => !conToken.has(c.empleado_id as string));
  if (huerfanos.length === 0) return [];

  const ids = huerfanos.map((c) => c.empleado_id as string);
  const [empleadosRes, condicionesRes] = await Promise.all([
    supabase.from("empleados").select("id, nombre, apellidos, dni_nie, puesto, fecha_alta").in("id", ids),
    supabase
      .from("empleado_condiciones")
      .select("empleado_id, primer_dia, vigente_hasta, vigente_desde")
      .in("empleado_id", ids)
      .order("vigente_desde", { ascending: false, nullsFirst: false }),
  ]);

  const empleados = new Map(
    (empleadosRes.data ?? []).map((e) => [(e as Record<string, unknown>).id as string, e as Record<string, unknown>]),
  );
  // Mismo criterio que en `listAltas`: gana la fila vigente; si no hay, la más reciente.
  const primerDia = new Map<string, string | null>();
  const tieneVigente = new Set<string>();
  for (const c of (condicionesRes.data ?? []) as Array<Record<string, unknown>>) {
    const empId = c.empleado_id as string;
    const vigente = c.vigente_hasta == null;
    if (tieneVigente.has(empId)) continue;
    if (vigente || !primerDia.has(empId)) {
      primerDia.set(empId, (c.primer_dia as string | null) ?? null);
      if (vigente) tieneVigente.add(empId);
    }
  }

  return huerfanos.map((c) => {
    const empId = c.empleado_id as string;
    const emp = empleados.get(empId);
    const fechaEvento = primerDia.get(empId) ?? (emp?.fecha_alta as string | null) ?? null;
    return {
      // No hay token: el id de la fila es el del empleado (único y estable aquí).
      id: `sin-envio-${empId}`,
      tipo: "alta" as TipoContratacion,
      empleado_id: empId,
      nombre: nombreDe(emp?.nombre, emp?.apellidos) || "Trabajador",
      dni_nie: (emp?.dni_nie as string | null) ?? null,
      puesto: (emp?.puesto as string | null) ?? null,
      // Se ordena por el momento de la contratación: es cuando debió comunicarse.
      enviado_en: c.promovido_at as string,
      fecha_evento: fechaEvento,
      estado: "pendiente" as const,
      pendiente_de: "email_fallido" as MotivoPendiente,
      ...calcularAviso(true, fechaEvento, hoy, {
        hoy: "Empieza HOY y la gestoría no ha recibido el alta",
        pasado: "Ya ha empezado a trabajar y la gestoría no ha recibido el alta",
      }),
    };
  });
}

/**
 * BAJAS. El estado sigue el documento que acredita oficialmente la baja: el
 * JUSTIFICANTE de la Seguridad Social (sistema RED), que la gestoría sube por su
 * enlace. El certificado de empresa (SEPE) es opcional y no bloquea.
 *   · correcto  → justificante recibido
 *   · pendiente → falta el justificante, o el aviso a la gestoría no salió
 *
 * El aviso fallido es el caso más grave: la gestoría puede no haberse enterado
 * de la baja y el trabajador seguiría de alta en la Seguridad Social.
 */
async function listBajas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  hoy: string,
): Promise<ContratacionRow[]> {
  const { data, error } = await supabase
    .from("gestoria_bajas")
    .select("id, empleado_id, nombre, dni_nie, puesto, tipo_baja_label, motivo, ultimo_dia, email_estado, enviado_en")
    .eq("empresa_id", empresaId)
    .order("enviado_en", { ascending: false });
  if (error) throw error;
  const filas = data ?? [];
  if (filas.length === 0) return [];

  // Documentos oficiales recibidos, por baja.
  const { data: docsData } = await supabase
    .from("gestoria_baja_doc_tokens")
    .select("baja_id, justificante_subido_en, certificado_subido_en")
    .eq("empresa_id", empresaId)
    .not("baja_id", "is", null);
  const docs = new Map(
    (docsData ?? []).map((d) => [
      (d as Record<string, unknown>).baja_id as string,
      d as Record<string, unknown>,
    ]),
  );

  return filas.map((b) => {
    const fallido = (b.email_estado as string) === "fallido";
    const ultimoDia = (b.ultimo_dia as string | null) ?? null;
    const doc = docs.get(b.id as string);
    const tieneJustificante = doc?.justificante_subido_en != null;

    // El aviso fallido manda sobre todo lo demás: sin correo no hay trámite.
    let pendienteDe: MotivoPendiente | null = null;
    if (fallido) pendienteDe = "email_fallido";
    else if (!tieneJustificante) pendienteDe = "justificante_baja";

    const pendiente = pendienteDe !== null;
    const aviso = fallido
      ? {
          aviso: "peligro" as const,
          aviso_texto:
            ultimoDia && ultimoDia <= hoy
              ? "El aviso NO salió y la baja ya es efectiva"
              : "El aviso a la gestoría NO salió",
        }
      : calcularAviso(pendiente, ultimoDia, hoy, {
          hoy: "La baja es HOY y falta el justificante de la Seguridad Social",
          pasado: "La baja ya pasó y sigue sin justificante de la Seguridad Social",
        });

    return {
      id: b.id as string,
      tipo: "baja" as TipoContratacion,
      empleado_id: (b.empleado_id as string | null) ?? null,
      nombre: (b.nombre as string) || "Trabajador",
      dni_nie: (b.dni_nie as string | null) ?? null,
      puesto: (b.puesto as string | null) ?? null,
      enviado_en: b.enviado_en as string,
      fecha_evento: ultimoDia,
      estado: pendiente ? ("pendiente" as const) : ("correcto" as const),
      pendiente_de: pendienteDe,
      tipo_baja_label: (b.tipo_baja_label as string | null) ?? null,
      motivo: (b.motivo as string | null) ?? null,
      ...aviso,
    };
  });
}

/**
 * MODIFICACIONES (promoción interna / cambio de puesto). Solo las que se han
 * comunicado a la gestoría (`gestoria_enviado_at`). Tampoco hay documento de
 * vuelta por parte de la gestoría, así que se dan por correctas al enviarse.
 */
async function listModificaciones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<ContratacionRow[]> {
  const { data, error } = await supabase
    .from("empleado_promociones")
    .select("id, empleado_id, puesto_origen_nombre, puesto_destino_nombre, primer_dia, gestoria_enviado_at")
    .eq("empresa_id", empresaId)
    .not("gestoria_enviado_at", "is", null)
    .order("gestoria_enviado_at", { ascending: false });
  if (error) throw error;
  const filas = data ?? [];
  if (filas.length === 0) return [];

  const empleadoIds = Array.from(new Set(filas.map((f) => f.empleado_id as string).filter(Boolean)));
  const { data: empleadosData } = empleadoIds.length
    ? await supabase.from("empleados").select("id, nombre, apellidos, dni_nie").in("id", empleadoIds)
    : { data: [] };
  const empleados = new Map(
    (empleadosData ?? []).map((e) => [(e as Record<string, unknown>).id as string, e as Record<string, unknown>]),
  );

  return filas.map((m) => {
    const emp = empleados.get(m.empleado_id as string);
    return {
      id: m.id as string,
      tipo: "modificacion" as TipoContratacion,
      empleado_id: (m.empleado_id as string | null) ?? null,
      nombre: nombreDe(emp?.nombre, emp?.apellidos) || "Trabajador",
      dni_nie: (emp?.dni_nie as string | null) ?? null,
      // El puesto que importa en un cambio es el NUEVO.
      puesto: (m.puesto_destino_nombre as string | null) ?? null,
      enviado_en: m.gestoria_enviado_at as string,
      fecha_evento: (m.primer_dia as string | null) ?? null,
      estado: "correcto" as const,
      pendiente_de: null,
      aviso: "ninguno" as const,
      aviso_texto: null,
      puesto_anterior: (m.puesto_origen_nombre as string | null) ?? null,
      puesto_nuevo: (m.puesto_destino_nombre as string | null) ?? null,
    };
  });
}

/**
 * REENVÍO del alta a la gestoría (única acción de escritura de esta pantalla).
 *
 * Existe porque el alta se envía UNA sola vez, dentro del flujo de contratación
 * (`contratarCandidato`, paso 7). Si ese correo no sale — el caso real: el alta
 * se lanzó desde una copia local y el guard de enlaces bloqueó el envío porque
 * el botón apuntaba a `localhost` — no había forma de reintentarlo: recontratar
 * está cerrado (`promovido_at` ya está puesto) y no existía ningún botón. El
 * trámite quedaba muerto y había que tocar la BD a mano.
 *
 * Solo lo ve y lo ejecuta quien puede EDITAR Recursos Humanos: la gestoría entra
 * a esta pantalla como usuaria de consulta y no debe poder auto-enviarse el alta.
 */
export async function reenviarAltaGestoria(
  empleadoId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const { permisos } = await getRolContext();
    if (!puedeEditarModulo(permisos, "RECURSOS HUMANOS")) {
      return { ok: false, error: "Sin permisos: necesitas Recursos Humanos para reenviar el alta." };
    }

    // El empleado debe ser de la empresa activa: el `empleadoId` viene del
    // cliente y no puede servir para enviar altas de otra empresa.
    const supabaseSrv = await createClient();
    const { data: emp } = await supabaseSrv
      .from("empleados")
      .select("id")
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "El trabajador no pertenece a esta empresa." };

    // `forzar`: el envío automático ya se dio por hecho una vez; este reenvío es
    // una acción manual y explícita, no debe depender del toggle de envío auto.
    const { enviarAltaGestoria } = await import("@/features/rrhh/actions/gestoria-actions");
    const res = await enviarAltaGestoria(empleadoId, { forzar: true });
    if (!res.ok) return { ok: false, error: res.error ?? "No se pudo reenviar el alta." };

    revalidatePath("/gestoria/contrataciones");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contrataciones] reenviarAlta:", msg);
    return { ok: false, error: msg };
  }
}
