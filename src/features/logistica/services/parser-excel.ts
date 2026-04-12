/**
 * Parser genérico de Excel/CSV → objetos tipados.
 * Reutilizable para proveedores, productos y escandallos.
 */

import * as XLSX from "xlsx";

/**
 * Lee un File y devuelve las filas como objetos { header → value }.
 * Normaliza headers a lowercase sin acentos.
 */
export async function readSheet(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("El archivo no tiene hojas con datos");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
    raw: false,
  });

  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return normalized;
  });
}

/**
 * Normaliza un header: minúsculas, sin acentos, sin espacios extra.
 * "Precio Compra" → "precio compra"
 * "Nombre Comercial" → "nombre comercial"
 */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Busca un valor en una fila probando múltiples aliases de columna.
 * Devuelve el primer match no vacío.
 */
export function getField(
  row: Record<string, string>,
  aliases: string[]
): string | null {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const val = row[key];
    if (val && val.length > 0) return val;
  }
  return null;
}

/**
 * Parsea un número (acepta coma o punto decimal). Devuelve null si no válido.
 */
export function parseNumber(val: string | null | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[€$\s]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parsea un array de strings separados por coma, slash o semicolon.
 * "Lunes, Miércoles, Viernes" → ["Lunes", "Miércoles", "Viernes"]
 */
export function parseStringArray(val: string | null | undefined): string[] {
  if (!val) return [];
  return val
    .split(/[,;/|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
