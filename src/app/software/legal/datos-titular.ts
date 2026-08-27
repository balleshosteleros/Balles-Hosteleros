/**
 * Datos del titular del software. FUENTE ÚNICA: los cuatro documentos legales
 * leen de aquí, para que un cambio de domicilio o teléfono no obligue a tocar
 * cuatro ficheros y se quede uno desactualizado.
 *
 * Ojo: son datos exigidos por el art. 10 de la Ley 34/2002 (LSSI). No los
 * inventes ni los dejes a medias — un aviso legal incompleto es motivo de
 * rechazo en la verificación de Google y de sanción administrativa.
 */
export const TITULAR = {
  razonSocial: "COMPLEJOS HOSTELEROS GOURMET, S.L.",
  cif: "B56558109",
  via: "C/ Arte Plateresco, 3",
  cp: "28905",
  municipio: "Getafe",
  provincia: "Madrid",
  pais: "España",
  email: "balleshosteleros@gmail.com",
  telefono: "91 999 41 41",
  /**
   * Dominio público del software. Es el mismo que está escrito en la Google
   * Auth Platform (página principal y enlaces legales de la pantalla de
   * consentimiento), así que estas URLs y las del panel tienen que coincidir:
   * si divergen, el revisor abre un enlace que no existe y rechaza la app.
   *
   * Ahí las legales cuelgan de la raíz (`/legal/privacidad`), no de
   * `/software/legal/...`; el rewrite de `next.config.ts` hace la traducción.
   */
  dominio: "software.balleshosteleros.com",
} as const;

/** Base absoluta del sitio, para URLs canónicas y sitemap. */
export const SITIO_URL = `https://${TITULAR.dominio}`;

/** Domicilio en una línea, para los párrafos corridos. */
export const DOMICILIO_LINEA = `${TITULAR.via}, ${TITULAR.cp} ${TITULAR.municipio} (${TITULAR.provincia}), ${TITULAR.pais}`;
