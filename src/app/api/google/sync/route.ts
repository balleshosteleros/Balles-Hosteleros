import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  readAccounts,
  refreshAccessToken,
  upsertAccount,
  writeAccountsTo,
} from "@/lib/google/accounts";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};

const META_COOKIE_OPTS = { ...COOKIE_OPTS, httpOnly: false };

/**
 * Asegura que la cuenta activa esté presente en el roster `g_accounts`.
 *
 * Esto resuelve dos casos sin obligar al usuario a re-logearse:
 *  - Cuentas conectadas antes de existir el roster (legacy): nunca pasaron
 *    por la rama nueva del callback.
 *  - Sesiones donde el callback se ejecutó pero por algún motivo no quedó
 *    el refresh token (ej: el usuario revocó y volvió a entrar con
 *    `prompt=consent` recortado).
 *
 * Llamado desde el cliente al montar el switcher. Sin efectos si ya está.
 */
export async function POST() {
  const c = await cookies();
  const email = c.get("g_email")?.value;
  const refreshToken = c.get("g_refresh_token")?.value;

  // Sin cuenta activa en cookies: puede ser una sesión recién abierta tras
  // cerrar sesión (que borra las cookies `g_*`). El roster sigue en BD, así
  // que reactivamos la primera cuenta y el usuario se la encuentra puesta.
  if (!email || !refreshToken) {
    const guardadas = await readAccounts();
    if (guardadas.length === 0) {
      return NextResponse.json({ ok: true, synced: false });
    }

    for (const cand of guardadas) {
      const accessToken = await refreshAccessToken(cand.refreshToken);
      if (!accessToken) continue;

      const response = NextResponse.json({
        ok: true,
        synced: true,
        restored: cand.email,
      });
      response.cookies.set("g_access_token", accessToken, COOKIE_OPTS);
      response.cookies.set("g_refresh_token", cand.refreshToken, COOKIE_OPTS);
      response.cookies.set("g_email", cand.email, META_COOKIE_OPTS);
      response.cookies.set("g_picture", cand.picture ?? "", META_COOKIE_OPTS);
      response.cookies.set("g_name", cand.name ?? "", META_COOKIE_OPTS);
      await writeAccountsTo(response.cookies, guardadas);
      return response;
    }

    // Ningún refresh_token sirve ya (revocados en Google): hay que reconectar.
    return NextResponse.json({ ok: true, synced: false });
  }

  const accounts = await readAccounts();
  const yaEsta = accounts.some(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  if (yaEsta) {
    return NextResponse.json({ ok: true, synced: false });
  }

  const actualizadas = upsertAccount(accounts, {
    email,
    name: c.get("g_name")?.value ?? "",
    picture: c.get("g_picture")?.value ?? "",
    refreshToken,
  });

  const response = NextResponse.json({ ok: true, synced: true });
  await writeAccountsTo(response.cookies, actualizadas);
  return response;
}
