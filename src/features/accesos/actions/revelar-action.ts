"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { decrypt } from "../lib/crypto";

/**
 * Único endpoint que devuelve la contraseña en plano.
 *
 * La verificación se delega al cliente Supabase del usuario: si la RLS
 * `app_credenciales_tenant_role_read` rechaza la lectura, este action devuelve
 * "no autorizado" sin tocar nada.
 */
export async function revelarCredencial(
  id: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const { supabase, userId } = await getAppContext();
  if (!userId) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("app_credenciales")
    .select("password_cifrado")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "No autorizado" };
  }

  try {
    const plain = decrypt(data.password_cifrado as string);
    return { ok: true, password: plain };
  } catch (e) {
    return { ok: false, error: `Error de descifrado: ${(e as Error).message}` };
  }
}
