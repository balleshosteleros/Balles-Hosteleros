"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ModeloAeat, SnapshotEmpresa } from "../types/modelos";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: data?.empresa_id ?? null };
}

export async function construirSnapshotEmpresa(
  empresaId: string,
): Promise<SnapshotEmpresa> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas")
    .select("nombre, razon_social, nif, direccion, epigrafe_iae, logo_url")
    .eq("id", empresaId)
    .single();

  return {
    razon_social: (data?.razon_social as string) ?? (data?.nombre as string) ?? "",
    nif: (data?.nif as string) ?? "",
    direccion: (data?.direccion as string) ?? undefined,
    epigrafe_iae: (data?.epigrafe_iae as string) ?? undefined,
    logo_url: (data?.logo_url as string) ?? undefined,
    capturado_en: new Date().toISOString(),
  };
}

export async function presentarModelo(
  modeloId: string,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: modelo, error: mErr } = await supabase
      .from("modelos_aeat")
      .select("*")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .single();
    if (mErr) throw mErr;

    if (modelo.estado === "PRESENTADO")
      return { ok: false, error: "El modelo ya está presentado" };

    const snapshot = await construirSnapshotEmpresa(empresaId);

    if (!snapshot.nif || !snapshot.razon_social) {
      return {
        ok: false,
        error:
          "Faltan datos fiscales de la empresa (NIF o razón social). Complétalos en Ajustes.",
      };
    }

    const payload = JSON.stringify({
      tipo: modelo.tipo,
      periodo: modelo.periodo,
      ejercicio: modelo.ejercicio,
      casillas: modelo.casillas,
      snapshot,
      empresa_id: empresaId,
    });
    const hash = createHash("sha256").update(payload).digest("hex");

    const { error: uErr } = await supabase
      .from("modelos_aeat")
      .update({
        estado: "PRESENTADO",
        snapshot_empresa: snapshot,
        hash_snapshot: hash,
        fecha_presentacion: new Date().toISOString(),
      })
      .eq("id", modeloId);
    if (uErr) throw uErr;

    revalidatePath(`/gestoria/modelos/${modeloId}`);
    revalidatePath("/gestoria/modelos");
    return { ok: true, hash };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[export] presentarModelo:", msg);
    return { ok: false, error: msg };
  }
}
