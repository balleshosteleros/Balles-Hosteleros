/**
 * Qué portales públicos tiene contratados cada empresa.
 *
 * No todas las empresas venden lo mismo: una coctelería puede no querer portal
 * de empleo, y la gestora del grupo no es un restaurante al que se le reserve
 * mesa. Aquí se marca lo que esa empresa TIENE, y tanto su web como los enlaces
 * públicos se adaptan: lo que no está marcado no sale y su dirección deja de
 * responder.
 *
 * Es un TECHO, no un sustituto de los datos: marcar el portal de empleo no hace
 * aparecer el enlace si no hay vacantes publicadas. Primero se pregunta si la
 * empresa lo tiene; después, si hay algo que enseñar.
 *
 * Se guarda en `empresas.config_operativa.portales` (jsonb, sin migración). Lo
 * que no está escrito cuenta como ACTIVO: toda empresa se monta con los cuatro
 * portales en marcha, así que el silencio significa "lo tiene" y ninguna empresa
 * ya montada pierde nada por no tener la clave.
 */

export type PortalPublico = "carta" | "reservas" | "empleo";

export interface PortalesEmpresa {
  carta?: boolean;
  reservas?: boolean;
  empleo?: boolean;
}

export const PORTALES: Array<{
  clave: PortalPublico;
  label: string;
  /** Lo que deja de salir al apagarlo, dicho para quien lo está marcando. */
  ayuda: string;
}> = [
  {
    clave: "carta",
    label: "Carta digital",
    ayuda: "El QR de la mesa y el enlace a la carta desde la web.",
  },
  {
    clave: "reservas",
    label: "Portal de reservas",
    ayuda: "El botón de reservar de la web y el formulario de reserva de mesa.",
  },
  {
    clave: "empleo",
    label: "Portal de empleo",
    ayuda: "El portal con las vacantes abiertas y su enlace en la web.",
  },
];

/**
 * ¿Tiene esta empresa el portal? Ausente o mal escrito = sí.
 *
 * Ante la duda se dice que sí a propósito: apagar un portal por un dato que no
 * se pudo leer tira una página pública que sí existía, y eso es peor que
 * enseñar de más.
 */
export function portalActivo(configOperativa: unknown, portal: PortalPublico): boolean {
  const config = configOperativa as { portales?: PortalesEmpresa } | null | undefined;
  return config?.portales?.[portal] !== false;
}
