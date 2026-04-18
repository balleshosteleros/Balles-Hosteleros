"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import {
  addDomainToProject,
  generarDnsHint,
  getDomainConfig,
  removeDomainFromProject,
  verifyDomain,
} from "../services/vercel-domains";
import { normalizarHost } from "../services/hostname-resolver";
import type { DominioEstado, PaginaWebDominio } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

function revalidar(paginaId: string) {
  revalidatePath(`/marketing/pagina-web/${paginaId}/dominios`);
  revalidatePath(`/marketing/pagina-web/${paginaId}`);
}

export async function listarDominios(paginaId: string): Promise<ActionResult<PaginaWebDominio[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    const { data, error } = await supabase
      .from("paginas_web_dominios")
      .select("*")
      .eq("pagina_id", paginaId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[dominios][listar]", error.message);
      return { ok: false, error: "No se pudieron cargar los dominios." };
    }
    return { ok: true, data: (data ?? []) as PaginaWebDominio[] };
  } catch (err) {
    console.error("[dominios][listar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function anadirDominio(input: {
  paginaId: string;
  hostname: string;
  esPrincipal?: boolean;
}): Promise<ActionResult<{ id: string; dns: { tipo: string; name: string; value: string } }>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const hostname = normalizarHost(input.hostname);
    if (!hostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) {
      return { ok: false, error: "Hostname inválido. Ej: bacanalmadrid.com" };
    }

    const dns = generarDnsHint(hostname);

    // Call Vercel API
    const vercelRes = await addDomainToProject(hostname);
    if (!vercelRes.ok) {
      // Si ya estaba añadido en Vercel, intentamos continuar (idempotente)
      if (!/already/i.test(vercelRes.error)) {
        console.error("[dominios][vercel] add:", vercelRes.error);
        return { ok: false, error: `Vercel: ${vercelRes.error}` };
      }
    }
    const vercelId = vercelRes.ok ? vercelRes.data.id : null;

    const { data, error } = await supabase
      .from("paginas_web_dominios")
      .insert({
        empresa_id: empresaId,
        pagina_id: input.paginaId,
        hostname,
        es_principal: input.esPrincipal ?? false,
        estado: "PENDIENTE_DNS" as DominioEstado,
        vercel_domain_id: vercelId,
        dns_hint: dns,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[dominios][insert]", error.message);
      return { ok: false, error: "No se pudo guardar el dominio." };
    }

    revalidar(input.paginaId);
    return { ok: true, data: { id: (data as { id: string }).id, dns } };
  } catch (err) {
    console.error("[dominios][anadir] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function verificarDominio(dominioId: string): Promise<
  ActionResult<{ estado: DominioEstado; ssl: boolean }>
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: row, error } = await supabase
      .from("paginas_web_dominios")
      .select("id, hostname, pagina_id")
      .eq("id", dominioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error || !row) return { ok: false, error: "Dominio no encontrado." };

    const hostname = (row as { hostname: string }).hostname;

    const [vercelVerify, vercelConfig] = await Promise.all([
      verifyDomain(hostname),
      getDomainConfig(hostname),
    ]);

    const verified = vercelVerify.ok && vercelVerify.data.verified;
    const misconfigured = vercelConfig.ok ? vercelConfig.data.misconfigured : true;
    const estado: DominioEstado = verified && !misconfigured ? "VERIFICADO" : "PENDIENTE_DNS";
    const ssl = verified && !misconfigured;

    const patch: Record<string, unknown> = {
      estado,
      ssl_activo: ssl,
    };
    if (estado === "VERIFICADO") patch.verificado_at = new Date().toISOString();

    const { error: upErr } = await supabase
      .from("paginas_web_dominios")
      .update(patch)
      .eq("id", dominioId)
      .eq("empresa_id", empresaId);
    if (upErr) console.error("[dominios][verify][update]", upErr.message);

    revalidar((row as { pagina_id: string }).pagina_id);
    return { ok: true, data: { estado, ssl } };
  } catch (err) {
    console.error("[dominios][verificar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function eliminarDominio(dominioId: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: row } = await supabase
      .from("paginas_web_dominios")
      .select("hostname, pagina_id")
      .eq("id", dominioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Dominio no encontrado." };

    const hostname = (row as { hostname: string }).hostname;
    await removeDomainFromProject(hostname); // best-effort

    const { error } = await supabase
      .from("paginas_web_dominios")
      .delete()
      .eq("id", dominioId)
      .eq("empresa_id", empresaId);
    if (error) {
      console.error("[dominios][delete]", error.message);
      return { ok: false, error: "No se pudo eliminar." };
    }

    revalidar((row as { pagina_id: string }).pagina_id);
    return { ok: true };
  } catch (err) {
    console.error("[dominios][eliminar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
