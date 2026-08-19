/**
 * ¿Este albarán va dirigido a la empresa en la que lo estoy subiendo? (encargo Iván 17-ago).
 *
 * El OCR ya extrae el DESTINATARIO del papel (CIF, razón social, dirección del restaurante
 * que recibe la mercancía). Aquí se cruza con la empresa activa: si no cuadran, se avisa
 * ANTES de guardar —que es el único momento en que se puede corregir sin perder la foto—.
 * Es lo que faltó con los 8 albaranes que acabaron en Bacanal sin que nada saltara.
 *
 * El ancla fuerte es el CIF (certeza). El nombre es señal, no prueba: el proveedor imprime
 * "HABANA COKTAIL (FUENLABRADA)", así que "contiene el nombre corto de la empresa" cuenta.
 *
 * Módulo PURO: sin red ni BD, testeable en aislamiento.
 */

import { normalizarCif, normalizarNombreFiscal } from "./identidad-fiscal";
import type { DestinatarioOcrAlbaran } from "./ocr-albaran";

/** Identidad de una empresa nuestra, reducida a lo que interviene en el cruce. */
export interface EmpresaIdentidad {
  id: string;
  nombre: string;
  nif: string | null;
  razonSocial: string | null;
}

export type VeredictoEmpresa =
  | "otra_empresa" // el papel va a OTRA empresa mía (por CIF = certeza; por nombre = fuerte sospecha)
  | "no_verificable" // el papel no trae destinatario legible: no se pudo comprobar
  | "desconocida"; // trae destinatario, pero no cuadra con ninguna empresa mía

export interface AvisoEmpresa {
  veredicto: VeredictoEmpresa;
  empresaActiva: { id: string; nombre: string };
  /** La empresa mía a la que parece ir dirigido (solo en "otra_empresa"). */
  empresaDetectada: { id: string; nombre: string } | null;
  /** Lo que se leyó como destinatario (para mostrarlo). */
  destinatarioTexto: string | null;
  /** El cruce fue por CIF (certeza) y no por parecido de nombre. */
  porCif: boolean;
}

/** Parecido 0..1 entre dos cadenas ya normalizadas (contención + Levenshtein). */
function similitud(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

const UMBRAL_NOMBRE = 0.7;

/** ¿El destinatario leído casa con la empresa `e`? "cif" (certeza), "nombre" (sospecha) o null. */
function casaCon(
  cifDest: string,
  rsDest: string,
  e: EmpresaIdentidad,
): "cif" | "nombre" | null {
  if (cifDest && normalizarCif(e.nif) === cifDest) return "cif";
  if (rsDest) {
    const nom = normalizarNombreFiscal(e.nombre);
    const rs = normalizarNombreFiscal(e.razonSocial);
    // El proveedor escribe "HABANA COKTAIL": contiene el nombre corto de la empresa.
    if (nom && (rsDest.includes(nom) || similitud(rsDest, nom) >= UMBRAL_NOMBRE)) return "nombre";
    if (rs && similitud(rsDest, rs) >= UMBRAL_NOMBRE) return "nombre";
  }
  return null;
}

/**
 * Evalúa el destinatario del papel contra la empresa activa y las demás del usuario.
 * Devuelve `null` cuando todo cuadra (el albarán va a la empresa activa): sin ruido.
 *
 * @param destinatario  lo que el OCR leyó como destinatario (puede venir vacío).
 * @param activa        la empresa en la que se está subiendo.
 * @param empresas      todas las empresas del usuario (incluida la activa).
 */
export function evaluarEmpresaDestinatario(
  destinatario: DestinatarioOcrAlbaran,
  activa: EmpresaIdentidad,
  empresas: EmpresaIdentidad[],
): AvisoEmpresa | null {
  const cifDest = normalizarCif(destinatario.cifNif);
  const rsDest = normalizarNombreFiscal(destinatario.razonSocial);
  const destinatarioTexto = destinatario.razonSocial?.trim() || destinatario.cifNif?.trim() || null;
  const activaOut = { id: activa.id, nombre: activa.nombre };

  // 1) ¿Cuadra con la empresa activa? Entonces todo bien, sin aviso.
  if (casaCon(cifDest, rsDest, activa)) return null;

  // Sin destinatario legible: no se pudo comprobar (Iván punto 5).
  if (!cifDest && !rsDest) {
    return { veredicto: "no_verificable", empresaActiva: activaOut, empresaDetectada: null, destinatarioTexto: null, porCif: false };
  }

  // 2) ¿Cuadra con OTRA empresa mía? Por CIF = certeza; por nombre = fuerte sospecha.
  for (const e of empresas) {
    if (e.id === activa.id) continue;
    const m = casaCon(cifDest, rsDest, e);
    if (m) {
      return {
        veredicto: "otra_empresa",
        empresaActiva: activaOut,
        empresaDetectada: { id: e.id, nombre: e.nombre },
        destinatarioTexto,
        porCif: m === "cif",
      };
    }
  }

  // 3) Trae destinatario, pero no cuadra con ninguna empresa mía.
  return { veredicto: "desconocida", empresaActiva: activaOut, empresaDetectada: null, destinatarioTexto, porCif: false };
}
