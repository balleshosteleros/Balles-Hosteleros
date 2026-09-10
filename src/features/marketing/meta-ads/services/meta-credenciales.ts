import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/features/accesos/lib/crypto";

/**
 * PRP-087 · Credenciales de Meta de UNA empresa.
 *
 * Cada empresa tiene su propia cuenta publicitaria: HABANA no puede ver ni
 * gastar de la de BACANAL. Por eso nada de esto sale de variables de entorno
 * globales — el `empresaId` es obligatorio en todas las funciones.
 *
 * El acceso solo se descifra aquí, en servidor, y no se devuelve nunca al
 * navegador.
 */

export interface MetaCredenciales {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  instagramActorId: string | null;
  moneda: string;
  topeGastoMensualCent: number | null;
  tokenExpiraAt: string | null;
}

/** Lo que sí puede ver el navegador: el estado, nunca las claves. */
export interface MetaEstadoConexion {
  conectado: boolean;
  activo: boolean;
  adAccountId: string | null;
  nombreCuenta: string | null;
  nombrePagina: string | null;
  nombreInstagram: string | null;
  moneda: string;
  topeGastoMensualCent: number | null;
  tokenExpiraAt: string | null;
  /** Días que faltan para que caduque el acceso; negativo si ya caducó. */
  diasParaCaducar: number | null;
}

interface FilaConfig {
  access_token_cifrado: string | null;
  ad_account_id: string | null;
  page_id: string | null;
  instagram_actor_id: string | null;
  nombre_cuenta: string | null;
  nombre_pagina: string | null;
  nombre_instagram: string | null;
  moneda: string | null;
  tope_gasto_mensual_cent: number | null;
  token_expira_at: string | null;
  activo: boolean;
}

const COLUMNAS =
  "access_token_cifrado, ad_account_id, page_id, instagram_actor_id, nombre_cuenta, nombre_pagina, nombre_instagram, moneda, tope_gasto_mensual_cent, token_expira_at, activo";

/**
 * Credenciales completas para llamar a la API. `null` si la empresa no tiene
 * Meta conectado o si le falta algo imprescindible: quien llame debe tratar el
 * `null` como "esta empresa no tiene Meta", no como un error.
 */
export async function getMetaCredenciales(
  admin: SupabaseClient,
  empresaId: string,
): Promise<MetaCredenciales | null> {
  const { data } = await admin
    .from("empresa_meta_config")
    .select(COLUMNAS)
    .eq("empresa_id", empresaId)
    .maybeSingle<FilaConfig>();

  if (!data?.activo) return null;
  if (!data.access_token_cifrado || !data.ad_account_id || !data.page_id) return null;

  let accessToken: string;
  try {
    accessToken = decrypt(data.access_token_cifrado);
  } catch {
    // Clave de cifrado cambiada o dato corrupto: mejor "no conectado" que
    // reventar la pantalla de marketing entera.
    console.error(`[meta] no se pudo descifrar el acceso de la empresa ${empresaId}`);
    return null;
  }

  return {
    accessToken,
    adAccountId: data.ad_account_id,
    pageId: data.page_id,
    instagramActorId: data.instagram_actor_id,
    moneda: data.moneda ?? "EUR",
    topeGastoMensualCent: data.tope_gasto_mensual_cent,
    tokenExpiraAt: data.token_expira_at,
  };
}

/** Estado para pintar en Ajustes. Sin claves: esto sí puede viajar. */
export async function getMetaEstado(
  admin: SupabaseClient,
  empresaId: string,
): Promise<MetaEstadoConexion> {
  const { data } = await admin
    .from("empresa_meta_config")
    .select(COLUMNAS)
    .eq("empresa_id", empresaId)
    .maybeSingle<FilaConfig>();

  const vacio: MetaEstadoConexion = {
    conectado: false,
    activo: false,
    adAccountId: null,
    nombreCuenta: null,
    nombrePagina: null,
    nombreInstagram: null,
    moneda: "EUR",
    topeGastoMensualCent: null,
    tokenExpiraAt: null,
    diasParaCaducar: null,
  };

  if (!data) return vacio;

  const diasParaCaducar = data.token_expira_at
    ? Math.floor((new Date(data.token_expira_at).getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    conectado: Boolean(data.access_token_cifrado),
    activo: data.activo,
    adAccountId: data.ad_account_id,
    nombreCuenta: data.nombre_cuenta,
    nombrePagina: data.nombre_pagina,
    nombreInstagram: data.nombre_instagram,
    moneda: data.moneda ?? "EUR",
    topeGastoMensualCent: data.tope_gasto_mensual_cent,
    tokenExpiraAt: data.token_expira_at,
    diasParaCaducar,
  };
}
