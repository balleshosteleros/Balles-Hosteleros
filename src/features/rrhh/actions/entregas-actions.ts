"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/supabase/get-context";
import type {
  CategoriaMaterial,
  Entrega,
  EntregaItem,
  EstadoEntrega,
} from "@/features/rrhh/data/entregas";

/**
 * Entregas de material y uniforme.
 *
 * RRHH registra qué le da a un trabajador; el trabajador lo firma como
 * recibido (ver `enviarEntregaAFirma`) y queda en su ficha y en su portal.
 */

function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Error desconocido";
}

async function nombreUsuarioActual(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos, full_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "";
  const u = data as {
    nombre: string | null;
    apellidos: string | null;
    full_name: string | null;
    email: string | null;
  };
  return (
    `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim() ||
    (u.full_name ?? "").trim() ||
    (u.email ?? "").trim()
  );
}

type FilaItem = {
  id: string;
  entrega_id: string;
  tipo_id: string | null;
  tipo_nombre: string;
  categoria: string;
  cantidad: number | null;
  talla: string | null;
  requiere_devolucion: boolean | null;
  devuelto_en: string | null;
  orden: number | null;
};

type FilaEntrega = {
  id: string;
  empleado_id: string;
  fecha: string;
  nota: string | null;
  estado: string;
  firma_id: string | null;
  firmada_en: string | null;
  entregado_por_nombre: string | null;
};

function mapItem(r: FilaItem): EntregaItem {
  return {
    id: r.id,
    tipoId: r.tipo_id,
    tipoNombre: r.tipo_nombre,
    categoria: (r.categoria === "uniforme" ? "uniforme" : "material") as CategoriaMaterial,
    cantidad: r.cantidad ?? 1,
    talla: r.talla,
    requiereDevolucion: !!r.requiere_devolucion,
    devueltoEn: r.devuelto_en,
    orden: r.orden ?? 0,
  };
}

/**
 * Carga entregas con sus líneas y el nombre del empleado.
 * `filtro.empleadoId` limita a un trabajador (ficha, portal); sin él devuelve
 * todo el histórico de la empresa (submódulo Entregas).
 */
async function cargarEntregas(filtro: { empleadoId?: string } = {}): Promise<Entrega[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];
  const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

  let query = db
    .from("entregas_material")
    .select("id, empleado_id, fecha, nota, estado, firma_id, firmada_en, entregado_por_nombre")
    .eq("empresa_id", empresaId);
  if (filtro.empleadoId) query = query.eq("empleado_id", filtro.empleadoId);

  const { data: cabeceras, error } = await query
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[rrhh] cargarEntregas:", error.message);
    return [];
  }

  const filas = (cabeceras ?? []) as FilaEntrega[];
  if (filas.length === 0) return [];

  // Líneas y nombres de empleado en dos consultas, no una por entrega.
  const ids = filas.map((f) => f.id);
  const { data: items } = await db
    .from("entregas_material_items")
    .select(
      "id, entrega_id, tipo_id, tipo_nombre, categoria, cantidad, talla, requiere_devolucion, devuelto_en, orden",
    )
    .in("entrega_id", ids)
    .order("orden", { ascending: true });

  const porEntrega = new Map<string, EntregaItem[]>();
  for (const it of (items ?? []) as FilaItem[]) {
    const lista = porEntrega.get(it.entrega_id) ?? [];
    lista.push(mapItem(it));
    porEntrega.set(it.entrega_id, lista);
  }

  const empleadoIds = [...new Set(filas.map((f) => f.empleado_id))];
  const { data: empleados } = await db
    .from("empleados")
    .select("id, nombre, apellidos")
    .in("id", empleadoIds);
  const nombres = new Map<string, string>();
  for (const e of (empleados ?? []) as { id: string; nombre: string | null; apellidos: string | null }[]) {
    nombres.set(e.id, `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim());
  }

  return filas.map((f) => ({
    id: f.id,
    empleadoId: f.empleado_id,
    empleadoNombre: nombres.get(f.empleado_id) ?? "",
    fecha: f.fecha,
    nota: f.nota,
    estado: f.estado as EstadoEntrega,
    firmaId: f.firma_id,
    firmadaEn: f.firmada_en,
    entregadoPorNombre: f.entregado_por_nombre,
    items: porEntrega.get(f.id) ?? [],
  }));
}

/** Histórico completo de la empresa. Lo usa el submódulo Entregas. */
export async function listEntregas(): Promise<Entrega[]> {
  return cargarEntregas();
}

/** Entregas de un trabajador. Lo usan su ficha en RRHH y su portal. */
export async function listEntregasPorEmpleado(empleadoId: string): Promise<Entrega[]> {
  if (!empleadoId) return [];
  return cargarEntregas({ empleadoId });
}

/** Entregas del trabajador que está mirando su propio portal. */
export async function listMisEntregas(): Promise<Entrega[]> {
  const { supabase, userId, empresaId } = await getAppContext();
  if (!userId || !empresaId) return [];
  const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

  // El empleado puede tener ficha en varias empresas (espejo multiempresa):
  // cargarEntregas ya filtra por la empresa activa, así que basta con la ficha
  // de esa empresa.
  const { data } = await db
    .from("empleados")
    .select("id")
    .eq("user_id", userId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const empleadoId = (data as { id: string } | null)?.id;
  if (!empleadoId) return [];

  return cargarEntregas({ empleadoId });
}

export interface NuevaEntregaItem {
  tipoId: string | null;
  tipoNombre: string;
  categoria: CategoriaMaterial;
  cantidad: number;
  talla: string | null;
  requiereDevolucion: boolean;
}

/**
 * Crea una entrega en borrador con sus líneas.
 * El envío a firma es un paso aparte, para poder revisarla antes.
 */
export async function crearEntrega(input: {
  empleadoId: string;
  fecha: string;
  nota: string | null;
  items: NuevaEntregaItem[];
}) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    if (!input.empleadoId) return { ok: false as const, error: "Elige un trabajador" };
    if (input.items.length === 0) {
      return { ok: false as const, error: "Añade al menos una cosa a la entrega" };
    }
    const sinNombre = input.items.some((i) => !i.tipoNombre.trim());
    if (sinNombre) return { ok: false as const, error: "Todas las líneas necesitan un tipo" };
    const cantidadMala = input.items.some((i) => !Number.isInteger(i.cantidad) || i.cantidad < 1);
    if (cantidadMala) return { ok: false as const, error: "Las cantidades deben ser números enteros mayores que 0" };

    // El empleado tiene que ser de esta empresa (RLS ya lo cubre, pero así el
    // mensaje de error es claro en vez de un fallo de FK).
    const { data: emp } = await db
      .from("empleados")
      .select("id")
      .eq("id", input.empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: false as const, error: "Ese trabajador no es de esta empresa" };

    const { data: cabecera, error: errCab } = await db
      .from("entregas_material")
      .insert({
        empresa_id: empresaId,
        empleado_id: input.empleadoId,
        fecha: input.fecha,
        nota: input.nota?.trim() || null,
        estado: "borrador",
        entregado_por: userId,
        entregado_por_nombre: await nombreUsuarioActual(db, userId),
      })
      .select("id")
      .single();
    if (errCab) throw errCab;

    const entregaId = (cabecera as { id: string }).id;
    const { error: errItems } = await db.from("entregas_material_items").insert(
      input.items.map((i, idx) => ({
        entrega_id: entregaId,
        tipo_id: i.tipoId,
        tipo_nombre: i.tipoNombre.trim(),
        categoria: i.categoria,
        cantidad: i.cantidad,
        talla: i.talla?.trim() || null,
        requiere_devolucion: i.requiereDevolucion,
        orden: idx,
      })),
    );
    if (errItems) {
      // Sin líneas la entrega no significa nada: se deshace entera.
      await db.from("entregas_material").delete().eq("id", entregaId);
      throw errItems;
    }

    revalidatePath("/rrhh/entregas");
    return { ok: true as const, entregaId };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/** Cambia la nota a mano de una entrega. */
export async function actualizarNotaEntrega(entregaId: string, nota: string | null) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { error } = await db
      .from("entregas_material")
      .update({ nota: nota?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", entregaId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Marca una línea como devuelta (o deshace la marca).
 * Es lo que RRHH confirma en el offboarding.
 */
export async function marcarItemDevuelto(itemId: string, devuelto: boolean) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { error } = await db
      .from("entregas_material_items")
      .update({
        devuelto_en: devuelto ? new Date().toISOString() : null,
        devuelto_por: devuelto ? userId : null,
      })
      .eq("id", itemId);
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Borra una entrega. Solo si aún no la ha firmado el trabajador: lo firmado es
 * un documento legal y no se toca (para eso está el estado "rechazada").
 */
export async function borrarEntrega(entregaId: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("estado")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };
    if ((actual as { estado: string }).estado === "firmada") {
      return {
        ok: false as const,
        error: "Esta entrega ya está firmada por el trabajador y no se puede borrar",
      };
    }

    const { error } = await db
      .from("entregas_material")
      .delete()
      .eq("id", entregaId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}
