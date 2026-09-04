/**
 * Canales de reserva en redes sociales (Instagram y Facebook).
 *
 * ⚠️ REGLA DEL DOMINIO — leer antes de tocar nada aquí.
 *
 * Meta NO tiene equivalente a Reserve with Google: no existe API pública para
 * publicar disponibilidad dentro de Instagram/Facebook ni para recibir la
 * reserva sin salir de la app. Lo que Meta sí permite —y es lo que usan
 * CoverManager y TheFork— es un BOTÓN DE ACCIÓN en el perfil que abre un
 * enlace externo. La reserva se completa en nuestro portal.
 *
 * Por eso este canal no lleva webhooks, ni OAuth, ni credenciales: es un
 * enlace de atribución (`reserva_links`) más las instrucciones exactas de
 * dónde pegarlo en cada app. El motor que confirma la reserva es el mismo de
 * la web (`/reservar/[slug]/[keyword]`), así que la mesa se asigna y se
 * confirma al momento igual que en cualquier otro canal.
 *
 * La palabra clave del enlace ES el origen que queda grabado en la reserva:
 * `crear-reserva-publica.ts` guarda `origen = <palabra_clave>`, e
 * `INSTAGRAM`/`FACEBOOK` ya tienen etiqueta y color propios en
 * `features/sala/data/origenes.ts`. No inventar otras palabras clave para
 * estos dos canales o la analítica los partiría en dos columnas.
 */

export type CanalSocialId = "instagram" | "facebook";

export interface PasoConfiguracion {
  /** Texto del paso, en sentence case y sin jerga técnica. */
  texto: string;
}

export interface CanalSocial {
  id: CanalSocialId;
  nombre: string;
  /** Palabra clave del enlace de atribución. Debe existir en LABELS de origenes.ts. */
  palabraClave: string;
  /** Qué recibe el restaurante al activarlo. */
  descripcion: string;
  /** Qué NO hace, dicho sin rodeos, para que nadie espere una integración nativa. */
  limitacion: string;
  /** Dónde se pega el enlace, paso a paso, dentro de la app de Meta. */
  pasos: PasoConfiguracion[];
  /** Enlace a la pantalla real de Meta donde se hace, si existe versión web. */
  ayudaUrl: string;
  ayudaLabel: string;
}

export const CANALES_SOCIALES: Record<CanalSocialId, CanalSocial> = {
  instagram: {
    id: "instagram",
    nombre: "Instagram",
    palabraClave: "INSTAGRAM",
    descripcion:
      "Botón «Reservar» en tu perfil de Instagram y enlace para historias y bio.",
    limitacion:
      "Instagram no permite completar la reserva dentro de la app: el botón abre tu página de reservas en el navegador. Es como funcionan también CoverManager y TheFork.",
    pasos: [
      { texto: "Tu cuenta tiene que ser profesional (empresa). Si es personal: Configuración → Tipo de cuenta → Cambiar a cuenta profesional." },
      { texto: "Abre tu perfil y pulsa «Editar perfil»." },
      { texto: "Entra en «Botones de acción» y elige «Reservar»." },
      { texto: "Elige «Sitio web» como proveedor y pega el enlace de abajo." },
      { texto: "Guarda. El botón «Reservar» aparece en tu perfil en unos minutos." },
      { texto: "Pega también el enlace en tu bio y en el sticker de enlace de las historias." },
    ],
    ayudaUrl: "https://help.instagram.com/1109672253571496",
    ayudaLabel: "Ayuda de Instagram sobre botones de acción",
  },
  facebook: {
    id: "facebook",
    nombre: "Facebook",
    palabraClave: "FACEBOOK",
    descripcion:
      "Botón «Reservar» en la cabecera de tu página de Facebook.",
    limitacion:
      "Facebook no permite completar la reserva dentro de la app: el botón abre tu página de reservas en el navegador. Es como funcionan también CoverManager y TheFork.",
    pasos: [
      { texto: "Entra en tu página de Facebook como administrador." },
      { texto: "Pulsa el botón de la cabecera (o «Añadir botón» si aún no tienes ninguno)." },
      { texto: "Elige la acción «Reservar»." },
      { texto: "Selecciona «Enlace a un sitio web» y pega el enlace de abajo." },
      { texto: "Guarda los cambios." },
    ],
    ayudaUrl: "https://www.facebook.com/business/help/522332217346179",
    ayudaLabel: "Ayuda de Facebook sobre el botón de la página",
  },
};

export const CANALES_SOCIALES_IDS: readonly CanalSocialId[] = ["instagram", "facebook"];

export function esCanalSocial(id: string): id is CanalSocialId {
  return (CANALES_SOCIALES_IDS as readonly string[]).includes(id);
}
