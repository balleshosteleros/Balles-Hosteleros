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
   * Dominio REAL de venta del software. Ojo: no es `balleshosteleros.com` a
   * secas — el sitio del SaaS vive en el subdominio `sistema.`, que es el que
   * declara `metadataBase` en el layout raíz. Las URLs canónicas y el sitemap
   * tienen que apuntar aquí, o Google indexa un dominio que no sirve la web.
   */
  dominio: "sistema.balleshosteleros.com",
} as const;

/** Base absoluta del sitio, para URLs canónicas y sitemap. */
export const SITIO_URL = `https://${TITULAR.dominio}`;

/** Domicilio en una línea, para los párrafos corridos. */
export const DOMICILIO_LINEA = `${TITULAR.via}, ${TITULAR.cp} ${TITULAR.municipio} (${TITULAR.provincia}), ${TITULAR.pais}`;
