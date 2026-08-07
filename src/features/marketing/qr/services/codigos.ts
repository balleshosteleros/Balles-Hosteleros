import "server-only";

import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Alfabeto sin caracteres ambiguos: fuera 0/O, 1/l/I. El código a veces se teclea
 * a mano cuando la cámara no coge el QR (poca luz, carta arrugada), y esos pares
 * se confunden al leerlos en papel.
 */
const ALFABETO = "23456789abcdefghjkmnpqrstuvwxyz";

/** Longitud por defecto. 5 caracteres = ~28 millones de combinaciones: de sobra, y
 *  mantiene el QR poco denso (cuadros grandes → escanea mejor con mala luz). */
const LONGITUD = 5;

/** Intentos antes de rendirse. Con el espacio que hay, colisionar varias veces
 *  seguidas es prácticamente imposible; el tope existe por si acaso. */
const MAX_INTENTOS = 12;

function generar(longitud: number): string {
  let out = "";
  for (let i = 0; i < longitud; i++) {
    out += ALFABETO[randomInt(0, ALFABETO.length)];
  }
  return out;
}

/**
 * Devuelve un código libre y lo RESERVA de forma atómica (queda quemado para
 * siempre). Si no lo reservara aquí mismo, dos personas creando un QR a la vez
 * podrían llevarse el mismo código.
 *
 * Devuelve null si tras varios intentos no consigue uno libre.
 */
export async function reservarCodigoLibre(): Promise<string | null> {
  const admin = createAdminClient();

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    // Si se encadenan colisiones, alarga el código en vez de insistir en vano.
    const longitud = LONGITUD + Math.floor(intento / 4);
    const candidato = generar(longitud);

    const { data, error } = await admin.rpc("qr_reservar_codigo", {
      p_codigo: candidato,
    });

    if (error) {
      console.error("[qr][reservarCodigoLibre]", error.message);
      return null;
    }
    if (data === true) return candidato;
  }

  console.error("[qr][reservarCodigoLibre] sin código libre tras varios intentos");
  return null;
}

/** Normaliza lo que llega por la URL: el código es siempre en minúsculas. */
export function normalizarCodigo(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Dominio público donde viven los QR. Es COMÚN a todas las empresas: por eso el
 * código es único globalmente y no por empresa.
 */
export function baseQr(): string {
  const env = process.env.NEXT_PUBLIC_QR_BASE_URL?.trim().replace(/\/+$/, "");
  return env || "https://qr.balleshosteleros.com";
}

/** URL completa que va DENTRO del QR impreso. Nunca el destino final. */
export function urlQr(codigo: string): string {
  return `${baseQr()}/${codigo}`;
}
