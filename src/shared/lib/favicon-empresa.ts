/**
 * Favicon POR EMPRESA para todas las páginas públicas.
 *
 * POR QUÉ HACE FALTA:
 * `src/app/icon.png` y `src/app/apple-icon.png` son iconos estáticos que Next
 * aplica a TODAS las rutas del proyecto. Son el icono de Balles Hosteleros —el
 * software—, así que la carta de HABANA, el portal de empleo de BACANAL o
 * cualquier enlace público salían en la pestaña del navegador con el logo de la
 * empresa gestora en vez del suyo. Al cliente que abre la carta desde el QR de
 * la mesa eso le dice poco y a la marca del restaurante le resta.
 *
 * Estas funciones resuelven el isotipo de la empresa a la que pertenece cada
 * página y devuelven el bloque `icons` de la metadata de Next. Sirve para
 * cualquier empresa presente y futura: no hay nada cableado por nombre.
 *
 * SIEMPRE EL ISOTIPO, nunca el logotipo: el logotipo lleva el nombre dentro y a
 * 32 px las letras no se leen. Si la empresa aún no ha subido isotipo se cae al
 * logo antes que dejar el icono del software.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

/**
 * Cliente service-role: `empresas` tiene RLS que bloquea anon y esto se ejecuta
 * siempre en el servidor (dentro de `generateMetadata`). Nunca llega al navegador.
 */
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Dirección del isotipo YA RECORTADO EN CÍRCULO.
 *
 * El navegador pinta el favicon tal cual: un isotipo cuadrado sale cuadrado en
 * la pestaña y en los marcadores, con las esquinas en pico al lado de los
 * iconos redondos del resto de webs. Por eso pasa por `/api/favicon`, que lo
 * devuelve redondo. NORMA: todo favicon del software y de las webs sale redondo.
 */
export function faviconRedondo(url: string, color?: string | null): string {
  const q = new URLSearchParams({ u: url });
  if (color) q.set("c", color);
  return `/api/favicon?${q.toString()}`;
}

/** Columna por la que se localiza la empresa dueña de la página pública. */
export type ClaveEmpresa =
  | { carta_slug: string }
  | { empleo_slug: string }
  | { slug: string }
  | { id: string };

/** Isotipo de la empresa + su color de marca (el disco del favicon redondo). */
export interface MarcaEmpresa {
  url: string;
  color: string | null;
}

/**
 * Isotipo de la empresa, o `null` si no se puede resolver (empresa inexistente,
 * o sin ninguna imagen de marca subida todavía).
 */
export async function isotipoDeEmpresa(clave: ClaveEmpresa): Promise<MarcaEmpresa | null> {
  const [columna, valor] = Object.entries(clave)[0] as [string, string];
  if (!valor) return null;

  try {
    const { data } = await serviceClient()
      .from("empresas")
      .select("isotipo_url, logo_alt_url, logo_url, color")
      .eq(columna, valor)
      .maybeSingle();

    if (!data) return null;
    // Orden de preferencia: isotipo → logo alternativo → logotipo. El favicon
    // es un círculo de 32 px: cuanto menos texto lleve, mejor se lee.
    const url =
      (data.isotipo_url as string | null) ||
      (data.logo_alt_url as string | null) ||
      (data.logo_url as string | null);
    return url ? { url, color: (data.color as string | null) ?? null } : null;
  } catch {
    // Un fallo leyendo la marca NUNCA debe tumbar la página: se cae al icono
    // por defecto, que es lo que había antes de todo esto.
    return null;
  }
}

/**
 * Bloque `icons` listo para devolver desde `generateMetadata`.
 *
 * Devolver `undefined` deja que Next use `src/app/icon.png` (el del software),
 * así que sólo se omite cuando de verdad no hay ninguna imagen de la empresa.
 */
export function iconsDeUrl(
  marca: MarcaEmpresa | string | null,
  color?: string | null,
): Metadata["icons"] | undefined {
  const url = typeof marca === "string" ? marca : marca?.url;
  if (!url) return undefined;
  const colorMarca = typeof marca === "string" ? color : marca?.color;

  // `apple` aparte porque iOS ignora el resto para el icono de la pantalla de
  // inicio; `shortcut` por los navegadores que aún lo miran.
  return {
    icon: faviconRedondo(url, colorMarca),
    shortcut: faviconRedondo(url, colorMarca),
    // iOS va con el CUADRADO de siempre a propósito: la pantalla de inicio del
    // iPhone recorta ella el icono y pinta de NEGRO lo transparente, así que un
    // círculo llegaría como un disco dentro de un cuadrado negro. Ver la norma
    // del icono de app (cuadrado, isotipo, con margen).
    apple: url,
  };
}

/** Atajo: resuelve la empresa y devuelve directamente el bloque `icons`. */
export async function iconsDeEmpresa(clave: ClaveEmpresa): Promise<Metadata["icons"] | undefined> {
  return iconsDeUrl(await isotipoDeEmpresa(clave));
}
