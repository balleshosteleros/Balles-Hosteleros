"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { ONBOARDING_STEPS, getStep } from "@/features/onboarding/data/steps";
import type {
  OnboardingEntidad,
  OnboardingEstado,
  OnboardingPasoEstado,
  OnboardingResumen,
} from "@/features/onboarding/types/onboarding";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

type SB = Awaited<ReturnType<typeof getContext>>["supabase"];

/** Conteo de filas de una tabla (con empresa_id) aplicando filtros de igualdad. */
async function contarTabla(
  supabase: SB,
  tabla: string,
  empresaId: string,
  extra: Record<string, string> = {},
): Promise<number> {
  let q = supabase.from(tabla).select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
  for (const [col, val] of Object.entries(extra)) q = q.eq(col, val);
  const { count } = await q;
  return count ?? 0;
}

/** Conteo real de la entidad de un paso para la empresa activa. */
async function contarEntidad(
  supabase: SB,
  empresaId: string,
  entidad: OnboardingEntidad,
): Promise<number> {
  switch (entidad) {
    case "locales":
      return contarTabla(supabase, "locales", empresaId);
    case "puestos":
      return contarTabla(supabase, "puestos", empresaId, { estado: "activo" });
    case "empleados":
      return contarTabla(supabase, "empleados", empresaId, { estado: "Activo" });
    case "proveedores":
      return contarTabla(supabase, "proveedores", empresaId);
    case "productos":
      return contarTabla(supabase, "productos", empresaId);
    case "carta":
      return contarTabla(supabase, "productos", empresaId, { tipo: "venta" });
    case "calendarios":
      return contarTabla(supabase, "rrhh_calendarios_vacaciones", empresaId);
    case "imagen_marca": {
      // `empresas` se identifica por `id` (no empresa_id); marca = logo o color.
      const { data } = await supabase
        .from("empresas")
        .select("logo_url, color")
        .eq("id", empresaId)
        .maybeSingle();
      const tieneLogo = !!(data?.logo_url as string | null);
      const tieneColor = !!(data?.color as string | null);
      return tieneLogo || tieneColor ? 1 : 0;
    }
    default:
      return 0;
  }
}

/**
 * Resumen del onboarding de la empresa activa: estado de cada paso DERIVADO de
 * conteos reales (≥1 = completado), cayendo a la señal persistida
 * (omitido/en_progreso) solo si aún no hay datos. Los obligatorios nunca quedan
 * "omitido".
 */
export async function getOnboardingResumen(): Promise<{ ok: boolean; data?: OnboardingResumen }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false };

    // Persistencia (omitido / en_progreso) + flag global de la empresa.
    const [{ data: filas }, { data: empresa }] = await Promise.all([
      supabase.from("empresa_onboarding_pasos").select("paso_key, estado").eq("empresa_id", empresaId),
      supabase.from("empresas").select("onboarding_completado_at").eq("id", empresaId).maybeSingle(),
    ]);
    const persistido = new Map<string, OnboardingEstado>(
      ((filas ?? []) as { paso_key: string; estado: OnboardingEstado }[]).map((f) => [f.paso_key, f.estado]),
    );

    const pasos: OnboardingPasoEstado[] = await Promise.all(
      ONBOARDING_STEPS.map(async (step) => {
        const count = await contarEntidad(supabase, empresaId, step.entidad);
        let estado: OnboardingEstado;
        if (count > 0) {
          estado = "completado";
        } else {
          const p = persistido.get(step.key);
          // Un obligatorio nunca se considera "omitido".
          if (p === "omitido") estado = step.obligatorio ? "pendiente" : "omitido";
          else estado = p ?? "pendiente";
        }
        return { key: step.key, estado, count };
      }),
    );

    const total = pasos.length;
    const hechos = pasos.filter((p) => p.estado === "completado" || p.estado === "omitido").length;
    const progreso = total === 0 ? 0 : Math.round((hechos / total) * 100);
    const obligatoriosCompletos = ONBOARDING_STEPS.filter((s) => s.obligatorio).every(
      (s) => pasos.find((p) => p.key === s.key)?.estado === "completado",
    );

    return {
      ok: true,
      data: {
        pasos,
        progreso,
        obligatoriosCompletos,
        completadoAt: (empresa?.onboarding_completado_at as string | null) ?? null,
      },
    };
  } catch (err) {
    console.error("[onboarding] getOnboardingResumen:", err);
    return { ok: false };
  }
}

/** Marca un paso como en progreso (al entrar a cargarlo). Idempotente. */
export async function marcarPasoIniciado(pasoKey: string) {
  return upsertPaso(pasoKey, "en_progreso");
}

/** Omite un paso OPCIONAL (los obligatorios no se pueden omitir). */
export async function marcarPasoOmitido(pasoKey: string) {
  const step = getStep(pasoKey);
  if (!step) return { ok: false, error: "Paso desconocido" };
  if (step.obligatorio) return { ok: false, error: "Este paso es obligatorio y no se puede omitir." };
  return upsertPaso(pasoKey, "omitido");
}

async function upsertPaso(pasoKey: string, estado: OnboardingEstado) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!getStep(pasoKey)) return { ok: false, error: "Paso desconocido" };

    const { error } = await supabase
      .from("empresa_onboarding_pasos")
      .upsert(
        { empresa_id: empresaId, paso_key: pasoKey, estado, updated_at: new Date().toISOString() },
        { onConflict: "empresa_id,paso_key" },
      );
    if (error) throw error;
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[onboarding] upsertPaso:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cierra el onboarding si los obligatorios están completos (deriva del resumen).
 * Marca `empresas.onboarding_completado_at` para dejar de auto-lanzar el wizard.
 */
export async function completarOnboarding() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const resumen = await getOnboardingResumen();
    if (!resumen.ok || !resumen.data) return { ok: false, error: "No se pudo calcular el progreso" };
    if (!resumen.data.obligatoriosCompletos) {
      return { ok: false, error: "Faltan pasos obligatorios (locales, puestos y empleados)." };
    }

    const { error } = await supabase
      .from("empresas")
      .update({ onboarding_completado_at: new Date().toISOString() })
      .eq("id", empresaId);
    if (error) throw error;
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[onboarding] completarOnboarding:", msg);
    return { ok: false, error: msg };
  }
}
