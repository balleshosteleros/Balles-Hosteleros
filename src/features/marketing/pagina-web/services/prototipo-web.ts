/**
 * Generador de la web prototipo.
 *
 * La idea: el restaurante NO escribe su web. Todo lo que hace falta ya vive en
 * el software (Ajustes, Sala, Empleo, Carta, Reseñas), así que aquí se monta
 * sola a partir de esos datos y el usuario solo decide QUÉ MÓDULOS quiere.
 *
 * Cada módulo es opcional y se puede activar/desactivar. Los que dependen de
 * datos que la empresa no tiene se marcan como no disponibles en vez de generar
 * una sección vacía.
 */

import type { Bloque, BloqueTipo, BrandingSnapshot, SeoConfig } from "../types";

export type ModuloWeb =
  | "hero"
  | "presentacion"
  | "galeria"
  | "carta"
  | "reservas"
  | "testimonios"
  | "redes"
  | "empleo"
  | "inspecciones"
  | "mapa"
  | "contacto";

export interface ModuloDefinicion {
  clave: ModuloWeb;
  label: string;
  descripcion: string;
  /** Activado por defecto al crear la web. */
  pordefecto: boolean;
}

export const MODULOS_WEB: ModuloDefinicion[] = [
  { clave: "hero", label: "Portada", descripcion: "Imagen grande con el nombre y botón de reservar", pordefecto: true },
  { clave: "presentacion", label: "Quiénes somos", descripcion: "Texto de presentación del local", pordefecto: true },
  { clave: "galeria", label: "Galería", descripcion: "Fotos del local y los platos", pordefecto: true },
  { clave: "carta", label: "Carta", descripcion: "Enlace a la carta digital del software", pordefecto: true },
  { clave: "reservas", label: "Reservas", descripcion: "Motor de reservas propio, con disponibilidad real", pordefecto: true },
  { clave: "testimonios", label: "Reseñas", descripcion: "Opiniones reales de Google ya sincronizadas", pordefecto: true },
  { clave: "redes", label: "Redes sociales", descripcion: "Enlaces que salen de Ajustes de la empresa", pordefecto: true },
  { clave: "empleo", label: "Empleo", descripcion: "Portal de empleo con las vacantes abiertas", pordefecto: true },
  { clave: "inspecciones", label: "Bolsa de inspectores", descripcion: "Inscripción de inspectores externos", pordefecto: false },
  { clave: "mapa", label: "Cómo llegar", descripcion: "Mapa con la dirección del local", pordefecto: true },
  { clave: "contacto", label: "Pie de página", descripcion: "Teléfono, dirección, horarios y legal", pordefecto: true },
];

/** Datos que el generador necesita. TODOS salen del software. */
export interface DatosEmpresaWeb {
  nombre: string;
  slug: string | null;
  empleoSlug: string | null;
  cartaSlug: string | null;
  cartaPublicada: boolean;
  logoUrl: string | null;
  color: string | null;
  colorSecundario: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  /** Instagram/Facebook/TikTok tal cual están en Ajustes (sin normalizar). */
  tieneAlgunaRed: boolean;
  /** Reseñas reales ya sincronizadas, para el bloque de testimonios. */
  testimonios: Array<{ nombre: string; texto: string; estrellas?: number }>;
  /** Fotos ya subidas al bucket de la empresa. */
  fotos: Array<{ url: string; alt: string }>;
  fotoPortada: string | null;
  horarios: string[];
}

/** Un módulo puede no ser aplicable si faltan datos en el software. */
export function moduloDisponible(m: ModuloWeb, d: DatosEmpresaWeb): boolean {
  switch (m) {
    case "carta":
      return Boolean(d.cartaSlug);
    case "reservas":
      return Boolean(d.slug);
    case "empleo":
      return Boolean(d.empleoSlug);
    case "inspecciones":
      return Boolean(d.slug);
    case "redes":
      return d.tieneAlgunaRed;
    case "testimonios":
      return d.testimonios.length > 0;
    case "galeria":
      return d.fotos.length > 0;
    case "mapa":
      return Boolean(d.direccion);
    default:
      return true;
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function bloque<T extends BloqueTipo>(tipo: T, orden: number, datos: unknown): Bloque {
  return { id: uuid(), tipo, orden, visible: true, datos } as Bloque;
}

/**
 * Monta los bloques de la web. El ORDEN es fijo y pensado para un restaurante:
 * primero se enamora (portada, quiénes somos, fotos), luego se decide (carta),
 * luego se actúa (reservar), y al final la prueba social y lo secundario.
 */
export function generarBloquesPrototipo(
  modulos: ModuloWeb[],
  d: DatosEmpresaWeb,
): Bloque[] {
  const activos = new Set(modulos.filter((m) => moduloDisponible(m, d)));
  const out: Bloque[] = [];
  let orden = 0;
  const push = (tipo: BloqueTipo, datos: unknown) => {
    out.push(bloque(tipo, orden++, datos));
  };

  const ciudad = d.ciudad ?? "";

  if (activos.has("hero")) {
    push("hero", {
      titulo: ciudad ? `${d.nombre} · ${ciudad}` : d.nombre,
      subtitulo: "Reserva tu mesa en un clic",
      cta: { label: "Reservar", href: "#reservas" },
      ...(d.fotoPortada ? { foto_url: d.fotoPortada } : {}),
      overlay: 0.45,
    });
  }

  if (activos.has("presentacion")) {
    push("texto_libre", {
      html_seguro:
        `<h2>Bienvenido a ${escapeHtml(d.nombre)}</h2>` +
        `<p>Cocina de producto, ambiente cuidado y un equipo que disfruta` +
        ` atendiéndote${ciudad ? ` en el corazón de ${escapeHtml(ciudad)}` : ""}.</p>` +
        `<p>Edita este texto para contar tu historia.</p>`,
    });
  }

  if (activos.has("galeria")) {
    push("galeria", { layout: "grid", imagenes: d.fotos.slice(0, 12) });
  }

  if (activos.has("carta") && d.cartaSlug) {
    push("cta", {
      titulo: "Nuestra carta",
      texto: d.cartaPublicada
        ? "Siempre actualizada, con precios y alérgenos."
        : "Publica tu carta digital para que tus clientes la vean aquí.",
      boton: { label: "Ver la carta", href: `/carta/${d.cartaSlug}`, variante: "primary" },
    });
  }

  if (activos.has("reservas")) {
    push("reservas", { modo: "portal_propio" });
  }

  if (activos.has("testimonios")) {
    push("testimonios", { items: d.testimonios.slice(0, 6) });
  }

  if (activos.has("redes")) {
    push("redes", {
      titulo: "Síguenos",
      descripcion: "Todo lo que pasa en el local, cada día.",
    });
  }

  if (activos.has("mapa") && d.direccion) {
    // Sin geocodificación: se centra en la ciudad y el usuario ajusta el pin
    // desde el editor. Mejor eso que inventar coordenadas.
    push("mapa", {
      lat: 40.2929043,
      lng: -3.7908484,
      zoom: 16,
      direccion_texto: d.direccion,
    });
  }

  if (activos.has("empleo") && d.empleoSlug) {
    push("cta", {
      titulo: "Trabaja con nosotros",
      texto: "Consulta nuestras vacantes abiertas y únete al equipo.",
      boton: { label: "Ver ofertas", href: `/empleo/${d.empleoSlug}`, variante: "primary" },
    });
  }

  if (activos.has("inspecciones")) {
    push("bolsa_inspectores", {
      titulo: "Únete a nuestra bolsa de inspectores",
      descripcion: "Colabora con inspecciones puntuales en nuestros locales.",
      cta_label: "Apuntarme a la bolsa",
    });
  }

  if (activos.has("contacto")) {
    const contacto: Array<{ label: string; href: string }> = [];
    if (d.direccion) contacto.push({ label: d.direccion, href: "#mapa" });
    if (d.telefono) {
      contacto.push({ label: d.telefono, href: `tel:${d.telefono.replace(/\s|\D/g, "")}` });
    }
    if (d.email) contacto.push({ label: d.email, href: `mailto:${d.email}` });

    const columnas: Array<{ titulo: string; items: Array<{ label: string; href: string }> }> = [];
    const navegar: Array<{ label: string; href: string }> = [];
    if (activos.has("carta") && d.cartaSlug) {
      navegar.push({ label: "Carta", href: `/carta/${d.cartaSlug}` });
    }
    if (activos.has("reservas")) navegar.push({ label: "Reservar", href: "#reservas" });
    if (activos.has("empleo") && d.empleoSlug) {
      navegar.push({ label: "Empleo", href: `/empleo/${d.empleoSlug}` });
    }
    if (navegar.length) columnas.push({ titulo: d.nombre, items: navegar });
    if (contacto.length) columnas.push({ titulo: "Contacto", items: contacto });
    if (d.horarios.length) {
      columnas.push({
        titulo: "Horarios",
        items: d.horarios.map((h) => ({ label: h, href: "#" })),
      });
    }

    push("footer", {
      columnas,
      texto_legal: `© ${new Date().getFullYear()} ${d.nombre}. Todos los derechos reservados.`,
    });
  }

  return out;
}

export function generarBrandingPrototipo(d: DatosEmpresaWeb): BrandingSnapshot {
  return {
    color_primario: d.color ?? "#d0a000",
    color_secundario: d.colorSecundario ?? "#a08020",
    color_fondo: "#0b0b0c",
    ...(d.logoUrl ? { logo_url: d.logoUrl } : {}),
  };
}

export function generarSeoPrototipo(d: DatosEmpresaWeb): SeoConfig {
  return {
    title: d.ciudad ? `${d.nombre} · ${d.ciudad}` : d.nombre,
    description: `Reserva tu mesa en ${d.nombre}${d.ciudad ? ` (${d.ciudad})` : ""}.`,
    ...(d.fotoPortada ? { og_image: d.fotoPortada } : {}),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
