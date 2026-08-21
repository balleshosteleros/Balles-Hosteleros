"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/supabase/get-context";
import type {
  CategoriaMaterial,
  Entrega,
  EntregaItem,
  EstadoDevolucion,
  EstadoEntrega,
} from "@/features/rrhh/data/entregas";
import { enviarActaEntregaAFirma } from "@/features/rrhh/services/entregas/enviar-a-firma";

/**
 * Entregas de material y uniforme.
 *
 * Una entrega = una unidad. RRHH la registra y al trabajador le llega un correo
 * para firmar que la ha recibido; al devolverla, otro correo para firmar que la
 * ha devuelto. Las dos actas quedan en su ficha y en su portal.
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
  devolucion_estado: string | null;
  devolucion_firma_id: string | null;
  devuelta_en: string | null;
  merma_motivo: string | null;
  merma_en: string | null;
};

function mapItem(r: FilaItem): EntregaItem {
  return {
    id: r.id,
    tipoId: r.tipo_id,
    tipoNombre: r.tipo_nombre,
    categoria: (r.categoria === "uniforme" ? "uniforme" : "material") as CategoriaMaterial,
    talla: r.talla,
    requiereDevolucion: !!r.requiere_devolucion,
    devueltoEn: r.devuelto_en,
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
    .select(
      "id, empleado_id, fecha, nota, estado, firma_id, firmada_en, entregado_por_nombre, devolucion_estado, devolucion_firma_id, devuelta_en, merma_motivo, merma_en",
    )
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
      "id, entrega_id, tipo_id, tipo_nombre, categoria, talla, requiere_devolucion, devuelto_en",
    )
    .in("entrega_id", ids);

  // Una pieza por entrega (garantizado por índice único en la BD).
  const porEntrega = new Map<string, EntregaItem>();
  for (const it of (items ?? []) as FilaItem[]) {
    porEntrega.set(it.entrega_id, mapItem(it));
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
    item: porEntrega.get(f.id) ?? null,
    devolucionEstado: (f.devolucion_estado ?? "no_procede") as EstadoDevolucion,
    mermaMotivo: f.merma_motivo,
    mermaEn: f.merma_en,
    devolucionFirmaId: f.devolucion_firma_id,
    devueltaEn: f.devuelta_en,
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
  talla: string | null;
  requiereDevolucion: boolean;
}

/**
 * Registra la entrega de UNA pieza y le manda al trabajador el acta para que
 * firme que la ha recibido.
 *
 * El correo se manda en el mismo paso porque una entrega sin firmar no sirve de
 * nada: lo que da valor al registro es que el trabajador reconozca que la tiene.
 * Si el correo falla, la entrega queda igualmente grabada en borrador y se puede
 * reenviar; no se pierde el trabajo de registrarla.
 */
export async function crearEntrega(input: {
  empleadoId: string;
  fecha: string;
  nota: string | null;
  item: NuevaEntregaItem;
}) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    if (!input.empleadoId) return { ok: false as const, error: "Elige un trabajador" };
    if (!input.item?.tipoNombre.trim()) {
      return { ok: false as const, error: "Elige qué se entrega" };
    }

    // El empleado tiene que ser de esta empresa (RLS ya lo cubre, pero así el
    // mensaje de error es claro en vez de un fallo de FK).
    const { data: emp } = await db
      .from("empleados")
      .select("id")
      .eq("id", input.empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: false as const, error: "Ese trabajador no es de esta empresa" };

    const solicitanteNombre = await nombreUsuarioActual(db, userId);

    const { data: cabecera, error: errCab } = await db
      .from("entregas_material")
      .insert({
        empresa_id: empresaId,
        empleado_id: input.empleadoId,
        fecha: input.fecha,
        nota: input.nota?.trim() || null,
        estado: "borrador",
        entregado_por: userId,
        entregado_por_nombre: solicitanteNombre,
      })
      .select("id")
      .single();
    if (errCab) throw errCab;

    const entregaId = (cabecera as { id: string }).id;
    const { error: errItem } = await db.from("entregas_material_items").insert({
      entrega_id: entregaId,
      tipo_id: input.item.tipoId,
      tipo_nombre: input.item.tipoNombre.trim(),
      categoria: input.item.categoria,
      talla: input.item.talla?.trim() || null,
      requiere_devolucion: input.item.requiereDevolucion,
    });
    if (errItem) {
      // Sin la pieza la entrega no significa nada: se deshace entera.
      await db.from("entregas_material").delete().eq("id", entregaId);
      throw errItem;
    }

    // Y se le manda a firmar.
    const firma = await enviarActaEntregaAFirma({
      variante: "entrega",
      entregaId,
      empresaId,
      solicitanteUserId: userId,
      solicitanteNombre,
    });

    if (firma.ok) {
      await db
        .from("entregas_material")
        .update({
          estado: "pendiente_firma",
          firma_id: firma.documentoId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entregaId);
    }

    revalidatePath("/rrhh/entregas");
    return {
      ok: true as const,
      entregaId,
      // La entrega existe aunque la firma no saliera: el aviso es para que RRHH
      // sepa que tiene que reenviarla, no un fallo del registro.
      firmaEnviada: firma.ok,
      errorFirma: firma.ok ? null : firma.error,
    };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Reenvía el acta de ENTREGA cuando el primer correo no salió o caducó.
 * Solo mientras el trabajador no la haya firmado ya.
 */
export async function reenviarEntregaAFirma(entregaId: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("estado")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };
    if ((actual as { estado: string }).estado === "firmada") {
      return { ok: false as const, error: "El trabajador ya ha firmado esta entrega" };
    }

    const solicitanteNombre = await nombreUsuarioActual(db, userId);
    const firma = await enviarActaEntregaAFirma({
      variante: "entrega",
      entregaId,
      empresaId,
      solicitanteUserId: userId,
      solicitanteNombre,
    });
    if (!firma.ok) return { ok: false as const, error: firma.error };

    await db
      .from("entregas_material")
      .update({
        estado: "pendiente_firma",
        firma_id: firma.documentoId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entregaId);

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Pide la devolución: le manda al trabajador el acta para que firme que ha
 * devuelto la pieza. Es el botón "Devolución" del módulo.
 */
export async function pedirDevolucion(entregaId: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("estado, devolucion_estado")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };

    const row = actual as { estado: string; devolucion_estado: string | null };
    // Sin acta de entrega firmada no hay nada que devolver: el trabajador nunca
    // reconoció haberlo recibido.
    if (row.estado !== "firmada") {
      return {
        ok: false as const,
        error: "El trabajador todavía no ha firmado que lo recibió",
      };
    }
    if (row.devolucion_estado === "devuelta") {
      return { ok: false as const, error: "Esta entrega ya está devuelta" };
    }

    const solicitanteNombre = await nombreUsuarioActual(db, userId);
    const firma = await enviarActaEntregaAFirma({
      variante: "devolucion",
      entregaId,
      empresaId,
      solicitanteUserId: userId,
      solicitanteNombre,
    });
    if (!firma.ok) return { ok: false as const, error: firma.error };

    await db
      .from("entregas_material")
      .update({
        devolucion_estado: "pendiente_firma",
        devolucion_firma_id: firma.documentoId,
        devolucion_solicitada_en: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", entregaId);

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
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
 * Da de baja la pieza por deterioro: le manda al trabajador un acta donde consta
 * que se ha roto o desgastado y que se autoriza su retirada.
 *
 * No es una devolución fallida: es el otro final posible del ciclo. Al firmarla,
 * la pieza deja de contar como material suyo y no se le puede reclamar.
 */
export async function darDeBajaPorMerma(entregaId: string, motivo: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const motivoLimpio = motivo?.trim() ?? "";
    if (!motivoLimpio) {
      return { ok: false as const, error: "Explica por qué se da de baja" };
    }

    const { data: actual } = await db
      .from("entregas_material")
      .select("estado, devolucion_estado")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };

    const row = actual as { estado: string; devolucion_estado: string | null };
    // Sin acta de entrega firmada no hay nada que dar de baja: el trabajador
    // nunca reconoció haberlo recibido.
    if (row.estado !== "firmada") {
      return {
        ok: false as const,
        error: "El trabajador todavía no ha firmado que lo recibió",
      };
    }
    if (row.devolucion_estado === "devuelta") {
      return { ok: false as const, error: "Esta entrega ya está devuelta" };
    }
    if (row.devolucion_estado === "merma") {
      return { ok: false as const, error: "Esta entrega ya está dada de baja" };
    }

    const solicitanteNombre = await nombreUsuarioActual(db, userId);
    const firma = await enviarActaEntregaAFirma({
      variante: "merma",
      entregaId,
      empresaId,
      solicitanteUserId: userId,
      solicitanteNombre,
      motivoMerma: motivoLimpio,
    });
    if (!firma.ok) return { ok: false as const, error: firma.error };

    await db
      .from("entregas_material")
      .update({
        devolucion_estado: "merma_pendiente_firma",
        devolucion_firma_id: firma.documentoId,
        devolucion_solicitada_en: new Date().toISOString(),
        merma_motivo: motivoLimpio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entregaId);

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Cancela una devolución o una merma pedida por error, mientras el trabajador no
 * la haya firmado. La pieza vuelve a contar como suya.
 *
 * No existe un "marcar como devuelto" a mano: la devolución la acredita la firma
 * del trabajador, no la palabra de la empresa. Para eso está `pedirDevolucion`.
 */
export async function cancelarDevolucion(entregaId: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("devolucion_estado")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };

    const estadoActual = (actual as { devolucion_estado: string | null }).devolucion_estado;
    if (estadoActual === "devuelta") {
      return {
        ok: false as const,
        error: "El trabajador ya ha firmado la devolución y no se puede deshacer",
      };
    }
    if (estadoActual === "merma") {
      return {
        ok: false as const,
        error: "El trabajador ya ha firmado la baja por deterioro y no se puede deshacer",
      };
    }

    const { error } = await db
      .from("entregas_material")
      .update({
        devolucion_estado: "no_procede",
        devolucion_firma_id: null,
        devolucion_solicitada_en: null,
        // Si lo cancelado era una merma, su motivo deja de tener sentido.
        merma_motivo: null,
        updated_at: new Date().toISOString(),
      })
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
