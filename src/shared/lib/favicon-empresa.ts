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
  return iconoDeMarca(url, color, "redondo");
}

/**
 * Dirección del icono de APP: el mismo dibujo CUADRADO y de borde a borde.
 *
 * Va en el `apple-touch-icon`. El isotipo a pelo no sirve cuando viene sobre
 * transparente —que es lo normal— porque iOS rellena de blanco lo que no está
 * pintado: la calavera dorada de BACANAL salía en la pantalla de inicio sobre
 * un cuadro BLANCO, en vez del negro de su favicon. Pasando por aquí lleva su
 * fondo puesto y llena el cuadro entero.
 */
export function iconoAppCuadrado(url: string, color?: string | null): string {
  return iconoDeMarca(url, color, "cuadrado");
}

function iconoDeMarca(url: string, color: string | null | undefined, forma: "redondo" | "cuadrado"): string {
  const q = new URLSearchParams({ u: url });
  if (color) q.set("c", color);
  if (forma === "cuadrado") q.set("forma", "cuadrado");
  // `v=` no lo usa la ruta: está para que al cambiar el aspecto del icono
  // cambie la dirección. El navegador guarda los favicons en su propio archivo
  // y no vuelve a pedirlos; sin esto, quien ya hubiera entrado en la web seguía
  // viendo el icono viejo aunque el nuevo estuviera servido. SUBIR EL NÚMERO al
  // cambiar el dibujo. v3 = 08-09-2026, disco negro; se respeta el color del archivo si ya contrasta.
  // v4 = 13-09-2026, nace el icono de app cuadrado.
  q.set("v", "4");
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
    // iOS va con el CUADRADO a propósito: la pantalla de inicio del iPhone
    // recorta ella el icono. Pero no vale el isotipo a pelo: lo transparente
    // iOS lo rellena de BLANCO, y la calavera dorada de BACANAL salía sobre un
    // cuadro blanco en vez del negro de su favicon. Se sirve generado, con su
    // fondo puesto y llenando el cuadro de borde a borde.
    apple: iconoAppCuadrado(url, colorMarca),
  };
}

/** Atajo: resuelve la empresa y devuelve directamente el bloque `icons`. */
export async function iconsDeEmpresa(clave: ClaveEmpresa): Promise<Metadata["icons"] | undefined> {
  return iconsDeUrl(await isotipoDeEmpresa(clave));
}
