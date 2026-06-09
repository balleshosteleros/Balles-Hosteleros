"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { getMiInformacionLaboral } from "@/features/rrhh/actions/empleados-actions";
import { parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { fallbackCronogramas } from "@/features/direccion/data/cronogramasMockData";
import { getModuloForCronograma } from "@/features/direccion/data/cronogramaAreas";

export type TareaPrioridad = "alta" | "media" | "baja";
export type TareaTipo = "manual" | "nueva_receta_fase" | "sistema" | "cronograma";

export interface TareaRow {
  id: string;
  empresa_id: string | null;
  user_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string | null;
  duracion_minutos: number | null;
  hecha: boolean;
  prioridad: TareaPrioridad;
  tipo: TareaTipo;
  link_url: string | null;
  ref_tabla: string | null;
  ref_id: string | null;
  ref_rol: string | null;
  pospuesta_count: number;
  pospuesta_ultima: string | null;
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

export async function marcarTarea(id: string, hecha: boolean): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("tareas")
      .update({ hecha, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (_err) {
    return { ok: false, error: "No se pudo actualizar la tarea" };
  }
}

/** Alias para compatibilidad — toglea el campo hecha de la tarea */
export async function toggleTareaHecha(id: string): Promise<Result> {
  const { supabase } = await getAppContext();
  const { data: current } = await supabase
    .from("tareas")
    .select("hecha")
    .eq("id", id)
    .single();
  return marcarTarea(id, !current?.hecha);
}

/** Elimina una tarea (solo permitido para tareas tipo 'manual') */
export async function deleteTarea(id: string): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { data: tarea } = await supabase
      .from("tareas")
      .select("tipo")
      .eq("id", id)
      .maybeSingle();
    if (tarea && tarea.tipo === "sistema") {
      return { ok: false, error: "Las tareas del cronograma no se pueden eliminar — usa Posponer." };
    }
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al eliminar" };
  }
}

/**
 * Pospone una tarea: mueve fecha y/o hora_inicio, incrementa el contador de
 * pospuestas en `tareas` y, si la tarea proviene del cronograma, también en
 * la fila correspondiente de `cronograma_ejecuciones` para que las métricas
 * de productividad lo reflejen.
 *
 * `nuevaHora` puede ser null (sin franja horaria asignada). `nuevaFecha` es
 * obligatoria en formato YYYY-MM-DD.
 */
export async function posponerTarea(input: {
  id: string;
  nuevaFecha: string;
  nuevaHora?: string | null;
}): Promise<Result<TareaRow>> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nuevaFecha)) {
      return { ok: false, error: "Fecha inválida" };
    }

    const { data: actual, error: readErr } = await supabase
      .from("tareas")
      .select("id, user_id, fecha, tipo, ref_tabla, ref_id, pospuesta_count")
      .eq("id", input.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!actual) return { ok: false, error: "Tarea no encontrada" };

    const ahora = new Date().toISOString();
    const nuevoCount = (actual.pospuesta_count ?? 0) + 1;

    const { data: actualizada, error: upErr } = await supabase
      .from("tareas")
      .update({
        fecha: input.nuevaFecha,
        hora_inicio: input.nuevaHora ?? null,
        pospuesta_count: nuevoCount,
        pospuesta_ultima: ahora,
        updated_at: ahora,
      })
      .eq("id", input.id)
      .select()
      .single();
    if (upErr) throw upErr;

    // Si es tarea de cronograma, replicar en cronograma_ejecuciones
    const esCronograma =
      actual.tipo === "sistema" &&
      typeof actual.ref_tabla === "string" &&
      actual.ref_tabla.startsWith("cronogramas_operativos") &&
      actual.ref_id;

    if (esCronograma) {
      const { data: ejec } = await supabase
        .from("cronograma_ejecuciones")
        .select("id, pospuesta_count")
        .eq("tarea_id", actual.ref_id)
        .eq("user_id", actual.user_id ?? userId)
        .eq("fecha_programada", actual.fecha)
        .maybeSingle();

      if (ejec) {
        await supabase
          .from("cronograma_ejecuciones")
          .update({
            fecha_programada: input.nuevaFecha,
            hora_inicio: input.nuevaHora ?? null,
            pospuesta_count: (ejec.pospuesta_count ?? 0) + 1,
            pospuesta_ultima: ahora,
            updated_at: ahora,
          })
          .eq("id", ejec.id);
      }
    }

    return { ok: true, data: actualizada as TareaRow };
  } catch (err) {
    console.error("[posponerTarea]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error al posponer" };
  }
}

/**
 * Cuenta tareas pendientes de hoy para el badge del header.
 *
 * Las tareas de cronograma (tipo "sistema") solo cuentan si pertenecen a un
 * módulo que el usuario tiene en su rol (permisos con ver:true) — mismo criterio
 * que la vista por defecto del cajón. Las de otros puestos previsualizados en el
 * filtro "por puesto" no deben inflar el contador. Encargos y personales
 * (no-sistema) siempre cuentan.
 */
export async function contarPendientesHoy(): Promise<{ ok: boolean; data: number }> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: true, data: 0 };
    const hoy = new Date().toISOString().split("T")[0];

    const norm = (s: string | null | undefined) =>
      (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

    // Módulos visibles = permisos del rol del usuario (ver:true) + su puesto.
    const { data: prof } = await supabase
      .from("usuarios")
      .select("rol_label, departamento")
      .eq("user_id", userId)
      .maybeSingle();
    const rolLabel =
      (prof?.rol_label as string | null)?.trim()
      || (prof?.departamento as string | null)?.trim()
      || "";

    const visibles = new Set<string>();
    if (rolLabel && empresaId) {
      const { data: rolRow } = await supabase
        .from("empresa_roles")
        .select("permisos")
        .eq("empresa_id", empresaId)
        .ilike("nombre", rolLabel)
        .maybeSingle();
      const permisos = (rolRow?.permisos ?? []) as Array<{ modulo: string; ver: boolean }>;
      for (const p of permisos) {
        if (p.ver && p.modulo) visibles.add(norm(getModuloForCronograma(p.modulo)));
      }
    }
    if (rolLabel) visibles.add(norm(getModuloForCronograma(rolLabel)));

    // Modelo nuevo: si el empleado tiene puestos, sus tareas de sistema YA son
    // las de los cronogramas de sus puestos → todas cuentan, sin filtro de módulo.
    const tienePuestos = (await getPuestoIdsDelUsuario()).length > 0;

    const { data, error } = await supabase
      .from("tareas")
      .select("tipo, ref_tabla")
      .eq("user_id", userId)
      .eq("fecha", hoy)
      .eq("hecha", false);
    if (error) throw error;

    const count = (data ?? []).filter((t) => {
      if (t.tipo !== "sistema") return true;
      if (tienePuestos) return true;
      if (visibles.size === 0) return false;
      const rt = (t.ref_tabla as string | null) ?? "";
      const i = rt.indexOf(":");
      const rol = i >= 0 ? rt.slice(i + 1) : "";
      return visibles.has(norm(getModuloForCronograma(rol)));
    }).length;

    return { ok: true, data: count };
  } catch {
    return { ok: true, data: 0 };
  }
}

export async function listTareasSugeridas() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const infoLaboral = await getMiInformacionLaboral();
    if (!infoLaboral.ok || !infoLaboral.data) {
      return { ok: true, data: [] };
    }

    const info = infoLaboral.data as {
      departamentos?: { nombre?: string } | null;
      puestos_trabajo?: { nombre?: string } | null;
    };
    const rolesToMatch: string[] = [];
    if (info.departamentos?.nombre) rolesToMatch.push(info.departamentos.nombre.toUpperCase());
    if (info.puestos_trabajo?.nombre) rolesToMatch.push(info.puestos_trabajo.nombre.toUpperCase());

    if (rolesToMatch.length === 0) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("cronogramas_operativos")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("rol", rolesToMatch);

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[tareas] listTareasSugeridas:", err);
    return { ok: false, data: [] };
  }
}

export async function completarTareaSugerida(cronogramaId: string, titulo: string) {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, error: "No autenticado" };

    const hoy = new Date().toISOString().split("T")[0];
    const { data: existente } = await supabase
      .from("tareas")
      .select("id")
      .eq("user_id", userId)
      .eq("ref_tabla", "cronogramas_operativos")
      .eq("ref_id", cronogramaId)
      .eq("fecha", hoy)
      .maybeSingle();

    if (existente) return { ok: true };

    const { error } = await supabase.from("tareas").insert({
      empresa_id: empresaId,
      user_id: userId,
      titulo: titulo,
      fecha: hoy,
      hecha: true,
      prioridad: "media",
      tipo: "sistema",
      ref_tabla: "cronogramas_operativos",
      ref_id: cronogramaId
    });

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[tareas] completarTareaSugerida:", err);
    return { ok: false, error: "Error al marcar tarea" };
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
  dia_semana: number[] | string | number | null;
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

/** Parsea "30 MIN" / "1 HORA" / "2 HORAS" / "1.5 HORAS" / "45M" → minutos. */
function parseDuracionMinutos(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const m = s.match(/^([\d.,]+)\s*([A-Z]*)$/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (!isFinite(n)) return null;
  const unit = m[2];
  if (unit.startsWith("H")) return Math.round(n * 60);
  if (unit.startsWith("M") || unit === "") return Math.round(n);
  return null;
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

/**
 * IDs de los puestos que ocupa el usuario actual (modelo nuevo M:N). Un empleado
 * tiene UNA ficha (UNIQUE user_id) que puede ocupar varios puestos; sus tareas
 * son las de los cronogramas de TODOS ellos. Vacío = aún sin puestos asignados.
 */
async function getPuestoIdsDelUsuario(): Promise<string[]> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return [];
    const { data: emps } = await supabase.from("empleados").select("id").eq("user_id", userId);
    const empIds = (emps ?? []).map((e) => e.id as string);
    if (empIds.length === 0) return [];
    const { data: eps } = await supabase
      .from("empleado_puestos").select("puesto_id").in("empleado_id", empIds);
    return Array.from(new Set((eps ?? []).map((r) => r.puesto_id as string))).filter(Boolean);
  } catch (err) {
    console.error("[getPuestoIdsDelUsuario]", err);
    return [];
  }
}

/** ¿El usuario tiene puestos asignados? (modelo nuevo activo para él). */
export async function usuarioTienePuestos(): Promise<boolean> {
  return (await getPuestoIdsDelUsuario()).length > 0;
}

/**
 * Cronogramas del usuario por sus puestos (modelo nuevo). Devuelve null si el
 * empleado todavía no tiene puestos: el llamador cae al modelo antiguo por rol.
 */
async function getCronogramasPorPuestosUsuario(): Promise<CronogramaTareaRow[] | null> {
  const puestoIds = await getPuestoIdsDelUsuario();
  if (puestoIds.length === 0) return null;
  try {
    const { supabase } = await getAppContext();
    const { data } = await supabase
      .from("cronogramas_operativos").select("*").in("puesto_id", puestoIds);
    return (data ?? []) as CronogramaTareaRow[];
  } catch (err) {
    console.error("[getCronogramasPorPuestosUsuario]", err);
    return null;
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
    
    const { data: initialData, error } = await supabase
      .from("cronogramas_operativos")
      .select("rol");
    let data = initialData;
    
    if (error) {
      console.error("[getRolesCronograma] DB Error:", error);
    }

    if (!data || data.length === 0) {
      try {
        console.log("[getRolesCronograma] Sembrando cronogramas_operativos desde mock...");
        const toInsert = fallbackCronogramas.slice(0, 100).map((f) => ({
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
  } catch (err) {
    console.error("[getRolesCronograma] Fatal Error, returning Mock Fallback:", err);
    const mockRoles = Array.from(new Set(fallbackCronogramas.map(f => f.rol.toUpperCase().trim()))).sort();
    return { ok: true, data: mockRoles };
  }
}

/**
 * Devuelve los módulos/departamentos visibles para el rol del usuario actual.
 * Lee `profiles.rol_label` y consulta `empresa_roles.permisos` (JSONB
 * `[{modulo, ver, editar}]`).
 *
 * Resultado:
 *   - moduloPropio: módulo asignado al rol del usuario (puede ser null si no
 *     se encuentra mapeo).
 *   - modulosVisibles: lista única de módulos con `ver=true` para el rol.
 *
 * Si el usuario es director (bypass total), devuelve todos los módulos.
 */
export async function getDepartamentosVisibles(): Promise<
  Result<{ moduloPropio: string | null; modulosVisibles: string[] }>
> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) {
      return { ok: true, data: { moduloPropio: null, modulosVisibles: [] } };
    }

    const { data: profile } = await supabase
      .from("usuarios")
      .select("rol_label")
      .eq("user_id", userId)
      .maybeSingle();
    const rolLabel = (profile?.rol_label as string | null)?.trim() ?? null;

    // Director del SaaS: bypass — ve todo.
    const { data: rolesRows } = await supabase
      .from("usuario_roles")
      .select("role")
      .eq("user_id", userId);
    const appRoles = (rolesRows ?? []).map((r) => r.role as string);
    const esDirectorGlobal = appRoles.includes("director") || appRoles.includes("admin");

    let modulosVisibles: string[] = [];
    let moduloPropio: string | null = null;

    if (rolLabel) {
      const { data: rolRow } = await supabase
        .from("empresa_roles")
        .select("permisos")
        .eq("empresa_id", empresaId)
        .ilike("nombre", rolLabel)
        .maybeSingle();
      const permisos = (rolRow?.permisos ?? []) as Array<{
        modulo: string;
        ver: boolean;
        editar: boolean;
      }>;
      modulosVisibles = permisos
        .filter((p) => p.ver)
        .map((p) => p.modulo)
        .filter(Boolean)
        .map((m) => getModuloForCronograma(m));
    }

    // El director SOLO cae al set completo si su rol no tiene permisos
    // configurados (red de seguridad para no dejarlo sin nada). Si los tiene,
    // se respetan: así puede quitar un módulo (p.ej. Gerencia) de su rol y
    // dejar de ver sus tareas.
    if (esDirectorGlobal && modulosVisibles.length === 0) {
      modulosVisibles = [
        "Dirección", "Gerencia", "RRHH", "Logística", "Cocina",
        "Sala", "Calidad", "Contabilidad", "Gestoría", "Jurídico", "Marketing",
      ];
    }

    // Mapea el rol_label al módulo propio.
    const ROLE_MODULE_MAP: Record<string, string> = {
      "DIRECTOR": "Dirección",
      "GERENTE": "Gerencia",
      "RESPONSABLE RRHH": "RRHH",
      "JEFE DE LOGÍSTICA": "Logística",
      "JEFE DE COCINA": "Cocina",
      "JEFE DE SALA": "Sala",
      "RESPONSABLE CALIDAD": "Calidad",
      "CONTABLE": "Contabilidad",
      "GESTOR": "Gestoría",
      "ABOGADO": "Jurídico",
      "RESPONSABLE MARKETING": "Marketing",
    };
    if (rolLabel) {
      moduloPropio = ROLE_MODULE_MAP[rolLabel.toUpperCase()] ?? null;
    }

    return {
      ok: true,
      data: {
        moduloPropio,
        modulosVisibles: Array.from(new Set(modulosVisibles)),
      },
    };
  } catch (err) {
    console.error("[getDepartamentosVisibles] Fatal:", err);
    return {
      ok: true,
      data: { moduloPropio: null, modulosVisibles: [] },
    };
  }
}

export async function listCronogramasPorRol(rol: string): Promise<Result<Record<string, unknown>[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    // Devolvemos TODAS las filas del rol (padres + hijos). El cliente las usa para:
    //  · construir el mapa de aclaraciones (filas con parent_id) que se muestran con el
    //    icono ℹ️ dentro de su tarea padre, y
    //  · listar las tareas sin fecha fija (parent_id null + frecuencia OTRO/POR NECESIDAD).
    let query = supabase
      .from("cronogramas_operativos")
      .select("id, rol, tarea, resumen, frecuencia, parent_id, orden")
      .ilike("rol", rol.trim());
    // Multi-empresa: limitar a la empresa activa para no mezclar filas de otras empresas.
    const esUuid = empresaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId);
    if (esUuid) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[listCronogramasPorRol]", err);
    return { ok: false, error: "Error al cargar información del rol" };
  }
}

// Marcador en `tareas.ref_tabla` para las marcas diarias de tareas "por necesidad".
// Se distingue de las rutinarias (`cronogramas_operativos:ROL`) por el sufijo `_pn`.
const PN_REF_PREFIX = "cronogramas_operativos_pn";

/**
 * Devuelve los ids de cronograma "por necesidad" que el usuario marcó como hechos
 * en una fecha concreta (las excepciones del día). Materialización perezosa: solo
 * existe fila en `tareas` cuando se marcó.
 */
export async function getPorNecesidadHechas(fechaIso: string): Promise<Result<string[]>> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("tareas")
      .select("ref_id")
      .eq("user_id", userId)
      .eq("fecha", fechaIso)
      .eq("hecha", true)
      .like("ref_tabla", `${PN_REF_PREFIX}:%`);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => r.ref_id as string).filter(Boolean) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Marca/desmarca una tarea "por necesidad" como hecha en una fecha. Crea la fila
 * en `tareas` al marcar y la borra al desmarcar. Devuelve el nuevo estado (hecha).
 */
export async function togglePorNecesidadHecha(input: {
  cronogramaId: string;
  rol: string;
  titulo: string;
  fechaIso: string;
}): Promise<Result<boolean>> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    const refTabla = `${PN_REF_PREFIX}:${input.rol}`;
    const { data: existing } = await supabase
      .from("tareas")
      .select("id")
      .eq("user_id", userId)
      .eq("fecha", input.fechaIso)
      .eq("ref_tabla", refTabla)
      .eq("ref_id", input.cronogramaId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("tareas").delete().eq("id", existing.id);
      if (error) throw error;
      return { ok: true, data: false };
    }

    const esUuid =
      empresaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId);
    const { error } = await supabase.from("tareas").insert({
      empresa_id: esUuid ? empresaId : null,
      user_id: userId,
      titulo: input.titulo,
      fecha: input.fechaIso,
      hecha: true,
      prioridad: "alta" as TareaPrioridad,
      tipo: "sistema" as TareaTipo,
      ref_tabla: refTabla,
      ref_id: input.cronogramaId,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true, data: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function syncTareasCronograma(dateIso?: string, forcedRol?: string): Promise<Result<SeedSummary>> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) {
      console.log("[sync] No userId found in context");
      return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };
    }

    // Modelo nuevo: las tareas del empleado son las de los cronogramas de TODOS
    // sus puestos. Si aún no tiene puestos, caemos al modelo antiguo por rol.
    const porPuestos = forcedRol ? null : await getCronogramasPorPuestosUsuario();

    let rol = forcedRol;
    let candidatos: CronogramaTareaRow[];
    if (porPuestos && porPuestos.length > 0) {
      candidatos = porPuestos;
      rol = rol ?? "Mis puestos";
    } else {
      if (!rol) {
        // Preferimos rol_label / departamento (claves de cronogramas_operativos.rol)
        // sobre usuario_roles.role (rol RBAC del sistema: empleado/admin/etc).
        const { data: prof } = await supabase
          .from("usuarios")
          .select("rol_label, departamento")
          .eq("user_id", userId)
          .maybeSingle();
        rol = (prof?.rol_label as string | null)?.trim()
          || (prof?.departamento as string | null)?.trim()
          || undefined;
        if (!rol) {
          const { data: rData } = await supabase.from("usuario_roles").select("role").eq("user_id", userId);
          const roles = rData?.map(r => r.role as string) || [];
          rol = roles.includes("admin") ? "Dirección" : (roles[0] || "Dirección");
        }
      }
      if (!rol) return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };
      candidatos = await getCronogramasParaSync(rol);
    }
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
      duracion_minutos: parseDuracionMinutos(t.tiempo_requerido),
      hecha: false,
      prioridad: "alta" as TareaPrioridad,
      tipo: "sistema" as TareaTipo,
      ref_tabla: `cronogramas_operativos:${t.rol}`,
      ref_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id) ? t.id : null,
      created_by: userId,
    }));

    const { error: iErr } = await supabase.from("tareas").insert(rows);
    if (iErr) {
      console.error("[sync] Error de inserción:", iErr);
      return { ok: false, error: `DB Error [${iErr.code}]: ${iErr.message}. Details: ${iErr.details}` };
    }

    return { ok: true, data: { rol, insertadas: rows.length, yaExistian: existSet.size } };
  } catch (err) {
    console.error("[syncTareasCronograma] Fatal:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: message };
  }
}

export async function syncTareasCronogramaRange(dates: string[], forcedRol?: string): Promise<Result> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: true, data: undefined };

    // Modelo nuevo: fuente = cronogramas de los puestos del empleado (fallback a rol).
    const porPuestos = forcedRol ? null : await getCronogramasPorPuestosUsuario();

    let rol = forcedRol;
    let candidatos: CronogramaTareaRow[];
    if (porPuestos && porPuestos.length > 0) {
      candidatos = porPuestos;
      rol = rol ?? "Mis puestos";
    } else {
      if (!rol) {
        const { data: prof } = await supabase
          .from("usuarios")
          .select("rol_label, departamento")
          .eq("user_id", userId)
          .maybeSingle();
        rol = (prof?.rol_label as string | null)?.trim()
          || (prof?.departamento as string | null)?.trim()
          || undefined;
        if (!rol) {
          const { data: rData } = await supabase
            .from("usuario_roles")
            .select("role")
            .eq("user_id", userId);
          const roles = rData?.map(r => r.role as string) || [];
          rol = roles.includes("admin") ? "Dirección" : (roles[0] || "Dirección");
        }
      }
      if (!rol) return { ok: true, data: undefined };
      candidatos = await getCronogramasParaSync(rol);
    }

    console.log(`[sync] Iniciando para rol: ${rol}, fechas: ${dates.length}`);
    if (candidatos.length === 0) return { ok: true, data: undefined };

    const toInsert: Record<string, unknown>[] = [];

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
            duracion_minutos: parseDuracionMinutos(t.tiempo_requerido),
            hecha: false,
            prioridad: "alta",
            tipo: "sistema",
            ref_tabla: `cronogramas_operativos:${t.rol}`,
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


