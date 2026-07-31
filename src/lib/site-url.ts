/**
 * Fuente ÚNICA de la URL base pública del software (2026-07-31).
 *
 * Antes esta lógica estaba DUPLICADA en ~9 sitios, cada uno con el mismo fallback
 * a `http://localhost:3000`. Eso permitió el incidente: un correo salió con un
 * enlace localhost hacia un empleado real (se generó desde una copia local).
 *
 * Orden de resolución:
 *   1. NEXT_PUBLIC_APP_URL   (la que se define en Vercel para producción)
 *   2. NEXT_PUBLIC_SITE_URL  (alias histórico)
 *   3. NEXT_PUBLIC_VERCEL_URL (autogenerada por Vercel, con https://)
 *   4. http://localhost:3000  (ÚLTIMO recurso, solo desarrollo)
 *
 * PROTECCIÓN: en producción (VERCEL_ENV === 'production'), si tras la resolución
 * la URL sigue apuntando a localhost, se LANZA un error. Nunca debe ocurrir —
 * significaría que faltan las env vars en el despliegue — y es preferible fallar
 * ruidosamente antes que enviar enlaces rotos a personas reales.
 */

/** Devuelve la URL base pública SIN barra final. */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ??
    "http://localhost:3000";

  const url = raw.replace(/\/+$/, "");

  // En producción, un fallback a localhost es un fallo de configuración crítico:
  // los enlaces de correos, firmas, liquidaciones, etc. saldrían rotos. Fallamos
  // ruidosamente para que el error se detecte de inmediato y no llegue a un cliente.
  if (
    process.env.VERCEL_ENV === "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url)
  ) {
    throw new Error(
      "[site-url] En PRODUCCIÓN la URL base cayó a localhost. Falta configurar " +
        "NEXT_PUBLIC_APP_URL con el dominio real (https://sistema.balleshosteleros.com) " +
        "en las variables de entorno de Vercel."
    );
  }

  return url;
}
