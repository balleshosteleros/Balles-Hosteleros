import { NextResponse } from "next/server";
import {
  findAccount,
  readAccounts,
  refreshAccessToken,
  removeAccount,
  writeAccountsTo,
} from "@/lib/google/accounts";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};

const META_COOKIE_OPTS = {
  ...COOKIE_OPTS,
  httpOnly: false,
};

/**
 * Cambia la cuenta Google activa a la indicada por `email`.
 *
 * No hace OAuth. Toma el refresh_token guardado en el roster `g_accounts`,
 * pide un access_token nuevo a Google y reescribe las cookies activas
 * `g_access_token`, `g_refresh_token`, `g_email`, `g_picture`, `g_name`.
 *
 * Si Google rechaza el refresh (cuenta caducada o consentimiento revocado),
 * elimina esa cuenta del roster y devuelve 401 para que la UI invite a
 * reconectar.
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  const accounts = await readAccounts();
  const cuenta = findAccount(accounts, email);
  if (!cuenta) {
    return NextResponse.json({ error: "unknown_account" }, { status: 404 });
  }

  const accessToken = await refreshAccessToken(cuenta.refreshToken);
  if (!accessToken) {
    // El refresh token ya no sirve → quitamos la cuenta y pedimos reconexión.
    const limpio = removeAccount(accounts, email);
    const fallo = NextResponse.json(
      { error: "refresh_failed", email },
      { status: 401 },
    );
    writeAccountsTo(fallo.cookies, limpio);
    return fallo;
  }

  const ok = NextResponse.json({ ok: true, email: cuenta.email });
  ok.cookies.set("g_access_token", accessToken, COOKIE_OPTS);
  ok.cookies.set("g_refresh_token", cuenta.refreshToken, COOKIE_OPTS);
  ok.cookies.set("g_email", cuenta.email, META_COOKIE_OPTS);
  ok.cookies.set("g_picture", cuenta.picture ?? "", META_COOKIE_OPTS);
  ok.cookies.set("g_name", cuenta.name ?? "", META_COOKIE_OPTS);
  return ok;
}
