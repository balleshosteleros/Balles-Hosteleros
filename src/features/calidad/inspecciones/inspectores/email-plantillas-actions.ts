"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  INSPECTOR_EMAIL_PLANTILLAS_SEED,
  INSPECTOR_EMAIL_PLANTILLA_FASES,
} from "@/lib/seeds/inspector-email-plantillas";
import { FASES_INSPECTOR_CONFIG, FASES_KANBAN_ORDEN } from "./data";
import type { InspectorFase } from "./types";

export interface InspectorEmailPlantilla {
  fase: InspectorFase;
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/**
 * Devuelve las 6 plantillas en el orden del pipeline. Si por cualquier motivo
 * faltase alguna fila en BD, completa el hueco con el seed canónico (lectura
 * tolerante; la escritura sigue siendo aditiva en `syncSeeds…`).
 */
export async function listInspectorEmailPlantillas(): Promise<
  InspectorEmailPlantilla[]
> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from("inspector_email_plantillas")
    .select("fase, asunto, cuerpo, activa")
    .eq("empresa_id", empresaId);
  if (error) {
    console.error("[email-plantillas] list:", error.message);
    return [];
  }

  const porFase = new Map<InspectorFase, {
    asunto: string;
    cuerpo: string;
    activa: boolean;
  }>();
  for (const r of data ?? []) {
    porFase.set(r.fase as InspectorFase, {
      asunto: r.asunto as string,
      cuerpo: r.cuerpo as string,
      activa: r.activa as boolean,
    });
  }

  return FASES_KANBAN_ORDEN.map((fase) => {
    const fila = porFase.get(fase);
    const seed = INSPECTOR_EMAIL_PLANTILLAS_SEED.find((s) => s.fase === fase);
    return {
      fase,
      nombre: FASES_INSPECTOR_CONFIG[fase].label,
      asunto: fila?.asunto ?? seed?.asunto ?? "",
      cuerpo: fila?.cuerpo ?? seed?.cuerpo ?? "",
      activa: fila?.activa ?? seed?.activa ?? false,
    };
  });
}

export async function updateInspectorEmailPlantilla(
  fase: InspectorFase,
  patch: { asunto: string; cuerpo: string; activa?: boolean },
): Promise<ActionResult> {
  if (!INSPECTOR_EMAIL_PLANTILLA_FASES.has(fase)) {
    return { ok: false, error: "Fase no válida" };
  }
  const asunto = patch.asunto.trim();
  const cuerpo = patch.cuerpo.trim();
  if (!asunto) return { ok: false, error: "El asunto no puede estar vacío" };
  if (!cuerpo) return { ok: false, error: "El cuerpo no puede estar vacío" };

  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const seed = INSPECTOR_EMAIL_PLANTILLAS_SEED.find((s) => s.fase === fase);
  const { error } = await supabase
    .from("inspector_email_plantillas")
    .upsert(
      {
        empresa_id: empresaId,
        fase,
        asunto,
        cuerpo,
        activa: patch.activa ?? seed?.activa ?? true,
      },
      { onConflict: "empresa_id,fase" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

export async function toggleInspectorEmailPlantillaActiva(
  fase: InspectorFase,
  activa: boolean,
): Promise<ActionResult> {
  if (!INSPECTOR_EMAIL_PLANTILLA_FASES.has(fase)) {
    return { ok: false, error: "Fase no válida" };
  }
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const seed = INSPECTOR_EMAIL_PLANTILLAS_SEED.find((s) => s.fase === fase);
  if (!seed) return { ok: false, error: "Fase no válida" };

  const { error } = await supabase
    .from("inspector_email_plantillas")
    .upsert(
      {
        empresa_id: empresaId,
        fase,
        asunto: seed.asunto,
        cuerpo: seed.cuerpo,
        activa,
      },
      { onConflict: "empresa_id,fase", ignoreDuplicates: false },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

/**
 * Resetea una plantilla a su valor canónico del seed.
 */
export async function resetInspectorEmailPlantilla(
  fase: InspectorFase,
): Promise<ActionResult> {
  const seed = INSPECTOR_EMAIL_PLANTILLAS_SEED.find((s) => s.fase === fase);
  if (!seed) return { ok: false, error: "Fase no válida" };
  return updateInspectorEmailPlantilla(fase, {
    asunto: seed.asunto,
    cuerpo: seed.cuerpo,
    activa: seed.activa,
  });
}
