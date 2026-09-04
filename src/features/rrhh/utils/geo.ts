export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GeoPos = { lat: number; lng: number; precision: number };

/**
 * Por encima de esta precisión la posición no sirve para decidir si alguien
 * está dentro de un local: el móvil no está usando GPS, sino la red (wifi o
 * antena de telefonía), que desvía cientos de metros o kilómetros. Pasa cuando
 * el permiso de ubicación está en modo "aproximado" (Android 12+) o con la
 * precisión de Google desactivada. Sin este tope, el sistema comparaba una
 * posición de ±1000 m contra un radio de 50 m y culpaba al empleado de no estar
 * en el local.
 */
const PRECISION_MAXIMA_ACEPTABLE_M = 200;

/** Intentos de lectura: el GPS suele necesitar unos segundos para fijar. */
const INTENTOS = 3;

function leerPosicion(opts: PositionOptions): Promise<GeoPos> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new Error(
              "Has bloqueado la geolocalización. Actívala en tu navegador para poder fichar."
            )
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error("No se pudo obtener tu ubicación. Revisa el GPS."));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("Tiempo agotado al obtener ubicación. Inténtalo de nuevo."));
        } else {
          reject(new Error("Error de geolocalización"));
        }
      },
      opts
    );
  });
}

export async function obtenerPosicionActual(): Promise<GeoPos> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Tu dispositivo no soporta geolocalización");
  }

  // `maximumAge: 0` es deliberado: con caché, el navegador devolvía al instante
  // la última posición conocida (normalmente la de la red, no la del GPS) y
  // nunca llegaba a pedir una lectura real.
  let mejor: GeoPos | null = null;
  for (let i = 0; i < INTENTOS; i++) {
    const pos = await leerPosicion({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    if (!mejor || pos.precision < mejor.precision) mejor = pos;
    // Suficientemente buena: no hacemos esperar más al empleado.
    if (mejor.precision <= PRECISION_MAXIMA_ACEPTABLE_M) return mejor;
  }

  return mejor as GeoPos;
}

/** True si la lectura es demasiado imprecisa para validar presencia en un local. */
export function esPrecisionInsuficiente(precision: number | null | undefined): boolean {
  return precision != null && precision > PRECISION_MAXIMA_ACEPTABLE_M;
}

export { PRECISION_MAXIMA_ACEPTABLE_M };
