"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "bh_empresa_activa";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setEmpresaActiva(
  empresaId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(empresaId)) {
    return { ok: false, error: "empresaId inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: linked } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("user_id", user.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  let allowed = !!linked;
  if (!allowed) {
    const { data: prof } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();
    allowed = prof?.empresa_id === empresaId;
  }
  if (!allowed) return { ok: false, error: "Sin acceso a esa empresa" };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, empresaId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true };
}

export async function getEmpresaActivaId(): Promise<string | null> {
  const cookieStore = await cookies();
  const v = cookieStore.get(COOKIE_NAME)?.value;
  return v && UUID_RE.test(v) ? v : null;
}

export async function clearEmpresaActiva(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
