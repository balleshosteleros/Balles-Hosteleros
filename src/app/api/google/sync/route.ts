import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  readAccounts,
  upsertAccount,
  writeAccountsTo,
} from "@/lib/google/accounts";

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

  if (!email || !refreshToken) {
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
  writeAccountsTo(response.cookies, actualizadas);
  return response;
}
