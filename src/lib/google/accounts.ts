import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type ResponseCookies = NextResponse["cookies"];

/**
 * Multi-cuenta Google estilo Gmail.
 *
 * Mantenemos las cookies "activas" tal cual ya las usaba el resto de la app
 * (`g_access_token`, `g_refresh_token`, `g_email`, `g_picture`, `g_name`).
 * Adicionalmente guardamos el roster de cuentas conectadas en dos cookies:
 *
 *  - `g_accounts`      → httpOnly. JSON con refresh_token por email. NUNCA llega
 *                        al navegador como JS.
 *  - `g_accounts_meta` → no-httpOnly. JSON con `{email, name, picture}` para
 *                        pintar el switcher en cliente sin exponer secretos.
 */

export type GoogleAccount = {
  email: string;
  name: string;
  picture: string;
  refreshToken: string;
};

export type GoogleAccountMeta = Pick<GoogleAccount, "email" | "name" | "picture">;

export const ACCOUNTS_COOKIE = "g_accounts";
export const ACCOUNTS_META_COOKIE = "g_accounts_meta";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 días, igual que las activas

const HTTP_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

const META_COOKIE_OPTS = {
  ...HTTP_COOKIE_OPTS,
  httpOnly: false,
};

function safeParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function readAccounts(): Promise<GoogleAccount[]> {
  const c = await cookies();
  const raw = c.get(ACCOUNTS_COOKIE)?.value;
  return safeParse<GoogleAccount[]>(raw, []);
}

function toMeta(accounts: GoogleAccount[]): GoogleAccountMeta[] {
  return accounts.map(({ email, name, picture }) => ({ email, name, picture }));
}

/**
 * Reescribe las cookies de roster en una respuesta concreta.
 * Útil cuando estamos en un Route Handler que ya construyó la respuesta.
 */
export function writeAccountsTo(
  responseCookies: ResponseCookies,
  accounts: GoogleAccount[],
) {
  if (accounts.length === 0) {
    responseCookies.set(ACCOUNTS_COOKIE, "", { ...HTTP_COOKIE_OPTS, maxAge: 0 });
    responseCookies.set(ACCOUNTS_META_COOKIE, "", { ...META_COOKIE_OPTS, maxAge: 0 });
    return;
  }
  responseCookies.set(ACCOUNTS_COOKIE, JSON.stringify(accounts), HTTP_COOKIE_OPTS);
  responseCookies.set(
    ACCOUNTS_META_COOKIE,
    JSON.stringify(toMeta(accounts)),
    META_COOKIE_OPTS,
  );
}

/**
 * Mete una cuenta nueva (o actualiza la existente con mismo email) en el roster
 * y deja la primera la "recién conectada", para que sea fácil elegir cuál es la
 * activa.
 */
export function upsertAccount(
  accounts: GoogleAccount[],
  next: GoogleAccount,
): GoogleAccount[] {
  const sin = accounts.filter(
    (a) => a.email.toLowerCase() !== next.email.toLowerCase(),
  );
  return [next, ...sin];
}

export function removeAccount(
  accounts: GoogleAccount[],
  email: string,
): GoogleAccount[] {
  return accounts.filter(
    (a) => a.email.toLowerCase() !== email.toLowerCase(),
  );
}

export function findAccount(
  accounts: GoogleAccount[],
  email: string,
): GoogleAccount | undefined {
  return accounts.find(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
}

/**
 * Refresca un access_token usando el refresh_token guardado en el roster.
 * Devuelve null si Google rechaza la petición o faltan creds.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "[google/accounts] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no configurados",
    );
    return null;
  }
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `[google/accounts] refresh fallido: ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.error("[google/accounts] refresh error:", err);
    return null;
  }
}
