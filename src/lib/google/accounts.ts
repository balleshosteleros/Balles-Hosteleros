import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ResponseCookies = NextResponse["cookies"];

/** Tabla de respaldo: el roster sobrevive al cierre de sesión. */
const TABLA_CUENTAS = "google_cuentas_usuario";

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
 *
 * Las cookies son solo CACHÉ. La fuente duradera es la tabla
 * `google_cuentas_usuario` (una fila por usuario, RLS: cada uno ve la suya).
 * Antes el roster vivía únicamente en cookie, y `signout` la borraba → había
 * que reconectar todas las cuentas cada día. Ahora, al volver a entrar, se
 * rehidrata desde BD y el usuario se encuentra sus cuentas ya puestas.
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

/**
 * Roster del usuario guardado en BD. Devuelve [] si no hay sesión o si algo
 * falla: nunca revienta, el flujo puede seguir con la cookie.
 */
async function readAccountsFromDb(): Promise<GoogleAccount[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from(TABLA_CUENTAS)
      .select("cuentas")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[google/accounts] lectura BD fallida:", error.message);
      return [];
    }
    const cuentas = data?.cuentas;
    return Array.isArray(cuentas) ? (cuentas as GoogleAccount[]) : [];
  } catch (err) {
    console.error("[google/accounts] lectura BD error:", err);
    return [];
  }
}

/**
 * Persiste el roster del usuario. El fallo se registra pero no interrumpe:
 * la cookie ya se habrá escrito y la sesión en curso sigue funcionando.
 */
async function writeAccountsToDb(accounts: GoogleAccount[]): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from(TABLA_CUENTAS).upsert(
      {
        user_id: user.id,
        cuentas: accounts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("[google/accounts] guardado BD fallido:", error.message);
    }
  } catch (err) {
    console.error("[google/accounts] guardado BD error:", err);
  }
}

/**
 * Lee el roster: primero la cookie (rápido) y, si viene vacía, se rehidrata
 * desde BD. Ese segundo camino es el que hace que las cuentas sobrevivan al
 * cierre de sesión, que borra las cookies `g_accounts*`.
 */
export async function readAccounts(): Promise<GoogleAccount[]> {
  const c = await cookies();
  const raw = c.get(ACCOUNTS_COOKIE)?.value;
  const deCookie = safeParse<GoogleAccount[]>(raw, []);
  if (deCookie.length > 0) return deCookie;
  return readAccountsFromDb();
}

function toMeta(accounts: GoogleAccount[]): GoogleAccountMeta[] {
  return accounts.map(({ email, name, picture }) => ({ email, name, picture }));
}

/**
 * Reescribe las cookies de roster Y lo persiste en BD, para que sobreviva al
 * cierre de sesión. Devuelve la promesa del guardado: los Route Handlers
 * deben esperarla antes de responder, o la función serverless puede cortarse
 * con el upsert a medias.
 */
export function writeAccountsTo(
  responseCookies: ResponseCookies,
  accounts: GoogleAccount[],
): Promise<void> {
  writeAccountsCookies(responseCookies, accounts);
  return writeAccountsToDb(accounts);
}

/** Solo cookies, sin tocar BD. */
function writeAccountsCookies(
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
