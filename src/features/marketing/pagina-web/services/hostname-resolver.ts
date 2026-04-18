/**
 * Resuelve un hostname externo (bacanalmadrid.com, www.x.com) a
 * { empresa_id, pagina_id } usando paginas_web_dominios + paginas_web.
 *
 * Se ejecuta en Server Components de la ruta catch-all (public-site).
 */
import { createAnonClient } from "@/lib/supabase/anon";
import type { Bloque } from "../types";

export interface HostnameMatch {
  empresa_id: string;
  pagina_id: string;
  hostname: string;
  bloques: Bloque[];
  seo: {
    title?: string;
    description?: string;
    og_image?: string;
    robots?: string;
  } | null;
  nombre_empresa: string;
  nombre_pagina: string;
}

/** Normaliza un hostname (sin port, sin protocolo, lowercase). */
export function normalizarHost(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

export async function resolverHostname(rawHost: string): Promise<HostnameMatch | null> {
  const hostname = normalizarHost(rawHost);
  if (!hostname) return null;

  try {
    const supabase = createAnonClient();

    const { data: domRow, error: domErr } = await supabase
      .from("paginas_web_dominios")
      .select("pagina_id, hostname, estado")
      .eq("hostname", hostname)
      .eq("estado", "VERIFICADO")
      .maybeSingle();

    if (domErr) {
      console.error("[pagina-web][resolver] dom:", domErr.message);
      return null;
    }
    if (!domRow) return null;

    const { data: pagRow, error: pagErr } = await supabase
      .from("paginas_web")
      .select("id, empresa_id, nombre, bloques, seo, estado")
      .eq("id", (domRow as { pagina_id: string }).pagina_id)
      .eq("estado", "PUBLICADA")
      .maybeSingle();

    if (pagErr || !pagRow) {
      if (pagErr) console.error("[pagina-web][resolver] pag:", pagErr.message);
      return null;
    }

    const pag = pagRow as {
      id: string;
      empresa_id: string;
      nombre: string;
      bloques: Bloque[];
      seo: HostnameMatch["seo"];
    };

    const { data: empresaRow } = await supabase
      .from("empresas")
      .select("id, nombre")
      .eq("id", pag.empresa_id)
      .maybeSingle();

    return {
      empresa_id: pag.empresa_id,
      pagina_id: pag.id,
      hostname,
      bloques: pag.bloques ?? [],
      seo: pag.seo ?? null,
      nombre_empresa: (empresaRow as { nombre?: string } | null)?.nombre ?? "Restaurante",
      nombre_pagina: pag.nombre,
    };
  } catch (err) {
    console.error("[pagina-web][resolver] fatal:", err);
    return null;
  }
}

/** Lista hostnames primarios del SaaS (no rewritear). Separados por coma. */
export function hostnamesPrincipales(): string[] {
  const env = process.env.APP_PRIMARY_HOSTS ?? "";
  const vercel = process.env.VERCEL_URL ? `${process.env.VERCEL_URL}` : "";
  return [...env.split(","), vercel, "localhost"]
    .map((h) => normalizarHost(h))
    .filter(Boolean);
}

export function esHostPrincipal(rawHost: string): boolean {
  const host = normalizarHost(rawHost);
  if (!host) return true;
  const principales = hostnamesPrincipales();
  // Match exacto o por sufijo (p.ej. staging.balleshosteleros.com)
  return principales.some((h) => host === h || host.endsWith(`.${h}`));
}
