/**
 * Resuelve un hostname externo (bacanalmadrid.com, www.x.com) a
 * { empresa_id, pagina_id } usando paginas_web_dominios + paginas_web.
 *
 * Se ejecuta en Server Components de la ruta catch-all (public-site).
 */
import { createAnonClient } from "@/lib/supabase/anon";
import type { Bloque, BrandingSnapshot } from "../types";

export interface HostnameMatch {
  empresa_id: string;
  empresa_slug: string | null;
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
  /** Logo completo (marca + texto). Cabecera de la web. */
  logo_url: string | null;
  /**
   * Isotipo: la marca SIN texto. Es lo que va en el favicon, el icono de la PWA
   * y el pin del mapa — un logotipo con letras es ilegible a 32px. Cae al logo
   * si la empresa no tiene isotipo cargado.
   */
  isotipo_url: string | null;
  /** Colores y tipografía de la empresa. Sin esto la web sale con el tema por defecto. */
  branding: BrandingSnapshot | null;
  /**
   * Redes de la empresa (Ajustes → datos generales). Se resuelven aquí y no se
   * guardan en el bloque: cambiar la red en Ajustes actualiza la web sola.
   */
  redes: RedesEmpresa;
}

export interface RedesEmpresa {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  whatsapp: string | null;
}

/**
 * Los campos de Ajustes admiten tanto un usuario ("bacanal_fuenlabrada") como
 * una URL completa. Normalizamos a URL para poder enlazar siempre.
 */
export function urlRed(red: keyof RedesEmpresa, valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").trim();
  if (!handle) return null;
  switch (red) {
    case "instagram":
      return `https://www.instagram.com/${encodeURIComponent(handle)}`;
    case "facebook":
      // El nombre de página de Facebook no lleva espacios en la URL: se
      // guardan por comodidad ("Bacanal fuenlabrada") y aquí se quitan.
      return `https://www.facebook.com/${encodeURIComponent(handle.replace(/\s+/g, ""))}`;
    case "tiktok":
      return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
    case "whatsapp": {
      // wa.me exige el número con prefijo de país y sin signos. En Ajustes se
      // escribe como se tenga a mano ("612 345 678", "+34 612345678",
      // "0034612345678"): aquí se normaliza para que el enlace funcione siempre.
      let n = handle.replace(/\D/g, "");
      if (n.startsWith("00")) n = n.slice(2);
      if (n.length === 9) n = `34${n}`; // móvil español sin prefijo
      return n.length >= 11 ? `https://wa.me/${n}` : null;
    }
  }
}

/** Normaliza un hostname (sin port, sin protocolo, lowercase). */
export function normalizarHost(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

/**
 * Resuelve el dominio y, dentro de él, la página que corresponde a la ruta.
 *
 * @param rutaSlug Slug de la URL: "" = inicio (la página del dominio),
 * "politica-de-privacidad" = esa página concreta de la misma empresa.
 *
 * POR QUÉ IMPORTA LA RUTA:
 * Antes se servía SIEMPRE la página asociada al dominio, sin mirar la URL, así
 * que /politica-de-privacidad devolvía la portada. Sin URL propia no se puede
 * enlazar la política desde un formulario — y eso es obligatorio por RGPD.
 */
export async function resolverHostname(
  rawHost: string,
  rutaSlug = "",
): Promise<HostnameMatch | null> {
  const hostname = normalizarHost(rawHost);
  if (!hostname) return null;

  const slug = rutaSlug.replace(/^\/+|\/+$/g, "").toLowerCase();

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

    const paginaInicioId = (domRow as { pagina_id: string }).pagina_id;

    // La portada es la página enganchada al dominio. Para cualquier otra ruta
    // buscamos por slug DENTRO de la misma empresa, para que un dominio no
    // pueda servir páginas de otra.
    let consulta = supabase
      .from("paginas_web")
      .select("id, empresa_id, nombre, bloques, seo, estado, branding")
      .eq("estado", "PUBLICADA");

    if (slug) {
      const { data: inicioRow } = await supabase
        .from("paginas_web")
        .select("empresa_id")
        .eq("id", paginaInicioId)
        .maybeSingle();

      const empresaDelDominio = (inicioRow as { empresa_id?: string } | null)?.empresa_id;
      if (!empresaDelDominio) return null;

      consulta = consulta
        .eq("empresa_id", empresaDelDominio)
        .eq("slug_interno", slug);
    } else {
      consulta = consulta.eq("id", paginaInicioId);
    }

    const { data: pagRow, error: pagErr } = await consulta.maybeSingle();

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
      branding: BrandingSnapshot | null;
    };

    // Vía `empresas_web_publica` y NO `empresas`: la tabla solo tiene política
    // para `authenticated`, así que el visitante anónimo leía null y la web salía
    // como "Restaurante" y sin logo. La vista expone solo los campos públicos de
    // las empresas que YA tienen web publicada (migración 015).
    const { data: empresaRow } = await supabase
      .from("empresas_web_publica")
      .select("id, nombre, slug, logo_url, isotipo_url, instagram, facebook, tiktok, whatsapp")
      .eq("id", pag.empresa_id)
      .maybeSingle();

    const emp = (empresaRow ?? {}) as {
      nombre?: string;
      slug?: string | null;
      logo_url?: string | null;
      isotipo_url?: string | null;
      instagram?: string | null;
      facebook?: string | null;
      tiktok?: string | null;
      whatsapp?: string | null;
    };
    const dg = emp as Record<string, string | undefined>;

    return {
      empresa_id: pag.empresa_id,
      empresa_slug: emp.slug ?? null,
      pagina_id: pag.id,
      hostname,
      bloques: pag.bloques ?? [],
      seo: pag.seo ?? null,
      nombre_empresa: emp.nombre ?? "Restaurante",
      logo_url: emp.logo_url ?? null,
      isotipo_url: emp.isotipo_url ?? emp.logo_url ?? null,
      // El logo de la empresa alimenta también la barra de navegación.
      branding: pag.branding ? { ...pag.branding, logo_url: emp.logo_url ?? undefined } : (emp.logo_url ? { logo_url: emp.logo_url } : null),
      nombre_pagina: pag.nombre,
      redes: {
        instagram: urlRed("instagram", dg.instagram),
        facebook: urlRed("facebook", dg.facebook),
        tiktok: urlRed("tiktok", dg.tiktok),
        whatsapp: urlRed("whatsapp", dg.whatsapp),
      },
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
  return [...env.split(","), vercel, "balleshosteleros.com", "localhost"]
    .map((h) => normalizarHost(h))
    .filter(Boolean);
}

/**
 * Subdominio donde viven los códigos QR. Es COMÚN a todas las empresas (por eso el
 * código es único globalmente): así dar de alta una empresa nueva no obliga a tocar
 * DNS ni a esperar a nadie.
 *
 * Configurable por si algún día cambia, pero con valor por defecto: si la variable
 * de entorno faltara en producción, los QR ya impresos dejarían de funcionar, y eso
 * no puede depender de un despiste de configuración.
 */
export function hostQr(): string {
  const env = process.env.NEXT_PUBLIC_QR_HOST?.trim();
  return normalizarHost(env || "qr.balleshosteleros.com");
}

export function esHostQr(rawHost: string): boolean {
  const host = normalizarHost(rawHost);
  if (!host) return false;
  return host === hostQr();
}

/**
 * Subdominios del dominio principal que, pese a terminar en
 * `.balleshosteleros.com`, sirven una PÁGINA WEB de empresa y no la app.
 *
 * POR QUÉ EXISTE ESTO:
 * `esHostPrincipal()` da por buena cualquier dirección acabada en el dominio
 * principal, así que un `bacanal.balleshosteleros.com` caía en el enrutado
 * normal y devolvía la app (login) en vez de la web del restaurante. Sirve para
 * enseñar una web antes de apuntarle su dominio real: el cliente la revisa sin
 * tocar el DNS del dominio en producción, que es un cambio de cara al público.
 *
 * El dominio real (bacanalmadrid.com) NO necesita estar aquí: al no terminar en
 * el dominio principal, `esHostPrincipal()` ya lo manda al motor de webs.
 *
 * Se configura por entorno (coma separada) para no tener que tocar código al
 * añadir una web nueva.
 */
export function hostsPreviewWeb(): string[] {
  const env = process.env.PAGINAS_WEB_PREVIEW_HOSTS ?? "";
  return env
    .split(",")
    .map((h) => normalizarHost(h))
    .filter(Boolean);
}

export function esHostPreviewWeb(rawHost: string): boolean {
  const host = normalizarHost(rawHost);
  if (!host) return false;
  return hostsPreviewWeb().includes(host);
}

/**
 * ¿Es una IP de la red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)?
 *
 * Se trata como host principal, igual que `localhost`: es como se abre la app
 * desde el MÓVIL contra el localhost del Mac (http://192.168.1.50:3000). Sin
 * esto, la IP no casaba con ningún dominio conocido, el proxy la tomaba por la
 * web pública de una empresa y TODA la app respondía 404 desde el teléfono
 * mientras desde el ordenador cargaba con normalidad.
 */
function esIpRedLocal(host: string): boolean {
  const soloIp = host.split(":")[0];
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(soloIp) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(soloIp) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(soloIp) ||
    soloIp === "127.0.0.1"
  );
}

export function esHostPrincipal(rawHost: string): boolean {
  const host = normalizarHost(rawHost);
  if (!host) return true;
  // La app abierta desde el móvil por la IP del Mac es la app, no una web de
  // empresa. Va lo primero: una IP no puede ser el dominio de ningún cliente.
  if (esIpRedLocal(host)) return true;
  // Los subdominios de preview sirven web de empresa, no la app: se comprueba
  // ANTES del match por sufijo, que si no los daría por principales.
  if (esHostPreviewWeb(host)) return false;
  const principales = hostnamesPrincipales();
  // Match exacto o por sufijo (p.ej. staging.balleshosteleros.com)
  return principales.some((h) => host === h || host.endsWith(`.${h}`));
}
