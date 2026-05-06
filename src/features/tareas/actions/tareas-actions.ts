"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { fallbackCronogramas } from "@/features/direccion/data/cronogramasMockData";

export type TareaPrioridad = "alta" | "media" | "baja";
export type TareaTipo = "manual" | "nueva_receta_fase" | "sistema" | "cronograma";

export interface TareaRow {
  id: string;
  empresa_id: string | null;
  user_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hecha: boolean;
  prioridad: TareaPrioridad;
  tipo: TareaTipo;
  link_url: string | null;
  ref_tabla: string | null;
  ref_id: string | null;
  ref_rol: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const TIPO_ORDER: Record<TareaTipo, number> = {
  cronograma: 0,
  nueva_receta_fase: 1,
  manual: 2,
  sistema: 3,
};

function sortTareas(rows: TareaRow[]): TareaRow[] {
  return rows.slice().sort((a, b) => {
    const fa = a.fecha;
    const fb = b.fecha;
    if (fa !== fb) return fa < fb ? -1 : 1;
    const ta = TIPO_ORDER[a.tipo] ?? 99;
    const tb = TIPO_ORDER[b.tipo] ?? 99;
    if (ta !== tb) return ta - tb;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

/**
 * Lista tareas del usuario actual. Las tareas tipo "cronograma" salen primero
 * dentro de cada día.
 */
export async function listTareasMias(): Promise<Result<TareaRow[]>> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .eq("user_id", userId)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return { ok: true, data: sortTareas((data as TareaRow[]) ?? []) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Crea una tarea manual para el usuario actual.
 */
export async function crearTareaManual(input: {
  titulo: string;
  fecha: string;
  prioridad: TareaPrioridad;
}): Promise<Result<TareaRow>> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        empresa_id: empresaId,
        user_id: userId,
        titulo: input.titulo,
        fecha: input.fecha,
        prioridad: input.prioridad,
        tipo: "manual",
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as TareaRow };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Crea una tarea asignada a otro usuario (ej: al mover fase de receta).
 */
export async function crearTareaAsignada(input: {
  user_id: string;
  empresa_id: string;
  titulo: string;
  descripcion?: string | null;
  tipo?: TareaTipo;
  prioridad?: TareaPrioridad;
  link_url?: string;
  ref_tabla?: string;
  ref_id?: string;
}): Promise<Result<TareaRow>> {
  try {
    const { supabase, userId } = await getAppContext();
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        empresa_id: input.empresa_id,
        user_id: input.user_id,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        fecha: new Date().toISOString().slice(0, 10),
        prioridad: input.prioridad ?? "media",
        tipo: input.tipo ?? "manual",
        link_url: input.link_url ?? null,
        ref_tabla: input.ref_tabla ?? null,
        ref_id: input.ref_id ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as TareaRow };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function toggleTareaHecha(id: string): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { data: cur } = await supabase
      .from("tareas")
      .select("hecha")
      .eq("id", id)
      .single();
    const { error } = await supabase
      .from("tareas")
      .update({ hecha: !cur?.hecha })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Cuenta las tareas pendientes del usuario actual para hoy.
 * Usada por useDailyCounts en el header.
 */
export async function contarPendientesHoy(): Promise<Result<number>> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: 0 };
    const hoy = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from("tareas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("fecha", hoy)
      .eq("hecha", false);
    if (error) throw error;
    return { ok: true, data: count ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteTarea(id: string): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/* ───────────── Cronogramas → Mis Tareas (auto-seed) ───────────── */

interface CronogramaTareaRow {
  id: string;
  rol: string;
  tarea: string;
  resumen: string | null;
  frecuencia: string | null;
  tiempo_requerido: string | null;
  dia_semana: number[] | null;
  dia_mes: number | null;
  fecha_anual: string | null;
  meses_trimestrales: number[] | null;
  empleados_asignados: string[] | null;
  parent_id: string | null;
  empresa_id: string | null;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekday(d: Date): number {
  const js = d.getDay(); 
  return js === 0 ? 7 : js;
}

function tocaHoy(t: CronogramaTareaRow, hoy: Date): boolean {
  const f = (t.frecuencia ?? "").toUpperCase();
  if (!f) return false;
  if (f === "DIARIO") return true;

  const diaNombre = format(hoy, 'EEEE', { locale: es }).toLowerCase();
  const diaNum = isoWeekday(hoy);

  if (f === "SEMANAL") {
    const val = t.dia_semana;
    // Si no tiene día asignado, la mostramos el Lunes por defecto para que no se pierda
    if (!val) return diaNum === 1; 
    
    if (Array.isArray(val)) return val.includes(diaNum);
    if (typeof val === 'string') {
      const v = val.toLowerCase();
      if (v === "lunes" || v === "1") return diaNum === 1;
      if (v === "martes" || v === "2") return diaNum === 2;
      if (v === "miercoles" || v === "miércoles" || v === "3") return diaNum === 3;
      if (v === "jueves" || v === "4") return diaNum === 4;
      if (v === "viernes" || v === "5") return diaNum === 5;
      if (v === "sabado" || v === "sábado" || v === "6") return diaNum === 6;
      if (v === "domingo" || v === "7") return diaNum === 7;
      return v === diaNombre;
    }
    if (typeof val === 'number') return val === diaNum;
    return false;
  }
  if (f === "MENSUAL") {
    return t.dia_mes === hoy.getDate();
  }
  if (f === "TRIMESTRAL") {
    const meses = t.meses_trimestrales ?? [1, 4, 7, 10];
    return meses.includes(hoy.getMonth() + 1) && t.dia_mes === hoy.getDate();
  }
  if (f === "ANUAL") {
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    return t.fecha_anual === `${mm}-${dd}`;
  }
  
  // TODO: [OBSERVACIÓN PENDIENTE DE EQUIPO] - Tareas "POR NECESIDAD" y "OTRO"
  // Actualmente estas tareas retornan `false` al final de esta función porque no tienen una fecha calendario matemática.
  // Esto significa que NO se sincronizarán ni aparecerán en las pestañas de Hoy/Semana/Mes.
  // Hay que definir si se crearán botones manuales para "gatillarlas", o si se deben mostrar siempre de forma flotante.
  return false;
}

async function getCronogramasParaSync(rol: string): Promise<CronogramaTareaRow[]> {
  try {
    const { supabase } = await getAppContext();
    
    // 1. Intento normalizado
    const { data, error } = await supabase
      .from("cronogramas_operativos")
      .select("*")
      .ilike("rol", rol.trim());
    
    if (!error && data && data.length > 0) {
      return data as CronogramaTareaRow[];
    }

    // 2. Si no hay datos, probamos con fallback manual para ser 100% seguros
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const rolNorm = norm(rol);
    
    // Intentar buscar todos y filtrar en JS (más lento pero infalible ante acentos/mayúsculas)
    const { data: allData } = await supabase.from("cronogramas_operativos").select("*");
    const matches = (allData || []).filter(r => norm(r.rol) === rolNorm);
    
    if (matches.length > 0) return matches as CronogramaTareaRow[];

    // 3. Fallback a Mock si nada funcionó
    console.log(`[sync] Usando fallback mock para rol: ${rol}`);
    return fallbackCronogramas
      .filter(f => norm(f.rol || "") === rolNorm) as unknown as CronogramaTareaRow[];
  } catch (err) {
    console.error("[getCronogramasParaSync] Fatal:", err);
    return [];
  }
}

interface SeedSummary {
  rol: string | null;
  insertadas: number;
  yaExistian: number;
}

export async function getRolesCronograma(): Promise<Result<string[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    
    let { data, error } = await supabase
      .from("cronogramas_operativos")
      .select("rol");
    
    if (error) {
      console.error("[getRolesCronograma] DB Error:", error);
    }

    if (!data || data.length === 0) {
      try {
        console.log("[getRolesCronograma] Sembrando cronogramas_operativos desde mock...");
        const toInsert = fallbackCronogramas.slice(0, 100).map((f: any) => ({
          rol: (f.rol || "GENERAL").toUpperCase().trim(),
          tarea: f.tarea || "Tarea sin título",
          frecuencia: (f.frecuencia || "OTRO").toUpperCase(),
          empresa_id: empresaId,
        }));
        await supabase.from("cronogramas_operativos").insert(toInsert);
        const { data: data2 } = await supabase.from("cronogramas_operativos").select("rol");
        if (data2) data = data2;
      } catch (seedErr) {
        console.error("[getRolesCronograma] Seeding failed:", seedErr);
      }
    }

    let roles: string[] = [];
    if (data && data.length > 0) {
      roles = Array.from(new Set(data.map(r => r.rol.trim()))).filter(Boolean).sort();
    }
    
    if (roles.length === 0) {
       roles = Array.from(new Set(fallbackCronogramas.map(f => f.rol.toUpperCase().trim()))).sort();
    }
    
    return { ok: true, data: roles };
  } catch (err: any) {
    console.error("[getRolesCronograma] Fatal Error, returning Mock Fallback:", err);
    const mockRoles = Array.from(new Set(fallbackCronogramas.map(f => f.rol.toUpperCase().trim()))).sort();
    return { ok: true, data: mockRoles };
  }
}

export async function listCronogramasPorRol(rol: string): Promise<Result<any[]>> {
  try {
    const { supabase } = await getAppContext();
    // No filtramos por frecuencia para que el usuario vea TODO lo disponible para ese rol
    // en la sección de información de apoyo.
    const { data, error } = await supabase
      .from("cronogramas_operativos")
      .select("*")
      .ilike("rol", rol.trim());
    
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[listCronogramasPorRol]", err);
    return { ok: false, error: "Error al cargar información del rol" };
  }
}

export async function syncTareasCronograma(dateIso?: string, forcedRol?: string): Promise<Result<SeedSummary>> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) {
      console.log("[sync] No userId found in context");
      return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };
    }

    let rol = forcedRol;
    if (!rol) {
      const { data: rData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = rData?.map(r => r.role as string) || [];
      rol = roles.includes("admin") ? "Dirección" : (roles[0] || "Dirección");
    }
    
    if (!rol) return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };

    // Búsqueda más flexible
    const candidatos = await getCronogramasParaSync(rol);
    const targetDate = dateIso ? parseISO(dateIso) : new Date();
    const targetIso = ymd(targetDate);

    console.log(`[sync] Iniciando para "${rol}" (${targetIso}). Candidatos base: ${candidatos.length}`);

    const aSembrar = candidatos.filter((t) => {
      const aplica = tocaHoy(t, targetDate);
      if (!aplica) return false;
      const asig = t.empleados_asignados;
      if (forcedRol || !asig || asig.length === 0) return true;
      return asig.includes(userId);
    });

    console.log(`[sync] Tareas que aplican tras filtros: ${aSembrar.length}`);

    if (aSembrar.length === 0) return { ok: true, data: { rol, insertadas: 0, yaExistian: 0 } };

    // Obtener existentes de forma segura
    const idsParaValidar = aSembrar
      .map(t => t.id)
      .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    
    let existSet = new Set<string>();
    if (idsParaValidar.length > 0) {
      const { data: existentes, error: eErr } = await supabase
        .from("tareas")
        .select("ref_id")
        .eq("user_id", userId)
        .eq("fecha", targetIso)
        .like("ref_tabla", "cronogramas_operativos%")
        .in("ref_id", idsParaValidar);
      
      if (eErr) {
        console.error("[sync] Error al validar existentes:", eErr);
      } else if (existentes) {
        existSet = new Set(existentes.map(r => r.ref_id));
      }
    }

    const nuevas = aSembrar.filter((t) => !existSet.has(t.id));
    console.log(`[sync] Nuevas a insertar: ${nuevas.length}`);

    if (nuevas.length === 0) return { ok: true, data: { rol, insertadas: 0, yaExistian: existSet.size } };

    const isUuid = (str: string | null) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const rows = nuevas.map((t) => ({
      empresa_id: isUuid(empresaId) ? empresaId : null,
      user_id: userId,
      titulo: t.tarea,
      descripcion: t.resumen ?? null,
      fecha: targetIso,
      hecha: false,
      prioridad: "alta" as TareaPrioridad,
      tipo: "sistema" as TareaTipo, // Cambiado de 'cronograma' a 'sistema' para cumplir con el check constraint de la DB
      ref_tabla: `cronogramas_operativos:${t.rol}`, // Usamos ref_tabla para guardar el rol, ya que ref_rol no existe
      ref_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id) ? t.id : null,
      created_by: userId,
    }));

    const { error: iErr } = await supabase.from("tareas").insert(rows);
    if (iErr) {
      console.error("[sync] Error de inserción:", iErr);
      return { ok: false, error: `DB Error [${iErr.code}]: ${iErr.message}. Details: ${iErr.details}` };
    }

    return { ok: true, data: { rol, insertadas: rows.length, yaExistian: existSet.size } };
  } catch (err: any) {
    console.error("[syncTareasCronograma] Fatal:", err);
    return { ok: false, error: err?.message || "Error desconocido" };
  }
}

export async function syncTareasCronogramaRange(dates: string[], forcedRol?: string): Promise<Result> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: true, data: undefined };

    let rol = forcedRol;
    if (!rol) {
      const { data: rData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = rData?.map(r => r.role as string) || [];
      rol = roles.includes("admin") ? "Dirección" : (roles[0] || "Dirección");
    }
    
    console.log(`[sync] Iniciando para rol: ${rol}, fechas: ${dates.length}`);
    if (!rol) return { ok: true, data: undefined };

    const candidatos = await getCronogramasParaSync(rol);
    if (candidatos.length === 0) return { ok: true, data: undefined };

    const toInsert: any[] = [];
    
    // Validar UUIDs para evitar error 400
    const idsValidos = candidatos
      .map(c => c.id)
      .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    let existMap = new Set<string>();
    if (idsValidos.length > 0) {
      const { data: existentes, error: eErr } = await supabase
        .from("tareas")
        .select("ref_id, fecha")
        .eq("user_id", userId)
        .like("ref_tabla", "cronogramas_operativos%")
        .in("ref_id", idsValidos)
        .in("fecha", dates);
      
      if (eErr) console.error("[syncRange] Error DB:", eErr);
      else existMap = new Set(existentes?.map(e => `${e.ref_id}_${ymd(parseISO(e.fecha))}`) ?? []);
    }

    for (const dStr of dates) {
      const d = parseISO(dStr);
      const aSembrar = candidatos.filter((t) => {
        if (!tocaHoy(t, d)) return false;
        const asig = t.empleados_asignados;
        if (forcedRol || !asig || asig.length === 0) return true;
        return asig.includes(userId);
      });

      const isUuid = (str: string | null) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      for (const t of aSembrar) {
        if (!existMap.has(`${t.id}_${dStr}`)) {
          toInsert.push({
            empresa_id: isUuid(empresaId) ? empresaId : null,
            user_id: userId,
            titulo: t.tarea,
            descripcion: t.resumen ?? null,
            fecha: dStr,
            hecha: false,
            prioridad: "alta",
            tipo: "sistema", // Cambiado de 'cronograma' a 'sistema'
            ref_tabla: `cronogramas_operativos:${t.rol}`, // Usamos ref_tabla para guardar el rol
            ref_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id) ? t.id : null,
            created_by: userId,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      console.log(`[syncRange] Insertando ${toInsert.length} nuevas tareas para ${rol}`);
      const { error: iErr } = await supabase.from("tareas").insert(toInsert);
      if (iErr) {
        console.error("[syncRange] Error insertando tareas:", iErr);
        throw new Error(`DB Error [${iErr.code}]: ${iErr.message}. Details: ${iErr.details}`);
      }
    }

    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[syncTareasCronogramaRange]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
