"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { CRONOGRAMA_ROLES } from "@/features/direccion/data/cronogramaAreas";

export type MiCronogramaTarea = {
  id: string;
  rol: string;
  departamento?: string | null;
  tarea: string;
  frecuencia: string;
  formacion?: string | null;
  tiempo_requerido?: string | null;
  resumen?: string | null;
  video_url?: string | null;
  parent_id?: string | null;
  orden?: number | null;
  id_visible?: string | null;
  dia_semana?: number[] | null;
  dia_mes?: number | null;
  fecha_anual?: string | null;
  meses_trimestrales?: number[] | null;
  empleados_asignados?: string[] | null;
  intervalo?: number | null;
  termina_tipo?: "fecha" | "repeticiones" | null;
  termina_fecha?: string | null;
  termina_repeticiones?: number | null;
  fecha_inicio?: string | null;
};

export type AreaMiCronograma = "OPERATIVA" | "ADMINISTRATIVA";

export type MiCronogramaDepartamento = {
  rol: string;
  label: string;
  area: AreaMiCronograma;
  departamento: string;
  tareas: MiCronogramaTarea[];
};

export type MiCronogramaResult =
  | {
      ok: true;
      data: {
        rolLabel: string | null;
        departamentos: MiCronogramaDepartamento[];
      };
    }
  | { ok: false; error: string };

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

// Mapeo cronograma rol (canónico) → módulo padre. Mismo catálogo que
// CRONOGRAMA_TO_MODULO en cronogramaAreas, normalizado a las claves de
// permisos de empresa_roles.
const ROL_TO_MODULO: Record<string, string> = {
  // Operativa
  "JEFE DE SALA": "SALA",
  "JEFE DE COCINA": "COCINA",
  CAMARERO: "SALA",
  COCINERO: "COCINA",
  OFFICE: "COCINA",
  LIMPIEZA: "COCINA",
  SEGURIDAD: "SALA",
  ARTISTA: "SALA",
  // Administrativa
  DIRECCION: "DIRECCION",
  GERENTE: "GERENCIA",
  "RECURSOS HUMANOS": "RECURSOS HUMANOS",
  CALIDAD: "CALIDAD",
  CONTABILIDAD: "CONTABILIDAD",
  LOGISTICA: "LOGISTICA",
  MARKETING: "MARKETING",
  GESTORIA: "GESTORIA",
  JURIDICO: "JURIDICO",
};

const ROL_LABEL: Record<string, string> = {
  "JEFE DE SALA": "Jefe de Sala",
  "JEFE DE COCINA": "Jefe de Cocina",
  CAMARERO: "Camarero",
  COCINERO: "Cocinero",
  OFFICE: "Office",
  LIMPIEZA: "Limpieza",
  SEGURIDAD: "Seguridad",
  ARTISTA: "Artista",
  DIRECCION: "Dirección",
  GERENTE: "Gerente",
  "RECURSOS HUMANOS": "Recursos Humanos",
  CALIDAD: "Calidad",
  CONTABILIDAD: "Contabilidad",
  LOGISTICA: "Logística",
  MARKETING: "Marketing",
  GESTORIA: "Gestoría",
  JURIDICO: "Jurídico",
};

const MODULO_LABEL: Record<string, string> = {
  SALA: "Sala",
  COCINA: "Cocina",
  DIRECCION: "Dirección",
  GERENCIA: "Gerencia",
  "RECURSOS HUMANOS": "Recursos Humanos",
  CALIDAD: "Calidad",
  CONTABILIDAD: "Contabilidad",
  LOGISTICA: "Logística",
  MARKETING: "Marketing",
  GESTORIA: "Gestoría",
  JURIDICO: "Jurídico",
};

// modulo (normalizado) → puestos canónicos.
const ROLS_POR_MODULO_NORM = (() => {
  const map = new Map<string, string[]>();
  for (const [rol, modulo] of Object.entries(ROL_TO_MODULO)) {
    const k = norm(modulo);
    const arr = map.get(k) ?? [];
    arr.push(rol);
    map.set(k, arr);
  }
  return map;
})();

const ORDEN_DEPARTAMENTOS = [
  "DIRECCION",
  "GERENCIA",
  "RECURSOS HUMANOS",
  "MARKETING",
  "CALIDAD",
  "CONTABILIDAD",
  "LOGISTICA",
  "GESTORIA",
  "JURIDICO",
  "COCINA",
  "SALA",
];

export async function getMiCronograma(): Promise<MiCronogramaResult> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) {
      return { ok: true, data: { rolLabel: null, departamentos: [] } };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol_label, departamento")
      .eq("user_id", userId)
      .maybeSingle();

    const rolLabel = ((profile?.rol_label as string | null) ?? null)?.trim() || null;
    const departamentoUsuario =
      ((profile?.departamento as string | null) ?? null)?.trim() || null;

    const modulosUsuario = new Set<string>();
    if (departamentoUsuario) modulosUsuario.add(norm(departamentoUsuario));

    if (rolLabel && empresaId) {
      const { data: rolRow } = await supabase
        .from("empresa_roles")
        .select("permisos")
        .eq("empresa_id", empresaId)
        .ilike("nombre", rolLabel)
        .maybeSingle();
      const permisos = (rolRow?.permisos ?? []) as Array<{
        modulo: string;
        ver: boolean;
      }>;
      for (const p of permisos) {
        if (p?.ver && p.modulo) modulosUsuario.add(norm(p.modulo));
      }
    }

    if (modulosUsuario.size === 0 && rolLabel) {
      modulosUsuario.add(norm(rolLabel));
    }

    // Determinar puestos canónicos accesibles por el usuario.
    const accessibleRols: string[] = [];
    const pushRol = (r: string) => {
      if (!accessibleRols.includes(r)) accessibleRols.push(r);
    };
    for (const m of modulosUsuario) {
      const rols = ROLS_POR_MODULO_NORM.get(m);
      if (rols && rols.length > 0) {
        for (const r of rols) pushRol(r);
      } else {
        const canonical = CRONOGRAMA_ROLES.find((r) => norm(r.rol) === m);
        if (canonical) pushRol(canonical.rol);
      }
    }
    if (rolLabel) {
      const canonical = CRONOGRAMA_ROLES.find(
        (r) => norm(r.rol) === norm(rolLabel),
      );
      if (canonical) pushRol(canonical.rol);
    }

    if (accessibleRols.length === 0) {
      return { ok: true, data: { rolLabel, departamentos: [] } };
    }

    const { data: rows, error } = await supabase
      .from("cronogramas_operativos")
      .select(
        "id, rol, departamento, tarea, frecuencia, formacion, tiempo_requerido, resumen, video_url, parent_id, orden, id_visible, empresa_id, dia_semana, dia_mes, fecha_anual, meses_trimestrales, empleados_asignados, intervalo, termina_tipo, termina_fecha, termina_repeticiones, fecha_inicio",
      )
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getMiCronograma] DB error:", error);
      return { ok: false, error: error.message };
    }

    const accessibleSetNorm = new Set(accessibleRols.map(norm));
    const tareasPorRol = new Map<string, MiCronogramaTarea[]>();

    for (const t of rows ?? []) {
      if (empresaId && t.empresa_id && t.empresa_id !== empresaId) continue;
      const asig = t.empleados_asignados as string[] | null | undefined;
      if (asig && asig.length > 0 && !asig.includes(userId)) continue;

      const rolNorm = norm(t.rol);
      if (!accessibleSetNorm.has(rolNorm)) continue;

      const canonical =
        accessibleRols.find((r) => norm(r) === rolNorm) ?? (t.rol as string);
      const arr = tareasPorRol.get(canonical) ?? [];
      arr.push(t as MiCronogramaTarea);
      tareasPorRol.set(canonical, arr);
    }

    const departamentos: MiCronogramaDepartamento[] = accessibleRols.map(
      (rol) => {
        const modulo = ROL_TO_MODULO[rol] ?? rol;
        const moduloKey = norm(modulo);
        const area: AreaMiCronograma =
          CRONOGRAMA_ROLES.find((r) => norm(r.rol) === norm(rol))?.area ??
          "ADMINISTRATIVA";
        return {
          rol,
          label: ROL_LABEL[rol] ?? rol,
          area,
          departamento: MODULO_LABEL[moduloKey] ?? modulo,
          tareas: tareasPorRol.get(rol) ?? [],
        };
      },
    );

    departamentos.sort((a, b) => {
      if (a.area !== b.area) return a.area === "OPERATIVA" ? -1 : 1;
      const moduloA = norm(ROL_TO_MODULO[a.rol] ?? a.departamento);
      const moduloB = norm(ROL_TO_MODULO[b.rol] ?? b.departamento);
      const ia = ORDEN_DEPARTAMENTOS.indexOf(moduloA);
      const ib = ORDEN_DEPARTAMENTOS.indexOf(moduloB);
      const aIdx = ia === -1 ? 999 : ia;
      const bIdx = ib === -1 ? 999 : ib;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.label.localeCompare(b.label);
    });

    return {
      ok: true,
      data: { rolLabel, departamentos },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[getMiCronograma] Fatal:", err);
    return { ok: false, error: message };
  }
}
