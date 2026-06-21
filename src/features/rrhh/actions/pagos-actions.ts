"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type EmpleadoArea = "administrativa" | "operativa";

export interface EmpleadoPagoRow {
  empleadoId: string;
  empleadoNombre: string;
  puesto: string | null;
  area: EmpleadoArea;
}

export async function listEmpleadosParaPagos(): Promise<{ ok: boolean; data: EmpleadoPagoRow[] }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const { data: accesosUE } = await supabase
      .from("usuario_empresas")
      .select("user_id")
      .eq("empresa_id", empresaId);
    const userIdsConAcceso = (accesosUE ?? []).map((r) => r.user_id as string);

    const filtro = userIdsConAcceso.length > 0
      ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
      : `empresa_id.eq.${empresaId}`;

    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos, puesto, estado, user_id, empresa_id, departamentos(nombre, area)")
      .or(filtro)
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });

    if (error) throw error;

    // Dedup por user_id: un usuario con ficha en varias empresas (p.ej. director
    // multiempresa) aparecería duplicado porque el filtro OR lo incluye por
    // empresa_id (su empresa principal) y por user_empresas (acceso secundario).
    // Damos prioridad a la ficha cuya empresa_id = empresaId activa.
    const porUser = new Map<string, typeof data[number]>();
    const sinUser: typeof data = [];
    for (const e of data ?? []) {
      const uid = e.user_id as string | null;
      if (!uid) {
        sinUser.push(e);
        continue;
      }
      const prev = porUser.get(uid);
      if (!prev) {
        porUser.set(uid, e);
        continue;
      }
      const prevPrincipal = prev.empresa_id === empresaId;
      const currPrincipal = e.empresa_id === empresaId;
      if (currPrincipal && !prevPrincipal) porUser.set(uid, e);
    }

    const rows: EmpleadoPagoRow[] = [...porUser.values(), ...sinUser].map((e) => {
      const deptoRel = e.departamentos as
        | { nombre?: string | null; area?: string | null }
        | Array<{ nombre?: string | null; area?: string | null }>
        | null;
      const deptoObj = Array.isArray(deptoRel) ? deptoRel[0] : deptoRel;
      const puesto = (e.puesto as string | null) ?? null;
      const area: EmpleadoArea =
        deptoObj?.area === "OPERATIVA" ? "operativa" : "administrativa";
      return {
        empleadoId: e.id as string,
        empleadoNombre: `${(e.nombre as string) ?? ""} ${(e.apellidos as string) ?? ""}`.trim(),
        puesto,
        area,
      };
    });
    rows.sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre, "es"));

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[rrhh] listEmpleadosParaPagos:", err);
    return { ok: false, data: [] };
  }
}

// ---------------------------------------------------------------------------
// Persistencia de pagos (tabla rrhh_pagos). periodo = 'YYYY-MM'.
// El TOTAL se guarda verbatim (cálculo de negocio propio), no se recomputa.
// ---------------------------------------------------------------------------

export interface PagoGuardado {
  empleadoId: string | null;
  empleadoNombre: string;
  fijo: boolean;
  pago: number;
  nomina: number;
  horasReales: number;
  horasTrabajadas: number;
  propina: number;
  ajuste: number;
  horasExtras: number;
  bonus: number;
  propinaMantenimiento: number;
  total: number;
  pagado: boolean;
}

type PagoDbRow = {
  empleado_id: string | null;
  empleado_nombre: string;
  fijo: boolean;
  pago: number | string;
  nomina: number | string;
  horas_reales: number | string;
  horas_trabajadas: number | string;
  propina: number | string;
  ajuste: number | string;
  horas_extras: number | string;
  bonus: number | string;
  propina_mes_anterior: number | string;
  total: number | string;
  pagado: boolean;
};

const PAGO_COLS =
  "empleado_id, empleado_nombre, fijo, pago, nomina, horas_reales, horas_trabajadas, propina, ajuste, horas_extras, bonus, propina_mes_anterior, total, pagado";

function dbToPago(r: PagoDbRow): PagoGuardado {
  return {
    empleadoId: r.empleado_id,
    empleadoNombre: r.empleado_nombre,
    fijo: r.fijo,
    pago: Number(r.pago),
    nomina: Number(r.nomina),
    horasReales: Number(r.horas_reales),
    horasTrabajadas: Number(r.horas_trabajadas),
    propina: Number(r.propina),
    ajuste: Number(r.ajuste),
    horasExtras: Number(r.horas_extras),
    bonus: Number(r.bonus),
    propinaMantenimiento: Number(r.propina_mes_anterior),
    total: Number(r.total),
    pagado: r.pagado,
  };
}

export async function loadPagos(
  periodo: string,
): Promise<{ ok: boolean; data: PagoGuardado[] }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("rrhh_pagos")
      .select(PAGO_COLS)
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => dbToPago(r as PagoDbRow)) };
  } catch (err) {
    console.error("[rrhh] loadPagos:", err);
    return { ok: false, data: [] };
  }
}

export async function savePago(
  periodo: string,
  row: PagoGuardado,
): Promise<{ ok: boolean }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !row.empleadoId) return { ok: false };
    const { error } = await supabase.from("rrhh_pagos").upsert(
      {
        empresa_id: empresaId,
        empleado_id: row.empleadoId,
        empleado_nombre: row.empleadoNombre,
        periodo,
        fijo: row.fijo,
        pago: row.pago,
        nomina: row.nomina,
        horas_reales: row.horasReales,
        horas_trabajadas: row.horasTrabajadas,
        propina: row.propina,
        ajuste: row.ajuste,
        horas_extras: row.horasExtras,
        bonus: row.bonus,
        propina_mes_anterior: row.propinaMantenimiento,
        total: row.total,
        pagado: row.pagado,
        created_by: userId,
      },
      { onConflict: "empresa_id,empleado_id,periodo" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] savePago:", err);
    return { ok: false };
  }
}
