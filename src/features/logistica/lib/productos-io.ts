"use client";

import * as XLSX from "xlsx";
import type { Producto, TipoProducto } from "@/features/logistica/data/productos";
import type { ProductoInput } from "@/features/logistica/actions/producto-actions";
import { exportToPDF } from "@/features/logistica/lib/export-utils";

// Columnas estándar para CSV/Excel (claves internas → etiquetas visibles)
const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  categoria: "Categoría",
  familia: "Familia",
  estado: "Estado",
  proveedor: "Proveedor",
  precioCompra: "Precio Compra",
  precioVenta: "Precio Venta",
  coste: "Coste",
  unidad: "Unidad",
  observaciones: "Observaciones",
};

const LABEL_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_LABELS).map(([k, v]) => [v.toLowerCase(), k])
);

/**
 * Normaliza una cabecera cualquiera a nuestro nombre de campo interno.
 * Soporta variantes como "nombre", "Nombre", "NOMBRE", "precio compra", etc.
 */
function normalizeHeader(header: string): string | null {
  const clean = header.trim().toLowerCase();
  // directo
  if (LABEL_TO_FIELD[clean]) return LABEL_TO_FIELD[clean];
  // alias comunes
  const aliases: Record<string, string> = {
    nombre: "nombre",
    name: "nombre",
    producto: "nombre",
    categoria: "categoria",
    category: "categoria",
    familia: "familia",
    family: "familia",
    estado: "estado",
    status: "estado",
    proveedor: "proveedor",
    supplier: "proveedor",
    "precio compra": "precioCompra",
    "precio de compra": "precioCompra",
    precio_compra: "precioCompra",
    preciocompra: "precioCompra",
    "precio venta": "precioVenta",
    "precio de venta": "precioVenta",
    precio_venta: "precioVenta",
    precioventa: "precioVenta",
    coste: "coste",
    cost: "coste",
    unidad: "unidad",
    unit: "unidad",
    observaciones: "observaciones",
    notas: "observaciones",
    notes: "observaciones",
  };
  return aliases[clean] ?? null;
}

/**
 * Parsea un archivo CSV o Excel y devuelve una lista de ProductoInput.
 * Lanza error si el archivo no tiene una columna "nombre" reconocible.
 */
export async function parseFileToProductos(
  file: File,
  tipo: TipoProducto
): Promise<ProductoInput[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("El archivo no tiene hojas con datos");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) throw new Error("El archivo no tiene filas de datos");

  // Detectar y mapear cabeceras
  const firstRow = rows[0];
  const headerMap: Record<string, string> = {};
  for (const rawHeader of Object.keys(firstRow)) {
    const field = normalizeHeader(rawHeader);
    if (field) headerMap[rawHeader] = field;
  }

  if (!Object.values(headerMap).includes("nombre")) {
    throw new Error(
      'No se encontró una columna "Nombre" en el archivo. Revisa las cabeceras.'
    );
  }

  const productos: ProductoInput[] = [];
  for (const row of rows) {
    const mapped: Record<string, string> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const field = headerMap[rawKey];
      if (!field) continue;
      mapped[field] = String(value ?? "").trim();
    }

    if (!mapped.nombre) continue; // saltar filas vacías

    // Normalizar estado (si viene en minúsculas o traducido)
    const estadoRaw = mapped.estado?.toLowerCase?.() ?? "";
    let estado: "Activo" | "Inactivo" | "En revisión" = "Activo";
    if (estadoRaw.startsWith("inactiv")) estado = "Inactivo";
    else if (estadoRaw.startsWith("revis") || estadoRaw.startsWith("pending"))
      estado = "En revisión";

    productos.push({
      nombre: mapped.nombre,
      tipo,
      categoria: mapped.categoria || "Sin categoría",
      familia: mapped.familia || null,
      estado,
      proveedor: mapped.proveedor || null,
      precioCompra: mapped.precioCompra || null,
      precioVenta: mapped.precioVenta || null,
      coste: mapped.coste || null,
      unidad: mapped.unidad || "ud",
      observaciones: mapped.observaciones || null,
    });
  }

  return productos;
}

/**
 * Genera un archivo CSV a partir de una lista de Producto y dispara la descarga.
 */
export function exportProductosToCSV(
  productos: Producto[],
  filename: string
): void {
  const headers = Object.values(FIELD_LABELS);
  const fieldKeys = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;

  const escape = (val: string): string => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = productos.map((p) =>
    fieldKeys
      .map((k) => {
        const v = (p as unknown as Record<string, unknown>)[k];
        return escape(String(v ?? ""));
      })
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), filename);
}

/**
 * Genera un archivo Excel .xlsx a partir de una lista de Producto y dispara la descarga.
 */
export function exportProductosToExcel(
  productos: Producto[],
  filename: string
): void {
  const fieldKeys = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;

  const data = productos.map((p) => {
    const row: Record<string, string> = {};
    for (const k of fieldKeys) {
      row[FIELD_LABELS[k]] = String(
        (p as unknown as Record<string, unknown>)[k] ?? ""
      );
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  XLSX.writeFile(wb, filename);
}

/**
 * Genera un PDF (vía diálogo de impresión del navegador) con los productos.
 */
export function exportProductosToPDF(
  productos: Producto[],
  filename: string,
  title = "Productos",
): void {
  const fieldKeys = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;
  const data = productos.map((p) => {
    const row: Record<string, string> = {};
    for (const k of fieldKeys) {
      row[FIELD_LABELS[k]] = String(
        (p as unknown as Record<string, unknown>)[k] ?? ""
      );
    }
    return row;
  });
  exportToPDF(data, filename, title);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga una plantilla CSV de ejemplo con las cabeceras correctas.
 */
export function downloadTemplateCSV(): void {
  const headers = Object.values(FIELD_LABELS).join(",");
  const exampleRow = [
    "Solomillo de ternera",
    "Materias primas",
    "Cárnicos",
    "Activo",
    "Proveedor Ejemplo S.L.",
    "18,50 €/kg",
    "",
    "",
    "kg",
    "Fila de ejemplo — bórrame",
  ]
    .map((v) => (v.includes(",") ? `"${v}"` : v))
    .join(",");
  const csv = `${headers}\n${exampleRow}`;
  downloadBlob(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    "plantilla-productos.csv"
  );
}
