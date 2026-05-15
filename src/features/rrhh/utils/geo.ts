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

export async function obtenerPosicionActual(): Promise<GeoPos> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Tu dispositivo no soporta geolocalización");
  }
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}
