import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  readAccountsFor,
  upsertAccount,
  writeAccountsTo,
} from "@/lib/google/accounts";

const TEMP_CLEAR = { path: "/", maxAge: 0 };

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};

const META_COOKIE_OPTS = { ...COOKIE_OPTS, httpOnly: false };

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  email?: string;
  name?: string;
  picture?: string;
};

/**
 * Callback de VINCULACIÓN de una cuenta de Google (correo + calendario).
 *
 * A diferencia de `/callback`, aquí NO interviene Supabase Auth: el código lo
 * canjeamos nosotros contra Google. Eso es justamente el objetivo — vincular
 * un buzón no es iniciar sesión en el software, así que la cuenta de Google
 * no tiene por qué ser un usuario invitado. Pasando por Supabase, el trigger
 * `handle_new_user` abortaba el alta de cualquier correo no invitado y la
 * vinculación moría con «no tienes acceso».
 *
 * La sesión del software es la que ya trae el navegador y no se toca.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const errorGoogle = url.searchParams.get("error");

  const c = await cookies();
  const next = c.get("g_vincular_next")?.value || "/";
  const stateEsperado = c.get("g_vincular_state")?.value;
  const state = url.searchParams.get("state");

  const fallo = (motivo: string) => {
    const sep = next.includes("?") ? "&" : "?";
    const res = NextResponse.redirect(`${origin}${next}${sep}google=${motivo}`);
    limpiarTemporales(res);
    return res;
  };

  if (errorGoogle) return fallo("cancelado");
  if (!code) return fallo("sin_codigo");
  // CSRF: el `state` que devuelve Google debe ser el que emitimos nosotros.
  if (!state || !stateEsperado || state !== stateEsperado) {
    return fallo("estado_invalido");
  }

  // La vinculación es del usuario del software que está dentro ahora mismo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fallo("sin_sesion");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "[google/vincular] faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
    );
    return fallo("sin_credenciales");
  }

  let tokens: TokenResponse;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/google/vincular-callback`,
        grant_type: "authorization_code",
      }).toString(),
      cache: "no-store",
    });
    tokens = (await res.json()) as TokenResponse;
    if (!res.ok || !tokens.access_token) {
      console.error(
        "[google/vincular] canje fallido:",
        tokens.error,
        tokens.error_description,
      );
      return fallo("canje_fallido");
    }
  } catch (err) {
    console.error("[google/vincular] canje error:", err);
    return fallo("canje_fallido");
  }

  // Sin refresh_token la cuenta solo duraría una hora y luego pediría
  // reconectar sola. Pasa si Google ya dio consentimiento antes y no se
  // fuerza `prompt=consent`; nuestro /vincular siempre lo fuerza.
  if (!tokens.refresh_token) {
    return fallo("sin_refresh");
  }

  let info: UserInfo = {};
  try {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      },
    );
    if (res.ok) info = (await res.json()) as UserInfo;
  } catch (err) {
    console.error("[google/vincular] userinfo error:", err);
  }

  const email = info.email;
  if (!email) return fallo("sin_email");

  const sep = next.includes("?") ? "&" : "?";
  const response = NextResponse.redirect(
    `${origin}${next}${sep}google=vinculada`,
  );

  // Cuenta recién vinculada = cuenta activa, igual que hace `/callback`.
  response.cookies.set("g_access_token", tokens.access_token, COOKIE_OPTS);
  response.cookies.set("g_refresh_token", tokens.refresh_token, COOKIE_OPTS);
  response.cookies.set("g_email", email, META_COOKIE_OPTS);
  response.cookies.set("g_picture", info.picture ?? "", META_COOKIE_OPTS);
  response.cookies.set("g_name", info.name ?? "", META_COOKIE_OPTS);

  const previas = await readAccountsFor(user.id);
  const actualizadas = upsertAccount(previas, {
    email,
    name: info.name ?? "",
    picture: info.picture ?? "",
    refreshToken: tokens.refresh_token,
  });
  await writeAccountsTo(response.cookies, actualizadas, user.id);

  limpiarTemporales(response);
  return response;
}

function limpiarTemporales(response: NextResponse) {
  response.cookies.set("g_vincular_next", "", TEMP_CLEAR);
  response.cookies.set("g_vincular_state", "", TEMP_CLEAR);
}
