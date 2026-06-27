"use server";

import { getAppContext } from "@/lib/supabase/get-context";

// ─── Tipos compartidos con la UI ───────────────────────────────────
// Mantengo los nombres en camelCase aquí pero el mapeo a la fila de
// Supabase usa snake_case (ver toRow / fromRow).

export interface EscandalloIngredienteInput {
  id?: string;
  productoId?: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  tipo?: "compra" | "elaboracion";
  formato?: string;
  precio?: number;          // precio = cantidad × coste (calculado en cliente)
  costeUnitario?: number;
  mermaPct?: number;        // % merma (limpieza/cocción)
}

export interface PasoElaboracionInput {
  id: string;
  titulo: string;
  instrucciones: string;
  videoUrl?: string;
}

export interface EscandalloInput {
  nombre: string;
  categoria?: string | null;
  estado?: string;
  partida?: string | null;
  porciones?: number | null;
  tiempoPreparacion?: string | null;
  elaboracion?: string | null;
  descripcion?: string | null;
  guarnicion?: string | null;
  decoracion?: string | null;
  menaje?: string | null;
  presentacionMesa?: string | null;
  presentacionFoto?: string | null;
  pasos?: PasoElaboracionInput[];
  alergenos?: string[];
  recomendaciones?: string[];
  etiquetas?: string[];
  delicatessen?: boolean;
  costeTotal?: number | null;
  pvp?: number | null;
  margenPct?: number | null;
  fotoUrl?: string | null;
  notas?: string | null;
  responsable?: string | null;
  shareToken?: string | null;
  shareEnabled?: boolean;
  productoId?: string | null;   // producto venta/elaboración asociado (sincroniza receta)
  ingredientes?: EscandalloIngredienteInput[];
}

// La check constraint en `escandallos.estado` exige capitalizadas
// ('Activa','Borrador','Archivada','Inactiva'); la UI maneja minúsculas.
function normalizarEstado(estado: string): string {
  const map: Record<string, string> = {
    activa: "Activa",
    borrador: "Borrador",
    archivada: "Archivada",
    inactiva: "Inactiva",
  };
  return map[estado.toLowerCase()] ?? estado;
}

// Construye el payload snake_case que se envía a `escandallos`.
// Solo se incluyen las claves explícitamente presentes en `input`
// para que updates parciales no machaquen campos no editados.
function toRow(input: EscandalloInput, opts: { isUpdate?: boolean; empresaId?: string } = {}) {
  const row: Record<string, unknown> = {};
  if (opts.empresaId) row.empresa_id = opts.empresaId;
  if (input.nombre !== undefined) row.nombre = input.nombre;
  if (input.categoria !== undefined) row.categoria = input.categoria;
  if (input.estado !== undefined) row.estado = normalizarEstado(input.estado);
  if (input.partida !== undefined) row.partida = input.partida;
  if (input.porciones !== undefined) row.porciones = input.porciones;
  if (input.tiempoPreparacion !== undefined) row.tiempo_preparacion = input.tiempoPreparacion;
  if (input.elaboracion !== undefined) row.elaboracion = input.elaboracion;
  if (input.descripcion !== undefined) row.descripcion = input.descripcion;
  if (input.guarnicion !== undefined) row.guarnicion = input.guarnicion;
  if (input.decoracion !== undefined) row.decoracion = input.decoracion;
  if (input.menaje !== undefined) row.menaje = input.menaje;
  if (input.presentacionMesa !== undefined) row.presentacion_mesa = input.presentacionMesa;
  if (input.presentacionFoto !== undefined) row.presentacion_foto = input.presentacionFoto;
  if (input.pasos !== undefined) row.pasos = input.pasos;
  if (input.alergenos !== undefined) row.alergenos = input.alergenos;
  if (input.recomendaciones !== undefined) row.recomendaciones = input.recomendaciones;
  if (input.etiquetas !== undefined) row.etiquetas = input.etiquetas;
  if (input.delicatessen !== undefined) row.delicatessen = input.delicatessen;
  if (input.costeTotal !== undefined) row.coste_total = input.costeTotal;
  if (input.pvp !== undefined) row.pvp = input.pvp;
  if (input.margenPct !== undefined) row.margen_pct = input.margenPct;
  if (input.fotoUrl !== undefined) row.foto_url = input.fotoUrl;
  if (input.notas !== undefined) row.notas = input.notas;
  if (input.responsable !== undefined) row.responsable = input.responsable;
  if (input.shareToken !== undefined) row.share_token = input.shareToken;
  if (input.shareEnabled !== undefined) row.share_enabled = input.shareEnabled;
  if (input.productoId !== undefined) row.producto_id = input.productoId;
  if (opts.isUpdate) row.updated_at = new Date().toISOString();
  return row;
}

// Reemplaza completamente los ingredientes de un escandallo.
async function replaceIngredientes(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  escandalloId: string,
  ingredientes: EscandalloIngredienteInput[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("escandallo_ingredientes")
    .delete()
    .eq("escandallo_id", escandalloId);
  if (delErr) throw delErr;

  if (ingredientes.length === 0) return;

  const rows = ingredientes.map((ing, idx) => ({
    escandallo_id: escandalloId,
    producto_id: ing.productoId ?? null,
    nombre: ing.nombre,
    cantidad: ing.cantidad,
    unidad: ing.unidad || "ud",
    coste_unitario: ing.costeUnitario ?? 0,
    coste_total: ing.precio ?? +(((ing.costeUnitario ?? 0) * ing.cantidad).toFixed(2)),
    merma_pct: ing.mermaPct ?? 0,
    tipo: ing.tipo ?? null,
    formato: ing.formato ?? null,
    orden: idx,
    // `prioridad` se omite a propósito: la columna tiene un default
    // ('secundario') con CHECK estricto principal/secundario; no es
    // el tipo de producto. No la convertimos en hack.
  }));

  const { error: insErr } = await supabase.from("escandallo_ingredientes").insert(rows);
  if (insErr) throw insErr;
}

// Sincroniza la receta del escandallo hacia producto_composicion (la tabla que
// descuenta stock por kardex y alimenta coste_escandallo()). Reescribe la
// composición completa del producto desde los ingredientes del escandallo.
// Solo se incluyen ingredientes vinculados a un producto (ing.productoId).
// Los duplicados por ingrediente se agregan (suma de cantidad) para respetar el
// unique (producto_venta_id, ingrediente_id).
async function syncProductoComposicion(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  productoId: string,
  ingredientes: EscandalloIngredienteInput[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("producto_composicion")
    .delete()
    .eq("producto_venta_id", productoId);
  if (delErr) throw delErr;

  const byIng = new Map<string, { producto_venta_id: string; ingrediente_id: string; cantidad: number; merma_pct: number }>();
  for (const ing of ingredientes) {
    if (!ing.productoId) continue;
    const prev = byIng.get(ing.productoId);
    if (prev) {
      prev.cantidad += ing.cantidad;
    } else {
      byIng.set(ing.productoId, {
        producto_venta_id: productoId,
        ingrediente_id: ing.productoId,
        cantidad: ing.cantidad,
        merma_pct: ing.mermaPct ?? 0,
      });
    }
  }

  const rows = Array.from(byIng.values());
  if (rows.length === 0) return;

  const { error: insErr } = await supabase.from("producto_composicion").insert(rows);
  if (insErr) throw insErr;
}

// Recalcula el coste del escandallo con coste_escandallo() — la MISMA función que
// usa Productos y el descuento de stock — y lo persiste en escandallos.coste_total.
// Garantiza que el coste mostrado en cocina y en Productos sea idéntico.
async function fijarCosteAutoritativo(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  escandalloId: string,
  productoId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("coste_escandallo", { p_producto_venta_id: productoId });
  if (error) throw error;
  if (data == null) return;
  const { error: upErr } = await supabase
    .from("escandallos")
    .update({ coste_total: Number(data) })
    .eq("id", escandalloId);
  if (upErr) throw upErr;
}

// ─── Lectura ───────────────────────────────────────────────────────

export async function listEscandallos() {
  try {
    const { supabase, empresaId } = await getAppContext();
    // JOIN a productos para que cada ingrediente traiga `alergenos` y el `tipo` real
    // del producto referenciado. Permite a la UI derivar la lista de alérgenos
    // del escandallo automáticamente, con trazabilidad de origen
    // ("Gluten · viene de Harina (compra), Bechamel (elaboración)").
    let query = supabase
      .from("escandallos")
      .select("*, ingredientes:escandallo_ingredientes(*, productos(alergenos, tipo))")
      .order("created_at", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true as const, data: data ?? [] };
  } catch (err) {
    console.error("[escandallos] listEscandallos:", err);
    return { ok: false as const, data: [] };
  }
}

// ─── Costes unitarios de ingredientes ──────────────────────────────
// Devuelve, por producto (compra/elaboración), el coste unitario EFECTIVO y el
// factor de conversión, replicando EXACTAMENTE la fuente de coste_escandallo():
//   coste_unitario = precio_unitario del proveedor preferido, si existe;
//                    si no, productos.coste (numérico).
// Así el coste calculado en directo en cocina coincide con el de Productos/stock.
export async function getCostesIngredientes() {
  const vacio = {} as Record<string, { costeUnitario: number; factor: number }>;
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, data: vacio };

    const { data: prods, error } = await supabase
      .from("productos")
      .select("id, coste, factor_conversion")
      .eq("empresa_id", empresaId)
      .in("tipo", ["compra", "elaboracion"]);
    if (error) throw error;

    const ids = (prods ?? []).map((p) => p.id as string);
    const prefMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: precios } = await supabase
        .from("ingredientes_proveedor")
        .select("producto_id, precio_unitario")
        .in("producto_id", ids)
        .eq("es_preferido", true);
      for (const r of precios ?? []) {
        prefMap.set(r.producto_id as string, Number(r.precio_unitario ?? 0));
      }
    }

    const map: Record<string, { costeUnitario: number; factor: number }> = {};
    for (const p of prods ?? []) {
      const costeRaw = String(p.coste ?? "");
      const costeNum = /^[0-9]+(\.[0-9]+)?$/.test(costeRaw) ? Number(costeRaw) : 0;
      const pref = prefMap.get(p.id as string);
      map[p.id as string] = {
        costeUnitario: pref != null ? pref : costeNum,
        factor: Number(p.factor_conversion ?? 1) || 1,
      };
    }
    return { ok: true as const, data: map };
  } catch (err) {
    console.error("[escandallos] getCostesIngredientes:", err);
    return { ok: false as const, data: vacio };
  }
}

// ─── Empleados (creadores) ─────────────────────────────────────────

export async function listEmpleadosCreadores() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, data: [] as { id: string; nombre: string; apellidos: string }[] };
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as { id: string; nombre: string; apellidos: string }[] };
  } catch (err) {
    console.error("[escandallos] listEmpleadosCreadores:", err);
    return { ok: false as const, data: [] as { id: string; nombre: string; apellidos: string }[] };
  }
}

// ─── Create ────────────────────────────────────────────────────────

export async function createEscandallo(input: EscandalloInput) {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const row = toRow(input, { empresaId });
    if (userId) row.created_by = userId;

    const { data: escandallo, error } = await supabase
      .from("escandallos")
      .insert(row)
      .select()
      .single();
    if (error) throw error;

    if (input.ingredientes && input.ingredientes.length > 0) {
      await replaceIngredientes(supabase, escandallo.id, input.ingredientes);
    }

    // Si el escandallo está asociado a un producto, sincronizamos su receta y
    // fijamos el coste con la MISMA función oficial que usan Productos/stock.
    if (input.productoId && input.ingredientes !== undefined) {
      await syncProductoComposicion(supabase, input.productoId, input.ingredientes);
      await fijarCosteAutoritativo(supabase, escandallo.id, input.productoId);
    }

    return { ok: true as const, data: escandallo };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] createEscandallo:", msg);
    return { ok: false as const, error: msg };
  }
}

// ─── Update ────────────────────────────────────────────────────────

export async function updateEscandallo(id: string, input: EscandalloInput) {
  try {
    const { supabase } = await getAppContext();
    const row = toRow(input, { isUpdate: true });

    const { error } = await supabase
      .from("escandallos")
      .update(row)
      .eq("id", id);
    if (error) throw error;

    if (input.ingredientes !== undefined) {
      await replaceIngredientes(supabase, id, input.ingredientes);
    }

    // Sincronizamos la receta al producto asociado (si lo hay) y fijamos el coste.
    if (input.productoId && input.ingredientes !== undefined) {
      await syncProductoComposicion(supabase, input.productoId, input.ingredientes);
      await fijarCosteAutoritativo(supabase, id, input.productoId);
    }

    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] updateEscandallo:", msg);
    return { ok: false as const, error: msg };
  }
}

// ─── Delete ────────────────────────────────────────────────────────

export async function deleteEscandallo(id: string) {
  try {
    const { supabase } = await getAppContext();
    // Borramos los ingredientes primero por si la FK no tiene ON DELETE CASCADE.
    const { error: ingErr } = await supabase
      .from("escandallo_ingredientes")
      .delete()
      .eq("escandallo_id", id);
    if (ingErr) throw ingErr;

    const { error } = await supabase
      .from("escandallos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] deleteEscandallo:", msg);
    return { ok: false as const, error: msg };
  }
}
