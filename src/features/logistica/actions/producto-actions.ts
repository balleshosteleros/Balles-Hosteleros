"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type {
  Producto,
  TipoProducto,
  EstadoProducto,
} from "@/features/logistica/data/productos";

const ESTADOS = ["Activo", "Inactivo", "Descatalogado", "En revisión"] as const;
const TIPOS = ["compra", "venta", "elaboracion"] as const;

const productoInputSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  tipo: z.enum(TIPOS),
  categoria: z.string().min(1, "La categoría es obligatoria"),
  familia: z.string().nullable().optional(),
  estado: z.enum(ESTADOS).default("Activo"),
  proveedor: z.string().nullable().optional(),
  precioCompra: z.string().nullable().optional(),
  precioVenta: z.string().nullable().optional(),
  coste: z.string().nullable().optional(),
  unidad: z.string().default("ud"),
  observaciones: z.string().nullable().optional(),
});

export type ProductoInput = z.infer<typeof productoInputSchema>;

// Mapea una fila de Supabase al tipo Producto del frontend
type ProductoRow = {
  id: string;
  empresa_id: string | null;
  nombre: string;
  tipo: TipoProducto;
  categoria: string;
  familia: string | null;
  estado: EstadoProducto;
  proveedor: string | null;
  precio_compra: string | null;
  precio_venta: string | null;
  coste: string | null;
  unidad: string;
  observaciones: string | null;
  updated_at: string;
};

function rowToProducto(r: ProductoRow): Producto {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    categoria: r.categoria,
    familia: r.familia ?? "",
    estado: r.estado,
    proveedor: r.proveedor ?? undefined,
    precioCompra: r.precio_compra ?? undefined,
    precioVenta: r.precio_venta ?? undefined,
    coste: r.coste ?? undefined,
    unidad: r.unidad,
    observaciones: r.observaciones ?? undefined,
    ultimaActualizacion: r.updated_at?.slice(0, 10) ?? "",
  };
}

async function requireManagement() {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") {
    return { id: "dev-bypass-user" } as { id: string };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const canManage =
    roles.includes("admin") ||
    roles.includes("director") ||
    roles.includes("gerencia") ||
    roles.includes("responsable");

  if (!canManage) throw new Error("No tienes permisos para gestionar productos");

  return user;
}

async function getUserEmpresaId(userId: string): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") {
    const { empresaId } = await getLogisticaContext();
    return empresaId;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .single();
  return (data as { empresa_id: string | null } | null)?.empresa_id ?? null;
}

/**
 * Lista productos del usuario autenticado filtrados por tipo.
 * RLS de Supabase se encarga del filtrado por empresa.
 */
export async function listProductos(tipo: TipoProducto): Promise<Producto[]> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    const query = supabase
      .from("productos")
      .select("*")
      .eq("tipo", tipo)
      .order("nombre", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;

    if (error) {
      console.error("Error listing productos:", error);
      return [];
    }

    return ((data ?? []) as ProductoRow[]).map(rowToProducto);
  } catch (err) {
    console.error("listProductos failed:", err);
    return [];
  }
}

export async function createProducto(
  input: ProductoInput
): Promise<{ error?: string; success?: boolean }> {
  try {
    const user = await requireManagement();
    const parsed = productoInputSchema.safeParse(input);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const empresaId = await getUserEmpresaId(user.id);
    if (!empresaId) return { error: "No tienes empresa asignada" };

    const { supabase } = await getLogisticaContext();
    const { error } = await supabase.from("productos").insert({
      empresa_id: empresaId,
      nombre: parsed.data.nombre,
      tipo: parsed.data.tipo,
      categoria: parsed.data.categoria,
      familia: parsed.data.familia,
      estado: parsed.data.estado,
      proveedor: parsed.data.proveedor,
      precio_compra: parsed.data.precioCompra,
      precio_venta: parsed.data.precioVenta,
      coste: parsed.data.coste,
      unidad: parsed.data.unidad,
      observaciones: parsed.data.observaciones,
      created_by: process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ? null : user.id,
    });

    if (error) return { error: error.message };

    revalidatePath("/logistica/productos");
    return { success: true };
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
      familia: p.familia ?? null,
      estado: p.estado,
      proveedor: p.proveedor ?? null,
      precio_compra: p.precioCompra ?? null,
      precio_venta: p.precioVenta ?? null,
      coste: p.coste ?? null,
      unidad: p.unidad,
      observaciones: p.observaciones ?? null,
      created_by: user.id,
    }));

    const { error } = await supabase.from("productos").insert(rows);

    if (error) return { error: error.message };

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
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.categoria !== undefined) updates.categoria = input.categoria;
    if (input.familia !== undefined) updates.familia = input.familia;
    if (input.estado !== undefined) updates.estado = input.estado;
    if (input.proveedor !== undefined) updates.proveedor = input.proveedor;
    if (input.precioCompra !== undefined) updates.precio_compra = input.precioCompra;
    if (input.precioVenta !== undefined) updates.precio_venta = input.precioVenta;
    if (input.coste !== undefined) updates.coste = input.coste;
    if (input.unidad !== undefined) updates.unidad = input.unidad;
    if (input.observaciones !== undefined) updates.observaciones = input.observaciones;

    const { error } = await supabase.from("productos").update(updates).eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/logistica/productos");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
