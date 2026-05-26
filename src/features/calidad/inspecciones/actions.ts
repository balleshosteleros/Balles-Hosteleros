"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { geminiJSON } from "@/lib/ia/gemini";
import type {
  Slide,
  SlideBlock,
  Plantilla,
  PlantillaVersion,
  EnvioResumen,
  EnvioCompleto,
  InspeccionToken,
  EmpresaTheme,
  JefeSalaFirma,
  VerificacionResultado,
} from "./types";
import { fetchJefeSalaFirma, verificarEnvioConDni } from "./public-data";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

// ─── Empresa theme (colores + logo) ───────────────────────────────────

export async function getEmpresaTheme(): Promise<EmpresaTheme | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;
  const { data } = await supabase
    .from("empresas")
    .select("id, nombre, logo_url, color, color_secundario, color_texto")
    .eq("id", empresaId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    logo_url: data.logo_url,
    color: data.color,
    color_secundario: data.color_secundario,
    color_texto: data.color_texto,
  };
}

// ─── Presentación ────────────────────────────────────────────────────────

export async function getPresentacion(): Promise<
  { slides: Slide[]; empresaId: string } | null
> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data, error } = await supabase
    .from("inspeccion_presentaciones")
    .select("slides")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) {
    console.error("[inspecciones] getPresentacion:", error.message);
    return null;
  }
  if (!data) {
    // Crea una presentación vacía si no existe
    const { data: nueva, error: err2 } = await supabase
      .from("inspeccion_presentaciones")
      .insert({ empresa_id: empresaId, slides: [] })
      .select("slides")
      .maybeSingle();
    if (err2 || !nueva) return { slides: [], empresaId };
    return { slides: (nueva.slides as Slide[]) ?? [], empresaId };
  }
  return { slides: (data.slides as Slide[]) ?? [], empresaId };
}

export async function savePresentacion(
  slides: Slide[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const { error } = await supabase
    .from("inspeccion_presentaciones")
    .upsert(
      { empresa_id: empresaId, slides },
      { onConflict: "empresa_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── Plantillas ─────────────────────────────────────────────────────────

export interface PlantillaResumen {
  id: string;
  numero_secuencial: number | null;
  nombre: string;
  descripcion: string | null;
  archivada: boolean;
  estado: "actual" | "archivada";
  version_vigente: number | null;
  estado_vigente: "borrador" | "publicada" | "archivada" | null;
  num_secciones: number;
  num_preguntas: number;
  num_envios: number;
  created_at: string;
}

export async function listPlantillas(): Promise<PlantillaResumen[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data: plantillas } = await supabase
    .from("inspeccion_plantillas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("numero_secuencial", { ascending: true });
  if (!plantillas) return [];

  const { data: versiones } = await supabase
    .from("inspeccion_plantilla_versiones")
    .select("id, plantilla_id, version, estado, vigente")
    .eq("empresa_id", empresaId);

  const versionPorPlantilla = new Map<
    string,
    { version: number; estado: PlantillaResumen["estado_vigente"]; id: string }
  >();
  for (const v of versiones ?? []) {
    if (v.vigente) {
      versionPorPlantilla.set(v.plantilla_id, {
        version: v.version,
        estado: v.estado as PlantillaResumen["estado_vigente"],
        id: v.id,
      });
    }
  }

  const versionIds = Array.from(versionPorPlantilla.values()).map((v) => v.id);
  const { data: secs } = versionIds.length
    ? await supabase
        .from("inspeccion_secciones")
        .select("id, version_id")
        .in("version_id", versionIds)
    : { data: [] as { id: string; version_id: string }[] };

  const secsByVersion = new Map<string, string[]>();
  for (const s of secs ?? []) {
    const arr = secsByVersion.get(s.version_id) ?? [];
    arr.push(s.id);
    secsByVersion.set(s.version_id, arr);
  }

  const secIdsAll = Array.from(secsByVersion.values()).flat();
  const { data: preguntas } = secIdsAll.length
    ? await supabase
        .from("inspeccion_preguntas")
        .select("id, seccion_id")
        .in("seccion_id", secIdsAll)
    : { data: [] as { id: string; seccion_id: string }[] };

  const preguntasPorSec = new Map<string, number>();
  for (const p of preguntas ?? []) {
    preguntasPorSec.set(
      p.seccion_id,
      (preguntasPorSec.get(p.seccion_id) ?? 0) + 1,
    );
  }

  const { data: envios } = await supabase
    .from("inspeccion_envios")
    .select("plantilla_id")
    .eq("empresa_id", empresaId);
  const enviosPorPlantilla = new Map<string, number>();
  for (const e of envios ?? []) {
    enviosPorPlantilla.set(e.plantilla_id, (enviosPorPlantilla.get(e.plantilla_id) ?? 0) + 1);
  }

  return plantillas.map((p): PlantillaResumen => {
    const v = versionPorPlantilla.get(p.id);
    const secciones = v ? secsByVersion.get(v.id) ?? [] : [];
    const numPreguntas = secciones.reduce(
      (s, sid) => s + (preguntasPorSec.get(sid) ?? 0),
      0,
    );
    const estadoPlantilla: "actual" | "archivada" =
      (p.estado as "actual" | "archivada" | null) ?? (p.archivada ? "archivada" : "archivada");
    return {
      id: p.id,
      numero_secuencial: p.numero_secuencial,
      nombre: p.nombre,
      descripcion: p.descripcion,
      archivada: p.archivada,
      estado: estadoPlantilla,
      version_vigente: v?.version ?? null,
      estado_vigente: v?.estado ?? null,
      num_secciones: secciones.length,
      num_preguntas: numPreguntas,
      num_envios: enviosPorPlantilla.get(p.id) ?? 0,
      created_at: p.created_at,
    };
  });
}

export async function getPlantillaCompleta(
  plantillaId: string,
): Promise<Plantilla | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: plantilla, error } = await supabase
    .from("inspeccion_plantillas")
    .select("*")
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !plantilla) return null;

  const { data: version } = await supabase
    .from("inspeccion_plantilla_versiones")
    .select("*")
    .eq("plantilla_id", plantillaId)
    .eq("vigente", true)
    .maybeSingle();

  if (!version) {
    return {
      id: plantilla.id,
      empresa_id: plantilla.empresa_id,
      numero_secuencial: plantilla.numero_secuencial,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      archivada: plantilla.archivada,
      created_at: plantilla.created_at,
      vigente_version: null,
    };
  }

  const { data: secs } = await supabase
    .from("inspeccion_secciones")
    .select("*")
    .eq("version_id", version.id)
    .order("orden");

  const { data: pregs } = await supabase
    .from("inspeccion_preguntas")
    .select("*")
    .in("seccion_id", (secs ?? []).map((s) => s.id))
    .order("orden");

  const seccionesConPreguntas = (secs ?? []).map((s) => ({
    ...s,
    preguntas: (pregs ?? []).filter((p) => p.seccion_id === s.id),
  }));

  const vigente: PlantillaVersion = {
    ...version,
    secciones: seccionesConPreguntas,
  };

  return {
    id: plantilla.id,
    empresa_id: plantilla.empresa_id,
    numero_secuencial: plantilla.numero_secuencial,
    nombre: plantilla.nombre,
    descripcion: plantilla.descripcion,
    archivada: plantilla.archivada,
    created_at: plantilla.created_at,
    vigente_version: vigente,
  };
}

export async function setPlantillaActual(
  plantillaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspeccion_plantillas")
    .update({ estado: "actual" })
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

export async function actualizarPlantilla(
  plantillaId: string,
  patch: { nombre?: string; descripcion?: string | null; created_at?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspeccion_plantillas")
    .update(patch)
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

export async function crearPlantillaVacia(
  nombre: string,
): Promise<{ ok: true; plantillaId: string } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { data: plantilla, error } = await supabase
    .from("inspeccion_plantillas")
    .insert({ empresa_id: empresaId, nombre })
    .select("id")
    .maybeSingle();
  if (error || !plantilla) return { ok: false, error: error?.message ?? "Error" };
  const { error: errV } = await supabase
    .from("inspeccion_plantilla_versiones")
    .insert({
      plantilla_id: plantilla.id,
      empresa_id: empresaId,
      version: 1,
      estado: "borrador",
      vigente: true,
    });
  if (errV) return { ok: false, error: errV.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true, plantillaId: plantilla.id };
}

export async function actualizarSeccion(
  seccionId: string,
  patch: { titulo?: string; descripcion?: string | null; orden?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspeccion_secciones")
    .update(patch)
    .eq("id", seccionId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

export async function actualizarPregunta(
  preguntaId: string,
  patch: Partial<{
    enunciado: string;
    ayuda: string | null;
    obligatoria: boolean;
    escala_min: number | null;
    escala_max: number | null;
    escala_label_min: string | null;
    escala_label_max: string | null;
    cuenta_para_nota: boolean;
    orden: number;
  }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspeccion_preguntas")
    .update(patch)
    .eq("id", preguntaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── Envíos ─────────────────────────────────────────────────────────────

export async function listEnvios(): Promise<EnvioResumen[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("inspeccion_envios")
    .select(
      "id, numero_secuencial, nombre_inspector, nombre_jefe_sala, fecha_inspeccion, nota_final, notas_por_seccion, plantilla_id, version_id, estado, verificado_at, created_at, local:locales(nombre), plantilla:inspeccion_plantillas(nombre, numero_secuencial), verificador:verificado_por_empleado_id(nombre, apellidos)",
    )
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((e): EnvioResumen => {
    const verif = Array.isArray(e.verificador)
      ? e.verificador[0]
      : (e.verificador as { nombre: string | null; apellidos: string | null } | null);
    const verifNombre = verif
      ? `${verif.nombre ?? ""} ${verif.apellidos ?? ""}`.trim() || null
      : null;
    const plantilla = Array.isArray(e.plantilla)
      ? e.plantilla[0]
      : (e.plantilla as { nombre: string; numero_secuencial: number | null } | null);
    return {
      id: e.id,
      numero_secuencial: e.numero_secuencial,
      nombre_inspector: e.nombre_inspector,
      nombre_jefe_sala: e.nombre_jefe_sala ?? null,
      fecha_inspeccion: e.fecha_inspeccion,
      local_nombre:
        (Array.isArray(e.local)
          ? e.local[0]?.nombre
          : (e.local as { nombre: string } | null)?.nombre) ?? null,
      nota_final: e.nota_final,
      notas_por_seccion: (e.notas_por_seccion as Record<string, number> | null) ?? null,
      plantilla_id: e.plantilla_id,
      plantilla_nombre: plantilla?.nombre ?? null,
      plantilla_version: plantilla?.numero_secuencial ?? null,
      estado: e.estado,
      verificado_at: e.verificado_at ?? null,
      verificado_por_nombre: verifNombre,
      created_at: e.created_at,
    };
  });
}

export async function getEnvio(envioId: string): Promise<EnvioCompleto | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: envio, error } = await supabase
    .from("inspeccion_envios")
    .select(
      "*, local:locales(nombre), plantilla:inspeccion_plantillas(nombre, numero_secuencial), verificador:verificado_por_empleado_id(nombre, apellidos)",
    )
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !envio) return null;

  const { data: respuestas } = await supabase
    .from("inspeccion_respuestas")
    .select("*")
    .eq("envio_id", envioId)
    .eq("empresa_id", empresaId);

  const verif = Array.isArray(envio.verificador)
    ? envio.verificador[0]
    : (envio.verificador as { nombre: string | null; apellidos: string | null } | null);
  const verifNombre = verif
    ? `${verif.nombre ?? ""} ${verif.apellidos ?? ""}`.trim() || null
    : null;

  const plantilla = Array.isArray(envio.plantilla)
    ? envio.plantilla[0]
    : (envio.plantilla as { nombre: string; numero_secuencial: number | null } | null);

  return {
    id: envio.id,
    empresa_id: envio.empresa_id,
    local_id: envio.local_id,
    local_nombre:
      (Array.isArray(envio.local) ? envio.local[0]?.nombre : (envio.local as { nombre: string } | null)?.nombre) ?? null,
    plantilla_id: envio.plantilla_id,
    plantilla_nombre: plantilla?.nombre ?? null,
    plantilla_version: plantilla?.numero_secuencial ?? null,
    version_id: envio.version_id,
    numero_secuencial: envio.numero_secuencial,
    nombre_inspector: envio.nombre_inspector,
    telefono_inspector: envio.telefono_inspector,
    fecha_inspeccion: envio.fecha_inspeccion,
    nombre_jefe_sala: envio.nombre_jefe_sala,
    nota_final: envio.nota_final,
    notas_por_seccion: (envio.notas_por_seccion as Record<string, number> | null) ?? null,
    estado: envio.estado,
    notas_calidad: envio.notas_calidad,
    verificado_at: envio.verificado_at ?? null,
    verificado_por_empleado_id: envio.verificado_por_empleado_id ?? null,
    verificado_por_nombre: verifNombre,
    created_at: envio.created_at,
    respuestas: (respuestas ?? []).map((r) => ({
      id: r.id,
      pregunta_id: r.pregunta_id,
      pregunta_snapshot: r.pregunta_snapshot,
      valor_texto: r.valor_texto,
      valor_numero: r.valor_numero != null ? Number(r.valor_numero) : null,
    })),
  };
}

// ─── Verificación QR por DNI del jefe de sala (PRP-041 + DNI) ──────────
//
// La firma ya no depende de la sesión del visitante. La pantalla pública
// carga los datos del jefe de sala con `getFirmaContext` y, al introducir
// el DNI correcto, llama a `firmarEnvioConDni`. Sin contador de intentos.

export async function getFirmaContext(
  qrToken: string,
): Promise<
  | { ok: true; data: JefeSalaFirma }
  | { ok: false; motivo: NonNullable<VerificacionResultado["motivo"]>; envio?: VerificacionResultado["envio"] }
> {
  return fetchJefeSalaFirma(qrToken);
}

export async function firmarEnvioConDni(input: {
  qrToken: string;
  dni: string;
}): Promise<VerificacionResultado> {
  const result = await verificarEnvioConDni({
    qrToken: input.qrToken,
    dniIntroducido: input.dni,
  });
  if (result.ok) {
    revalidatePath("/calidad/inspecciones");
    revalidatePath("/mi-panel/inspecciones");
  }
  return result;
}

export async function revisarEnvio(
  envioId: string,
  patch: { estado?: EnvioResumen["estado"]; notas_calidad?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId, user } = await ctx();
  if (!empresaId || !user) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspeccion_envios")
    .update({
      ...patch,
      revisado_at: patch.estado === "revisado" ? new Date().toISOString() : null,
      revisado_por: patch.estado === "revisado" ? user.id : null,
    })
    .eq("id", envioId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── Token público + plantilla activa ─────────────────────────────────

export async function getToken(): Promise<InspeccionToken | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;
  const { data } = await supabase
    .from("inspeccion_tokens")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data
    ? {
        empresa_id: data.empresa_id,
        token: data.token,
        activo: data.activo,
        plantilla_activa_id: data.plantilla_activa_id,
      }
    : null;
}

export async function rotarToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  // Token legible: [slug-local]-[mes]-[año]. Generado en DB.
  const { data: tokenRow, error: errRpc } = await supabase.rpc(
    "inspeccion_token_legible",
    { p_empresa_id: empresaId },
  );
  if (errRpc || !tokenRow) {
    return { ok: false, error: errRpc?.message ?? "No se pudo generar el enlace" };
  }
  const token = String(tokenRow);

  const { error } = await supabase
    .from("inspeccion_tokens")
    .update({ token, rotated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true, token };
}

export async function setPlantillaActiva(
  plantillaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspeccion_tokens")
    .update({ plantilla_activa_id: plantillaId })
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── IA Gemini ──────────────────────────────────────────────────────────

export async function iaReescribirTexto(input: {
  texto: string;
  tono: "formal" | "cercano" | "corto" | "largo" | "motivacional";
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  if (!input.texto.trim()) return { ok: false, error: "Texto vacío" };
  try {
    const result = await geminiJSON<{ texto: string }>(
      `Reescribe el siguiente texto en español con tono ${input.tono}. Mantén la idea original. Devuelve solo el texto reescrito, sin comillas ni etiquetas.\n\nTEXTO:\n${input.texto}`,
      {
        responseSchema: {
          type: "object",
          properties: {
            texto: {
              type: "string",
              description: "Texto reescrito en el tono solicitado.",
            },
          },
          required: ["texto"],
        } as Parameters<typeof geminiJSON>[1]["responseSchema"],
        temperature: 0.7,
      },
    );
    return { ok: true, texto: result.data.texto };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error IA" };
  }
}

export async function iaGenerarSlide(input: {
  prompt: string;
}): Promise<{ ok: true; slide: Slide } | { ok: false; error: string }> {
  if (!input.prompt.trim()) return { ok: false, error: "Prompt vacío" };
  try {
    const result = await geminiJSON<{
      titulo: string;
      bloques: { tipo: string; contenido: string }[];
    }>(
      `Genera una slide de presentación en español sobre: "${input.prompt}". Devuelve un título corto (max 6 palabras) y entre 1 y 3 bloques. Cada bloque tipo "paragraph" o "bullets". Bullets como contenido separado por "|".`,
      {
        responseSchema: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            bloques: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: {
                    type: "string",
                    enum: ["paragraph", "bullets"],
                  },
                  contenido: { type: "string" },
                },
                required: ["tipo", "contenido"],
              },
            },
          },
          required: ["titulo", "bloques"],
        } as unknown as Parameters<typeof geminiJSON>[1]["responseSchema"],
        temperature: 0.6,
      },
    );
    const uid = () =>
      `b-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    const blocks: SlideBlock[] = [
      { id: uid(), type: "title", text: result.data.titulo },
    ];
    for (const b of result.data.bloques) {
      if (b.tipo === "bullets") {
        blocks.push({
          id: uid(),
          type: "bullets",
          items: b.contenido
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      } else {
        blocks.push({ id: uid(), type: "paragraph", text: b.contenido });
      }
    }
    const slide: Slide = {
      id: `s-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
      layout: "default",
      background: "primary",
      image: null,
      blocks,
    };
    return { ok: true, slide };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error IA" };
  }
}
