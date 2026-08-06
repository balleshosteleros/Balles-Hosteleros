"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
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
