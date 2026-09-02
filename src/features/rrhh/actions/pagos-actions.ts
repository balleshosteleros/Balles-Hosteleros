"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { getNotifLiquidacionesConfig } from "@/features/notificaciones/actions/notif-config-actions";
import { crearNotificaciones } from "@/features/notificaciones/actions/notificaciones-actions";
import {
  enviarCorreoConfirmacionLiquidacion,
  type LiquidacionDetalle,
} from "@/features/rrhh/services/nominas/rrhh-pagos-confirmacion";
import { nombreMes } from "@/features/rrhh/services/nominas/nominas-gestoria";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import type { DetalleNomina } from "@/features/rrhh/data/pagos";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { capitalizeText } from "@/shared/lib/utils";

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

export async function listEmpleadosParaPagos(): Promise<{ ok: boolean; data: EmpleadoPagoRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    // Sin empresa resuelta lo normal es que la sesión haya caducado. Se dice
    // con todas las letras: antes se devolvía `ok:false` a secas y la pantalla
    // se quedaba en blanco sin que el usuario pudiera saber por qué.
    if (!empresaId) {
      return { ok: false, data: [], error: "SESION_CADUCADA" };
    }

    // AISLAMIENTO ESTRICTO POR EMPRESA. Solo fichas cuya empresa_id es la activa.
    //
    // Antes esto era un .or() que además traía cualquier ficha cuyo user_id
    // tuviera acceso a la empresa activa (vía usuario_empresas). Esa segunda rama
    // NO llevaba filtro de empresa, así que a un usuario multiempresa (p.ej. RRHH
    // con acceso a las dos) se le colaban las fichas de la OTRA empresa en la
    // pantalla de pagos: veía nóminas, DNI e IRPF de gente que no era de la
    // empresa que tenía activa.
    //
    // Ojo: la RLS de `empleados` autoriza todas las empresas del usuario (por
    // diseño, es multiempresa), así que NO corta esta fuga. El aislamiento por
    // empresa activa lo hace este filtro y solo este filtro: no lo relajes.
    const { data, error } = await supabase
      .from("empleados")
      // El puesto REAL vive en `empleado_puestos` (M:N, uno principal).
      // `empleados.puesto` es texto legacy: está vacío en varias fichas y puede
      // estar desfasado, así que solo se usa de respaldo.
      .select(
        "id, nombre, apellidos, puesto, estado, user_id, empresa_id, dni_nie, departamentos!empleados_departamento_id_fkey(nombre, area), empleado_puestos(es_principal, puestos(nombre))",
      )
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });

    if (error) throw error;

    // Sin dedup por user_id: con el filtro por empresa_id cada empleado aparece
    // como mucho una vez (una ficha por empresa). El dedup anterior solo existía
    // para limpiar los duplicados que creaba la rama user_id ya retirada.
    const rows: EmpleadoPagoRow[] = (data ?? []).map((e) => {
      const deptoRel = e.departamentos as
        | { nombre?: string | null; area?: string | null }
        | Array<{ nombre?: string | null; area?: string | null }>
        | null;
      const deptoObj = Array.isArray(deptoRel) ? deptoRel[0] : deptoRel;

      // UN solo puesto por empleado: el principal de `empleado_puestos`. Si no
      // hubiera principal marcado se coge el primero, y como último recurso el
      // texto legacy de la ficha.
      const vinculos = (e.empleado_puestos ?? []) as Array<{
        es_principal?: boolean | null;
        puestos?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null;
      }>;
      const nombreDeVinculo = (v: (typeof vinculos)[number]): string | null => {
        const rel = v.puestos;
        const obj = Array.isArray(rel) ? rel[0] : rel;
        return obj?.nombre?.trim() || null;
      };
      const principal = vinculos.find((v) => v.es_principal);
      const puesto =
        (principal ? nombreDeVinculo(principal) : null) ??
        vinculos.map(nombreDeVinculo).find((n) => n) ??
        ((e.puesto as string | null)?.trim() || null);
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
    return { ok: false, data: [], error: friendlyError(err, "nombreDeVinculo") };
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
  nomina: number;
  horasReales: number;
  horasTrabajadas: number;
  complemento: number;
  ajuste: number;
  horasExtras: number;
  bonus: number;
  ssEmpleado: number;
  ssEmpresa: number;
  irpf: number;
  total: number;
  pagado: boolean;
  comentario: string | null;
  nominaPath: string | null;
  numNominas: number; // nº de nóminas individuales de ese empleado/mes (para el badge)
  // Las nóminas individuales del mes (ordenadas). Cuando hay 2+, permite abrir el
  // desglose de CADA columna y ver qué aporta cada una a la suma. Solo LECTURA: se
  // deriva de `rrhh_pagos_nominas`, no se guarda en `rrhh_pagos`.
  detalleNominas?: DetalleNomina[];
  // true si ALGUNA de sus nóminas del mes se subió cuando el empleado YA estaba
  // Inactivo: se pinta un aviso para revisar si de verdad le corresponde cobrar.
  // No se marca si la baja se produjo DESPUÉS de subir la nómina.
  avisoInactivo: boolean;
  confirmacionEnviadaAt: string | null;
  confirmacionAceptadaAt: string | null;
}

type PagoDbRow = {
  empleado_id: string | null;
  empleado_nombre: string;
  fijo: boolean;
  nomina: number | string;
  horas_reales: number | string;
  horas_trabajadas: number | string;
  complemento: number | string;
  ajuste: number | string;
  horas_extras: number | string;
  bonus: number | string;
  ss_empleado: number | string;
  ss_empresa: number | string;
  irpf: number | string;
  total: number | string;
  pagado: boolean;
  comentario: string | null;
  nomina_path: string | null;
  confirmacion_enviada_at: string | null;
  confirmacion_aceptada_at: string | null;
};

const PAGO_COLS =
  "empleado_id, empleado_nombre, fijo, nomina, horas_reales, horas_trabajadas, complemento, ajuste, horas_extras, bonus, ss_empleado, ss_empresa, irpf, total, pagado, comentario, nomina_path, confirmacion_enviada_at, confirmacion_aceptada_at";

function dbToPago(r: PagoDbRow): PagoGuardado {
  return {
    empleadoId: r.empleado_id,
    empleadoNombre: r.empleado_nombre,
    fijo: r.fijo,
    nomina: Number(r.nomina),
    horasReales: Number(r.horas_reales),
    horasTrabajadas: Number(r.horas_trabajadas),
    complemento: Number(r.complemento),
    ajuste: Number(r.ajuste),
    horasExtras: Number(r.horas_extras),
    bonus: Number(r.bonus),
    ssEmpleado: Number(r.ss_empleado),
    ssEmpresa: Number(r.ss_empresa),
    irpf: Number(r.irpf),
    total: Number(r.total),
    pagado: r.pagado,
    comentario: r.comentario ?? null,
    nominaPath: r.nomina_path,
    numNominas: 0,
    avisoInactivo: false,
    confirmacionEnviadaAt: r.confirmacion_enviada_at,
    confirmacionAceptadaAt: r.confirmacion_aceptada_at,
  };
}

export async function loadPagos(
  periodo: string,
): Promise<{ ok: boolean; data: PagoGuardado[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };
    const [{ data, error }, { data: nominas }] = await Promise.all([
      supabase.from("rrhh_pagos").select(PAGO_COLS).eq("empresa_id", empresaId).eq("periodo", periodo),
      // Nóminas individuales del mes: sirven para el badge "2","3"…, para el
      // desglose al pulsarlo (qué aporta cada nómina a cada columna) y para el
      // sello de "ya estaba de baja al subirla" (aviso de revisión).
      supabase
        .from("rrhh_pagos_nominas")
        .select("empleado_id, empleado_inactivo_al_subir, orden, neto, ss_empleado, ss_empresa, irpf, incidencia")
        .eq("empresa_id", empresaId)
        .eq("periodo", periodo)
        .neq("revision_estado", "denegada")
        .order("orden", { ascending: true }),
    ]);
    if (error) throw error;
    // Desglose por empleado: sus nóminas individuales (en orden) y si ALGUNA se
    // subió estando ya de baja.
    const porEmpleado = new Map<string, DetalleNomina[]>();
    const inactivoAlSubir = new Set<string>();
    for (const r of nominas ?? []) {
      const id = r.empleado_id as string;
      const lista = porEmpleado.get(id) ?? [];
      lista.push({
        orden: Number(r.orden ?? 0),
        neto: Number(r.neto ?? 0),
        ssEmpleado: Number(r.ss_empleado ?? 0),
        ssEmpresa: Number(r.ss_empresa ?? 0),
        irpf: Number(r.irpf ?? 0),
        incidencia: (r.incidencia as string | null) ?? null,
      });
      porEmpleado.set(id, lista);
      if (r.empleado_inactivo_al_subir === true) inactivoAlSubir.add(id);
    }
    const filas = (data ?? []).map((r) => {
      const p = dbToPago(r as PagoDbRow);
      const detalle = p.empleadoId ? porEmpleado.get(p.empleadoId) ?? [] : [];
      p.numNominas = detalle.length;
      p.detalleNominas = detalle;
      p.avisoInactivo = p.empleadoId ? inactivoAlSubir.has(p.empleadoId) : false;
      return p;
    });
    return { ok: true, data: filas };
  } catch (err) {
    console.error("[rrhh] loadPagos:", err);
    return { ok: false, data: [], error: friendlyError(err, "filas") };
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
        nomina: row.nomina,
        horas_reales: row.horasReales,
        horas_trabajadas: row.horasTrabajadas,
        complemento: row.complemento,
        ajuste: row.ajuste,
        horas_extras: row.horasExtras,
        bonus: row.bonus,
        ss_empleado: row.ssEmpleado,
        ss_empresa: row.ssEmpresa,
        irpf: row.irpf,
        total: row.total,
        pagado: row.pagado,
        comentario: row.comentario?.trim() ? capitalizeText(row.comentario.trim()) : null,
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
        "id, empleado_id, empleado_nombre, fijo, nomina, complemento, ajuste, horas_extras, bonus, ss_empleado, ss_empresa, irpf, total",
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
            mensaje: "",
            payload: {
              periodo,
                        nomina: Number(r.nomina),
              complemento: Number(r.complemento),
              ajuste: Number(r.ajuste),
              horasExtras: Number(r.horas_extras),
              bonus: Number(r.bonus),
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

    // Correo al empleado con el detalle + enlace de confirmación (best-effort).
    // Va por service-role: crea el token (hash-only) y manda el correo a
    // email_empresa (o personal). No rompe el flujo si falta correo o SMTP.
    if (updated.length > 0) {
      try {
        const admin = createAdminClient();
        const { data: emp } = await admin
          .from("empresas")
          .select("nombre")
          .eq("id", empresaId)
          .maybeSingle();
        const empresaNombre = (emp?.nombre as string) ?? "la empresa";
        const mesLabel = nombreMes(periodo);
        await Promise.all(
          updated.map((r) => {
            const detalle: LiquidacionDetalle = {
              empleadoNombre: r.empleado_nombre as string,
              periodo,
              mesLabel,
              empresaNombre,
              fijo: Boolean(r.fijo),
                        nomina: Number(r.nomina),
              complemento: Number(r.complemento),
              ajuste: Number(r.ajuste),
              horasExtras: Number(r.horas_extras),
              bonus: Number(r.bonus),
                        ssEmpleado: Number(r.ss_empleado),
              ssEmpresa: Number(r.ss_empresa),
              irpf: Number(r.irpf),
              total: Number(r.total),
              confirmadoEn: null,
              marcaUrl: null,
            };
            return enviarCorreoConfirmacionLiquidacion(admin, {
              empresaId,
              empleadoId: r.empleado_id as string,
              periodo,
              pagoId: r.id as string,
              detalle,
            }).catch((e) => {
              console.error("[rrhh] correo liquidación:", e);
              return { ok: false as const };
            });
          }),
        );
      } catch (e) {
        console.error("[rrhh] enviarConfirmacionesPago correos:", e);
      }
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
    const { supabase, empresaId, userId } = await getAppContext();
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

    // Al marcar pagado fechamos el abono (histórico del empleado); al desmarcar
    // limpiamos la fecha para que no quede un "abonado el X" fantasma.
    //
    // El update se condiciona al estado CONTRARIO (`.eq("pagado", !pagado)`): así
    // dos clics seguidos (o dos pestañas) no lo ejecutan dos veces. Antes el
    // segundo pisaba `pagado_at` con la fecha del reintento y —peor— enviaba al
    // empleado un SEGUNDO aviso de "liquidación pagada".
    const { data: cambiadas, error } = await supabase
      .from("rrhh_pagos")
      .update({
        pagado,
        pagado_at: pagado ? new Date().toISOString() : null,
        pagado_por: pagado ? (userId ?? null) : null,
      })
      .eq("id", row.id as string)
      .eq("pagado", !pagado)
      .select("id");
    if (error) throw error;

    // Ya estaba en ese estado: nada que hacer y, sobre todo, NO se re-notifica.
    if (!cambiadas || cambiadas.length === 0) return { ok: true };

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
    const { permisos } = await getRolContext();
    if (!puedeEditarModulo(permisos, "RECURSOS HUMANOS")) {
      return { ok: false, error: "Sin permisos: necesitas Recursos Humanos para reabrir una liquidación." };
    }

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
    const { permisos } = await getRolContext();
    return puedeEditarModulo(permisos, "RECURSOS HUMANOS");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Histórico de pagos abonados de UN empleado
// ---------------------------------------------------------------------------
// Solo pagos ya abonados (pagado = true): es el histórico de "dinero recibido".
// Cada fila trae el periodo, el neto percibido, el desglose y la fecha de abono.

export interface PagoAbonado {
  id: string;
  periodo: string;      // 'YYYY-MM'
  periodoLabel: string; // 'junio 2026'
  total: number;        // neto a percibir (lo que recibe)
  nomina: number;       // nómina neta
  ssEmpleado: number;   // cotización a cargo del TRABAJADOR (se le descuenta)
  ssEmpresa: number;    // cotización a cargo de la EMPRESA (no se le descuenta)
  irpf: number;
  complemento: number;
  horasExtras: number;
  bonus: number;
  ajuste: number;
  pagadoAt: string | null;      // ISO del abono
  pagadoAtLabel: string | null; // 'dd/mm/aaaa' en zona de la empresa
  nominaPath: string | null;
}

const PAGO_ABONADO_COLS =
  "id, periodo, total, nomina, ss_empleado, ss_empresa, irpf, complemento, " +
  "horas_extras, bonus, ajuste, pagado_at, nomina_path";

function bdToPagoAbonado(r: Record<string, unknown>, tz: string): PagoAbonado {
  const periodo = String(r.periodo);
  const pagadoAt = (r.pagado_at as string) ?? null;
  return {
    id: String(r.id),
    periodo,
    periodoLabel: periodoLabel(periodo),
    total: Number(r.total),
    nomina: Number(r.nomina),
    ssEmpleado: Number(r.ss_empleado),
    ssEmpresa: Number(r.ss_empresa),
    irpf: Number(r.irpf),
    complemento: Number(r.complemento),
    horasExtras: Number(r.horas_extras),
    bonus: Number(r.bonus),
    ajuste: Number(r.ajuste),
    pagadoAt,
    pagadoAtLabel: pagadoAt ? formatFechaEnZona(pagadoAt, tz) : null,
    nominaPath: (r.nomina_path as string) ?? null,
  };
}

// Histórico para la FICHA de RRHH (empleado concreto, empresa activa).
export async function listPagosAbonadosEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: PagoAbonado[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId) return { ok: false, data: [] };
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);

    const { data, error } = await supabase
      .from("rrhh_pagos")
      .select(PAGO_ABONADO_COLS)
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("pagado", true)
      .order("periodo", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => bdToPagoAbonado(r as unknown as Record<string, unknown>, tz)) };
  } catch (err) {
    console.error("[rrhh] listPagosAbonadosEmpleado:", err);
    return { ok: false, data: [], error: friendlyError(err, "listPagosAbonadosEmpleado") };
  }
}

// Histórico para el PORTAL del empleado logueado (sus fichas, empresa activa).
// Cada nómina está aislada por empresa: la RLS de rrhh_pagos y el filtro por
// empresa_id garantizan que solo vea los pagos de la empresa activa.
export async function listMisPagosAbonados(): Promise<{ ok: boolean; data: PagoAbonado[]; error?: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, data: [] };
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);

    const { data: fichas } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId);
    const fichaIds = (fichas ?? []).map((f) => f.id as string);
    if (fichaIds.length === 0) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("rrhh_pagos")
      .select(PAGO_ABONADO_COLS)
      .eq("empresa_id", empresaId)
      .in("empleado_id", fichaIds)
      .eq("pagado", true)
      .order("periodo", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => bdToPagoAbonado(r as unknown as Record<string, unknown>, tz)) };
  } catch (err) {
    console.error("[rrhh] listMisPagosAbonados:", err);
    return { ok: false, data: [], error: friendlyError(err, "fichaIds") };
  }
}

// Las horas del mes por empleado (teóricas vs fichadas normales/extras) viven en
// la acción compartida `@/features/rrhh/actions/horas-actions` (loadHorasMes),
// para que Pagos, Horarios y el panel del trabajador usen el MISMO dato.

/**
 * Pagos de VARIOS meses agregados por empleado (vistas trimestral y anual).
 *
 * Suma todos los importes de cada trabajador en el rango. Aparecen TODOS los que
 * cobraron algún mes del periodo, aunque solo fuera uno: quien trabajó en marzo y
 * se fue sale igual, con lo suyo de marzo. Así el total del rango cuadra con lo
 * realmente pagado, sin depender de quién siga de alta hoy.
 *
 * Los campos que no tienen sentido sumar (estado de pago, confirmaciones, ruta
 * del documento) se devuelven neutros: en agregado no representan nada.
 */
export async function loadPagosRango(
  periodos: string[],
): Promise<{ ok: boolean; data: PagoGuardado[]; meses: number; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || periodos.length === 0) return { ok: false, data: [], meses: 0 };

    const { data, error } = await supabase
      .from("rrhh_pagos")
      .select(PAGO_COLS)
      .eq("empresa_id", empresaId)
      .in("periodo", periodos);
    if (error) throw error;

    // Agregación por trabajador. Los sueltos (ex-empleados sin ficha) se agrupan
    // por su nombre, que es lo único que los identifica.
    const acc = new Map<string, PagoGuardado>();
    for (const row of data ?? []) {
      const p = dbToPago(row as PagoDbRow);
      const clave = p.empleadoId ?? `ext:${p.empleadoNombre}`;
      const prev = acc.get(clave);
      if (!prev) {
        acc.set(clave, {
          ...p,
          // En agregado no aplican: son estados de UN mes concreto.
          pagado: false,
          comentario: null,
          nominaPath: null,
          numNominas: 0,
          avisoInactivo: false,
          confirmacionEnviadaAt: null,
          confirmacionAceptadaAt: null,
        });
        continue;
      }
      prev.nomina += p.nomina;
      prev.horasReales += p.horasReales;
      prev.horasTrabajadas += p.horasTrabajadas;
      prev.complemento += p.complemento;
      prev.ajuste += p.ajuste;
      prev.horasExtras += p.horasExtras;
      prev.bonus += p.bonus;
      prev.ssEmpleado += p.ssEmpleado;
      prev.ssEmpresa += p.ssEmpresa;
      prev.irpf += p.irpf;
      prev.total += p.total;
    }

    // Redondeo a céntimos AL FINAL (no en cada suma: acumularía el error).
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const filas = [...acc.values()].map((p) => ({
      ...p,
      nomina: r2(p.nomina), complemento: r2(p.complemento),
      ajuste: r2(p.ajuste), horasExtras: r2(p.horasExtras), bonus: r2(p.bonus),
      ssEmpleado: r2(p.ssEmpleado), ssEmpresa: r2(p.ssEmpresa), irpf: r2(p.irpf),
      total: r2(p.total),
      horasReales: r2(p.horasReales), horasTrabajadas: r2(p.horasTrabajadas),
    }));

    return { ok: true, data: filas, meses: periodos.length };
  } catch (err) {
    console.error("[rrhh] loadPagosRango:", err);
    return { ok: false, data: [], meses: 0 };
  }
}
