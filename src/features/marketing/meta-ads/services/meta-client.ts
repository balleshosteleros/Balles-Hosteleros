import "server-only";

import {
  META_GRAPH_BASE,
  MetaApiError,
  traducirErrorMeta,
} from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Cliente único de la Graph API de Meta.
 *
 * Todo lo que hable con Meta pasa por aquí. Motivos:
 *  - El acceso se descifra en servidor y NUNCA sale al navegador, así que estas
 *    llamadas no pueden hacerse desde un componente de cliente.
 *  - Los errores se traducen una sola vez a castellano, en vez de que cada
 *    pantalla se invente su propio mensaje.
 *  - El cupo de llamadas de Meta se reintenta aquí, con espera creciente.
 */

const TIMEOUT_MS = 20_000;
const REINTENTOS_CUPO = 2;

async function esperar(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function peticion(
  url: string,
  init: RequestInit,
  intento = 0,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new MetaApiError("Meta ha tardado demasiado en responder. Inténtalo de nuevo.");
    }
    throw new MetaApiError("No se ha podido conectar con Meta. Revisa la conexión a internet.");
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = traducirErrorMeta(body, res.status);
    // Cupo agotado: Meta pide esperar. Reintentamos con espera creciente
    // antes de rendirnos, porque suele resolverse en segundos.
    if (error.esCupoAgotado && intento < REINTENTOS_CUPO) {
      await esperar(2000 * (intento + 1));
      return peticion(url, init, intento + 1);
    }
    throw error;
  }

  return body;
}

/** GET a la Graph API. Los parámetros van en la URL; el acceso también. */
export async function metaGet<T = Record<string, unknown>>(
  ruta: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${ruta.startsWith("/") ? ruta : `/${ruta}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("access_token", accessToken);
  return (await peticion(url.toString(), { method: "GET" })) as T;
}

/** POST a la Graph API. Los objetos se serializan a JSON, como espera Meta. */
export async function metaPost<T = Record<string, unknown>>(
  ruta: string,
  accessToken: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = `${META_GRAPH_BASE}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.append(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  body.append("access_token", accessToken);
  return (await peticion(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })) as T;
}

/**
 * GET paginado: recorre `paging.next` hasta agotar la lista.
 *
 * Una cuenta publicitaria con años de historia devuelve las campañas de 25 en
 * 25. Sin esto, la pantalla enseñaría solo la primera página y el usuario
 * pensaría que le faltan campañas.
 */
export async function metaGetTodas<T = Record<string, unknown>>(
  ruta: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
  maxPaginas = 40,
): Promise<T[]> {
  const acumulado: T[] = [];
  let respuesta = await metaGet<{ data?: T[]; paging?: { next?: string } }>(
    ruta,
    accessToken,
    { limit: 100, ...params },
  );
  acumulado.push(...(respuesta.data ?? []));

  let paginas = 1;
  while (respuesta.paging?.next && paginas < maxPaginas) {
    respuesta = (await peticion(respuesta.paging.next, { method: "GET" })) as {
      data?: T[];
      paging?: { next?: string };
    };
    acumulado.push(...(respuesta.data ?? []));
    paginas += 1;
  }

  return acumulado;
}
