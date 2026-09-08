import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión del ALUMNO de la escuela.
 *
 * El alumno no es un usuario del software: no tiene sesión de Supabase, así que
 * su acceso se sostiene en una cookie propia HttpOnly firmada con HMAC. Dentro
 * solo viaja su id y la caducidad; la firma impide fabricarla desde fuera, y en
 * cada petición se vuelve a comprobar contra la base de datos que el alumno
 * sigue de alta, así que darle de baja le cierra la puerta al instante.
 */

const COOKIE = "escuela_alumno";
/** 30 días: la escuela se visita de vez en cuando, no a diario. */
const DIAS_SESION = 30;

function pepper(): string {
  // Se reutiliza el secreto de las firmas cuando no hay uno propio: así el
  // portal funciona en producción sin depender de una variable nueva.
  const v = process.env.ESCUELA_TOKEN_PEPPER?.trim() || process.env.FIRMA_TOKEN_PEPPER?.trim();
  if (!v || v.length < 16) {
    throw new Error(
      "[escuela] Falta ESCUELA_TOKEN_PEPPER (o FIRMA_TOKEN_PEPPER) de al menos 16 caracteres.",
    );
  }
  return v;
}

function firmar(datos: string): string {
  return createHmac("sha256", pepper()).update(datos).digest("base64url");
}

function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function generarCodigoAcceso(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Hash del código de acceso. Nunca se guarda el código en claro. */
export function hashCodigo(alumnoId: string, codigo: string): string {
  return createHmac("sha256", pepper()).update(`${alumnoId}:${codigo}`).digest("hex");
}

export function compararCodigo(alumnoId: string, codigo: string, hashEsperado: string): boolean {
  return iguales(hashCodigo(alumnoId, codigo), hashEsperado);
}

/** Ficha de sesión que viaja en la cookie. */
function construirToken(alumnoId: string, expiraMs: number): string {
  const cuerpo = Buffer.from(JSON.stringify({ a: alumnoId, e: expiraMs })).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function leerToken(token: string): string | null {
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;
  if (!iguales(firmar(cuerpo), firma)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as {
      a?: string;
      e?: number;
    };
    if (!datos.a || !datos.e || Date.now() > datos.e) return null;
    return datos.a;
  } catch {
    return null;
  }
}

export async function crearSesionAlumno(alumnoId: string): Promise<void> {
  const expira = Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000;
  const store = await cookies();
  store.set(COOKIE, construirToken(alumnoId, expira), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_SESION * 24 * 60 * 60,
  });
}

/** Id del alumno de la sesión, o null si no hay o no es válida. */
export async function leerSesionAlumno(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    return leerToken(token);
  } catch {
    return null;
  }
}

export async function cerrarSesionAlumno(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
