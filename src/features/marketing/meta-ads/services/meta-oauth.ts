import "server-only";

import {
  META_API_VERSION,
  META_GRAPH_BASE,
  META_REDIRECT_PATH,
  META_SCOPES,
  MetaApiError,
  traducirErrorMeta,
} from "@/features/marketing/meta-ads/lib/meta-api";
import { metaGet } from "@/features/marketing/meta-ads/services/meta-client";
import { getSiteUrl } from "@/lib/site-url";

/**
 * PRP-087 · "Conectar con Facebook".
 *
 * El App ID y el App Secret identifican al SOFTWARE, no a la empresa: van en
 * variables de entorno. Lo que es de cada empresa es el acceso que sale de este
 * baile, y eso sí se guarda cifrado en su fila.
 *
 * Nota sobre la revisión de Meta: mientras la app esté en modo desarrollo, esto
 * funciona íntegro para quien tenga rol en la app sobre cuentas publicitarias
 * de las que ya es administrador (HABANA y BACANAL). La revisión de
 * `ads_management` solo hace falta para conectar empresas ajenas.
 */

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
}

/** `null` si el software no tiene todavía dada de alta su app de Meta. */
export function getMetaAppConfig(): MetaAppConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/** La dirección de vuelta debe coincidir CARÁCTER A CARÁCTER con la dada de alta en Meta. */
export function getMetaRedirectUri(): string {
  return `${getSiteUrl()}${META_REDIRECT_PATH}`;
}

/** URL a la que se manda al usuario al pulsar "Conectar con Facebook". */
export function construirUrlAutorizacion(state: string): string {
  const cfg = getMetaAppConfig();
  if (!cfg) throw new MetaApiError("El software todavía no tiene dada de alta su aplicación de Meta.");

  const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", getMetaRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

interface RespuestaToken {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * Canjea el código por un acceso y lo convierte en uno de larga duración
 * (~60 días). El corto dura una hora: si guardásemos ese, la integración se
 * caería sola esa misma tarde.
 */
export async function canjearCodigoPorAccesoLargo(
  code: string,
): Promise<{ accessToken: string; expiraAt: string | null }> {
  const cfg = getMetaAppConfig();
  if (!cfg) throw new MetaApiError("El software todavía no tiene dada de alta su aplicación de Meta.");

  const corto = await pedirToken({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: getMetaRedirectUri(),
    code,
  });

  const largo = await pedirToken({
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: corto.access_token ?? "",
  });

  const accessToken = largo.access_token ?? corto.access_token;
  if (!accessToken) {
    throw new MetaApiError("Meta no ha devuelto ningún acceso. Vuelve a intentar la conexión.");
  }

  const segundos = largo.expires_in ?? corto.expires_in ?? null;
  const expiraAt = segundos ? new Date(Date.now() + segundos * 1000).toISOString() : null;

  return { accessToken, expiraAt };
}

async function pedirToken(params: Record<string, string>): Promise<RespuestaToken> {
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw traducirErrorMeta(body, res.status);
  return body as RespuestaToken;
}

// ─── Descubrimiento de activos ──────────────────────────────────────
// Nada de teclear identificadores: se leen de la API y se eligen de una lista.

export interface CuentaPublicitaria {
  id: string;            // act_123456789
  nombre: string;
  moneda: string;
  /** Meta usa 1 = activa; cualquier otra cosa es cuenta cerrada o con incidencia. */
  utilizable: boolean;
}

export interface PaginaFacebook {
  id: string;
  nombre: string;
  instagramId: string | null;
  instagramUsuario: string | null;
}

/** Cuentas publicitarias a las que llega este acceso. */
export async function listarCuentasPublicitarias(accessToken: string): Promise<CuentaPublicitaria[]> {
  const res = await metaGet<{
    data?: Array<{ id?: string; name?: string; currency?: string; account_status?: number }>;
  }>("/me/adaccounts", accessToken, {
    fields: "id,name,currency,account_status",
    limit: 200,
  });

  return (res.data ?? [])
    .filter((c) => Boolean(c.id))
    .map((c) => ({
      id: c.id as string,
      nombre: c.name?.trim() || (c.id as string),
      moneda: c.currency ?? "EUR",
      utilizable: c.account_status === 1,
    }));
}

/**
 * Páginas de Facebook, con su Instagram vinculado si lo tienen.
 *
 * Si una página no devuelve `instagram_business_account`, es que la cuenta de
 * Instagram no es profesional o no está vinculada en el Business Manager. Eso
 * hay que decirlo en la pantalla: si no, el anuncio se crearía solo para
 * Facebook y nadie entendería por qué no sale en Instagram.
 */
export async function listarPaginas(accessToken: string): Promise<PaginaFacebook[]> {
  const res = await metaGet<{
    data?: Array<{
      id?: string;
      name?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  }>("/me/accounts", accessToken, {
    fields: "id,name,instagram_business_account{id,username}",
    limit: 200,
  });

  return (res.data ?? [])
    .filter((p) => Boolean(p.id))
    .map((p) => ({
      id: p.id as string,
      nombre: p.name?.trim() || (p.id as string),
      instagramId: p.instagram_business_account?.id ?? null,
      instagramUsuario: p.instagram_business_account?.username ?? null,
    }));
}
