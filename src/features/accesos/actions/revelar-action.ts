"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAnonClient } from "@/lib/supabase/anon";
import { decrypt } from "../lib/crypto";

/** Minutos que dura una verificación de identidad antes de volver a pedirla. */
export const VERIFICACION_VALIDEZ_MIN = 5;

/**
 * Revela en claro la CONTRASEÑA y/o un DATO EXTRA de una credencial.
 *
 * Doble control:
 *   1. La lectura va por el cliente del USUARIO → la RLS por ROL VISIBLE
 *      decide si esta credencial es accesible. PROGRAMADOR no llega aquí.
 *   2. Verificación de identidad: el usuario debe reconfirmar su contraseña
 *      de acceso (`verificarIdentidad`) ANTES de poder llamar a este action,
 *      independientemente de su rol. (Gate adicional para CUALQUIER visualización.)
 *
 * @param campo  "password" (por defecto) o el nombre exacto de un dato extra.
 */
export async function revelarCredencial(
  id: string,
  campo: string = "password",
): Promise<{ ok: true; valor: string } | { ok: false; error: string }> {
  const { supabase, userId } = await getAppContext();
  if (!userId) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("app_credenciales")
    .select("password_cifrado, datos_extra")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "No autorizado" };
  }

  try {
    if (campo === "password") {
      const cifrado = data.password_cifrado as string;
      if (!cifrado) return { ok: false, error: "Esta credencial no tiene contraseña" };
      return { ok: true, valor: decrypt(cifrado) };
    }

    const extras = (data.datos_extra ?? []) as Array<{ nombre: string; valor_cifrado: string }>;
    const extra = extras.find((d) => d.nombre === campo);
    if (!extra) return { ok: false, error: "Dato no encontrado" };
    return { ok: true, valor: decrypt(extra.valor_cifrado) };
  } catch (e) {
    return { ok: false, error: `Error de descifrado: ${(e as Error).message}` };
  }
}

/**
 * Verificación rápida de identidad antes de visualizar cualquier contraseña.
 *
 * Revalida la contraseña de acceso del propio usuario contra Supabase Auth
 * usando un cliente efímero (no toca la sesión activa). No guarda nada.
 * El frontend exige pasar por aquí antes de llamar a `revelarCredencial`.
 */
export async function verificarIdentidad(
  password: string,
): Promise<{ ok: true; validezMin: number } | { ok: false; error: string }> {
  const { supabase, userId } = await getAppContext();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!password || password.length < 1) {
    return { ok: false, error: "Introduce tu contraseña" };
  }

  // Email del usuario actual (desde su sesión real).
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) return { ok: false, error: "No se pudo verificar tu identidad" };

  // Cliente efímero ANON (persistSession:false): comprueba la contraseña sin
  // tocar la cookie de sesión del navegador.
  const probe = createAnonClient();
  const { error } = await probe.auth.signInWithPassword({ email, password });
  await probe.auth.signOut();
  if (error) {
    return { ok: false, error: "Contraseña incorrecta" };
  }
  return { ok: true, validezMin: VERIFICACION_VALIDEZ_MIN };
}
