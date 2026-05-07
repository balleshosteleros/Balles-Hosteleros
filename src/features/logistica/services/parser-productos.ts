/**
 * Parser de productos (compra o venta) desde Excel/CSV.
 */

import type { ProductoImport } from "../types/import";
import type { ProductoTipo, ProductoEstado } from "../types/db";
import { readSheet, getField, parseNumber } from "./parser-excel";

function normalizeEstado(raw: string | null): ProductoEstado {
  if (!raw) return "Activo";
  const lower = raw.toLowerCase();
  if (lower.startsWith("inactiv")) return "Inactivo";
  return "Activo";
}

export async function parseProductosFile(
  file: File,
  tipo: ProductoTipo
): Promise<ProductoImport[]> {
  const rows = await readSheet(file);
  if (rows.length === 0) throw new Error("El archivo no tiene filas de datos");

  const productos: ProductoImport[] = [];

  for (const row of rows) {
    const nombre =
      getField(row, ["nombre", "name", "producto", "articulo", "descripcion"]) ?? "";

    if (!nombre) continue;

    productos.push({
      nombre,
      tipo,
      categoria:
        getField(row, ["categoria", "category", "familia principal"]) ??
        "Sin categoría",
      familia: getField(row, ["familia", "family", "subcategoria"]),
      estado: normalizeEstado(getField(row, ["estado", "status"])),
      proveedor: getField(row, ["proveedor", "supplier", "vendor"]),
      precioCompra: getField(row, [
        "precio compra",
        "precio de compra",
        "coste compra",
        "cost price",
      ]),
      precioVenta: getField(row, [
        "precio venta",
        "precio de venta",
        "pvp",
        "sale price",
        "price",
      ]),
      coste: getField(row, ["coste", "cost", "food cost"]),
      unidad: getField(row, ["unidad", "unit", "uds"]) ?? "ud",
      unidadUso: getField(row, ["unidad uso", "unidad de uso", "usage unit"]),
      factorConversion:
        parseNumber(getField(row, ["factor", "factor conversion", "conversion"])) ??
        1,
      stockMinimo:
        parseNumber(getField(row, ["stock minimo", "min stock", "minimo"])) ?? 0,
      stockMaximo:
        parseNumber(getField(row, ["stock maximo", "max stock", "maximo"])) ?? 0,
      agoraId:
        tipo === "venta"
          ? getField(row, ["agora id", "id agora", "agora", "codigo agora", "codigo"])
          : null,
      observaciones: getField(row, ["observaciones", "notas", "notes", "comentarios"]),
    });
  }

  if (productos.length === 0) {
    throw new Error(
      'No se encontraron productos. Asegúrate de que el archivo tiene una columna "Nombre" o similar.'
    );
  }

  return productos;
}
