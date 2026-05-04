import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
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

const CLEAR_OPTS = { path: "/", maxAge: 0 };

function clearActive(response: NextResponse) {
  response.cookies.set("g_access_token", "", CLEAR_OPTS);
  response.cookies.set("g_refresh_token", "", CLEAR_OPTS);
  response.cookies.set("g_email", "", CLEAR_OPTS);
  response.cookies.set("g_picture", "", CLEAR_OPTS);
  response.cookies.set("g_name", "", CLEAR_OPTS);
}

/**
 * Desconecta cuentas Google.
 *
 * Sin body / sin `email` → desconecta TODO (legacy).
 * Con `{ email }` → quita esa cuenta del roster. Si era la activa, intenta
 * promover otra cuenta del roster sin pedir login; si ninguna sirve, limpia
 * las cookies activas.
 */
export async function POST(request: Request) {
  let email: string | undefined;
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: string }
      | null;
    email = body?.email?.trim().toLowerCase() || undefined;
  } catch {
    email = undefined;
  }

  // Modo "limpiar todo": no hay email → fuera todo.
  if (!email) {
    const response = NextResponse.json({ ok: true });
    clearActive(response);
    writeAccountsTo(response.cookies, []);
    return response;
  }

  const accounts = await readAccounts();
  const restantes = removeAccount(accounts, email);

  const c = await cookies();
  const activeEmail = (c.get("g_email")?.value ?? "").toLowerCase();
  const eraActiva = !!activeEmail && activeEmail === email;

  if (!eraActiva) {
    const response = NextResponse.json({ ok: true, removed: email });
    writeAccountsTo(response.cookies, restantes);
    return response;
  }

  // Era la activa: intentar promover otra cuenta sin pedir login.
  for (const cand of restantes) {
    const accessToken = await refreshAccessToken(cand.refreshToken);
    if (!accessToken) continue;
    const response = NextResponse.json({
      ok: true,
      removed: email,
      switchedTo: cand.email,
    });
    writeAccountsTo(response.cookies, restantes);
    response.cookies.set("g_access_token", accessToken, COOKIE_OPTS);
    response.cookies.set("g_refresh_token", cand.refreshToken, COOKIE_OPTS);
    response.cookies.set("g_email", cand.email, META_COOKIE_OPTS);
    response.cookies.set("g_picture", cand.picture ?? "", META_COOKIE_OPTS);
    response.cookies.set("g_name", cand.name ?? "", META_COOKIE_OPTS);
    return response;
  }

  // Ninguna cuenta del roster sirvió: limpiamos todo (activas + roster).
  const response = NextResponse.json({ ok: true, removed: email });
  clearActive(response);
  writeAccountsTo(response.cookies, []);
  return response;
}
