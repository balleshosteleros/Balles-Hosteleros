import { cookies } from "next/headers";

export type GoogleTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};

/**
 * Lee los tokens de Google desde las cookies que pone /callback.
 */
export async function getGoogleTokens(): Promise<GoogleTokens> {
  const c = await cookies();
  return {
    accessToken: c.get("g_access_token")?.value ?? null,
    refreshToken: c.get("g_refresh_token")?.value ?? null,
    email: c.get("g_email")?.value ?? null,
  };
}

/**
 * Intenta canjear un refresh_token por un nuevo access_token.
 * Devuelve null si no hay creds configuradas o Google rechaza la petición.
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "[google] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no configurados — imposible refrescar el access token. Añade ambas variables al .env.local con las credenciales del cliente OAuth de Google.",
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
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `[google] refresh fallido: ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.error("[google] refresh error:", err);
    return null;
  }
}

/**
 * Wrapper genérico para llamar a Google APIs con el access token actual.
 * Devuelve null si no hay token o si Google responde no-OK.
 */
export async function googleFetch<T>(
  url: string,
  accessToken: string,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `[google] ${url.split("?")[0]} → ${res.status} ${res.statusText}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[google] fetch error:", err);
    return null;
  }
}

export type GoogleFetchResult<T> = {
  data: T | null;
  needsReauth: boolean;
  status?: number;
};

/**
 * Llama a una API de Google leyendo el access token desde cookies.
 * Si Google responde 401, intenta refrescar el token con `g_refresh_token`,
 * actualiza la cookie y reintenta una vez. Si no hay refresh token o el
 * refresh falla, marca `needsReauth=true` para que la UI pida reconexión.
 */
export async function googleFetchAuto<T>(
  url: string,
): Promise<GoogleFetchResult<T>> {
  const c = await cookies();
  const accessToken = c.get("g_access_token")?.value ?? null;
  const refreshToken = c.get("g_refresh_token")?.value ?? null;

  if (!accessToken) {
    return { data: null, needsReauth: true };
  }

  const doFetch = (token: string) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

  let res: Response;
  try {
    res = await doFetch(accessToken);
  } catch (err) {
    console.error("[google] fetch error:", err);
    return { data: null, needsReauth: false };
  }

  if (res.status === 401) {
    if (!refreshToken) {
      return { data: null, needsReauth: true, status: 401 };
    }
    const newToken = await refreshAccessToken(refreshToken);
    if (!newToken) {
      return { data: null, needsReauth: true, status: 401 };
    }
    try {
      c.set("g_access_token", newToken, COOKIE_OPTS);
      // Re-extiende cookies que comparten ciclo de 60 días para que la
      // sesión se renueve mientras el usuario sigue activo en la app.
      c.set("g_refresh_token", refreshToken, COOKIE_OPTS);
      const publicOpts = { ...COOKIE_OPTS, httpOnly: false };
      const emailCookie = c.get("g_email")?.value;
      if (emailCookie) c.set("g_email", emailCookie, publicOpts);
      const pictureCookie = c.get("g_picture")?.value;
      if (pictureCookie) c.set("g_picture", pictureCookie, publicOpts);
      const nameCookie = c.get("g_name")?.value;
      if (nameCookie) c.set("g_name", nameCookie, publicOpts);
      const rosterCookie = c.get("g_accounts_meta")?.value;
      if (rosterCookie) c.set("g_accounts_meta", rosterCookie, publicOpts);
    } catch {
      // En contextos sin permiso de escritura de cookies (componentes server),
      // ignoramos: la API caller volverá a leer la cookie en la siguiente request
    }
    try {
      res = await doFetch(newToken);
    } catch (err) {
      console.error("[google] retry fetch error:", err);
      return { data: null, needsReauth: false };
    }
  }

  if (!res.ok) {
    console.error(
      `[google] ${url.split("?")[0]} → ${res.status} ${res.statusText}`,
    );
    return {
      data: null,
      needsReauth: res.status === 401,
      status: res.status,
    };
  }

  try {
    const data = (await res.json()) as T;
    return { data, needsReauth: false, status: res.status };
  } catch (err) {
    console.error("[google] json parse error:", err);
    return { data: null, needsReauth: false, status: res.status };
  }
}
