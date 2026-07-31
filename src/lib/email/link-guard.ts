/**
 * Protección anti-enlaces-rotos en correos (2026-07-31).
 *
 * CONTEXTO DEL INCIDENTE: durante una demo se envió a un empleado real un correo
 * de "recupera tu contraseña" cuyo enlace apuntaba a `http://localhost:3000`. El
 * correo salió desde una copia del software corriendo EN LOCAL (que usa
 * `.env.local` con NEXT_PUBLIC_APP_URL=http://localhost:3000). Un enlace localhost
 * es inservible para el destinatario y destruye la confianza: parece phishing o
 * software roto.
 *
 * Este guard es el CINTURÓN DE SEGURIDAD DEFINITIVO. Se aplica en la puerta única
 * de salida de correos (`sendEmail`), así que da igual desde qué flujo se llame:
 * si un correo lleva un enlace inservible, NO SALE.
 *
 * Reglas:
 *  - Un enlace `localhost` / `127.0.0.1` / `0.0.0.0` / IP privada es SIEMPRE
 *    inservible para un destinatario externo → bloquear el envío.
 *  - Un enlace a un dominio de PREVIEW de Vercel (`*.vercel.app`) también se
 *    bloquea: esos despliegues son efímeros y no deben mandarse a personas reales.
 *  - Solo se inspeccionan URLs con esquema http/https dentro del HTML y el texto.
 *
 * Server-only: solo se usa en el envío de correos (nunca en cliente).
 */

import "server-only";

/** Hosts que jamás deben aparecer en un enlace enviado a un destinatario real. */
const HOSTS_PROHIBIDOS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
];

/**
 * ¿El host es una IP de rango privado (LAN)? P.ej. 192.168.x.x, 10.x.x.x,
 * 172.16–31.x.x. Estos enlaces solo funcionan dentro de la red local de quien
 * envía, nunca para el destinatario.
 */
function esIpPrivada(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 127) return true; // loopback por IP
  return false;
}

export type LinkGuardResultado =
  | { ok: true }
  | { ok: false; motivo: string; hostOfensivo: string };

/**
 * Revisa TODAS las URLs http(s) presentes en el contenido de un correo (HTML +
 * texto + asunto) y devuelve `{ ok: false, ... }` si alguna apunta a un host
 * inservible para el destinatario (localhost, IP privada, preview de Vercel).
 *
 * No lanza: devuelve un resultado que el llamador convierte en error de envío.
 */
export function comprobarEnlacesCorreo(partes: {
  html?: string;
  text?: string;
  subject?: string;
}): LinkGuardResultado {
  const contenido = [partes.html, partes.text, partes.subject]
    .filter(Boolean)
    .join("\n");

  // Extrae todos los http(s)://… del contenido. Suficientemente permisivo para
  // capturar tanto href="..." como enlaces pegados en texto plano.
  const urls = contenido.match(/https?:\/\/[^\s"'<>)\]]+/gi) ?? [];

  for (const raw of urls) {
    let host: string;
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      continue; // URL malformada: no la podemos juzgar, la dejamos pasar.
    }

    if (HOSTS_PROHIBIDOS.includes(host)) {
      return {
        ok: false,
        hostOfensivo: host,
        motivo: `El correo contiene un enlace a "${host}", que solo funciona en el ordenador de desarrollo y es inservible para el destinatario.`,
      };
    }
    if (esIpPrivada(host)) {
      return {
        ok: false,
        hostOfensivo: host,
        motivo: `El correo contiene un enlace a la IP privada "${host}", que solo funciona dentro de la red local de quien envía.`,
      };
    }
    if (host.endsWith(".vercel.app")) {
      return {
        ok: false,
        hostOfensivo: host,
        motivo: `El correo contiene un enlace a un despliegue de vista previa de Vercel ("${host}"), que es efímero y no debe enviarse a personas reales.`,
      };
    }
  }

  return { ok: true };
}
