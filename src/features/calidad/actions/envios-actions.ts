"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { calcularNota } from "@/features/calidad/lib/nota-auditoria";
import { crearNotificaciones } from "@/features/notificaciones/actions/notificaciones-actions";
import type {
  AuditoriaPregunta,
  AuditoriaRespuesta,
} from "@/features/calidad/types/auditorias";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export interface EnvioResumen {
  id: string;
  numero_secuencial: number;
  fecha: string;
  nota_final: number | null;
  estado: "borrador" | "enviada";
  plantilla_nombre: string;
  version: number;
  local_nombre: string;
  auditor_nombre: string;
}

export async function listEnvios(): Promise<EnvioResumen[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from("auditoria_envios")
    .select(`
      id, numero_secuencial, fecha, nota_final, estado,
      plantilla:auditoria_plantillas!auditoria_envios_plantilla_id_fkey(nombre),
      version:auditoria_plantilla_versiones!auditoria_envios_version_id_fkey(version),
      local:locales!auditoria_envios_local_id_fkey(nombre),
      auditor:empleados!auditoria_envios_auditor_empleado_id_fkey(nombre, apellidos)
    `)
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false });

  if (error || !data) {
    console.error("[auditorias] listEnvios:", error?.message);
    return [];
  }

  return data.map((e) => {
    const plantilla = Array.isArray(e.plantilla) ? e.plantilla[0] : e.plantilla;
    const version = Array.isArray(e.version) ? e.version[0] : e.version;
    const local = Array.isArray(e.local) ? e.local[0] : e.local;
    const auditor = Array.isArray(e.auditor) ? e.auditor[0] : e.auditor;
    return {
      id: e.id as string,
      numero_secuencial: e.numero_secuencial as number,
      fecha: e.fecha as string,
      nota_final: (e.nota_final as number | null) ?? null,
      estado: (e.estado as "borrador" | "enviada") ?? "enviada",
      plantilla_nombre: (plantilla?.nombre as string | undefined) ?? "—",
      version: (version?.version as number | undefined) ?? 1,
      local_nombre: (local?.nombre as string | undefined) ?? "—",
      auditor_nombre: auditor ? `${auditor.nombre ?? ""} ${auditor.apellidos ?? ""}`.trim() : "—",
    };
  });
}

/* ------------------------------------------------------------------ *
 * Detalle de una auditoría realizada
 * ------------------------------------------------------------------ */

export interface RespuestaDetalle {
  pregunta_id: string;
  numero_global: number;
  texto: string;
  tipo: AuditoriaPregunta["tipo"];
  escala_min: number | null;
  escala_max: number | null;
  etiqueta_min: string | null;
  etiqueta_max: string | null;
  peso: number;
  obligatoria: boolean;
  /** Opciones a elegir en las preguntas de tipo opción única/múltiple. */
  opciones: string[] | null;
  valor_numero: number | null;
  valor_texto: string | null;
  valor_opciones: string[] | null;
}

export interface SeccionDetalle {
  id: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  /** Nota media de la sección sobre 10 (null si no tiene escalas respondidas). */
  nota: number | null;
  respuestas: RespuestaDetalle[];
}

export interface EnvioDetalle extends EnvioResumen {
  plantilla_id: string;
  version_id: string;
  enviada_at: string | null;
  secciones: SeccionDetalle[];
}

export async function getEnvioDetalle(envioId: string): Promise<EnvioDetalle | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: envio, error } = await supabase
    .from("auditoria_envios")
    .select(`
      id, numero_secuencial, fecha, nota_final, estado, enviada_at,
      plantilla_id, version_id,
      plantilla:auditoria_plantillas!auditoria_envios_plantilla_id_fkey(nombre),
      version:auditoria_plantilla_versiones!auditoria_envios_version_id_fkey(version),
      local:locales!auditoria_envios_local_id_fkey(nombre),
      auditor:empleados!auditoria_envios_auditor_empleado_id_fkey(nombre, apellidos)
    `)
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !envio) {
    console.error("[auditorias] getEnvioDetalle:", error?.message);
    return null;
  }

  // Las preguntas viven en la VERSIÓN con la que se rellenó, no en la vigente.
  const { data: secciones } = await supabase
    .from("auditoria_secciones")
    .select("id, orden, titulo, descripcion")
    .eq("version_id", envio.version_id)
    .order("orden", { ascending: true });

  const seccionIds = (secciones ?? []).map((s) => s.id);
  const { data: preguntas } = seccionIds.length
    ? await supabase
        .from("auditoria_preguntas")
        .select("*")
        .in("seccion_id", seccionIds)
        .order("orden", { ascending: true })
    : { data: [] as AuditoriaPregunta[] };

  const { data: respuestas } = await supabase
    .from("auditoria_respuestas")
    .select("pregunta_id, valor_numero, valor_texto, valor_opciones")
    .eq("envio_id", envioId);

  const porPregunta = new Map<string, Pick<AuditoriaRespuesta, "valor_numero" | "valor_texto" | "valor_opciones">>();
  for (const r of respuestas ?? []) porPregunta.set(r.pregunta_id as string, r);

  const seccionesDetalle: SeccionDetalle[] = (secciones ?? []).map((s) => {
    const propias = (preguntas ?? []).filter((p) => p.seccion_id === s.id);
    // Cada escala se normaliza a 0..10 antes de promediar, por si la sección
    // llegase a mezclar escalas distintas (0..5 y 0..10).
    let suma = 0;
    let cuenta = 0;

    const detalle: RespuestaDetalle[] = propias.map((p) => {
      const r = porPregunta.get(p.id);
      const valorNumero = r?.valor_numero ?? null;
      const escalaMax = p.escala_max ?? 5;
      if (p.tipo === "escala" && valorNumero !== null && escalaMax > 0) {
        suma += (Number(valorNumero) / escalaMax) * 10;
        cuenta += 1;
      }
      return {
        pregunta_id: p.id,
        numero_global: p.numero_global,
        texto: p.texto,
        tipo: p.tipo,
        escala_min: p.escala_min,
        escala_max: p.escala_max,
        etiqueta_min: p.etiqueta_min,
        etiqueta_max: p.etiqueta_max,
        peso: Number(p.peso ?? 1),
        obligatoria: Boolean(p.obligatoria),
        opciones: (p.opciones as string[] | null) ?? null,
        valor_numero: valorNumero === null ? null : Number(valorNumero),
        valor_texto: r?.valor_texto ?? null,
        valor_opciones: (r?.valor_opciones as string[] | null) ?? null,
      };
    });

    return {
      id: s.id,
      orden: s.orden,
      titulo: s.titulo,
      descripcion: s.descripcion,
      nota: cuenta === 0 ? null : suma / cuenta,
      respuestas: detalle,
    };
  });

  const plantilla = Array.isArray(envio.plantilla) ? envio.plantilla[0] : envio.plantilla;
  const version = Array.isArray(envio.version) ? envio.version[0] : envio.version;
  const local = Array.isArray(envio.local) ? envio.local[0] : envio.local;
  const auditor = Array.isArray(envio.auditor) ? envio.auditor[0] : envio.auditor;

  return {
    id: envio.id as string,
    numero_secuencial: envio.numero_secuencial as number,
    fecha: envio.fecha as string,
    nota_final: (envio.nota_final as number | null) ?? null,
    estado: (envio.estado as "borrador" | "enviada") ?? "enviada",
    plantilla_id: envio.plantilla_id as string,
    version_id: envio.version_id as string,
    enviada_at: (envio.enviada_at as string | null) ?? null,
    plantilla_nombre: (plantilla?.nombre as string | undefined) ?? "—",
    version: (version?.version as number | undefined) ?? 1,
    local_nombre: (local?.nombre as string | undefined) ?? "—",
    auditor_nombre: auditor ? `${auditor.nombre ?? ""} ${auditor.apellidos ?? ""}`.trim() : "—",
    secciones: seccionesDetalle,
  };
}

/* ------------------------------------------------------------------ *
 * Hacer una auditoría
 * ------------------------------------------------------------------ */

/**
 * Datos para empezar una auditoría: la plantilla vigente y a quién/dónde se
 * puede auditar. Si no hay plantilla vigente no se puede auditar.
 */
export interface OpcionesNuevaAuditoria {
  plantilla: { id: string; nombre: string; version_id: string; version: number } | null;
  locales: Array<{ id: string; nombre: string }>;
  auditores: Array<{ id: string; nombre: string }>;
  /** Empleado del usuario que está usando el sistema, para venir preseleccionado. */
  auditorPorDefecto: string | null;
}

export async function getOpcionesNuevaAuditoria(): Promise<OpcionesNuevaAuditoria> {
  const { supabase, user, empresaId } = await ctx();
  const vacio: OpcionesNuevaAuditoria = { plantilla: null, locales: [], auditores: [], auditorPorDefecto: null };
  if (!user || !empresaId) return vacio;

  const { data: plantilla } = await supabase
    .from("auditoria_plantillas")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("es_vigente", true)
    .maybeSingle();

  // La auditoría se rellena con la versión PUBLICADA vigente de esa plantilla:
  // nunca con un borrador a medias.
  let plantillaConVersion: OpcionesNuevaAuditoria["plantilla"] = null;
  if (plantilla) {
    const { data: version } = await supabase
      .from("auditoria_plantilla_versiones")
      .select("id, version")
      .eq("plantilla_id", plantilla.id)
      .eq("estado", "publicada")
      .order("vigente", { ascending: false })
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (version) {
      plantillaConVersion = {
        id: plantilla.id as string,
        nombre: plantilla.nombre as string,
        version_id: version.id as string,
        version: version.version as number,
      };
    }
  }

  const [{ data: locales }, { data: empleados }] = await Promise.all([
    supabase.from("locales").select("id, nombre").eq("empresa_id", empresaId).eq("activo", true).order("nombre"),
    supabase
      .from("empleados")
      .select("id, nombre, apellidos, user_id, estado")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo") // Ojo: en `empleados` el estado va capitalizado.
      .order("nombre"),
  ]);

  const auditores = (empleados ?? []).map((e) => ({
    id: e.id as string,
    nombre: `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim(),
  }));
  const propio = (empleados ?? []).find((e) => e.user_id === user.id);

  return {
    plantilla: plantillaConVersion,
    locales: (locales ?? []).map((l) => ({ id: l.id as string, nombre: l.nombre as string })),
    auditores,
    auditorPorDefecto: (propio?.id as string | undefined) ?? null,
  };
}

const crearAuditoriaSchema = z.object({
  localId: z.string().uuid("Elige un local"),
  // El empleado que audita es OBLIGATORIO: toda auditoría refleja quién la hizo.
  auditorEmpleadoId: z.string().uuid("Indica qué empleado hace la auditoría"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
});

/**
 * Abre una auditoría en BORRADOR sobre la plantilla vigente. Aún no tiene nota:
 * se calcula al cerrarla.
 */
export async function crearAuditoria(input: {
  localId: string;
  auditorEmpleadoId: string;
  fecha: string;
}): Promise<{ ok: true; envioId: string } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const parsed = crearAuditoriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const opciones = await getOpcionesNuevaAuditoria();
  if (!opciones.plantilla) {
    return { ok: false, error: "No hay plantilla vigente publicada. Marca una plantilla como vigente" };
  }

  // El auditor tiene que ser un empleado activo de esta empresa, no un id suelto.
  const { data: auditor } = await supabase
    .from("empleados")
    .select("id")
    .eq("id", parsed.data.auditorEmpleadoId)
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo")
    .maybeSingle();
  if (!auditor) {
    return { ok: false, error: "El empleado indicado no es un empleado activo de esta empresa" };
  }

  const { data, error } = await supabase
    .from("auditoria_envios")
    .insert({
      empresa_id: empresaId,
      plantilla_id: opciones.plantilla.id,
      version_id: opciones.plantilla.version_id,
      local_id: parsed.data.localId,
      auditor_empleado_id: parsed.data.auditorEmpleadoId,
      fecha: parsed.data.fecha,
      estado: "borrador",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Error al crear la auditoría" };

  revalidatePath("/calidad/auditorias");
  return { ok: true, envioId: data.id as string };
}

const respuestaSchema = z.object({
  preguntaId: z.string().uuid(),
  valorNumero: z.number().nullable().optional(),
  valorTexto: z.string().nullable().optional(),
  valorOpciones: z.array(z.string()).nullable().optional(),
});

/**
 * Guarda las respuestas de una auditoría en borrador. Se puede llamar tantas
 * veces como haga falta: cada pregunta se pisa con su último valor.
 */
export async function guardarRespuestas(
  envioId: string,
  respuestas: Array<{
    preguntaId: string;
    valorNumero?: number | null;
    valorTexto?: string | null;
    valorOpciones?: string[] | null;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const parsed = z.array(respuestaSchema).safeParse(respuestas);
  if (!parsed.success) return { ok: false, error: "Respuestas no válidas" };

  // Una auditoría cerrada no se toca.
  const { data: envio } = await supabase
    .from("auditoria_envios")
    .select("id, estado")
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!envio) return { ok: false, error: "Auditoría no encontrada" };
  if (envio.estado === "enviada") return { ok: false, error: "Esta auditoría ya está cerrada" };

  if (parsed.data.length === 0) return { ok: true };

  const filas = parsed.data.map((r) => ({
    envio_id: envioId,
    pregunta_id: r.preguntaId,
    valor_numero: r.valorNumero ?? null,
    valor_texto: r.valorTexto ?? null,
    valor_opciones: r.valorOpciones ?? null,
  }));

  const { error } = await supabase
    .from("auditoria_respuestas")
    .upsert(filas, { onConflict: "envio_id,pregunta_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/calidad/auditorias/${envioId}`);
  return { ok: true };
}

/**
 * Cierra la auditoría: calcula la nota final y la deja como enviada.
 *
 * REGLA: no se cierra una auditoría a medias. TODAS las preguntas son
 * obligatorias, sin excepción, así que basta con que quede una sin contestar
 * para que el cierre se rechace. La comprobación vive aquí, en el servidor:
 * la pantalla también avisa, pero el que manda es este control.
 *
 * La nota se calcula igual que las notas por sección de getEnvioDetalle: cada
 * pregunta de escala se normaliza a 0..10 (por si conviven escalas 0..5 y
 * 0..10) y se promedia ponderando por el peso de la pregunta. Las preguntas de
 * texto y observaciones no puntúan, pero también hay que contestarlas.
 */
export async function cerrarAuditoria(envioId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const detalle = await getEnvioDetalle(envioId);
  if (!detalle) return { ok: false, error: "Auditoría no encontrada" };
  if (detalle.estado === "enviada") return { ok: false, error: "Esta auditoría ya está cerrada" };

  const todas = detalle.secciones.flatMap((s) => s.respuestas);
  if (todas.length === 0) return { ok: false, error: "Esta plantilla no tiene preguntas" };

  const sinContestar = todas.filter(respuestaVacia).length;
  if (sinContestar > 0) {
    return {
      ok: false,
      error: sinContestar === 1
        ? "Falta 1 pregunta por contestar. Hay que contestarlas todas"
        : `Faltan ${sinContestar} preguntas por contestar. Hay que contestarlas todas`,
    };
  }

  const notaFinal = calcularNota(todas);

  const { error } = await supabase
    .from("auditoria_envios")
    .update({ estado: "enviada", nota_final: notaFinal, enviada_at: new Date().toISOString() })
    .eq("id", envioId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calidad/auditorias");
  revalidatePath(`/calidad/auditorias/${envioId}`);
  return { ok: true };
}

/**
 * Deja la auditoría PENDIENTE de terminar: guarda lo contestado y avisa por
 * notificación al empleado que la está haciendo, para que no se le olvide.
 *
 * Una auditoría pendiente NO cuenta para estadísticas (el dashboard y la
 * analítica solo miran las cerradas), pero queda registrada y localizable.
 */
export async function dejarAuditoriaPendiente(
  envioId: string,
  respuestas: Array<{
    preguntaId: string;
    valorNumero?: number | null;
    valorTexto?: string | null;
    valorOpciones?: string[] | null;
  }>,
): Promise<{ ok: boolean; error?: string; faltan?: number }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const guardado = await guardarRespuestas(envioId, respuestas);
  if (!guardado.ok) return guardado;

  const detalle = await getEnvioDetalle(envioId);
  if (!detalle) return { ok: false, error: "Auditoría no encontrada" };

  const faltan = detalle.secciones.flatMap((s) => s.respuestas).filter(respuestaVacia).length;

  // El aviso va al usuario del empleado que consta como auditor.
  const { data: envio } = await supabase
    .from("auditoria_envios")
    .select("auditor_empleado_id, numero_secuencial")
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (envio?.auditor_empleado_id) {
    const { data: empleado } = await supabase
      .from("empleados")
      .select("id, user_id")
      .eq("id", envio.auditor_empleado_id)
      .maybeSingle();

    if (empleado?.user_id) {
      await crearNotificaciones([
        {
          empleadoId: empleado.id as string,
          usuarioId: empleado.user_id as string,
          tipo: "recordatorio",
          titulo: "Tienes una auditoría sin terminar",
          mensaje:
            faltan === 1
              ? `La auditoría nº ${envio.numero_secuencial} de ${detalle.local_nombre} tiene 1 pregunta sin contestar. Termínala para que cuente.`
              : `La auditoría nº ${envio.numero_secuencial} de ${detalle.local_nombre} tiene ${faltan} preguntas sin contestar. Termínala para que cuente.`,
          accionLabel: "Terminarla",
          accionUrl: `/calidad/auditorias/${envioId}/rellenar`,
          refTabla: "auditoria_envios",
          refId: envioId,
          // Un solo aviso vivo por auditoría, aunque se guarde muchas veces.
          dedupeKey: `auditoria_pendiente:${envioId}`,
        },
      ]);
    }
  }

  revalidatePath("/calidad/auditorias");
  return { ok: true, faltan };
}

/**
 * Una respuesta cuenta como sin contestar cuando no tiene ningún valor. El 0 SÍ
 * es una respuesta válida (en las auditorías antiguas, en escala 0..5, era la
 * peor nota), por eso se compara contra null y no por "falsy".
 */
function respuestaVacia(r: RespuestaDetalle): boolean {
  return (
    r.valor_numero === null &&
    (r.valor_texto === null || r.valor_texto.trim() === "") &&
    (r.valor_opciones === null || r.valor_opciones.length === 0)
  );
}

/** Borra una auditoría en borrador (una cerrada no se borra). */
export async function eliminarAuditoriaBorrador(envioId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const { data: envio } = await supabase
    .from("auditoria_envios")
    .select("id, estado")
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!envio) return { ok: false, error: "Auditoría no encontrada" };
  if (envio.estado === "enviada") return { ok: false, error: "Una auditoría cerrada no se puede borrar" };

  const { error } = await supabase.from("auditoria_envios").delete().eq("id", envioId).eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calidad/auditorias");
  return { ok: true };
}
