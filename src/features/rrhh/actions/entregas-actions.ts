"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/supabase/get-context";
import type {
  ActaEntrega,
  ActaEntregaTipo,
  CategoriaMaterial,
  Entrega,
  EntregaItem,
  EstadoDevolucion,
  EstadoEntrega,
  HitoActa,
} from "@/features/rrhh/data/entregas";
import { enviarActaEntregaAFirma } from "@/features/rrhh/services/entregas/enviar-a-firma";
import { reenviarFirma, cancelarFirmaInterno } from "@/features/rrhh/actions/firmas-actions";

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

/**
 * Cuántas piezas tiene sin devolver cada trabajador de la empresa.
 *
 * Lo usa el offboarding: la tarjeta del Kanban avisa de lo que falta por
 * devolver antes de dejarle salir. Devuelve un mapa empleadoId → nº de piezas;
 * los que no aparecen no deben nada.
 */
export async function contarPendientesDevolucionPorEmpleado(): Promise<
  Record<string, number>
> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return {};
  const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

  // Firmada por el trabajador (es suya), pendiente de devolver, y ni devuelta
  // ni dada de baja por deterioro.
  const { data, error } = await db
    .from("entregas_material")
    .select("empleado_id, entregas_material_items!inner(requiere_devolucion)")
    .eq("empresa_id", empresaId)
    .eq("estado", "firmada")
    .eq("entregas_material_items.requiere_devolucion", true)
    .not("devolucion_estado", "in", '("devuelta","merma")');
  if (error) {
    console.error("[rrhh] contarPendientesDevolucionPorEmpleado:", error.message);
    return {};
  }

  const conteo: Record<string, number> = {};
  for (const fila of (data ?? []) as { empleado_id: string }[]) {
    conteo[fila.empleado_id] = (conteo[fila.empleado_id] ?? 0) + 1;
  }
  return conteo;
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
 *
 * Reenvía el MISMO documento (renueva su enlace y su OTP) en vez de generar uno
 * nuevo. Antes se creaba un acta nueva en cada reenvío y la anterior seguía viva
 * y firmable, así que el trabajador podía acabar firmando dos veces la misma
 * entrega y la ficha solo guardaba la última: la otra quedaba huérfana.
 */
export async function reenviarEntregaAFirma(entregaId: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("estado, firma_id")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };
    const row = actual as { estado: string; firma_id: string | null };
    if (row.estado === "firmada") {
      return { ok: false as const, error: "El trabajador ya ha firmado esta entrega" };
    }

    // Camino normal: ya hay un acta esperando firma → se le renueva el enlace.
    if (row.firma_id) {
      const { data: doc } = await db
        .from("firmas_documentos")
        .select("estado")
        .eq("id", row.firma_id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      const estadoDoc = (doc as { estado: string } | null)?.estado ?? null;

      if (estadoDoc === "firmado") {
        return { ok: false as const, error: "El trabajador ya ha firmado esta entrega" };
      }
      if (estadoDoc === "pendiente") {
        const res = await reenviarFirma(row.firma_id);
        if (!res.ok) return { ok: false as const, error: res.error };
        revalidatePath("/rrhh/entregas");
        return { ok: true as const };
      }
    }

    // Solo si no hay acta utilizable (nunca se creó, o caducó/se canceló) se
    // genera una nueva. La anterior, si la había, se cierra para que no quede
    // ningún enlace vivo capaz de firmar la misma entrega otra vez.
    if (row.firma_id) await cancelarFirmaInterno(row.firma_id, empresaId, userId);

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
    if (row.devolucion_estado === "merma") {
      return { ok: false as const, error: "Esta entrega ya está dada de baja por deterioro" };
    }
    // Ya hay un acta esperando su firma: mandar otra dejaría dos documentos
    // vivos para la misma devolución y podría firmar las dos.
    if (row.devolucion_estado === "pendiente_firma") {
      return {
        ok: false as const,
        error: "Ya se le ha pedido la devolución y está esperando su firma",
      };
    }
    if (row.devolucion_estado === "merma_pendiente_firma") {
      return {
        ok: false as const,
        error: "Esta entrega tiene una baja por deterioro esperando su firma",
      };
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
    // Igual que en la devolución: un acta en curso impide crear otra.
    if (row.devolucion_estado === "pendiente_firma") {
      return {
        ok: false as const,
        error: "Esta entrega tiene una devolución esperando su firma",
      };
    }
    if (row.devolucion_estado === "merma_pendiente_firma") {
      return {
        ok: false as const,
        error: "Ya se ha pedido la baja por deterioro y está esperando su firma",
      };
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
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("devolucion_estado, devolucion_firma_id")
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

    // El acta ya enviada se cierra: si solo se le quita el puntero, el enlace
    // que tiene el trabajador en el correo seguiría firmando una devolución
    // que RRHH ya había anulado.
    const firmaIdViva = (actual as { devolucion_firma_id?: string | null })
      .devolucion_firma_id;
    if (firmaIdViva) await cancelarFirmaInterno(firmaIdViva, empresaId, userId);

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
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("entregas_material")
      .select("estado, firma_id, devolucion_firma_id")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "La entrega ya no existe" };
    const fila = actual as {
      estado: string;
      firma_id: string | null;
      devolucion_firma_id: string | null;
    };
    if (fila.estado === "firmada") {
      return {
        ok: false as const,
        error: "Esta entrega ya está firmada por el trabajador y no se puede borrar",
      };
    }

    // Se cierran sus actas pendientes ANTES de borrar: si no se pudieran cerrar,
    // borrar la entrega dejaría vivo un enlace capaz de firmar el acta de algo
    // que ya no existe. Por eso se comprueba el resultado y se aborta.
    for (const fid of [fila.firma_id, fila.devolucion_firma_id]) {
      if (!fid) continue;
      const cierre = await cancelarFirmaInterno(fid, empresaId, userId);
      if (!cierre.ok) {
        return {
          ok: false as const,
          error: "No se pudo cerrar el acta pendiente de esta entrega, así que no se ha borrado nada.",
        };
      }
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

/**
 * Historial de una entrega: sus actas y, dentro de cada una, cuándo salió el
 * correo, si se reenvió y cuándo, cuándo lo abrió y cuándo firmó.
 *
 * Se lee del registro de auditoría del motor de firmas (`firmas_eventos`), que
 * ya guarda cada hito con su hora exacta; aquí solo se traduce a lenguaje llano.
 */
export async function getHistorialEntrega(
  entregaId: string,
): Promise<{ ok: true; actas: ActaEntrega[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    // La empresa activa no la aísla la RLS por sí sola: se filtra a mano.
    const { data: entrega } = await db
      .from("entregas_material")
      .select("id, firma_id, devolucion_firma_id")
      .eq("id", entregaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!entrega) return { ok: false as const, error: "La entrega ya no existe" };

    const fila = entrega as { firma_id: string | null; devolucion_firma_id: string | null };
    const ids = [fila.firma_id, fila.devolucion_firma_id].filter(
      (x): x is string => Boolean(x),
    );
    if (ids.length === 0) return { ok: true as const, actas: [] };

    const { data: docs, error: errDocs } = await db
      .from("firmas_documentos")
      .select("id, tipo, titulo, estado, enviado_en, firmado_en, reenviado_count, pdf_firmado_path, created_at")
      .in("id", ids)
      .eq("empresa_id", empresaId);
    if (errDocs) throw errDocs;

    const { data: eventos, error: errEv } = await db
      .from("firmas_eventos")
      .select("documento_id, tipo, ocurrido_en, metadata, seq")
      .in("documento_id", ids)
      .order("seq", { ascending: true });
    if (errEv) throw errEv;

    const filasEventos = (eventos ?? []) as {
      documento_id: string;
      tipo: string;
      ocurrido_en: string;
      metadata: Record<string, unknown> | null;
    }[];

    const actas: ActaEntrega[] = ((docs ?? []) as {
      id: string;
      tipo: string;
      titulo: string;
      estado: string;
      enviado_en: string | null;
      firmado_en: string | null;
      reenviado_count: number | null;
      pdf_firmado_path: string | null;
      created_at: string;
    }[])
      .map((d) => ({
        documentoId: d.id,
        tipo: (d.tipo === "entrega_material"
          ? "entrega"
          : d.tipo === "merma_material"
            ? "merma"
            : "devolucion") as ActaEntregaTipo,
        titulo: d.titulo,
        estado: d.estado,
        enviadoEn: d.enviado_en,
        firmadoEn: d.firmado_en,
        reenvios: d.reenviado_count ?? 0,
        tieneDocumentoFirmado: d.estado === "firmado" && Boolean(d.pdf_firmado_path),
        hitos: filasEventos
          .filter((ev) => ev.documento_id === d.id)
          .map(hitoDesdeEvento)
          .filter((h): h is HitoActa => h !== null),
        creadoEn: d.created_at,
      }))
      // Primero la entrega, luego lo que vino después.
      .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
      .map(({ creadoEn: _creadoEn, ...acta }) => acta);

    return { ok: true as const, actas };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Traduce un evento de auditoría a una línea legible. Devuelve null para los
 * hitos internos que no le dicen nada a RRHH (validación del código, etc.).
 */
function hitoDesdeEvento(ev: {
  tipo: string;
  ocurrido_en: string;
  metadata: Record<string, unknown> | null;
}): HitoActa | null {
  const meta = ev.metadata ?? {};
  const destino = typeof meta.destino === "string" ? meta.destino : null;
  const emailOk = meta.emailOk !== false;

  switch (ev.tipo) {
    case "creado":
      return { fecha: ev.ocurrido_en, titulo: "Acta generada", detalle: null };
    case "enviado":
      return {
        fecha: ev.ocurrido_en,
        titulo: emailOk ? "Correo enviado" : "El correo no salió",
        detalle: destino,
      };
    case "reenviado":
      return {
        fecha: ev.ocurrido_en,
        titulo: emailOk ? "Correo reenviado" : "El reenvío no salió",
        detalle: destino,
      };
    case "abierto":
      return { fecha: ev.ocurrido_en, titulo: "Lo abrió el trabajador", detalle: null };
    case "otp_enviado":
      return {
        fecha: ev.ocurrido_en,
        titulo: "Código de firma enviado",
        detalle:
          typeof meta.destinoEnmascarado === "string" ? meta.destinoEnmascarado : null,
      };
    case "firmado":
      return { fecha: ev.ocurrido_en, titulo: "Firmado", detalle: null };
    case "rechazado":
      return {
        fecha: ev.ocurrido_en,
        titulo: "Rechazado por el trabajador",
        detalle: typeof meta.motivo === "string" ? meta.motivo : null,
      };
    case "expirado":
      return {
        fecha: ev.ocurrido_en,
        titulo:
          meta.motivo === "cancelado_manual" ? "Anulado por la empresa" : "Caducado",
        detalle: null,
      };
    default:
      // otp_validado / otp_fallido / otp_bloqueado: ruido para esta pantalla.
      return null;
  }
}
