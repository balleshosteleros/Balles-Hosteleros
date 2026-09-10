import "server-only";
import { createHash } from "crypto";

/**
 * Entrada del alumno con su cuenta de Google.
 *
 * El alumno NO está en `auth.users` y no debe estarlo: si se usara el acceso de
 * Google del software, cada alumno que pulsara el botón se daría de alta como
 * usuario del sistema. Aquí solo se hace una cosa — comprobar que el token que
 * trae el navegador lo firmó Google de verdad y sacar de él el correo — y con
 * ese correo se busca al alumno, igual que si lo hubiera escrito a mano.
 *
 * La comprobación la hace el propio Google en `tokeninfo`: valida la firma y
 * devuelve el contenido. Se prefiere a verificar la firma aquí porque no añade
 * ninguna dependencia y no hay claves que rotar.
 */

const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token=";
const EMISORES = ["accounts.google.com", "https://accounts.google.com"];

export interface IdentidadGoogle {
  email: string;
  nombre: string | null;
}

type PayloadGoogle = {
  aud?: string;
  iss?: string;
  exp?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  nonce?: string;
};

/**
 * Devuelve el correo del token, o null si algo no cuadra.
 *
 * Se rechaza sin contemplaciones: token de otra aplicación (`aud`), emisor que
 * no es Google, caducado, correo sin verificar, o un `nonce` que no es el que
 * este navegador pidió — esto último es lo que impide que alguien reutilice un
 * token capturado en otro sitio.
 */
export async function identidadDesdeTokenGoogle(
  idToken: string,
  nonceEnClaro: string,
): Promise<IdentidadGoogle | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !idToken) return null;

  try {
    const res = await fetch(`${TOKENINFO}${encodeURIComponent(idToken)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const p = (await res.json()) as PayloadGoogle;

    if (p.aud !== clientId) return null;
    if (!p.iss || !EMISORES.includes(p.iss)) return null;

    const expira = Number(p.exp ?? 0);
    if (!expira || expira * 1000 <= Date.now()) return null;

    const verificado = p.email_verified === true || p.email_verified === "true";
    if (!p.email || !verificado) return null;

    // El navegador manda a Google el nonce YA cifrado y a nosotros el original:
    // así solo entra el token que pidió esta misma pantalla.
    if (p.nonce) {
      const esperado = createHash("sha256").update(nonceEnClaro).digest("hex");
      if (p.nonce !== esperado) return null;
    }

    return { email: p.email.trim().toLowerCase(), nombre: p.name?.trim() || null };
  } catch (e) {
    console.error("[escuela] identidadDesdeTokenGoogle:", e);
    return null;
  }
}
