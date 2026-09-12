"use server";

/**
 * Los portales públicos que tiene contratados la EMPRESA ACTIVA.
 *
 * Se guardan en `empresas.config_operativa.portales`, y se leen y escriben
 * aquí —y no desde el formulario general de Ajustes— porque ese formulario
 * manda la configuración entera: si alguien lo tenía abierto de antes, al
 * guardar machacaría lo que se hubiera marcado aquí mientras tanto. Aquí se
 * lee la fila, se cambia solo la clave `portales` y se devuelve.
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalesEmpresa } from "@/features/empresa/lib/portales";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, empresaId };
}

export async function getPortalesEmpresa(): Promise<Resultado<PortalesEmpresa>> {
  const { supabase, empresaId } = await getCtx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data, error } = await supabase
    .from("empresas")
    .select("config_operativa")
    .eq("id", empresaId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const config = (data?.config_operativa ?? {}) as { portales?: PortalesEmpresa };
  return { ok: true, data: config.portales ?? {} };
}

export async function savePortalesEmpresa(
  portales: PortalesEmpresa,
): Promise<Resultado<PortalesEmpresa>> {
  const { supabase, empresaId } = await getCtx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data, error: errorLectura } = await supabase
    .from("empresas")
    .select("config_operativa")
    .eq("id", empresaId)
    .maybeSingle();
  if (errorLectura) return { ok: false, error: errorLectura.message };

  const config = (data?.config_operativa ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("empresas")
    .update({ config_operativa: { ...config, portales } })
    .eq("id", empresaId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: portales };
}

/**
 * ¿Puede esta empresa cambiar la estructura de su web, o solo su contenido?
 *
 * Apagado (lo de fábrica) = modo contenido: textos, fotos y enlaces. La
 * plantilla —qué secciones hay y en qué orden— no se toca, que es lo que hace
 * que las webs no se rompan y sigan pareciéndose entre sí.
 */
export async function getEstructuraWebEditable(): Promise<Resultado<boolean>> {
  const { supabase, empresaId } = await getCtx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data, error } = await supabase
    .from("empresas")
    .select("config_operativa")
    .eq("id", empresaId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const config = (data?.config_operativa ?? {}) as { webEstructuraEditable?: boolean };
  return { ok: true, data: config.webEstructuraEditable === true };
}

export async function saveEstructuraWebEditable(
  valor: boolean,
): Promise<Resultado<boolean>> {
  const { supabase, empresaId } = await getCtx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data, error: errorLectura } = await supabase
    .from("empresas")
    .select("config_operativa")
    .eq("id", empresaId)
    .maybeSingle();
  if (errorLectura) return { ok: false, error: errorLectura.message };

  const config = (data?.config_operativa ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("empresas")
    .update({ config_operativa: { ...config, webEstructuraEditable: valor } })
    .eq("id", empresaId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: valor };
}
