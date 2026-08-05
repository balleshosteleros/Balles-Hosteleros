/**
 * SEED CANÓNICO — Catálogos base de logística (medidas, formatos, IVAs, conservaciones).
 *
 * Cada catálogo es INDEPENDIENTE POR TIPO: se replica en `compra`, `venta` y
 * `elaboracion`, porque compra y venta se gestionan por separado y editar el IVA
 * de compra no debe tocar el de venta.
 *
 * Valores extraídos de la empresa de referencia en producción, no inventados.
 * Antes vivían en la función SQL `seed_catalogos_logistica_empresa()`, que quedó
 * obsoleta (escribía en tablas ya renombradas/eliminadas) y tumbaba el alta de
 * empresas. Ahora viven aquí, junto al resto de seeds canónicos.
 */

/** Tipos de catálogo: compra y venta van separados; elaboracion es la cocina. */
export const CATALOGO_TIPOS = ["compra", "venta", "elaboracion"] as const;
export type CatalogoTipo = (typeof CATALOGO_TIPOS)[number];

/** Unidades de medida base y sus formatos. `equivalencias` = cuánto vale 1 formato en la unidad. */
export const MEDIDAS_SEED: Array<{
  codigo: string;
  label: string;
  orden: number;
  formatos: Array<{ nombre: string; orden: number; equivalencias: number }>;
}> = [
  {
    codigo: "Kilogramos",
    label: "Kilogramos",
    orden: 1,
    formatos: [
      { nombre: "0,5 Kg", orden: 1, equivalencias: 0.5 },
      { nombre: "1 Kg", orden: 2, equivalencias: 1 },
      { nombre: "2 Kg", orden: 3, equivalencias: 2 },
      { nombre: "8 Kg", orden: 4, equivalencias: 8 },
      { nombre: "10 Kg", orden: 5, equivalencias: 10 },
    ],
  },
  {
    codigo: "Litros",
    label: "Litros",
    orden: 2,
    formatos: [
      { nombre: "0,70 L", orden: 1, equivalencias: 0.7 },
      { nombre: "1 L", orden: 2, equivalencias: 1 },
      { nombre: "1,5 L", orden: 3, equivalencias: 1.5 },
      { nombre: "5 L", orden: 4, equivalencias: 5 },
      { nombre: "50 L", orden: 5, equivalencias: 50 },
    ],
  },
  {
    codigo: "Unidades",
    label: "Unidades",
    orden: 3,
    // Formatos de venta/compra reales (cajas, packs). No es una serie 1..100.
    formatos: [
      1, 2, 4, 5, 6, 7, 8, 10, 12, 15, 18, 20, 24, 25, 35, 36, 50, 54, 60, 70,
      85, 100, 110, 126, 140, 200, 500, 1000,
    ].map((n, i) => ({ nombre: `${n} Ud`, orden: i + 1, equivalencias: n })),
  },
];

/** IVA vigente en España. */
export const IVAS_SEED = [
  { codigo: "0%", porcentaje: 0, label: "Exento", orden: 1 },
  { codigo: "4%", porcentaje: 4, label: "Superreducido", orden: 2 },
  { codigo: "10%", porcentaje: 10, label: "Reducido", orden: 3 },
  { codigo: "21%", porcentaje: 21, label: "General", orden: 4 },
];

/** Zonas de conservación APPCC. */
export const CONSERVACIONES_SEED = [
  { nombre: "Congelación", rango_temp: "< -18 °C", orden: 1 },
  { nombre: "Refrigeración", rango_temp: "0–8 °C", orden: 2 },
  { nombre: "Ambiente", rango_temp: "15–25 °C", orden: 3 },
];
