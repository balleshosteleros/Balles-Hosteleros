import { cookies } from "next/headers";

export type GoogleTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
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
