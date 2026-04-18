"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DatosFiscales {
  razon_social: string;
  nif: string;
  direccion: string;
  epigrafe_iae: string;
}

async function resolveEmpresaId(): Promise<string | null> {
  const { empresaId } = await getAppContext();
  return empresaId;
}

export async function getDatosFiscales(): Promise<{
  ok: boolean;
  data: DatosFiscales | null;
  error?: string;
}> {
  try {
    const empresaId = await resolveEmpresaId();
    if (!empresaId) return { ok: false, data: null, error: "No autenticado" };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("empresas")
      .select("razon_social, nif, direccion, epigrafe_iae")
      .eq("id", empresaId)
      .single();
    if (error) throw error;

    return {
      ok: true,
      data: {
        razon_social: (data?.razon_social as string) ?? "",
        nif: (data?.nif as string) ?? "",
        direccion: (data?.direccion as string) ?? "",
        epigrafe_iae: (data?.epigrafe_iae as string) ?? "",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[datos-fiscales] get:", msg);
    return { ok: false, data: null, error: msg };
  }
}

export async function saveDatosFiscales(
  input: DatosFiscales,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const empresaId = await resolveEmpresaId();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("empresas")
      .update({
        razon_social: input.razon_social.trim() || null,
        nif: input.nif.trim() || null,
        direccion: input.direccion.trim() || null,
        epigrafe_iae: input.epigrafe_iae.trim() || null,
      })
      .eq("id", empresaId);
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[datos-fiscales] save:", msg);
    return { ok: false, error: msg };
  }
}
