"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { capitalizeText } from "@/shared/lib/utils";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type {
  Producto,
  TipoProducto,
  EstadoProducto,
  Conservacion,
} from "@/features/logistica/data/productos";
import { IVA_DEFAULT } from "@/features/logistica/data/productos";

const ESTADOS = ["Activo", "Inactivo"] as const;
const TIPOS = ["compra", "venta", "elaboracion"] as const;
const CONSERVACIONES = ["Frigorífico", "Congelador", "Seco"] as const;

const productoInputSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").transform(capitalizeText),
  tipo: z.enum(TIPOS),
  categoria: z.string().min(1, "La categoría es obligatoria").transform(capitalizeText),
  estado: z.enum(ESTADOS).default("Activo"),
  // El nombre del proveedor se almacena SIEMPRE en MAYÚSCULAS (regla de
  // negocio compartida con la tabla `proveedores.nombre_comercial`).
  proveedor: z.string().nullable().optional().transform((v) => v ? v.trim().toUpperCase() : v),
  precioCompra: z.string().nullable().optional(),
  precioVenta: z.string().nullable().optional(),
  coste: z.string().nullable().optional(),
  iva: z.string().nullable().optional(),
  medida: z.string().default("Unidades"),
  formato: z.string().nullable().optional(),
  envase: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  conservacion: z.enum(CONSERVACIONES).nullable().optional(),
  partida: z.string().nullable().optional(),
  estiloColor: z.string().nullable().optional(),
  estiloImagenUrl: z.string().nullable().optional(),
  textoTicket: z.string().nullable().optional(),
  textoComanda: z.string().nullable().optional(),
  cartaNombre: z.string().nullable().optional(),
  cartaTexto: z.string().nullable().optional(),
  alergenos: z.array(z.string()).optional(),
});

export type ProductoInput = z.infer<typeof productoInputSchema>;

// Mapea una fila de Supabase al tipo Producto del frontend
type ProductoRow = {
  id: string;
  empresa_id: string | null;
  numero_secuencial: number | null;
  nombre: string;
  tipo: TipoProducto;
  categoria: string;
  estado: EstadoProducto;
  proveedor: string | null;
  precio_compra: string | null;
  precio_venta: string | null;
  coste: string | null;
  medida: string;
  formato: string | null;
  envase: string | null;
  observaciones: string | null;
  conservacion: Conservacion | null;
  partida: string | null;
  estilo_color: string | null;
  estilo_imagen_url: string | null;
  texto_ticket: string | null;
  texto_comanda: string | null;
  carta_nombre: string | null;
  carta_texto: string | null;
  alergenos: string[] | null;
  created_at: string;
  updated_at: string;
};

function rowToProducto(r: ProductoRow): Producto {
  return {
    id: r.id,
    numeroSecuencial: r.numero_secuencial ?? undefined,
    nombre: r.nombre,
    tipo: r.tipo,
    categoria: r.categoria,
    estado: r.estado,
    proveedor: r.proveedor ?? undefined,
    precioCompra: r.precio_compra ?? undefined,
    precioVenta: r.precio_venta ?? undefined,
    coste: r.coste ?? undefined,
    medida: r.medida,
    formato: r.formato ?? undefined,
    envase: r.envase ?? undefined,
    observaciones: r.observaciones ?? undefined,
    conservacion: r.conservacion ?? null,
    partida: r.partida ?? null,
    estiloColor: r.estilo_color ?? null,
    estiloImagenUrl: r.estilo_imagen_url ?? null,
    textoTicket: r.texto_ticket ?? undefined,
    textoComanda: r.texto_comanda ?? undefined,
    cartaNombre: r.carta_nombre ?? null,
    cartaTexto: r.carta_texto ?? null,
    alergenos: Array.isArray(r.alergenos) ? r.alergenos : [],
    createdAt: r.created_at ?? undefined,
    ultimaActualizacion: r.updated_at?.slice(0, 10) ?? "",
  };
}

async function requireManagement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { esDirector } = await getRolContext();

  if (!esDirector) throw new Error("No tienes permisos para gestionar productos");

  return user;
}

async function getUserEmpresaId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("user_id", userId)
    .single();
  return (data as { empresa_id: string | null } | null)?.empresa_id ?? null;
}

// Cada producto de venta debe tener su escandallo (1:1 por nombre + empresa).
// Si ya existe uno con el mismo nombre, no duplica. Si la creación falla, NO
// rompemos el alta del producto: el escandallo se puede crear manualmente luego.
type SupabaseLike = Awaited<ReturnType<typeof createClient>>;
async function ensureEscandalloForProductoVenta(
  supabase: SupabaseLike,
  params: { empresaId: string; nombre: string; categoria: string; createdBy: string },
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("escandallos")
      .select("id")
      .eq("empresa_id", params.empresaId)
      .eq("nombre", params.nombre)
      .limit(1)
      .maybeSingle();
    if (existing) return;

    await supabase.from("escandallos").insert({
      empresa_id: params.empresaId,
      nombre: params.nombre,
      categoria: params.categoria,
      estado: "Borrador",
      created_by: params.createdBy,
    });
  } catch (err) {
    console.error("[productos] ensureEscandalloForProductoVenta:", err);
  }
}

/**
 * Lista productos del usuario autenticado filtrados por tipo.
 * RLS de Supabase se encarga del filtrado por empresa.
 */
export async function getProductoById(id: string): Promise<Producto | null> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    let query = supabase.from("productos").select("*").eq("id", id);
    if (empresaId) query = query.eq("empresa_id", empresaId) as typeof query;
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return rowToProducto(data as ProductoRow);
  } catch (err) {
    console.error("[productos] getProductoById:", err);
    return null;
  }
}

export async function listProductos(tipo?: TipoProducto): Promise<Producto[]> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    let query = supabase
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true });
    if (tipo) query = query.eq("tipo", tipo) as typeof query;
    if (empresaId) query = query.eq("empresa_id", empresaId) as typeof query;
    const { data, error } = await query;

    if (error) {
      console.error("Error listing productos:", error);
      return [];
    }

    const productos = ((data ?? []) as ProductoRow[]).map(rowToProducto);

    // Hidrata el IVA vigente para productos de compra desde producto_precios_compra.
    // El IVA ya no vive en `productos`; se guarda en el histórico de precios.
    const compraIds = productos.filter((p) => p.tipo === "compra").map((p) => p.id);
    if (compraIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: precios } = await supabase
        .from("producto_precios_compra")
        .select("producto_id, iva, fecha_inicio, created_at")
        .in("producto_id", compraIds)
        .lte("fecha_inicio", today)
        .order("fecha_inicio", { ascending: false })
        .order("created_at", { ascending: false });

      const ivaPorProducto = new Map<string, string>();
      for (const row of (precios ?? []) as Array<{
        producto_id: string;
        iva: string | null;
      }>) {
        if (!ivaPorProducto.has(row.producto_id) && row.iva) {
          ivaPorProducto.set(row.producto_id, row.iva);
        }
      }
      for (const p of productos) {
        if (p.tipo === "compra") {
          const iva = ivaPorProducto.get(p.id);
          if (iva) p.iva = iva;
        }
      }
    }

    return productos;
  } catch (err) {
    console.error("listProductos failed:", err);
    return [];
  }
}

export async function createProducto(
  input: ProductoInput
): Promise<{ error?: string; producto?: Producto }> {
  try {
    const user = await requireManagement();
    const parsed = productoInputSchema.safeParse(input);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const empresaId = await getUserEmpresaId(user.id);
    if (!empresaId) return { error: "No tienes empresa asignada" };

    const { supabase } = await getLogisticaContext();
    const { data: inserted, error } = await supabase
      .from("productos")
      .insert({
        empresa_id: empresaId,
        nombre: parsed.data.nombre,
        tipo: parsed.data.tipo,
        categoria: parsed.data.categoria,
        estado: parsed.data.estado,
        proveedor: parsed.data.proveedor,
        precio_compra: parsed.data.precioCompra,
        precio_venta: parsed.data.precioVenta,
        coste: parsed.data.coste,
        medida: parsed.data.medida,
        formato: parsed.data.formato ?? null,
        envase: parsed.data.envase ?? null,
        observaciones: parsed.data.observaciones,
        conservacion: parsed.data.conservacion ?? null,
        partida: parsed.data.partida ?? null,
        estilo_color: parsed.data.estiloColor ?? null,
        estilo_imagen_url: parsed.data.estiloImagenUrl ?? null,
        texto_ticket: parsed.data.textoTicket ?? null,
        texto_comanda: parsed.data.textoComanda ?? null,
        carta_nombre: parsed.data.cartaNombre ?? null,
        carta_texto: parsed.data.cartaTexto ?? null,
        alergenos: parsed.data.alergenos ?? [],
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) return { error: error.message };

    // Productos de venta: cada uno debe tener su escandallo asociado (1:1 por nombre).
    // Lo creamos en borrador para que aparezca como PENDIENTE hasta que se rellenen
    // ingredientes. Idempotente: si ya existe uno con el mismo nombre, no duplica.
    if (parsed.data.tipo === "venta" && inserted?.id) {
      await ensureEscandalloForProductoVenta(supabase, {
        empresaId,
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        createdBy: user.id,
      });
    }

    // Productos de compra: si vinieron precio + iva en el alta, abrimos la primera
    // entrada del histórico para que sean la fuente de verdad desde el día 1.
    if (
      parsed.data.tipo === "compra" &&
      inserted?.id &&
      parsed.data.precioCompra
    ) {
      const precioNum = parseFloat(
        String(parsed.data.precioCompra).replace(/[^0-9,\.]/g, "").replace(",", ".")
      );
      if (Number.isFinite(precioNum) && precioNum >= 0) {
        await supabase.from("producto_precios_compra").insert({
          producto_id: inserted.id,
          precio: precioNum,
          // Nunca "sin IVA": si no vino uno explícito, aplicamos el tipo general.
          iva: parsed.data.iva ?? IVA_DEFAULT,
          fecha_inicio: new Date().toISOString().slice(0, 10),
          created_by: user.id,
        });
      }
    }

    revalidatePath("/logistica/productos");
    const producto = rowToProducto(inserted as ProductoRow);
    if (parsed.data.iva && parsed.data.tipo === "compra") {
      producto.iva = parsed.data.iva;
    }
    return { producto };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Importación masiva desde una lista de productos parseados (CSV/Excel).
 * Devuelve el número de registros importados o un error.
 */
export async function bulkImportProductos(
  productos: ProductoInput[]
): Promise<{ error?: string; imported?: number }> {
  try {
    const user = await requireManagement();

    if (!Array.isArray(productos) || productos.length === 0) {
      return { error: "No hay productos para importar" };
    }
    if (productos.length > 5000) {
      return { error: "Máximo 5000 productos por importación" };
    }

    const empresaId = await getUserEmpresaId(user.id);
    if (!empresaId) return { error: "No tienes empresa asignada" };

    // Validar cada fila
    const valid: ProductoInput[] = [];
    const errors: string[] = [];
    productos.forEach((p, idx) => {
      const parsed = productoInputSchema.safeParse(p);
      if (parsed.success) {
        valid.push(parsed.data);
      } else {
        errors.push(
          `Fila ${idx + 1}: ${parsed.error.issues[0]?.message ?? "inválida"}`
        );
      }
    });

    if (valid.length === 0) {
      return {
        error: `Ninguna fila válida. Primer error: ${errors[0] ?? "desconocido"}`,
      };
    }

    const supabase = await createClient();
    const rows = valid.map((p) => ({
      empresa_id: empresaId,
      nombre: p.nombre,
      tipo: p.tipo,
      categoria: p.categoria,
      estado: p.estado,
      proveedor: p.proveedor ?? null,
      precio_compra: p.precioCompra ?? null,
      precio_venta: p.precioVenta ?? null,
      coste: p.coste ?? null,
      medida: p.medida,
      formato: p.formato ?? null,
      envase: p.envase ?? null,
      observaciones: p.observaciones ?? null,
      conservacion: p.conservacion ?? null,
      partida: p.partida ?? null,
      estilo_color: p.estiloColor ?? null,
      estilo_imagen_url: p.estiloImagenUrl ?? null,
      texto_ticket: p.textoTicket ?? null,
      texto_comanda: p.textoComanda ?? null,
      carta_nombre: p.cartaNombre ?? null,
      carta_texto: p.cartaTexto ?? null,
      alergenos: p.alergenos ?? [],
      created_by: user.id,
    }));

    const { error } = await supabase.from("productos").insert(rows);

    if (error) return { error: error.message };

    // Auto-crear escandallo (borrador) por cada producto de venta importado.
    // Secuencial a propósito: volumen normal de imports es bajo y queremos
    // que un fallo aislado no rompa el resto (ensureEscandallo... ya lo absorbe).
    const ventas = valid.filter((p) => p.tipo === "venta");
    for (const p of ventas) {
      await ensureEscandalloForProductoVenta(supabase, {
        empresaId,
        nombre: p.nombre,
        categoria: p.categoria,
        createdBy: user.id,
      });
    }

    revalidatePath("/logistica/productos");
    return { imported: valid.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteProducto(
  id: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireManagement();
    const { supabase } = await getLogisticaContext();
    const { error } = await supabase.from("productos").delete().eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/logistica/productos");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateProducto(
  id: string,
  input: Partial<ProductoInput>
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireManagement();
    const { supabase } = await getLogisticaContext();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.nombre !== undefined) updates.nombre = input.nombre ? capitalizeText(input.nombre) : input.nombre;
    if (input.categoria !== undefined) updates.categoria = input.categoria ? capitalizeText(input.categoria) : input.categoria;
    if (input.estado !== undefined) updates.estado = input.estado;
    if (input.proveedor !== undefined) updates.proveedor = input.proveedor ? input.proveedor.trim().toUpperCase() : input.proveedor;
    if (input.precioCompra !== undefined) updates.precio_compra = input.precioCompra;
    if (input.precioVenta !== undefined) updates.precio_venta = input.precioVenta;
    if (input.coste !== undefined) updates.coste = input.coste;
    if (input.medida !== undefined) updates.medida = input.medida;
    if (input.formato !== undefined) updates.formato = input.formato;
    if (input.envase !== undefined) updates.envase = input.envase;
    if (input.observaciones !== undefined) updates.observaciones = input.observaciones;
    if (input.conservacion !== undefined) updates.conservacion = input.conservacion;
    if (input.partida !== undefined) updates.partida = input.partida;
    if (input.estiloColor !== undefined) updates.estilo_color = input.estiloColor;
    if (input.estiloImagenUrl !== undefined) updates.estilo_imagen_url = input.estiloImagenUrl;
    if (input.textoTicket !== undefined) updates.texto_ticket = input.textoTicket;
    if (input.textoComanda !== undefined) updates.texto_comanda = input.textoComanda;
    if (input.cartaNombre !== undefined) updates.carta_nombre = input.cartaNombre;
    if (input.cartaTexto !== undefined) updates.carta_texto = input.cartaTexto;
    if (input.alergenos !== undefined) updates.alergenos = input.alergenos ?? [];

    const { error } = await supabase.from("productos").update(updates).eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/logistica/productos");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Recalcula el coste de todos los productos de venta/elaboración
 * llamando a la función RPC coste_escandallo para cada uno.
 */
export async function recalculateAllCosts(): Promise<{ error?: string; updated?: number }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) throw new Error("No empresa context");

    // 1. Obtener todos los productos que no son de compra
    const { data: prods, error: pErr } = await supabase
      .from("productos")
      .select("id, tipo")
      .eq("empresa_id", empresaId)
      .in("tipo", ["venta", "elaboracion"]);

    if (pErr) throw pErr;
    if (!prods?.length) return { updated: 0 };

    let updatedCount = 0;
    for (const p of prods) {
      // 2. Calcular coste via RPC
      const { data: newCost, error: rpcErr } = await supabase.rpc("coste_escandallo", {
        p_producto_venta_id: p.id,
      });

      if (rpcErr) {
        console.error(`Error calculando coste para ${p.id}:`, rpcErr);
        continue;
      }

      // 3. Actualizar la tabla productos con el nuevo coste (como string para mantener compatibilidad)
      const { error: updErr } = await supabase
        .from("productos")
        .update({
          coste: Number(newCost || 0).toFixed(2),
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);

      if (!updErr) updatedCount++;
    }

    revalidatePath("/logistica/productos");
    return { updated: updatedCount };
  } catch (err) {
    console.error("recalculateAllCosts failed:", err);
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
