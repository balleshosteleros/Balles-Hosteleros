/**
 * OAuth2 server-to-server con service account → access_token para la
 * Partner Notification API. JWT RS256 hecho a mano para evitar nuevas deps.
 *
 * GOOGLE_RWG_PARTNER_OAUTH_KEY: base64 del service-account JSON descargado de GCP.
 */

import { createSign } from "node:crypto";

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  token: string;
  expSec: number;
}

let cache: CachedToken | null = null;

function loadServiceAccount(): ServiceAccountJson | null {
  const raw = process.env.GOOGLE_RWG_PARTNER_OAUTH_KEY?.trim();
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as ServiceAccountJson;
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const SCOPE = "https://www.googleapis.com/auth/mapsbooking";

async function exchangeJwtForAccessToken(sa: ServiceAccountJson): Promise<{ token: string; expSec: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(sa.private_key);
  const jwt = `${signingInput}.${base64url(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const resp = await fetch(payload.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`oauth_token_exchange_${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { access_token: string; expires_in: number };
  return { token: json.access_token, expSec: now + (json.expires_in ?? 3600) };
}

/**
 * Devuelve un access_token válido, cacheado en memoria (~50 min).
 * Devuelve null si GOOGLE_RWG_PARTNER_OAUTH_KEY no está configurada.
 */
export async function getPartnerAccessToken(): Promise<string | null> {
  const sa = loadServiceAccount();
  if (!sa) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cache && cache.expSec > now + 60) return cache.token;
  const fresh = await exchangeJwtForAccessToken(sa);
  cache = { token: fresh.token, expSec: fresh.expSec };
  return fresh.token;
}
