"use server";

/**
 * Server actions de Sala → Música.
 *
 * Reparto de permisos:
 *  · VER y dar al Play → cualquiera que vea SALA. Es lo que hace el equipo del
 *    local durante el servicio y no debe requerir nada más.
 *  · GESTIONAR (crear listas, subir canciones, fijar horarios) → solo roles con
 *    el permiso MÚSICA marcado en Ajustes → Roles.
 *
 * La disponibilidad horaria se calcula SIEMPRE en servidor con la zona horaria
 * de la empresa: si se calculara en el navegador, un portátil con la hora mal
 * puesta desbloquearía la lista de copas a media mañana.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { puedeVerModulo, puedeEditarModulo } from "@/features/auth/lib/permisos";
import { calcularDisponibilidad } from "@/features/sala/musica/lib/disponibilidad";
import { deleteObjectR2, presignGetR2 } from "@/shared/lib/r2";
import type {
  ListaMusica,
  Cancion,
  HorarioLista,
  EstadoReproductor,
  UsoMusica,
  ComandoReproductor,
  LocalMusica,
} from "@/features/sala/musica/types";

const RUTA = "/sala/musica";

// ─── Guards de permiso ──────────────────────────────────────────────────────

/** ¿Puede al menos VER la música (y pulsar Play)? Basta con ver SALA. */
async function guardVer() {
  const { supabase, userId, empresaId } = await getAppContext();
  if (!userId || !empresaId) {
    return { ok: false as const, error: "No autenticado", supabase, empresaId: null, userId: null };
  }
  const { esDirector, permisos } = await getRolContext(userId);
  if (!puedeVerModulo(esDirector, permisos, "SALA")) {
    return { ok: false as const, error: "Sin acceso a Sala", supabase, empresaId: null, userId };
  }
  return { ok: true as const, supabase, empresaId, userId, esDirector, permisos };
}

/** ¿Puede GESTIONAR la música? Requiere el permiso MÚSICA (o ser dirección). */
async function guardGestion() {
  const base = await guardVer();
  if (!base.ok) return base;
  if (!puedeEditarModulo(base.esDirector, base.permisos, "MÚSICA")) {
    return {
      ok: false as const,
      error: "Tu rol no puede gestionar la música. Pídelo en Ajustes → Roles.",
      supabase: base.supabase,
      empresaId: null,
      userId: base.userId,
    };
  }
  return base;
}

// ─── Lectura: listas con canciones, horarios y disponibilidad ───────────────

export async function listMusica(): Promise<{
  ok: boolean;
  listas: ListaMusica[];
  biblioteca: Cancion[];
  uso: UsoMusica;
  puedeGestionar: boolean;
  error?: string;
}> {
  const vacio = {
    listas: [],
    biblioteca: [],
    uso: { bytesUsados: 0, bytesLimite: 5 * 1024 ** 3 },
    puedeGestionar: false,
  };
  try {
    const ctx = await guardVer();
    if (!ctx.ok) return { ok: false, ...vacio, error: ctx.error };
    const { supabase, empresaId, esDirector, permisos } = ctx;

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const puedeGestionar = puedeEditarModulo(esDirector, permisos, "MÚSICA");

    const [listasRes, cancionesRes, vinculosRes, horariosRes, usoRes] = await Promise.all([
      supabase.from("musica_listas").select("*").eq("empresa_id", empresaId)
        .eq("activo", true).order("created_at", { ascending: true }),
      supabase.from("musica_canciones").select("*").eq("empresa_id", empresaId)
        .eq("activo", true).order("titulo", { ascending: true }),
      supabase.from("musica_lista_canciones").select("*").eq("empresa_id", empresaId)
        .order("posicion", { ascending: true }),
      supabase.from("musica_horarios").select("*").eq("empresa_id", empresaId),
      supabase.from("musica_uso_por_empresa").select("bytes_used, bytes_limit")
        .eq("empresa_id", empresaId).maybeSingle(),
    ]);

    if (listasRes.error) throw listasRes.error;
    if (cancionesRes.error) throw cancionesRes.error;

    const biblioteca: Cancion[] = (cancionesRes.data ?? []).map(mapCancion);
    const porId = new Map(biblioteca.map((c) => [c.id, c]));

    const horariosPorLista = new Map<string, HorarioLista[]>();
    for (const h of horariosRes.data ?? []) {
      const item: HorarioLista = {
        id: h.id as string,
        listaId: h.lista_id as string,
        dias: (h.dias ?? []) as number[],
        horaInicio: h.hora_inicio as string,
        horaFin: h.hora_fin as string,
      };
      const arr = horariosPorLista.get(item.listaId) ?? [];
      arr.push(item);
      horariosPorLista.set(item.listaId, arr);
    }

    const cancionesPorLista = new Map<string, Cancion[]>();
    for (const v of vinculosRes.data ?? []) {
      const c = porId.get(v.cancion_id as string);
      if (!c) continue; // canción borrada: se ignora en vez de romper la lista
      const arr = cancionesPorLista.get(v.lista_id as string) ?? [];
      arr.push(c);
      cancionesPorLista.set(v.lista_id as string, arr);
    }

    const listas: ListaMusica[] = (listasRes.data ?? []).map((l) => {
      const horarios = horariosPorLista.get(l.id as string) ?? [];
      const sinHorario = Boolean(l.sin_horario);
      const { disponible, motivo } = calcularDisponibilidad(sinHorario, horarios, tz);
      return {
        id: l.id as string,
        nombre: l.nombre as string,
        etiqueta: (l.etiqueta as string | null) ?? null,
        favorita: Boolean(l.favorita),
        sinHorario,
        canciones: cancionesPorLista.get(l.id as string) ?? [],
        horarios,
        disponibleAhora: disponible,
        motivoBloqueo: motivo,
      };
    });

    const uso: UsoMusica = {
      bytesUsados: Number(usoRes.data?.bytes_used ?? 0),
      bytesLimite: Number(usoRes.data?.bytes_limit ?? 5 * 1024 ** 3),
    };

    return { ok: true, listas, biblioteca, uso, puedeGestionar };
  } catch (err) {
    console.error("[musica] listMusica:", err);
    return { ok: false, ...vacio, error: "No se pudo cargar la música" };
  }
}

function mapCancion(c: Record<string, unknown>): Cancion {
  return {
    id: c.id as string,
    titulo: c.titulo as string,
    artista: (c.artista as string | null) ?? null,
    duracionSeg: Number(c.duracion_seg ?? 0),
    r2Key: c.r2_key as string,
    bytes: Number(c.bytes ?? 0),
    mimeType: (c.mime_type as string) ?? "audio/mpeg",
  };
}

// ─── Listas ─────────────────────────────────────────────────────────────────

const listaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  etiqueta: z.string().trim().max(40).optional().nullable(),
  sinHorario: z.boolean().optional(),
});

export async function crearLista(input: z.input<typeof listaSchema>) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const parsed = listaSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const { error } = await ctx.supabase.from("musica_listas").insert({
      empresa_id: ctx.empresaId,
      nombre: parsed.data.nombre,
      etiqueta: parsed.data.etiqueta || null,
      sin_horario: parsed.data.sinHorario ?? true,
      creado_por: ctx.userId,
    });
    if (error) throw error;

    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] crearLista:", msg);
    return { ok: false, error: msg };
  }
}

export async function actualizarLista(
  id: string,
  input: Partial<z.input<typeof listaSchema>> & { favorita?: boolean },
) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.nombre !== undefined) {
      const n = String(input.nombre).trim();
      if (!n) return { ok: false, error: "El nombre es obligatorio" };
      patch.nombre = n;
    }
    if (input.etiqueta !== undefined) patch.etiqueta = input.etiqueta || null;
    if (input.sinHorario !== undefined) patch.sin_horario = Boolean(input.sinHorario);
    if (input.favorita !== undefined) patch.favorita = Boolean(input.favorita);

    const { error } = await ctx.supabase.from("musica_listas").update(patch).eq("id", id);
    if (error) throw error;

    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] actualizarLista:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Marcar/desmarcar favorita. Es la única escritura que NO exige el permiso de
 * gestión: es una preferencia de uso del día a día, no configuración.
 */
export async function toggleFavorita(id: string, favorita: boolean) {
  try {
    const ctx = await guardVer();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const { error } = await ctx.supabase
      .from("musica_listas")
      .update({ favorita, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] toggleFavorita:", msg);
    return { ok: false, error: msg };
  }
}

/** Borrado lógico: la lista desaparece pero las canciones siguen en biblioteca. */
export async function borrarLista(id: string) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const { error } = await ctx.supabase
      .from("musica_listas")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] borrarLista:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Canciones dentro de una lista ──────────────────────────────────────────

export async function anadirCancionesALista(listaId: string, cancionIds: string[]) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    if (cancionIds.length === 0) return { ok: true };

    // Se colocan al final: se lee la última posición ocupada.
    const { data: ultimas } = await ctx.supabase
      .from("musica_lista_canciones")
      .select("posicion")
      .eq("lista_id", listaId)
      .order("posicion", { ascending: false })
      .limit(1);
    let pos = Number(ultimas?.[0]?.posicion ?? -1);

    const filas = cancionIds.map((cancionId) => ({
      empresa_id: ctx.empresaId,
      lista_id: listaId,
      cancion_id: cancionId,
      posicion: ++pos,
    }));

    // `upsert` con ignoreDuplicates: si alguien añade dos veces la misma
    // canción, no revienta — simplemente no se duplica (índice único).
    const { error } = await ctx.supabase
      .from("musica_lista_canciones")
      .upsert(filas, { onConflict: "lista_id,cancion_id", ignoreDuplicates: true });
    if (error) throw error;

    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] anadirCancionesALista:", msg);
    return { ok: false, error: msg };
  }
}

export async function quitarCancionDeLista(listaId: string, cancionId: string) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const { error } = await ctx.supabase
      .from("musica_lista_canciones")
      .delete()
      .eq("lista_id", listaId)
      .eq("cancion_id", cancionId);
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] quitarCancionDeLista:", msg);
    return { ok: false, error: msg };
  }
}

/** Elimina la canción de la biblioteca y su archivo de R2 (libera cuota). */
export async function borrarCancion(cancionId: string) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const { data: cancion } = await ctx.supabase
      .from("musica_canciones")
      .select("r2_key")
      .eq("id", cancionId)
      .maybeSingle();

    const { error } = await ctx.supabase
      .from("musica_canciones")
      .delete()
      .eq("id", cancionId);
    if (error) throw error;

    // El archivo se borra DESPUÉS de la fila: si R2 fallara, no queda una
    // canción visible apuntando a un archivo que ya no existe.
    if (cancion?.r2_key) {
      try {
        await deleteObjectR2(cancion.r2_key as string);
      } catch (e) {
        console.error("[musica] borrarCancion R2:", e);
      }
    }

    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] borrarCancion:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Paso 2 de la subida: el archivo YA está en R2, aquí se registra la canción.
 * Se llama solo después de que el PUT haya ido bien, para no dejar nunca una
 * canción visible apuntando a un archivo que no existe.
 */
const registrarSchema = z.object({
  titulo: z.string().trim().min(1, "Falta el título").max(200),
  artista: z.string().trim().max(200).optional().nullable(),
  duracionSeg: z.number().int().min(0).max(60 * 60 * 3),
  r2Key: z.string().trim().min(1),
  bytes: z.number().int().positive(),
  mimeType: z.string().trim().min(1),
  /** Si viene, la canción se añade directamente a esta lista. */
  listaId: z.string().guid().optional().nullable(),
});

export async function registrarCancion(input: z.input<typeof registrarSchema>) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const parsed = registrarSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const d = parsed.data;

    const { data: creada, error } = await ctx.supabase
      .from("musica_canciones")
      .insert({
        empresa_id: ctx.empresaId,
        titulo: d.titulo,
        artista: d.artista || null,
        duracion_seg: d.duracionSeg,
        r2_key: d.r2Key,
        bytes: d.bytes,
        mime_type: d.mimeType,
        creado_por: ctx.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (d.listaId && creada?.id) {
      await anadirCancionesALista(d.listaId, [creada.id as string]);
    }

    revalidatePath(RUTA);
    return { ok: true, id: creada?.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] registrarCancion:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * URLs firmadas para reproducir las canciones de una lista.
 *
 * Se piden por lista y no una a una para que al pulsar Play el reproductor ya
 * tenga todas y el salto entre canciones sea inmediato (sin un viaje al
 * servidor entre tema y tema, que se oiría como un silencio).
 */
export async function getUrlsLista(listaId: string): Promise<{
  ok: boolean;
  urls: Record<string, string>;
  error?: string;
}> {
  try {
    const ctx = await guardVer();
    if (!ctx.ok) return { ok: false, urls: {}, error: ctx.error };

    const { data: vinculos } = await ctx.supabase
      .from("musica_lista_canciones")
      .select("cancion_id")
      .eq("lista_id", listaId)
      .eq("empresa_id", ctx.empresaId);

    const ids = (vinculos ?? []).map((v) => v.cancion_id as string);
    if (ids.length === 0) return { ok: true, urls: {} };

    // RLS ya limita a la empresa; el filtro explícito evita firmar por error la
    // clave de otra empresa si algún día se relajara la política.
    const { data: canciones } = await ctx.supabase
      .from("musica_canciones")
      .select("id, r2_key")
      .eq("empresa_id", ctx.empresaId)
      .in("id", ids);

    const urls: Record<string, string> = {};
    for (const c of canciones ?? []) {
      urls[c.id as string] = presignGetR2(c.r2_key as string);
    }
    return { ok: true, urls };
  } catch (err) {
    console.error("[musica] getUrlsLista:", err);
    return { ok: false, urls: {}, error: "No se pudo preparar la reproducción" };
  }
}

// ─── Horarios ───────────────────────────────────────────────────────────────

const horarioSchema = z.object({
  listaId: z.string().guid("Lista no válida"),
  dias: z.array(z.number().int().min(1).max(7)).min(1, "Elige al menos un día"),
  horaInicio: z.string().regex(/^\d{1,2}:\d{2}$/, "Hora de inicio no válida"),
  horaFin: z.string().regex(/^\d{1,2}:\d{2}$/, "Hora de fin no válida"),
});

export async function anadirHorario(input: z.input<typeof horarioSchema>) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };

    const parsed = horarioSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const { error } = await ctx.supabase.from("musica_horarios").insert({
      empresa_id: ctx.empresaId,
      lista_id: parsed.data.listaId,
      dias: parsed.data.dias,
      hora_inicio: parsed.data.horaInicio,
      hora_fin: parsed.data.horaFin,
    });
    if (error) throw error;

    // Al fijar una franja, la lista deja de ser "siempre disponible": si no, el
    // horario quedaría guardado pero sin efecto y parecería que no funciona.
    await ctx.supabase
      .from("musica_listas")
      .update({ sin_horario: false, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.listaId);

    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] anadirHorario:", msg);
    return { ok: false, error: msg };
  }
}

export async function borrarHorario(id: string) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const { error } = await ctx.supabase.from("musica_horarios").delete().eq("id", id);
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] borrarHorario:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Reproductor del local ──────────────────────────────────────────────────

/** Locales de la empresa. Cada uno tiene su música independiente. */
export async function listLocales(): Promise<{
  ok: boolean;
  locales: LocalMusica[];
}> {
  try {
    const ctx = await guardVer();
    if (!ctx.ok) return { ok: false, locales: [] };
    const { data, error } = await ctx.supabase
      .from("locales")
      .select("id, nombre")
      .eq("empresa_id", ctx.empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return {
      ok: true,
      locales: (data ?? []).map((l) => ({
        id: l.id as string,
        nombre: l.nombre as string,
      })),
    };
  } catch (err) {
    console.error("[musica] listLocales:", err);
    return { ok: false, locales: [] };
  }
}

export async function getEstadoReproductor(localId: string): Promise<{
  ok: boolean;
  estado: EstadoReproductor | null;
}> {
  try {
    const ctx = await guardVer();
    if (!ctx.ok || !localId) return { ok: false, estado: null };
    const { data } = await ctx.supabase
      .from("musica_reproductor")
      .select("*")
      .eq("local_id", localId)
      .maybeSingle();
    if (!data) return { ok: true, estado: null };
    return { ok: true, estado: mapEstado(data) };
  } catch (err) {
    console.error("[musica] getEstadoReproductor:", err);
    return { ok: false, estado: null };
  }
}

function mapEstado(d: Record<string, unknown>): EstadoReproductor {
  return {
    localId: d.local_id as string,
    listaId: (d.lista_id as string | null) ?? null,
    cancionId: (d.cancion_id as string | null) ?? null,
    indice: Number(d.indice ?? 0),
    reproduciendo: Boolean(d.reproduciendo),
    volumen: Number(d.volumen ?? 70),
    comando: (d.comando as string | null) ?? null,
    comandoSeq: Number(d.comando_seq ?? 0),
    deviceId: (d.device_id as string | null) ?? null,
    deviceNombre: (d.device_nombre as string | null) ?? null,
    vistoEn: (d.visto_en as string | null) ?? null,
  };
}

/**
 * Envía una orden al equipo de altavoces. `comando_seq` se incrementa siempre
 * para que el reproductor distinga una orden NUEVA de un eco de su propio
 * estado (si no, al reenviar "play" estando ya en play, no pasaría nada).
 *
 * Antes de arrancar una lista se comprueba su horario EN SERVIDOR: es el punto
 * donde de verdad se impide que suene la lista de copas por la mañana.
 */
export async function enviarComando(input: {
  localId: string;
  comando: ComandoReproductor;
  listaId?: string | null;
  cancionId?: string | null;
  indice?: number;
  volumen?: number;
}) {
  try {
    const ctx = await guardVer();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    if (!input.localId) return { ok: false, error: "Falta indicar el local" };

    // El local debe ser de la empresa activa: si no, se podría mandar música al
    // local de otra empresa conociendo su id.
    const { data: local } = await ctx.supabase
      .from("locales")
      .select("id")
      .eq("id", input.localId)
      .eq("empresa_id", ctx.empresaId)
      .maybeSingle();
    if (!local) return { ok: false, error: "Local no válido" };

    if (input.comando === "play" && input.listaId) {
      const permitido = await listaDisponible(ctx.supabase, ctx.empresaId, input.listaId);
      if (!permitido.ok) return { ok: false, error: permitido.error };
    }

    const { data: actual } = await ctx.supabase
      .from("musica_reproductor")
      .select("comando_seq")
      .eq("local_id", input.localId)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      local_id: input.localId,
      empresa_id: ctx.empresaId,
      comando: input.comando,
      comando_seq: Number(actual?.comando_seq ?? 0) + 1,
      actualizado_por: ctx.userId,
      updated_at: new Date().toISOString(),
    };
    if (input.listaId !== undefined) patch.lista_id = input.listaId;
    if (input.cancionId !== undefined) patch.cancion_id = input.cancionId;
    if (input.indice !== undefined) patch.indice = input.indice;
    if (input.volumen !== undefined) {
      patch.volumen = Math.max(0, Math.min(100, Math.round(input.volumen)));
    }
    if (input.comando === "play") patch.reproduciendo = true;
    if (input.comando === "pause" || input.comando === "stop") patch.reproduciendo = false;

    const { error } = await ctx.supabase
      .from("musica_reproductor")
      .upsert(patch, { onConflict: "local_id" });
    if (error) throw error;

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] enviarComando:", msg);
    return { ok: false, error: msg };
  }
}

/** Comprueba en servidor que la lista puede sonar ahora mismo. */
async function listaDisponible(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  listaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [{ data: lista }, { data: horarios }] = await Promise.all([
    supabase.from("musica_listas").select("sin_horario, nombre").eq("id", listaId).maybeSingle(),
    supabase.from("musica_horarios").select("*").eq("lista_id", listaId),
  ]);
  if (!lista) return { ok: false, error: "La lista ya no existe" };

  const tz = await getZonaHorariaEmpresa(supabase, empresaId);
  const franjas: HorarioLista[] = (horarios ?? []).map((h) => ({
    id: h.id as string,
    listaId: h.lista_id as string,
    dias: (h.dias ?? []) as number[],
    horaInicio: h.hora_inicio as string,
    horaFin: h.hora_fin as string,
  }));

  const { disponible, motivo } = calcularDisponibilidad(
    Boolean(lista.sin_horario),
    franjas,
    tz,
  );
  if (disponible) return { ok: true };
  return { ok: false, error: `«${lista.nombre}» está fuera de su horario. ${motivo ?? ""}`.trim() };
}

/**
 * Minutos sin señal de vida tras los cuales se da por muerto al equipo de
 * altavoces. Se manda señal cada minuto, así que 3 minutos son 3 fallos
 * seguidos: suficiente para no relevar a un equipo vivo por un corte de red
 * pasajero, y poco para no dejar el local sin música toda la tarde porque
 * alguien apagó un ordenador.
 */
const MINUTOS_ALTAVOZ_VIVO = 3;

/**
 * Marca ESTE navegador como el equipo conectado a los altavoces DE UN LOCAL.
 *
 * Solo puede haber uno por local: si hubiera dos, la misma lista sonaría a la
 * vez en dos equipos con unos segundos de desfase, que es peor que no tener
 * música. Si ya hay otro equipo vivo, esta acción NO lo releva por su cuenta —
 * devuelve `ocupadoPor` para que la aplicación pregunte primero.
 *
 * Con `forzar: true` toma el relevo igualmente (el usuario ya ha confirmado).
 */
export async function marcarComoReproductor(input: {
  localId: string;
  deviceId: string;
  deviceNombre: string;
  forzar?: boolean;
}): Promise<{ ok: boolean; error?: string; ocupadoPor?: string }> {
  try {
    const ctx = await guardVer();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    if (!input.localId) return { ok: false, error: "Falta indicar el local" };

    const { data: local } = await ctx.supabase
      .from("locales")
      .select("id")
      .eq("id", input.localId)
      .eq("empresa_id", ctx.empresaId)
      .maybeSingle();
    if (!local) return { ok: false, error: "Local no válido" };

    const { data: actual } = await ctx.supabase
      .from("musica_reproductor")
      .select("device_id, device_nombre, visto_en, reproduciendo")
      .eq("local_id", input.localId)
      .maybeSingle();

    // ¿Hay ya OTRO equipo marcado y sigue dando señales de vida?
    const otro =
      actual?.device_id && actual.device_id !== input.deviceId ? actual : null;
    if (otro && !input.forzar) {
      const visto = otro.visto_en ? new Date(otro.visto_en as string) : null;
      const vivo =
        visto !== null &&
        Date.now() - visto.getTime() < MINUTOS_ALTAVOZ_VIVO * 60_000;
      if (vivo) {
        return {
          ok: false,
          ocupadoPor: (otro.device_nombre as string | null) || "Otro equipo",
        };
      }
      // Sin señal reciente: el equipo que constaba ya no está abierto, así que
      // se toma el relevo sin molestar a nadie con una pregunta.
    }

    const { error } = await ctx.supabase.from("musica_reproductor").upsert(
      {
        local_id: input.localId,
        empresa_id: ctx.empresaId,
        device_id: input.deviceId,
        device_nombre: input.deviceNombre.slice(0, 60),
        visto_en: new Date().toISOString(),
        actualizado_por: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "local_id" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] marcarComoReproductor:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Señal de vida del equipo de altavoces. Se manda cada minuto mientras está
 * marcado: así, si se apaga o se cierra el navegador, otro equipo puede tomar
 * el relevo sin preguntar en vez de quedarse bloqueado para siempre.
 */
export async function latidoReproductor(localId: string, deviceId: string) {
  try {
    const ctx = await guardVer();
    if (!ctx.ok || !localId) return { ok: false };
    // Solo escribe si ESTE equipo sigue siendo el altavoz: si otro tomó el
    // relevo, su latido no debe resucitar al anterior.
    const { error } = await ctx.supabase
      .from("musica_reproductor")
      .update({ visto_en: new Date().toISOString() })
      .eq("local_id", localId)
      .eq("device_id", deviceId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[musica] latidoReproductor:", err);
    return { ok: false };
  }
}

/** Deja de ser el equipo de altavoces (libera el local para otro equipo). */
export async function liberarReproductor(localId: string, deviceId: string) {
  try {
    const ctx = await guardVer();
    if (!ctx.ok || !localId) return { ok: false };
    const { error } = await ctx.supabase
      .from("musica_reproductor")
      .update({
        device_id: null,
        device_nombre: null,
        visto_en: null,
        reproduciendo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("local_id", localId)
      .eq("device_id", deviceId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[musica] liberarReproductor:", err);
    return { ok: false };
  }
}

/** Guarda el tope de almacenamiento de música (Configuración). */
export async function guardarCuotaMusica(gigas: number) {
  try {
    const ctx = await guardGestion();
    if (!ctx.ok) return { ok: false, error: ctx.error };
    const g = Math.max(1, Math.min(100, Math.round(gigas)));
    const { error } = await ctx.supabase.from("musica_cuota").upsert(
      {
        empresa_id: ctx.empresaId,
        bytes_limit: g * 1024 ** 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id" },
    );
    if (error) throw error;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] guardarCuotaMusica:", msg);
    return { ok: false, error: msg };
  }
}
