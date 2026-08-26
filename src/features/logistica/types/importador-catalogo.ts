/**
 * Tipos y schemas del importador de catálogo de Ágora.
 *
 * Ágora es un sistema externo: nada de lo que devuelve se da por bueno. Todo
 * pasa por Zod antes de tocar nuestro modelo, y lo que no valide se reporta,
 * no se descarta en silencio.
 *
 * FORMA REAL DE LA API (verificada en vivo 25-ago, endpoint
 * `/api/export-master/?filter=Products`). Ejemplo abreviado del Id 1789:
 *
 *   {
 *     "Id": 1789, "Name": "Danza Macabra", "FamilyId": 162,
 *     "SaleableAsMain": true, "AskForAddins": true, "IsSoldByWeight": false,
 *     "CostPrice": 0.60739,
 *     "Prices":     [ { "PriceListId": 1, "MainPrice": 9.75 }, … ],
 *     "CostPrices": [ { "WarehouseId": 1, "CostPrice": 2.4296 }, … ]
 *   }
 *
 * OJO con dos campos que se leyeron mal en el primer intento:
 *   · el precio de carta es `Prices[].MainPrice` (lista 1), no `SalePrices[].Price`
 *   · `AskForAddins` es "pregunta complementos al vender", NO "es elaboración"
 */

import { z } from "zod";

// ─── ENTRADA CRUDA DESDE ÁGORA ──────────────────────────────────────────────

export const agoraPrecioSchema = z.object({
  PriceListId: z.number(),
  MainPrice: z.number().nullable().optional(),
});

export const agoraCostePorAlmacenSchema = z.object({
  WarehouseId: z.number(),
  CostPrice: z.number().nullable().optional(),
});

/**
 * Producto tal como llega de Ágora. `passthrough` a propósito: Ágora manda
 * muchos campos que no usamos (color de botón, tiempo de preparación, códigos
 * de barras) y no queremos que aparezcan campos nuevos rompan la validación.
 */
export const agoraProductoSchema = z
  .object({
    Id: z.union([z.number(), z.string()]),
    Name: z.string().min(1),
    FamilyId: z.union([z.number(), z.string()]).nullable().optional(),
    DeletionDate: z.string().nullable().optional(),
    SaleableAsMain: z.boolean().nullable().optional(),
    SaleableAsAddin: z.boolean().nullable().optional(),
    AskForAddins: z.boolean().nullable().optional(),
    IsSoldByWeight: z.boolean().nullable().optional(),
    CostPrice: z.number().nullable().optional(),
    Prices: z.array(agoraPrecioSchema).nullable().optional(),
    CostPrices: z.array(agoraCostePorAlmacenSchema).nullable().optional(),
  })
  .passthrough();

export type AgoraProductoRaw = z.infer<typeof agoraProductoSchema>;

/**
 * Producto de Ágora ya validado, con el stock del almacén inyectado aparte
 * (`__stock`) porque en la API viaja en otro endpoint (`filter=Stocks`).
 */
export type AgoraProducto = AgoraProductoRaw & { __stock?: number | null };

export const agoraFamiliaSchema = z
  .object({
    Id: z.union([z.number(), z.string()]),
    Name: z.string(),
    ParentFamilyId: z.union([z.number(), z.string()]).nullable().optional(),
  })
  .passthrough();

export const agoraStockSchema = z
  .object({
    WarehouseId: z.number(),
    ProductId: z.union([z.number(), z.string()]),
    Quantity: z.number().nullable().optional(),
  })
  .passthrough();

// ─── DECISIONES QUE EL USUARIO PUEDE APROBAR ────────────────────────────────

export const decisionImportacionSchema = z.enum([
  "venta",
  "compra",
  "elaboracion",
  "vincular",
  "revisar",
  "descartar",
]);

/**
 * Una línea aprobada por el usuario, tal como llega del navegador al servidor.
 * El servidor NO se fía de estos datos para el contenido del producto: vuelve a
 * leer Ágora y usa el `agoraId` como clave. De aquí sólo se respeta la DECISIÓN
 * (y la cantidad del enlace, que es criterio humano).
 */
export const lineaAprobadaSchema = z.object({
  agoraId: z.string().min(1),
  decision: decisionImportacionSchema,
  /** Producto nuestro al que vincular (obligatorio si decision = "vincular"). */
  vincularAId: z.string().uuid().nullable().optional(),
  /** Ficha de compra con la que enlazar por escandallo (regla de bebidas). */
  parejaCompraId: z.string().uuid().nullable().optional(),
  /** Cuánto gasta una venta de su ficha de compra. 1 = unidad entera. */
  cantidadEnlace: z.number().positive().max(10_000).nullable().optional(),
  /** Precio de venta puesto a mano cuando Ágora no lo trae. */
  precioVentaManual: z.number().min(0).max(100_000).nullable().optional(),
});

export type LineaAprobada = z.infer<typeof lineaAprobadaSchema>;

export const importarCatalogoInputSchema = z.object({
  lineas: z.array(lineaAprobadaSchema).min(1).max(2000),
});

// ─── RESULTADO DE LA IMPORTACIÓN ────────────────────────────────────────────

export interface ResultadoImportacion {
  creadosVenta: number;
  creadosCompra: number;
  creadosElaboracion: number;
  vinculados: number;
  enlacesEscandallo: number;
  omitidos: number;
  errores: Array<{ agoraId: string; nombre: string; motivo: string }>;
}
