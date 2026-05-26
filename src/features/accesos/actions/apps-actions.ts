"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { appExternaSchema, type AppExterna, type AppExternaInput } from "../data/tipos";

function faviconUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return null;
  }
}

export async function listApps(): Promise<AppExterna[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("apps_externas")
    .select("id, empresa_id, nombre, url, logo_url, categoria, notas, created_at, updated_at")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[listApps]", error);
    return [];
  }
  return (data ?? []) as AppExterna[];
}

export async function createApp(
  input: AppExternaInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { userId, empresaId } = await getAppContext();
  if (!userId || !empresaId) return { ok: false, error: "No autenticado" };

  const parsed = appExternaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const logoUrl =
    (parsed.data.logo_url && parsed.data.logo_url.trim()) ||
    faviconUrl(parsed.data.url ?? null);

  const { data, error } = await admin
    .from("apps_externas")
    .insert({
      empresa_id: empresaId,
      nombre: parsed.data.nombre,
      url: parsed.data.url || null,
      logo_url: logoUrl,
      categoria: parsed.data.categoria,
      notas: parsed.data.notas ?? "",
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accesos");
  return { ok: true, id: data!.id as string };
}

export async function updateApp(
  id: string,
  input: AppExternaInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { empresaId } = await getAppContext();
  if (!empresaId) return { ok: false, error: "No autenticado" };

  const parsed = appExternaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const logoUrl =
    (parsed.data.logo_url && parsed.data.logo_url.trim()) ||
    faviconUrl(parsed.data.url ?? null);

  const { error } = await admin
    .from("apps_externas")
    .update({
      nombre: parsed.data.nombre,
      url: parsed.data.url || null,
      logo_url: logoUrl,
      categoria: parsed.data.categoria,
      notas: parsed.data.notas ?? "",
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accesos");
  return { ok: true };
}

export async function deleteApp(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { empresaId } = await getAppContext();
  if (!empresaId) return { ok: false, error: "No autenticado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("apps_externas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accesos");
  return { ok: true };
}

export async function listRolesEmpresa(): Promise<Array<{ id: string; nombre: string }>> {
  const { empresaId } = await getAppContext();
  if (!empresaId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("empresa_roles")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[listRolesEmpresa]", error);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id as string, nombre: r.nombre as string }));
}
