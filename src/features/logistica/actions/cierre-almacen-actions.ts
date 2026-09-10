"use server";

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLogisticaEdit } from "@/features/logistica/lib/require-logistica";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Cierre de almacén (PRP-080 Fase 2).
 *
 * Cerrar es decir "hasta este día ya no se toca nada". A partir de ahí ni una merma,
 * ni un albarán, ni una venta, ni un ajuste anterior al corte se pueden crear, cambiar
 * ni borrar. Quien de verdad lo impide es la base de datos; esto es la puerta por la
 * que se pide.
 *
 * Solo se cierran DÍAS TERMINADOS. No es un capricho: las ventas del TPV llegan a la
 * mañana siguiente, así que cerrar "hoy a las seis" dejaría fuera las ventas de hoy.
 */

export interface CierreAlmacen {
  id: string;
  corteDia: string;
  corte: string;
  inventarioId: string | null;
  cerradoPor: string | null;
  cerradoPorNombre: string | null;
  cerradoAt: string;
}

/** El cierre vigente de la empresa activa, o null si el almacén está abierto. */
export async function getCierreAlmacen(): Promise<{ ok: boolean; data: CierreAlmacen | null; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: true, data: null };

    const { data, error } = await supabase
      .from("almacen_cierres")
      .select("id, corte_dia, corte, inventario_id, cerrado_por, cerrado_at")
      .eq("empresa_id", empresaId)
      .is("reabierto_at", null)
      .order("corte", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

    // Nombre de quien cerró, para que el aviso diga una persona y no un identificador.
    let nombre: string | null = null;
    if (data.cerrado_por) {
      const { data: u } = await supabase
        .from("usuarios")
        .select("nombre")
        .eq("id", data.cerrado_por)
        .maybeSingle();
      nombre = (u?.nombre as string | null) ?? null;
    }

    return {
      ok: true,
      data: {
        id: data.id as string,
        corteDia: data.corte_dia as string,
        corte: data.corte as string,
        inventarioId: (data.inventario_id as string | null) ?? null,
        cerradoPor: (data.cerrado_por as string | null) ?? null,
        cerradoPorNombre: nombre,
        cerradoAt: data.cerrado_at as string,
      },
    };
  } catch (err) {
    console.error("[cierre-almacen] getCierreAlmacen:", err);
    return { ok: false, data: null, error: friendlyError(err, "getCierreAlmacen") };
  }
}

/** El último día que se puede cerrar hoy: ayer, en el día natural de la empresa. */
export async function getUltimoDiaCerrable(): Promise<{ ok: boolean; dia: string | null }> {
  try {
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, dia: null };
    const admin = createAdminClient();
    const tz = await getZonaHorariaEmpresa(admin, empresaId);
    const hoy = hoyEnZona(tz);
    const ayer = new Date(`${hoy}T12:00:00Z`);
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    return { ok: true, dia: ayer.toISOString().slice(0, 10) };
  } catch (err) {
    console.error("[cierre-almacen] getUltimoDiaCerrable:", err);
    return { ok: false, dia: null };
  }
}

/**
 * Cierra el almacén hasta `dia` (incluido). `inventarioId` deja constancia de desde
 * qué recuento se cerró, si vino de ahí.
 */
export async function cerrarAlmacen(input: {
  dia: string;
  inventarioId?: string | null;
}): Promise<{ ok: boolean; error?: string; corteDia?: string }> {
  try {
    const user = await requireLogisticaEdit("cerrar el almacén");
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("almacen_cerrar", {
      p_empresa: empresaId,
      p_dia: input.dia,
      p_inventario: input.inventarioId ?? null,
      p_usuario: user.id,
    });
    // El mensaje de la excepción ya viene en castellano y accionable.
    if (error) return { ok: false, error: error.message };

    revalidatePath("/logistica/stock");
    revalidatePath("/logistica/inventarios");
    return { ok: true, corteDia: (data as { corte_dia?: string } | null)?.corte_dia ?? input.dia };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierre-almacen] cerrarAlmacen:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Reabre el último cierre. Exige motivo y queda registrado: reabrir un almacén cerrado
 * es una excepción, no una operación de cada día.
 */
export async function reabrirAlmacen(input: {
  motivo: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireLogisticaEdit("reabrir el almacén");
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    if (!input.motivo?.trim()) {
      return { ok: false, error: "Para reabrir el almacén hay que decir por qué." };
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("almacen_reabrir", {
      p_empresa: empresaId,
      p_usuario: user.id,
      p_motivo: input.motivo.trim(),
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/logistica/stock");
    revalidatePath("/logistica/inventarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierre-almacen] reabrirAlmacen:", msg);
    return { ok: false, error: msg };
  }
}
