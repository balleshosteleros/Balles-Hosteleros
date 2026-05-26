"use client";

import * as XLSX from "xlsx";
import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";

const EXT_TABULARES = new Set(["xlsx", "xls", "xlsm", "csv", "tsv"]);
const EXT_BINARIOS_OK = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
]);

const MIME_FALLBACK: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function obtenerExtension(nombre: string): string {
  const idx = nombre.lastIndexOf(".");
  return idx >= 0 ? nombre.slice(idx + 1).toLowerCase() : "";
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function extraerTabla(buffer: ArrayBuffer, nombreArchivo: string): PayloadExtraido {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!sheet) {
    throw new Error("El archivo no contiene hojas con datos.");
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (filas.length === 0) {
    throw new Error("El archivo no contiene filas de datos.");
  }

  const cabeceras = Object.keys(filas[0]);
  const filasStr: Array<Record<string, string>> = filas.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = String(v ?? "").trim();
    }
    return out;
  });

  return {
    kind: "tabla",
    nombreArchivo,
    cabeceras,
    filas: filasStr,
  };
}

/**
 * Lee un File del input y devuelve el payload que la server action va a procesar.
 *
 * - Excel/CSV/TSV → tabla parseada (sin tokens IA para parseo, solo para mapeo de columnas).
 * - PDF/imagen → base64 + mimeType (Gemini hace OCR y extracción nativa).
 *
 * Lanza error con mensaje legible si el formato no es soportado o el archivo está vacío.
 */
export async function extraerDeArchivo(file: File): Promise<PayloadExtraido> {
  if (file.size === 0) {
    throw new Error("El archivo está vacío.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("El archivo supera los 20 MB. Reduce tamaño o súbelo por partes.");
  }

  const ext = obtenerExtension(file.name);

  if (EXT_TABULARES.has(ext)) {
    const buffer = await file.arrayBuffer();
    return extraerTabla(buffer, file.name);
  }

  if (EXT_BINARIOS_OK.has(ext)) {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || MIME_FALLBACK[ext] || "application/octet-stream";
    return {
      kind: "binario",
      nombreArchivo: file.name,
      mimeType,
      base64,
    };
  }

  throw new Error(
    `Formato .${ext || "desconocido"} no soportado. Usa Excel, CSV, PDF o foto (PNG/JPG/HEIC).`,
  );
}

export const FORMATOS_ACEPTADOS_INPUT =
  ".xlsx,.xls,.xlsm,.csv,.tsv,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif," +
  "image/*,application/pdf";
