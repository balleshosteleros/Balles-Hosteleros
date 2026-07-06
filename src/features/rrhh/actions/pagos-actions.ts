"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { getNotifLiquidacionesConfig } from "@/features/notificaciones/actions/notif-config-actions";
import { crearNotificaciones } from "@/features/notificaciones/actions/notificaciones-actions";

const MESES_PAGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function periodoLabel(periodo: string): string {
  const [y, m] = periodo.split("-");
  return `${MESES_PAGOS[Number(m) - 1] ?? ""} ${y}`.trim();
}
function fmtEur(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}

export type EmpleadoArea = "administrativa" | "operativa";

export interface EmpleadoPagoRow {
  empleadoId: string;
  empleadoNombre: string;
  dniNie: string | null; // para emparejar nóminas de forma inequívoca
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
      .select("id, nombre, apellidos, puesto, estado, user_id, empresa_id, dni_nie, departamentos(nombre, area)")
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
        dniNie: (e.dni_nie as string | null) ?? null,
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
  ssEmpleado: number;
  ssEmpresa: number;
  total: number;
  pagado: boolean;
  nominaPath: string | null;
  confirmacionEnviadaAt: string | null;
  confirmacionAceptadaAt: string | null;
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
  ss_empleado: number | string;
  ss_empresa: number | string;
  total: number | string;
  pagado: boolean;
  nomina_path: string | null;
  confirmacion_enviada_at: string | null;
  confirmacion_aceptada_at: string | null;
};

const PAGO_COLS =
  "empleado_id, empleado_nombre, fijo, pago, nomina, horas_reales, horas_trabajadas, propina, ajuste, horas_extras, bonus, propina_mes_anterior, ss_empleado, ss_empresa, total, pagado, nomina_path, confirmacion_enviada_at, confirmacion_aceptada_at";

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
    ssEmpleado: Number(r.ss_empleado),
    ssEmpresa: Number(r.ss_empresa),
    total: Number(r.total),
    pagado: r.pagado,
    nominaPath: r.nomina_path,
    confirmacionEnviadaAt: r.confirmacion_enviada_at,
    confirmacionAceptadaAt: r.confirmacion_aceptada_at,
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
): Promise<{ ok: boolean; locked?: boolean }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !row.empleadoId) return { ok: false };

    // Bloqueo: si la liquidacion ya fue enviada al empleado, no se edita
    // (hay que reabrirla primero). El trigger lo garantiza en BD; aqui evitamos
    // la llamada y damos feedback claro.
    const { data: existente } = await supabase
      .from("rrhh_pagos")
      .select("confirmacion_enviada_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", row.empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (existente?.confirmacion_enviada_at) return { ok: false, locked: true };

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
        ss_empleado: row.ssEmpleado,
        ss_empresa: row.ssEmpresa,
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

// ---------------------------------------------------------------------------
// Confirmaciones de liquidacion.
// Enviar = marcar confirmacion_enviada_at -> bloquea el pago y le aparece el
// pop-up al empleado en su app. Solo afecta a empleados con ficha (empleado_id).
// ---------------------------------------------------------------------------

export async function enviarConfirmacionesPago(
  periodo: string,
  empleadoIds: string[],
): Promise<{ ok: boolean; enviadosIds: string[] }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    const ids = empleadoIds.filter((id) => id && !id.startsWith("ext-"));
    if (!empresaId || ids.length === 0) return { ok: false, enviadosIds: [] };

    // Solo afecta a pagos YA guardados (no a empleados sin datos): si no hay fila
    // en rrhh_pagos no hay liquidación que enviar.
    const { data, error } = await supabase
      .from("rrhh_pagos")
      .update({
        confirmacion_enviada_at: new Date().toISOString(),
        confirmacion_enviada_por: userId,
      })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .in("empleado_id", ids)
      .is("confirmacion_enviada_at", null)
      .select(
        "id, empleado_id, empleado_nombre, pago, nomina, propina, ajuste, horas_extras, bonus, propina_mes_anterior, total",
      );
    if (error) throw error;
    const updated = data ?? [];
    const enviadosIds = updated.map((r) => r.empleado_id as string);

    // Notificar a cada empleado (si la empresa lo tiene activado).
    const cfg = await getNotifLiquidacionesConfig();
    if (cfg.activo && updated.length > 0) {
      const empIds = updated.map((r) => r.empleado_id as string).filter(Boolean);
      const { data: emps } = await supabase
        .from("empleados")
        .select("id, user_id")
        .in("id", empIds);
      const userByEmp = new Map((emps ?? []).map((e) => [e.id as string, e.user_id as string | null]));
      const label = periodoLabel(periodo);
      const rows = updated
        .map((r) => {
          const uid = userByEmp.get(r.empleado_id as string);
          if (!uid) return null;
          return {
            empleadoId: r.empleado_id as string,
            usuarioId: uid,
            tipo: "liquidacion",
            titulo: `Tu liquidación de ${label}`,
            mensaje: `Total: ${fmtEur(Number(r.total))}`,
            payload: {
              periodo,
              pago: Number(r.pago),
              nomina: Number(r.nomina),
              propina: Number(r.propina),
              ajuste: Number(r.ajuste),
              horasExtras: Number(r.horas_extras),
              bonus: Number(r.bonus),
              propinaMantenimiento: Number(r.propina_mes_anterior),
              total: Number(r.total),
              textoLiquidar: cfg.textoLiquidar,
              requiereAprobacion: cfg.requiereAprobacion,
            },
            accionLabel: cfg.requiereAprobacion ? "LIQUIDAR" : "Visto",
            requiereAccion: cfg.requiereAprobacion,
            refTabla: "rrhh_pagos",
            refId: r.id as string,
            accionUrl: "/m",
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (rows.length > 0) await crearNotificaciones(rows);
    }

    return { ok: true, enviadosIds };
  } catch (err) {
    console.error("[rrhh] enviarConfirmacionesPago:", err);
    return { ok: false, enviadosIds: [] };
  }
}

// Marca/quita el flag `pagado` (botón Pagar/Pagado de RRHH). Si la empresa exige
// aprobación, solo deja marcar pagado cuando el empleado ya aprobó (tick). Si
// está activado, al marcar pagado notifica al empleado.
export async function marcarPagado(
  periodo: string,
  empleadoId: string,
  pagado: boolean,
): Promise<{ ok: boolean; requiereAprobacion?: boolean }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId || empleadoId.startsWith("ext-")) return { ok: false };
    const cfg = await getNotifLiquidacionesConfig();

    const { data: row } = await supabase
      .from("rrhh_pagos")
      .select("id, total, confirmacion_aceptada_at")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .eq("empleado_id", empleadoId)
      .maybeSingle();
    if (!row) return { ok: false };

    if (pagado && cfg.requiereAprobacion && !row.confirmacion_aceptada_at) {
      return { ok: false, requiereAprobacion: true };
    }

    const { error } = await supabase
      .from("rrhh_pagos")
      .update({ pagado })
      .eq("id", row.id as string);
    if (error) throw error;

    if (pagado && cfg.pagadoActivo) {
      const { data: emp } = await supabase
        .from("empleados")
        .select("user_id")
        .eq("id", empleadoId)
        .maybeSingle();
      const uid = emp?.user_id as string | null;
      if (uid) {
        const label = periodoLabel(periodo);
        await crearNotificaciones([
          {
            empleadoId,
            usuarioId: uid,
            tipo: "liquidacion_pagada",
            titulo: `Liquidación pagada — ${label}`,
            mensaje: `Tu liquidación de ${label} (${fmtEur(Number(row.total))}) ha sido abonada.`,
            payload: { periodo, total: Number(row.total) },
            accionLabel: "Visto",
            requiereAccion: false,
            refTabla: "rrhh_pagos",
            refId: row.id as string,
            accionUrl: "/m",
          },
        ]);
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] marcarPagado:", err);
    return { ok: false };
  }
}

// Reabrir = anular el envio para corregir y reenviar. Solo director.
export async function reabrirConfirmacionPago(
  periodo: string,
  empleadoId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { esDirector } = await getRolContext();
    if (!esDirector) return { ok: false, error: "Solo un director puede reabrir una liquidación." };

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId || empleadoId.startsWith("ext-")) return { ok: false };

    // El trigger limpia aceptada_at y enviada_por al poner enviada_at = null.
    const { error } = await supabase
      .from("rrhh_pagos")
      .update({ confirmacion_enviada_at: null })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .eq("empleado_id", empleadoId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] reabrirConfirmacionPago:", err);
    return { ok: false, error: "No se pudo reabrir la liquidación." };
  }
}

export async function puedeReabrirPagos(): Promise<boolean> {
  try {
    const { esDirector } = await getRolContext();
    return esDirector;
  } catch {
    return false;
  }
}
