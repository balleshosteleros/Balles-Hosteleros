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
  /** Nameservers reales del dominio. Sirven para saber dónde vive su DNS. */
  nameservers?: string[] | null;
  /** Direcciones que Vercel recomienda HOY para un dominio raíz, por preferencia. */
  recommendedIPv4?: Array<{ rank: number; value: string[] }> | null;
  /** Destino que Vercel recomienda HOY para un subdominio, por preferencia. */
  recommendedCNAME?: Array<{ rank: number; value: string }> | null;
}

/** Un registro que el dueño del dominio tiene que crear, tal y como se le enseña. */
export interface RegistroDns {
  tipo: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  /** Por qué hace falta. Se enseña al usuario, sin jerga. */
  motivo: "APUNTAR" | "PROPIEDAD";
}

/** Dónde vive el DNS del dominio: cambia las instrucciones que se enseñan. */
export type ProveedorDns = "VERCEL" | "SITEGROUND" | "OTRO";

export function proveedorDeNameservers(nameservers?: string[] | null): ProveedorDns {
  const ns = (nameservers ?? []).join(" ").toLowerCase();
  if (ns.includes("vercel-dns")) return "VERCEL";
  if (ns.includes("siteground")) return "SITEGROUND";
  return "OTRO";
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
 * Los registros que hay que crear para este dominio, preguntándoselos a Vercel.
 *
 * Antes se adivinaban con una heurística y salían los valores ANTIGUOS
 * (`76.76.21.21`, `cname.vercel-dns.com`). Siguen funcionando, pero no son los
 * que Vercel enseña hoy en su panel, y un cliente que compare las dos pantallas
 * cree que le estamos dando datos malos. Ahora se piden y se usa el que Vercel
 * pone primero; la heurística solo entra si la API no contesta.
 *
 * `verificacion` es lo que devuelve `addDomainToProject` cuando el dominio ya
 * está en OTRA cuenta de Vercel: un registro TXT que demuestra que es suyo. No
 * mueve el dominio a nuestra cuenta, solo nos deja usarlo en el proyecto.
 */
export async function registrosDelDominio(
  hostname: string,
  verificacion?: VercelDomainAddResult["verification"],
): Promise<{ registros: RegistroDns[]; proveedor: ProveedorDns }> {
  const registros: RegistroDns[] = [];

  // La propiedad va SIEMPRE primero: sin ella, apuntar el dominio no sirve.
  for (const v of verificacion ?? []) {
    if (v.type?.toUpperCase() !== "TXT") continue;
    registros.push({
      tipo: "TXT",
      name: nombreRelativo(v.domain, hostname),
      value: v.value,
      motivo: "PROPIEDAD",
    });
  }

  const cfg = await getDomainConfig(hostname);
  const partes = hostname.split(".");
  const esApex = partes.length === 2 || esApexConTldCompuesto(hostname);

  if (cfg.ok) {
    const mejor = <T,>(lista?: Array<{ rank: number; value: T }> | null): T | null => {
      if (!lista?.length) return null;
      return [...lista].sort((a, b) => a.rank - b.rank)[0].value;
    };
    if (esApex) {
      const ips = mejor(cfg.data.recommendedIPv4);
      for (const ip of ips ?? []) {
        registros.push({ tipo: "A", name: "@", value: ip, motivo: "APUNTAR" });
      }
    } else {
      const destino = mejor(cfg.data.recommendedCNAME);
      if (destino) {
        registros.push({
          tipo: "CNAME",
          name: partes[0],
          // Vercel lo devuelve con el punto final de la raíz DNS; casi ningún
          // panel lo acepta escrito así.
          value: destino.replace(/\.$/, ""),
          motivo: "APUNTAR",
        });
      }
    }
  }

  // La API no contestó (o no recomendó nada): se cae a los valores de siempre.
  if (!registros.some((r) => r.motivo === "APUNTAR")) {
    const hint = generarDnsHint(hostname);
    registros.push({ ...hint, motivo: "APUNTAR" });
  }

  return {
    registros,
    proveedor: proveedorDeNameservers(cfg.ok ? cfg.data.nameservers : null),
  };
}

/** `_vercel.midominio.com` sobre `midominio.com` se escribe solo como `_vercel`. */
function nombreRelativo(completo: string, hostname: string): string {
  if (completo === hostname) return "@";
  return completo.endsWith("." + hostname)
    ? completo.slice(0, -(hostname.length + 1))
    : completo;
}

function esApexConTldCompuesto(hostname: string): boolean {
  const partes = hostname.split(".");
  return (
    partes.length === 3 &&
    ["co.uk", "com.es", "com.mx", "com.ar", "com.br"].some((s) => hostname.endsWith(s))
  );
}

/**
 * Heurística simple para generar el DNS hint que se muestra al admin.
 * Para apex: A record 76.76.21.21 (Vercel anycast).
 * Para subdominios: CNAME cname.vercel-dns.com.
 */
export function generarDnsHint(hostname: string): { tipo: "A" | "CNAME"; name: string; value: string } {
  const parts = hostname.split(".");
  const esApex = parts.length === 2 || esApexConTldCompuesto(hostname);
  if (esApex) {
    return { tipo: "A", name: "@", value: "76.76.21.21" };
  }
  return { tipo: "CNAME", name: parts[0], value: "cname.vercel-dns.com" };
}
