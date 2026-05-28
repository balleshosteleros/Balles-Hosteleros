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
