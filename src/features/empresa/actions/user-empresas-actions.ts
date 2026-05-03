"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UserEmpresaRow {
  user_id: string;
  empresa_id: string;
}

/**
 * Lista los UUIDs de empresas a las que un usuario tiene acceso.
 * Si no se pasa userId, devuelve los del usuario autenticado actual.
 */
export async function listEmpresasDeUsuario(userId?: string): Promise<string[]> {
  const supabase = await createClient();

  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[user-empresas] list:", error.message);
    return [];
  }

  return (data ?? []).map((r) => r.empresa_id as string);
}

/**
 * Reemplaza completamente el set de empresas a las que un usuario tiene acceso.
 * Solo accesible por admins (RLS).
 */
export async function setEmpresasDeUsuario(input: {
  userId: string;
  empresaIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Borra todos los accesos previos del usuario
    const { error: delErr } = await supabase
      .from("user_empresas")
      .delete()
      .eq("user_id", input.userId);
    if (delErr) throw delErr;

    if (input.empresaIds.length === 0) return { ok: true };

    const rows = input.empresaIds.map((empresa_id) => ({
      user_id: input.userId,
      empresa_id,
    }));

    const { error: insErr } = await supabase
      .from("user_empresas")
      .insert(rows);
    if (insErr) throw insErr;

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[user-empresas] set:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Concede a un usuario acceso a una empresa concreta.
 */
export async function addAccesoEmpresa(input: {
  userId: string;
  empresaId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_empresas")
      .insert({ user_id: input.userId, empresa_id: input.empresaId });
    if (error && error.code !== "23505") throw error; // ignora duplicados
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[user-empresas] add:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Revoca a un usuario el acceso a una empresa.
 */
export async function removeAccesoEmpresa(input: {
  userId: string;
  empresaId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_empresas")
      .delete()
      .eq("user_id", input.userId)
      .eq("empresa_id", input.empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[user-empresas] remove:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Lista accesos de TODOS los usuarios de la empresa (admin).
 * Devuelve un map userId → empresaIds[].
 */
export async function listAllUserEmpresas(): Promise<Record<string, string[]>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_empresas")
    .select("user_id, empresa_id");

  if (error) {
    console.error("[user-empresas] list-all:", error.message);
    return {};
  }

  const out: Record<string, string[]> = {};
  for (const row of (data ?? []) as UserEmpresaRow[]) {
    if (!out[row.user_id]) out[row.user_id] = [];
    out[row.user_id].push(row.empresa_id);
  }
  return out;
}
