/**
 * Seed canónico de CATEGORÍAS DE PRODUCTO (tipo "compra").
 *
 * Este es el set estándar de categorías de compra con el que arranca CUALQUIER
 * empresa nueva, y el que se propaga (aditivo) a las empresas existentes vía
 * `syncSeedsToAllEmpresas()`. Modo aditivo: solo crea las categorías que falten
 * por nombre (case-insensitive); NUNCA renombra ni borra lo que el cliente ya
 * tenga personalizado.
 *
 * NOTA — categorías internas NO genéricas: "Vapers" y "Shishas" son categorías
 * de nicho que viven solo en las empresas que las usan (Habana / Bacanal) y
 * NO forman parte de este set estándar, así que las empresas nuevas no las
 * heredan. Si una empresa las necesita, las crea a mano desde el catálogo.
 *
 * Solo se siembra el tipo "compra"; las categorías de "venta"/"elaboracion"
 * dependen de la carta de cada empresa y no se imponen por seed.
 */

import type { TipoProducto } from "@/features/logistica/data/productos";

export interface CategoriaProductoSeed {
  tipo: TipoProducto;
  nombre: string;
  orden: number;
}

export const CATEGORIAS_PRODUCTO_SEED: CategoriaProductoSeed[] = [
  { tipo: "compra", nombre: "Alcoholes",          orden: 1 },
  { tipo: "compra", nombre: "Cafes e infusiones", orden: 2 },
  { tipo: "compra", nombre: "Carnes",             orden: 3 },
  { tipo: "compra", nombre: "Cervezas",           orden: 4 },
  { tipo: "compra", nombre: "Chuches y picoteo",  orden: 5 },
  { tipo: "compra", nombre: "Coctelería",         orden: 6 },
  { tipo: "compra", nombre: "Despensa",           orden: 7 },
  { tipo: "compra", nombre: "Envases",            orden: 8 },
  { tipo: "compra", nombre: "Frutas y verduras",  orden: 9 },
  { tipo: "compra", nombre: "Lácteos y huevos",   orden: 10 },
  { tipo: "compra", nombre: "Limpieza",           orden: 11 },
  { tipo: "compra", nombre: "Menaje",             orden: 12 },
  { tipo: "compra", nombre: "Panes",              orden: 13 },
  { tipo: "compra", nombre: "Pescados y mariscos", orden: 14 },
  { tipo: "compra", nombre: "Refrescos",          orden: 15 },
  { tipo: "compra", nombre: "Vinos y champagne",  orden: 16 },
  { tipo: "compra", nombre: "Otros",              orden: 17 },
];

export function normalizeCategoriaProductoNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}
