"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/features/accesos/lib/crypto";
import {
  getMetaEstado,
  type MetaEstadoConexion,
} from "@/features/marketing/meta-ads/services/meta-credenciales";
import {
  construirUrlAutorizacion,
  getMetaAppConfig,
  listarCuentasPublicitarias,
  listarPaginas,
  type CuentaPublicitaria,
  type PaginaFacebook,
} from "@/features/marketing/meta-ads/services/meta-oauth";
import {
  META_EMPRESA_COOKIE,
  META_STATE_COOKIE,
  MetaApiError,
  eurosACentimos,
} from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Acciones de la tarjeta Meta en Ajustes → Integraciones.
 *
 * Regla que atraviesa todo el archivo: el acceso cifrado NUNCA se devuelve al
 * navegador. Ni entero, ni troceado, ni "solo los últimos cuatro". Lo que sale
 * de aquí son nombres y estados.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function mensajeDeError(err: unknown): string {
  if (err instanceof MetaApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Error inesperado al hablar con Meta.";
}

/** Estado de la conexión de la empresa activa, para pintar la tarjeta. */
export async function getMetaEstadoAction(): Promise<
  Resultado<MetaEstadoConexion & { appConfigurada: boolean }>
> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const admin = createAdminClient();
  const estado = await getMetaEstado(admin, empresaId);
  return { ok: true, data: { ...estado, appConfigurada: getMetaAppConfig() !== null } };
}

/**
 * Paso 1 de conectar: devuelve la URL de Facebook a la que hay que mandar al
 * usuario, y deja en cookies el `state` (contra CSRF) y la empresa que se está
 * conectando — porque al volver de Facebook hay que saber a qué empresa
 * pertenece ese acceso, y la cookie de empresa activa podría haber cambiado.
 */
export async function iniciarConexionMetaAction(): Promise<Resultado<{ url: string }>> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  if (!getMetaAppConfig()) {
    return fallo(
      "El software todavía no tiene dada de alta su aplicación de Meta. Hace falta configurar META_APP_ID y META_APP_SECRET.",
    );
  }

  const state = randomBytes(24).toString("hex");
  const c = await cookies();
  const opciones = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 minutos: lo que dura conectar, y ni un segundo más
  };
  c.set(META_STATE_COOKIE, state, opciones);
  c.set(META_EMPRESA_COOKIE, empresaId, opciones);

  try {
    return { ok: true, data: { url: construirUrlAutorizacion(state) } };
  } catch (err) {
    return fallo(mensajeDeError(err));
  }
}

/**
 * Tras volver de Facebook: qué cuentas publicitarias, páginas e Instagram ve
 * este acceso. Es lo que se le ofrece a elegir; no se teclea ningún id.
 */
export async function listarActivosMetaAction(): Promise<
  Resultado<{ cuentas: CuentaPublicitaria[]; paginas: PaginaFacebook[] }>
> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_meta_config")
    .select("access_token_cifrado")
    .eq("empresa_id", empresaId)
    .maybeSingle<{ access_token_cifrado: string | null }>();

  if (!data?.access_token_cifrado) {
    return fallo("Todavía no has conectado ninguna cuenta de Meta para esta empresa.");
  }

  try {
    const accessToken = decrypt(data.access_token_cifrado);
    const [cuentas, paginas] = await Promise.all([
      listarCuentasPublicitarias(accessToken),
      listarPaginas(accessToken),
    ]);
    return { ok: true, data: { cuentas, paginas } };
  } catch (err) {
    return fallo(mensajeDeError(err));
  }
}

const guardarSchema = z.object({
  adAccountId: z.string().trim().regex(/^act_\d+$/, "Elige una cuenta publicitaria de la lista."),
  pageId: z.string().trim().min(1, "Elige la página de Facebook del negocio."),
  // Sin tope no se activa: es la garantía de que nadie gaste sin límite.
  topeGastoMensualEuros: z
    .number({ message: "Pon un tope de gasto al mes." })
    .positive("El tope de gasto tiene que ser mayor que cero.")
    .max(1_000_000, "Ese tope es demasiado alto, revísalo."),
  activo: z.boolean(),
});

export type GuardarMetaInput = z.input<typeof guardarSchema>;

/**
 * Guarda la elección de cuenta/página/Instagram y el tope de gasto.
 *
 * El Instagram NO se elige a mano: se toma el que Meta dice que está vinculado
 * a esa página. Si la página no tiene Instagram profesional vinculado, se
 * guarda vacío y la pantalla lo advierte.
 */
export async function guardarCuentaMetaAction(
  input: GuardarMetaInput,
): Promise<Resultado<{ guardado: true }>> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) {
    return fallo(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  }
  const { adAccountId, pageId, topeGastoMensualEuros, activo } = parsed.data;

  const admin = createAdminClient();
  const { data: fila } = await admin
    .from("empresa_meta_config")
    .select("access_token_cifrado")
    .eq("empresa_id", empresaId)
    .maybeSingle<{ access_token_cifrado: string | null }>();

  if (!fila?.access_token_cifrado) {
    return fallo("Conecta primero la cuenta con Facebook.");
  }

  // Se vuelve a preguntar a Meta en vez de fiarse de lo que mande el navegador:
  // así el nombre de la cuenta, la moneda y el Instagram son los de verdad.
  let nombreCuenta: string | null = null;
  let moneda = "EUR";
  let nombrePagina: string | null = null;
  let instagramActorId: string | null = null;
  let nombreInstagram: string | null = null;

  try {
    const accessToken = decrypt(fila.access_token_cifrado);
    const [cuentas, paginas] = await Promise.all([
      listarCuentasPublicitarias(accessToken),
      listarPaginas(accessToken),
    ]);

    const cuenta = cuentas.find((c) => c.id === adAccountId);
    if (!cuenta) return fallo("Esa cuenta publicitaria ya no está disponible con esta conexión.");
    if (!cuenta.utilizable) {
      return fallo(`La cuenta «${cuenta.nombre}» no está activa en Meta. Revísala en el Business Manager.`);
    }
    nombreCuenta = cuenta.nombre;
    moneda = cuenta.moneda;

    const pagina = paginas.find((p) => p.id === pageId);
    if (!pagina) return fallo("Esa página de Facebook ya no está disponible con esta conexión.");
    nombrePagina = pagina.nombre;
    instagramActorId = pagina.instagramId;
    nombreInstagram = pagina.instagramUsuario;
  } catch (err) {
    return fallo(mensajeDeError(err));
  }

  const { error } = await admin
    .from("empresa_meta_config")
    .update({
      ad_account_id: adAccountId,
      page_id: pageId,
      instagram_actor_id: instagramActorId,
      nombre_cuenta: nombreCuenta,
      nombre_pagina: nombrePagina,
      nombre_instagram: nombreInstagram,
      moneda,
      tope_gasto_mensual_cent: eurosACentimos(topeGastoMensualEuros),
      activo,
      conectado_por: userId,
      conectado_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId);

  if (error) return fallo(error.message);
  return { ok: true, data: { guardado: true } };
}

/**
 * Desconectar: borra el acceso de esta empresa. No toca nada en Meta — las
 * campañas siguen su curso allí, que es lo correcto: desconectar el software no
 * puede apagarle la publicidad a nadie.
 */
export async function desconectarMetaAction(): Promise<Resultado<{ desconectado: true }>> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("empresa_meta_config")
    .update({
      access_token_cifrado: null,
      token_expira_at: null,
      ad_account_id: null,
      page_id: null,
      instagram_actor_id: null,
      nombre_cuenta: null,
      nombre_pagina: null,
      nombre_instagram: null,
      activo: false,
    })
    .eq("empresa_id", empresaId);

  if (error) return fallo(error.message);
  return { ok: true, data: { desconectado: true } };
}
