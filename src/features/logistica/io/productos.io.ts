import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  bulkImportProductos,
  listProductos,
  type ProductoInput,
} from "@/features/logistica/actions/producto-actions";
import type { TipoProducto } from "@/features/logistica/data/productos";

const ESTADOS = ["Activo", "Inactivo"] as const;
const TIPOS = ["compra", "venta", "elaboracion"] as const;
const CONSERVACIONES = ["Frigorífico", "Congelador", "Seco"] as const;

const productoIOSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  tipo: z.enum(TIPOS),
  categoria: z.string().min(1, "La categoría es obligatoria"),
  estado: z.enum(ESTADOS).default("Activo"),
  proveedor: z.string().nullable().optional(),
  precioCompra: z.string().nullable().optional(),
  precioVenta: z.string().nullable().optional(),
  coste: z.string().nullable().optional(),
  iva: z.string().nullable().optional(),
  unidad: z.string().default("ud"),
  formato: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  conservacion: z.enum(CONSERVACIONES).nullable().optional(),
  partida: z.string().nullable().optional(),
  estiloColor: z.string().nullable().optional(),
  estiloImagenUrl: z.string().nullable().optional(),
  textoTicket: z.string().nullable().optional(),
  textoComanda: z.string().nullable().optional(),
});

const schema = productoIOSchema as unknown as RowSchema<ProductoInput>;

function makeConfig(variant: TipoProducto): ModuleIO<ProductoInput> {
  const isCompra = variant === "compra";
  const isVenta = variant === "venta";
  const showConservacion = !isVenta;
  return {
    module: "logistica",
    submodule: `productos-${variant}`,
    label: `Productos de ${variant}`,
    description: `Catálogo de productos tipo ${variant}.`,
    schema,
    uniqueBy: "nombre",
    columns: [
      {
        key: "nombre",
        label: "Nombre",
        aliases: ["producto", "articulo", "descripcion"],
        required: true,
        unique: true,
        example: "Tomate cherry",
      },
      {
        key: "tipo",
        label: "Tipo",
        type: "enum",
        values: TIPOS,
        required: true,
        example: variant,
      },
      {
        key: "categoria",
        label: "Categoría",
        aliases: ["categoria", "category", "familia", "family", "subcategoria"],
        required: true,
        example: "Verduras",
      },
      {
        key: "conservacion",
        label: "Conservación",
        type: "enum",
        values: CONSERVACIONES,
        aliases: ["conservation", "almacenamiento"],
        hideInImport: !showConservacion,
        hideInExport: !showConservacion,
        example: "Frigorífico",
      },
      {
        key: "partida",
        label: "Partida",
        aliases: ["station", "puesto"],
        hideInImport: !isVenta,
        hideInExport: !isVenta,
        example: "FRÍO + POSTRES",
      },
      {
        key: "estado",
        label: "Estado",
        type: "enum",
        values: ESTADOS,
        example: "Activo",
      },
      {
        key: "proveedor",
        label: "Proveedor",
        aliases: ["supplier", "vendor"],
        hideInImport: !isCompra,
        hideInExport: !isCompra,
      },
      {
        key: "precioCompra",
        label: "Precio compra",
        aliases: ["coste compra", "cost price"],
        hideInImport: !isCompra,
        hideInExport: !isCompra,
        example: "1,50",
      },
      {
        key: "precioVenta",
        label: "Precio venta",
        aliases: ["pvp", "sale price", "price"],
        hideInImport: !isVenta,
        hideInExport: !isVenta,
        example: "12,00",
      },
      {
        key: "coste",
        label: "Coste",
        aliases: ["cost", "food cost"],
        hideInImport: !isVenta,
        hideInExport: !isVenta,
        example: "3,80",
      },
      {
        key: "iva",
        label: "IVA",
        aliases: ["impuesto", "tax"],
        hideInImport: variant === "elaboracion",
        hideInExport: variant === "elaboracion",
        example: "10%",
      },
      {
        key: "medida",
        label: "Medida",
        aliases: ["unit", "uds", "unidad"],
        example: "Kilogramos",
      },
      {
        key: "formato",
        label: "Formato",
        aliases: ["format", "presentacion", "envase"],
        hideInImport: isVenta,
        hideInExport: isVenta,
        example: "Caja 10 kg",
      },
      {
        key: "observaciones",
        label: "Observaciones",
        aliases: ["notas", "notes", "comentarios"],
      },
    ],
    fetchAll: async () => {
      const productos = await listProductos(variant);
      return productos.map<ProductoInput>((p) => ({
        nombre: p.nombre,
        tipo: p.tipo,
        categoria: p.categoria,
        estado: p.estado,
        proveedor: p.proveedor ?? null,
        precioCompra: p.precioCompra ?? null,
        precioVenta: p.precioVenta ?? null,
        coste: p.coste ?? null,
        iva: p.iva ?? null,
        medida: p.medida,
        formato: p.formato ?? null,
        observaciones: p.observaciones ?? null,
        conservacion: (p.conservacion ?? null) as ProductoInput["conservacion"],
        partida: p.partida ?? null,
        estiloColor: p.estiloColor ?? null,
        estiloImagenUrl: p.estiloImagenUrl ?? null,
        textoTicket: p.textoTicket ?? null,
        textoComanda: p.textoComanda ?? null,
      }));
    },
    upsert: async (rows) => {
      const result = await bulkImportProductos(rows);
      if (result.error) {
        return {
          ok: false,
          imported: 0,
          updated: 0,
          skipped: rows.length,
          errors: [{ row: 0, message: result.error }],
        };
      }
      return {
        ok: true,
        imported: result.imported ?? 0,
        updated: 0,
        skipped: rows.length - (result.imported ?? 0),
        errors: [],
      };
    },
  };
}

export const productosCompraIO = makeConfig("compra");
export const productosVentaIO = makeConfig("venta");
export const productosElaboracionIO = makeConfig("elaboracion");
