/**
 * Parser de escandallos desde Excel/CSV.
 * Formato esperado (una fila por ingrediente):
 *   | Plato | Ingrediente | Cantidad | Unidad | Merma % |
 *
 * Un plato puede aparecer en múltiples filas (una por ingrediente).
 */

import type { EscandalloImport } from "../types/import";
import { readSheet, getField, parseNumber } from "./parser-excel";

export async function parseEscandallosFile(file: File): Promise<EscandalloImport[]> {
  const rows = await readSheet(file);
  if (rows.length === 0) throw new Error("El archivo no tiene filas de datos");

  const escandallos: EscandalloImport[] = [];

  for (const row of rows) {
    const productoVenta = getField(row, [
      "plato",
      "producto venta",
      "producto",
      "nombre plato",
      "dish",
      "producto de venta",
    ]);

    const ingrediente = getField(row, [
      "ingrediente",
      "componente",
      "producto compra",
      "producto de compra",
      "ingredient",
    ]);

    if (!productoVenta || !ingrediente) continue;

    const cantidad = parseNumber(
      getField(row, ["cantidad", "qty", "quantity", "uds"])
    );

    if (cantidad === null || cantidad <= 0) continue;

    escandallos.push({
      productoVenta,
      ingrediente,
      cantidad,
      unidad: getField(row, ["unidad", "unit", "uds"]) ?? undefined,
      mermaPct:
        parseNumber(
          getField(row, ["merma", "merma pct", "merma %", "waste"])
        ) ?? 0,
      observaciones: getField(row, ["observaciones", "notas", "notes"]),
    });
  }

  if (escandallos.length === 0) {
    throw new Error(
      'No se encontraron escandallos. Formato esperado: columnas "Plato", "Ingrediente", "Cantidad".'
    );
  }

  return escandallos;
}
