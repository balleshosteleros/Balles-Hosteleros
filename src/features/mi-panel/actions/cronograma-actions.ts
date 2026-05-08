"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type MiCronogramaTarea = {
  id: string;
  rol: string;
  tarea: string;
  frecuencia: string;
  formacion?: string | null;
  tiempo_requerido?: string | null;
  resumen?: string | null;
  video_url?: string | null;
  parent_id?: string | null;
  orden?: number | null;
  dia_semana?: number[] | null;
  dia_mes?: number | null;
  fecha_anual?: string | null;
  meses_trimestrales?: number[] | null;
  empleados_asignados?: string[] | null;
};

export type MiCronogramaDepartamento = {
  rol: string;
  label: string;
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
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const MODULO_TO_CRONOGRAMA_ROLES: Record<string, string[]> = {
  DIRECCION: ["DIRECCION", "DIRECTOR"],
  SALA: ["JEFE DE SALA", "SALA"],
  COCINA: ["JEFE DE COCINA", "COCINA"],
  GERENCIA: ["GERENTE", "GERENCIA"],
  CALIDAD: ["CALIDAD", "RESPONSABLE CALIDAD"],
  "RECURSOS HUMANOS": ["RECURSOS HUMANOS", "RRHH", "RESPONSABLE RRHH"],
  RRHH: ["RECURSOS HUMANOS", "RRHH", "RESPONSABLE RRHH"],
  MARKETING: ["MARKETING", "RESPONSABLE MARKETING"],
  LOGISTICA: ["LOGISTICA", "JEFE DE LOGISTICA"],
  CONTABILIDAD: ["CONTABILIDAD", "CONTABLE"],
  GESTORIA: ["GESTORIA", "GESTOR"],
  JURIDICO: ["JURIDICO", "ABOGADO"],
};

const DEPARTAMENTO_LABEL: Record<string, string> = {
  DIRECCION: "Dirección",
  SALA: "Sala",
  COCINA: "Cocina",
  GERENCIA: "Gerencia",
  CALIDAD: "Calidad",
  "RECURSOS HUMANOS": "Recursos Humanos",
  RRHH: "Recursos Humanos",
  MARKETING: "Marketing",
  LOGISTICA: "Logística",
  CONTABILIDAD: "Contabilidad",
  GESTORIA: "Gestoría",
  JURIDICO: "Jurídico",
};

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

    if (modulosUsuario.size === 0) {
      return { ok: true, data: { rolLabel, departamentos: [] } };
    }

    const candidatosPorModulo = new Map<string, Set<string>>();
    for (const modulo of modulosUsuario) {
      const candidatos = MODULO_TO_CRONOGRAMA_ROLES[modulo] ?? [modulo];
      const set = new Set(candidatos.map(norm));
      candidatosPorModulo.set(modulo, set);
    }

    const { data: rows, error } = await supabase
      .from("cronogramas_operativos")
      .select(
        "id, rol, tarea, frecuencia, formacion, tiempo_requerido, resumen, video_url, parent_id, orden, empresa_id, dia_semana, dia_mes, fecha_anual, meses_trimestrales, empleados_asignados",
      )
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getMiCronograma] DB error:", error);
      return { ok: false, error: error.message };
    }

    const tareasPorModulo = new Map<string, MiCronogramaTarea[]>();
    const rolCanonicoPorModulo = new Map<string, string>();

    for (const t of rows ?? []) {
      if (empresaId && t.empresa_id && t.empresa_id !== empresaId) continue;
      const asig = t.empleados_asignados as string[] | null | undefined;
      if (asig && asig.length > 0 && !asig.includes(userId)) continue;

      const rolNorm = norm(t.rol);
      let moduloMatch: string | null = null;
      for (const [modulo, candidatos] of candidatosPorModulo) {
        if (candidatos.has(rolNorm)) {
          moduloMatch = modulo;
          break;
        }
      }
      if (!moduloMatch) continue;

      const arr = tareasPorModulo.get(moduloMatch) ?? [];
      arr.push(t as MiCronogramaTarea);
      tareasPorModulo.set(moduloMatch, arr);
      if (!rolCanonicoPorModulo.has(moduloMatch)) {
        rolCanonicoPorModulo.set(moduloMatch, t.rol as string);
      }
    }

    const ordenDepts = [
      "DIRECCION",
      "GERENCIA",
      "COCINA",
      "SALA",
      "LOGISTICA",
      "RECURSOS HUMANOS",
      "RRHH",
      "MARKETING",
      "CALIDAD",
      "CONTABILIDAD",
      "GESTORIA",
      "JURIDICO",
    ];

    const departamentos: MiCronogramaDepartamento[] = Array.from(
      tareasPorModulo.entries(),
    )
      .map(([modulo, tareas]) => ({
        rol: rolCanonicoPorModulo.get(modulo) ?? modulo,
        label: DEPARTAMENTO_LABEL[modulo] ?? modulo,
        tareas,
      }))
      .sort((a, b) => {
        const ia = ordenDepts.indexOf(norm(a.label));
        const ib = ordenDepts.indexOf(norm(b.label));
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
