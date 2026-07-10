"use server";

/**
 * Revisión de nóminas subidas (por la gestoría o a mano) + histórico de archivos.
 *
 * Flujo: las nóminas se vuelcan al registro de pagos como provisionales, pero cada
 * una lleva un `revision_estado`. RRHH ve aquí todas las del mes, con un indicador
 * de si tienen incidencia, puede abrir el documento y APROBAR (queda 'correcta') o
 * DENEGAR (queda 'denegada' y se descuenta de la suma de `rrhh_pagos`).
 *
 * `listarSubidasHistorico` alimenta la vista de histórico de documentos subidos.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type RevisionEstado = "correcta" | "con_incidencia" | "denegada";

export interface NominaRevision {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  periodo: string;
  orden: number;
  neto: number;
  ssEmpleado: number;
  ssEmpresa: number;
  irpf: number;
  estado: RevisionEstado;
  incidencia: string | null;
  tieneDocumento: boolean;
}

/** Nóminas individuales de un mes con su estado de revisión (para la vista RRHH). */
export async function listarNominasRevision(periodo: string): Promise<NominaRevision[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];

    const { data, error } = await supabase
      .from("rrhh_pagos_nominas")
      .select(
        "id, empleado_id, periodo, orden, neto, ss_empleado, ss_empresa, irpf, revision_estado, incidencia, nomina_path",
      )
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .order("orden", { ascending: true });
    if (error) throw error;

    const filas = data ?? [];
    // Nombres de empleado en un tiro.
    const ids = [...new Set(filas.map((f) => f.empleado_id as string))];
    const nombres = new Map<string, string>();
    if (ids.length > 0) {
      const { data: emps } = await supabase
        .from("empleados")
        .select("id, nombre, apellidos")
        .in("id", ids);
      for (const e of emps ?? []) {
        nombres.set(e.id as string, `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim());
      }
    }

    return filas.map((f) => ({
      id: f.id as string,
      empleadoId: f.empleado_id as string,
      empleadoNombre: nombres.get(f.empleado_id as string) ?? "—",
      periodo: f.periodo as string,
      orden: (f.orden as number) ?? 0,
      neto: Number(f.neto ?? 0),
      ssEmpleado: Number(f.ss_empleado ?? 0),
      ssEmpresa: Number(f.ss_empresa ?? 0),
      irpf: Number(f.irpf ?? 0),
      estado: (f.revision_estado as RevisionEstado) ?? "correcta",
      incidencia: (f.incidencia as string | null) ?? null,
      tieneDocumento: Boolean(f.nomina_path),
    }));
  } catch (err) {
    console.error("[rrhh] listarNominasRevision:", err);
    return [];
  }
}

/**
 * Recalcula la SUMA de las nóminas NO denegadas de un empleado/mes y la vuelca a
 * `rrhh_pagos` (mantiene la fila del pago coherente tras aprobar/denegar).
 */
async function recalcularSumaPago(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  empleadoId: string,
  periodo: string,
): Promise<void> {
  const { data } = await admin
    .from("rrhh_pagos_nominas")
    .select("ss_empleado, ss_empresa, irpf, neto, nomina_path, orden")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .eq("periodo", periodo)
    .neq("revision_estado", "denegada")
    .order("orden", { ascending: true });
  const lista = data ?? [];
  const suma = lista.reduce(
    (a, r) => ({
      ss_empleado: a.ss_empleado + Number(r.ss_empleado),
      ss_empresa: a.ss_empresa + Number(r.ss_empresa),
      irpf: a.irpf + Number(r.irpf),
      nomina: a.nomina + Number(r.neto),
    }),
    { ss_empleado: 0, ss_empresa: 0, irpf: 0, nomina: 0 },
  );
  await admin
    .from("rrhh_pagos")
    .update({ ...suma, nomina_path: lista[0]?.nomina_path ?? null })
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .eq("periodo", periodo);
}

/**
 * Aprobar o denegar una nómina en revisión. Aprobar → 'correcta'. Denegar →
 * 'denegada' (deja de contar en la suma del pago). No se puede tocar si la
 * liquidación de ese pago ya fue enviada (inmutable).
 */
export async function revisarNomina(
  nominaId: string,
  accion: "aprobar" | "denegar",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };

    const { data: nom, error: e0 } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id, empresa_id, empleado_id, periodo")
      .eq("id", nominaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (e0) throw e0;
    if (!nom) return { ok: false, error: "Nómina no encontrada" };

    // Bloqueo: si la liquidación de ese pago ya fue enviada, no se toca.
    const { data: pago } = await supabase
      .from("rrhh_pagos")
      .select("confirmacion_enviada_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", nom.empleado_id as string)
      .eq("periodo", nom.periodo as string)
      .maybeSingle();
    if (pago?.confirmacion_enviada_at) {
      return { ok: false, error: "La liquidación de ese mes ya fue enviada: no se puede modificar." };
    }

    const admin = createAdminClient();
    const nuevoEstado: RevisionEstado = accion === "aprobar" ? "correcta" : "denegada";
    const { error: e1 } = await admin
      .from("rrhh_pagos_nominas")
      .update({
        revision_estado: nuevoEstado,
        // Al aprobar limpiamos la incidencia; al denegar la conservamos como motivo.
        ...(accion === "aprobar" ? { incidencia: null } : {}),
        revisado_por: userId ?? null,
        revisado_en: new Date().toISOString(),
      })
      .eq("id", nominaId)
      .eq("empresa_id", empresaId);
    if (e1) throw e1;

    await recalcularSumaPago(
      admin,
      empresaId,
      nom.empleado_id as string,
      nom.periodo as string,
    );

    revalidatePath("/rrhh/pagos");
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] revisarNomina:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export interface SubidaHistorico {
  id: string;
  periodo: string;
  origen: "gestoria" | "manual";
  archivoNombre: string | null;
  archivoBytes: number | null;
  leidas: number;
  guardadas: number;
  yaExistian: number;
  sinEmpleado: number;
  mesIncorrecto: number;
  createdAt: string;
}

/** Histórico de archivos de nóminas subidos (auditoría), más reciente primero. */
export async function listarSubidasHistorico(limit = 60): Promise<SubidaHistorico[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from("nominas_gestoria_subidas")
      .select(
        "id, periodo, origen, archivo_nombre, archivo_bytes, leidas, guardadas, ya_existian, sin_empleado, mes_incorrecto, created_at",
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      periodo: r.periodo as string,
      origen: (r.origen as "gestoria" | "manual") ?? "gestoria",
      archivoNombre: (r.archivo_nombre as string | null) ?? null,
      archivoBytes: (r.archivo_bytes as number | null) ?? null,
      leidas: Number(r.leidas ?? 0),
      guardadas: Number(r.guardadas ?? 0),
      yaExistian: Number(r.ya_existian ?? 0),
      sinEmpleado: Number(r.sin_empleado ?? 0),
      mesIncorrecto: Number(r.mes_incorrecto ?? 0),
      createdAt: r.created_at as string,
    }));
  } catch (err) {
    console.error("[rrhh] listarSubidasHistorico:", err);
    return [];
  }
}
