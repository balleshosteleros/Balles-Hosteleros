/**
 * Wrapper tipado de Vercel Domains API.
 * Docs: https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project
 *
 * Env vars requeridas (server-only):
 *   VERCEL_TOKEN       — PAT con scope "Full Account" o "Projects + Domains"
 *   VERCEL_PROJECT_ID  — ID del proyecto destino
 *   VERCEL_TEAM_ID     — (opcional) ID del team si el proyecto está en team scope
 */

const API_BASE = "https://api.vercel.com";

function env() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) {
    throw new Error(
      "Faltan env vars: VERCEL_TOKEN y VERCEL_PROJECT_ID son obligatorias.",
    );
  }
  return { token, projectId, teamId };
}

function teamQuery(teamId?: string): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export interface VercelDomainAddResult {
  id: string;
  name: string;
  verified: boolean;
  verification?: Array<{ type: string; domain: string; value: string; reason?: string }>;
}

export interface VercelDomainConfig {
  configuredBy: string | null;
  acceptedChallenges: string[] | null;
  misconfigured: boolean;
}

export async function addDomainToProject(
  hostname: string,
): Promise<{ ok: true; data: VercelDomainAddResult } | { ok: false; error: string }> {
  try {
    const { token, projectId, teamId } = env();
    const res = await fetch(
      `${API_BASE}/v10/projects/${projectId}/domains${teamQuery(teamId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: hostname }),
      },
    );
    const json = (await res.json()) as VercelDomainAddResult & {
      error?: { code: string; message: string };
    };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function verifyDomain(
  hostname: string,
): Promise<{ ok: true; data: { verified: boolean } } | { ok: false; error: string }> {
  try {
    const { token, projectId, teamId } = env();
    const res = await fetch(
      `${API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}/verify${teamQuery(teamId)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const json = (await res.json()) as { verified?: boolean; error?: { message: string } };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: { verified: Boolean(json.verified) } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getDomainConfig(
  hostname: string,
): Promise<{ ok: true; data: VercelDomainConfig } | { ok: false; error: string }> {
  try {
    const { token, teamId } = env();
    const res = await fetch(
      `${API_BASE}/v6/domains/${encodeURIComponent(hostname)}/config${teamQuery(teamId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json()) as VercelDomainConfig & { error?: { message: string } };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeDomainFromProject(
  hostname: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { token, projectId, teamId } = env();
    const res = await fetch(
      `${API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}${teamQuery(teamId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: { message: string } };
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Heurística simple para generar el DNS hint que se muestra al admin.
 * Para apex: A record 76.76.21.21 (Vercel anycast).
 * Para subdominios: CNAME cname.vercel-dns.com.
 */
export function generarDnsHint(hostname: string): { tipo: "A" | "CNAME"; name: string; value: string } {
  const parts = hostname.split(".");
  // Consideramos apex si sólo hay 2 segmentos (ej. bacanalmadrid.com)
  // o 3 segmentos con TLDs compuestos comunes (ej. example.co.uk)
  const esApex =
    parts.length === 2 ||
    (parts.length === 3 &&
      ["co.uk", "com.es", "com.mx", "com.ar", "com.br"].some((s) => hostname.endsWith(s)));
  if (esApex) {
    return { tipo: "A", name: "@", value: "76.76.21.21" };
  }
  return { tipo: "CNAME", name: parts[0], value: "cname.vercel-dns.com" };
}
