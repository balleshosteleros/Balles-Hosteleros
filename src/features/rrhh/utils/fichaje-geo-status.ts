import type { Fichaje, LocalGeo } from "@/features/rrhh/data/fichajes";

/**
 * Clasifica un fichaje según su relación geográfica con el local asignado.
 *
 * - `en-local`: el empleado fichó dentro del radio configurado del local
 *   y no estaba en modo teletrabajo.
 * - `teletrabajo`: el fichaje tiene `modoTeletrabajo=true`. Tiene prioridad
 *   sobre la distancia — un teletrabajador a 5000m del local sigue siendo
 *   "teletrabajo", no "fuera".
 * - `fuera`: fichaje presencial cuya distancia al local supera el radio.
 *   Es la señal de auditoría más importante para supervisión RRHH.
 * - `sin-datos`: faltan coordenadas en el fichaje, el local no está
 *   geolocalizado, o el local no existe. Ningún juicio puede emitirse.
 */
export type FichajeGeoStatus = "en-local" | "teletrabajo" | "fuera" | "sin-datos";

export const FICHAJE_GEO_STATUS_LABEL: Record<FichajeGeoStatus, string> = {
  "en-local": "En local",
  teletrabajo: "Teletrabajo",
  fuera: "Fuera",
  "sin-datos": "Sin datos",
};

type FichajeGeoInput = Pick<
  Fichaje,
  "latEntrada" | "lngEntrada" | "modoTeletrabajo" | "distanciaEntradaMetros"
>;

type LocalGeoInput = Pick<LocalGeo, "lat" | "lng" | "radioMetros"> | null | undefined;

/**
 * Función pura. No hace IO ni depende de estado externo. Es la única
 * fuente de verdad para decidir el badge de un fichaje en toda la app.
 */
export function getFichajeGeoStatus(
  fichaje: FichajeGeoInput,
  local: LocalGeoInput,
): FichajeGeoStatus {
  // Teletrabajo aprobado por el supervisor → bypassa la verificación de radio.
  if (fichaje.modoTeletrabajo === true) return "teletrabajo";

  // Sin datos suficientes para emitir juicio.
  if (
    fichaje.latEntrada == null ||
    fichaje.lngEntrada == null ||
    !local ||
    local.lat == null ||
    local.lng == null ||
    fichaje.distanciaEntradaMetros == null
  ) {
    return "sin-datos";
  }

  // Comparación contra radio configurado del local.
  if (fichaje.distanciaEntradaMetros <= local.radioMetros) return "en-local";
  return "fuera";
}
