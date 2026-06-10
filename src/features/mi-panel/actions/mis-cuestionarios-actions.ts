"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type {
  Cuestionario,
  BloqueCuestionario,
  CategoriaCuestionario,
  RespuestaEmpleadoCuestionario,
} from "@/features/calidad/data/cuestionarios";

function rel<T>(r: unknown): T | null {
  if (Array.isArray(r)) return (r[0] as T) ?? null;
  return (r as T) ?? null;
}

/** IDs de empleado (espejos multi-empresa) ligados al usuario autenticado. */
async function misEmpleadoIds(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  userId: string,
): Promise<string[]> {
  const { data } = await supabase.from("empleados").select("id").eq("user_id", userId);
  return (data ?? []).map((e) => e.id as string);
}

type PlantillaRow = {
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  duracion_minutos: number | null;
  intentos_max: number | null;
  nota_corte: number | null;
  mostrar_resultados: boolean | null;
  aleatorizar_preguntas: boolean | null;
  mensaje_inicial: string | null;
  mensaje_aprobado: string | null;
  mensaje_no_aprobado: string | null;
  bloques: BloqueCuestionario[] | null;
};

/** Plantilla de BD → forma `Cuestionario`. `id` = id del envío del empleado. */
function plantillaToCuestionario(
  envioId: string,
  plantilla: PlantillaRow | null,
  fechaCierre: string,
): Cuestionario {
  return {
    id: envioId,
    empresaId: "",
    nombre: plantilla?.nombre ?? "(sin plantilla)",
    descripcion: plantilla?.descripcion ?? "",
    categoria: (plantilla?.categoria as CategoriaCuestionario) ?? "evaluacion",
    estado: "activo",
    creadorId: "",
    creadorNombre: "",
    fechaCreacion: "",
    fechaCierre,
    duracionMinutos: plantilla?.duracion_minutos ?? 0,
    intentosMax: plantilla?.intentos_max ?? 1,
    notaCorte: plantilla?.nota_corte ?? 0,
    mostrarResultados: plantilla?.mostrar_resultados ?? true,
    aleatorizarPreguntas: plantilla?.aleatorizar_preguntas ?? false,
    mensajeInicial: plantilla?.mensaje_inicial ?? "",
    mensajeAprobado: plantilla?.mensaje_aprobado ?? "",
    mensajeNoAprobado: plantilla?.mensaje_no_aprobado ?? "",
    destinatarios: { tipo: "todos", ids: [] },
    bloques: plantilla?.bloques ?? [],
    respuestas: [],
  };
}

export interface MiCuestionarioItem {
  cuestionario: Cuestionario; // id = envioId
  respondido: boolean;
  respuesta: RespuestaEmpleadoCuestionario | null;
}

/** Fila del join envío→campaña→plantilla (el cliente tipado no infiere joins anidados). */
type EnvioJoinRow = {
  id: string;
  empleado_id: string;
  respuestas: Record<string, string | string[]> | null;
  respondido_at: string | null;
  puntuacion: number | null;
  nota_sobre: number | null;
  aprobado: boolean | null;
  campana: unknown;
};

const SELECT_ENVIO =
  "id, empleado_id, respuestas, respondido_at, puntuacion, nota_sobre, aprobado, " +
  "campana:cuestionario_campanas(periodo_fin, plantilla:cuestionario_plantillas(" +
  "nombre, descripcion, categoria, duracion_minutos, intentos_max, nota_corte, " +
  "mostrar_resultados, aleatorizar_preguntas, mensaje_inicial, mensaje_aprobado, " +
  "mensaje_no_aprobado, bloques))";

/** Cuestionarios (envíos) asignados al empleado autenticado, con su estado. */
export async function listMisCuestionarios(): Promise<{
  ok: boolean;
  data: MiCuestionarioItem[];
}> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: [] };
    const ids = await misEmpleadoIds(supabase, userId);
    if (ids.length === 0) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("cuestionario_envios")
      .select(SELECT_ENVIO)
      .in("empleado_id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as unknown as EnvioJoinRow[];
    const items: MiCuestionarioItem[] = rows.map((e) => {
      const campana = rel<{ periodo_fin: string | null; plantilla?: unknown }>(e.campana);
      const plantilla = rel<PlantillaRow>(campana?.plantilla);
      const cuestionario = plantillaToCuestionario(
        e.id as string,
        plantilla,
        campana?.periodo_fin ?? "",
      );
      const respondido = !!e.respondido_at;
      const respuesta: RespuestaEmpleadoCuestionario | null = respondido
        ? {
            empleadoId: userId,
            fecha: (e.respondido_at as string | null ?? "").slice(0, 10),
            respuestas: (e.respuestas ?? {}) as Record<string, string | string[]>,
            puntuacion: e.puntuacion != null ? Number(e.puntuacion) : 0,
            notaSobre: e.nota_sobre != null ? Number(e.nota_sobre) : 0,
            aprobado: !!e.aprobado,
            intento: 1,
            duracionMin: 0,
          }
        : null;
      if (respuesta) cuestionario.respuestas = [respuesta];
      return { cuestionario, respondido, respuesta };
    });

    return { ok: true, data: items };
  } catch (err) {
    console.error("[mi-panel] listMisCuestionarios:", err);
    return { ok: false, data: [] };
  }
}

/** Corrige (servidor) las respuestas contra la plantilla y devuelve la nota. */
function corregir(
  bloques: BloqueCuestionario[],
  respuestas: Record<string, string | string[]>,
): { puntos: number; sobre: number } {
  let puntos = 0;
  let sobre = 0;
  for (const bloque of bloques) {
    for (const p of bloque.preguntas) {
      sobre += p.puntos;
      const r = respuestas[p.id];
      if (p.tipo === "unica" || p.tipo === "verdadero_falso") {
        const correctaId = p.opciones.find((o) => o.correcta)?.id;
        if (correctaId && r === correctaId) puntos += p.puntos;
      } else if (p.tipo === "multiple") {
        const correctas = p.opciones.filter((o) => o.correcta).map((o) => o.id).sort();
        const elegidas = (Array.isArray(r) ? r : []).slice().sort();
        if (
          correctas.length === elegidas.length &&
          correctas.every((id, i) => id === elegidas[i])
        ) {
          puntos += p.puntos;
        }
      }
      // 'texto' no puntúa automáticamente.
    }
  }
  return { puntos, sobre };
}

/** Registra las respuestas del empleado a un envío y calcula su nota. */
export async function submitCuestionario(
  envioId: string,
  respuestas: Record<string, string | string[]>,
): Promise<{ ok: boolean; puntos?: number; sobre?: number; aprobado?: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    const ids = await misEmpleadoIds(supabase, userId);

    const { data: envio, error } = await supabase
      .from("cuestionario_envios")
      .select(
        "id, empleado_id, respondido_at, campana:cuestionario_campanas(plantilla:cuestionario_plantillas(nota_corte, bloques))",
      )
      .eq("id", envioId)
      .maybeSingle();
    if (error) throw error;
    if (!envio) return { ok: false, error: "Cuestionario no encontrado" };
    const env = envio as unknown as {
      empleado_id: string;
      respondido_at: string | null;
      campana: unknown;
    };
    if (!ids.includes(env.empleado_id)) {
      return { ok: false, error: "Este cuestionario no es tuyo" };
    }
    if (env.respondido_at) {
      return { ok: false, error: "Ya has respondido este cuestionario" };
    }

    const campana = rel<{ plantilla?: unknown }>(env.campana);
    const plantilla = rel<{ nota_corte: number | null; bloques: BloqueCuestionario[] | null }>(
      campana?.plantilla,
    );
    const bloques = plantilla?.bloques ?? [];
    const notaCorte = plantilla?.nota_corte ?? 0;

    const { puntos, sobre } = corregir(bloques, respuestas);
    const pct = sobre > 0 ? (puntos / sobre) * 100 : 0;
    const aprobado = pct >= notaCorte;

    const { error: upErr } = await supabase
      .from("cuestionario_envios")
      .update({
        respuestas,
        respondido_at: new Date().toISOString(),
        puntuacion: puntos,
        nota_sobre: sobre,
        aprobado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", envioId);
    if (upErr) throw upErr;

    return { ok: true, puntos, sobre, aprobado };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mi-panel] submitCuestionario:", msg);
    return { ok: false, error: msg };
  }
}
