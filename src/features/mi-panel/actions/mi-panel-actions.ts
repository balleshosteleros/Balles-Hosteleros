"use server";

import { createClient } from "@/lib/supabase/server";
import { distanciaMetros } from "@/features/rrhh/utils/geo";
import { sendEmail } from "@/lib/email/send";
import { bajaContratoRecibidaEmail } from "@/lib/email/templates/baja-contrato-recibida";
import { crearFirmaInterno } from "@/features/rrhh/services/firmas/crear-firma";
import { generarCartaBajaVoluntariaPDF } from "@/features/rrhh/services/firmas/baja-voluntaria-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DiaCalendario,
  MiFichajeHoy,
  SolicitudEstado,
  SolicitudPersonal,
  SolicitudSubtipo,
  SolicitudTipo,
  SolicitudSubtipoAusencia,
  SolicitudSubtipoTrabajo,
} from "@/features/mi-panel/types";
import {
  calcularNivel,
  getMiBalance,
  getNiveles,
} from "@/features/toques/services/toques.service";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";
import { getZonaHorariaEmpresa, ZONA_HORARIA_DEFAULT } from "@/features/empresa/lib/empresa-server";
import { minutosDiaEnZona, ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { bloqueoSolapaRango } from "@/features/rrhh/data/calendarios-vacaciones";
import {
  getHorarioDia,
  semanaDeFecha,
  hhmmAMinutos,
  minutosAHHMM,
} from "@/features/rrhh/utils/horario-empleado";
import {
  resolverCandidatosPorGeo,
  getHorariosDiaUnificado,
  getMisLocales,
  planificarReparto,
  type TramoEmpresaMin,
} from "@/features/mi-panel/utils/fichaje-multiempresa";

function extractErrorMessage(err: unknown): string {
  if (!err) return "Error desconocido";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint, e.code ? `[${e.code}]` : null].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Error desconocido";
  }
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      empresaId: null,
      nombre: null,
      departamento: null,
      rolLabel: null,
    };
  }
  const { data } = await supabase
    .from("usuarios")
    .select("empresa_id, nombre, apellidos, departamento, rol_label")
    .eq("user_id", user.id)
    .single();
  const nombreCompleto = data
    ? `${data.nombre ?? ""} ${data.apellidos ?? ""}`.trim()
    : "";
  const fallbackEmail = user.email?.split("@")[0] ?? "";

  let empresaId = await getEmpresaActivaId();
  if (!empresaId) {
    const { data: link } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    empresaId =
      (link?.empresa_id as string | undefined) ??
      (data?.empresa_id as string | undefined) ??
      null;
  }

  return {
    supabase,
    user,
    empresaId,
    nombre: nombreCompleto || fallbackEmail || null,
    departamento: (data?.departamento as string | undefined) ?? null,
    rolLabel: (data?.rol_label as string | undefined) ?? null,
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

type GeoInput = { lat: number; lng: number; precision: number } | null;

function monthBounds(anio: number, mes: number) {
  const start = new Date(Date.UTC(anio, mes - 1, 1));
  const end = new Date(Date.UTC(anio, mes, 1));
  return {
    desde: start.toISOString().split("T")[0],
    hasta: end.toISOString().split("T")[0],
  };
}

// ─── FICHAJE ─────────────────────────────────────────────────

// Cierra automáticamente fichajes abiertos de días pasados conservando la
// incidencia en su campo propio. La tabla no admite un estado "incidencia".
// Se ejecuta solo después de las 8:00 (hora local del servidor)
// para no interrumpir turnos de noche en curso.
async function autoCerrarFichajesHuerfanos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string | null,
  empleadoId: string,
): Promise<void> {
  const now = new Date();
  if (now.getHours() < 8) return;
  try {
    // Multi-empresa: si `empresaId` es null se cierran los huérfanos del
    // empleado en TODAS sus empresas (RLS limita a las suyas). Si se pasa una
    // empresa concreta, solo esa.
    let q = supabase
      .from("fichajes")
      .update({
        estado: "completado",
        hora_salida: now.toISOString(),
        incidencia: "Fichaje sin cierre — pendiente de revisión",
      })
      .eq("empleado_id", empleadoId)
      .lt("fecha", todayISO())
      .is("hora_salida", null)
      .in("estado", ["trabajando", "pausa"]);
    if (empresaId) q = q.eq("empresa_id", empresaId);
    await q;
  } catch (err: unknown) {
    console.error("[mi-panel] autoCerrarFichajesHuerfanos:", extractErrorMessage(err));
  }
}

// Horas trabajadas por el empleado en el periodo (día o semana ISO según el
// turno flexible), sumando los fichajes completados y el tiempo en curso de los
// abiertos. Base del objetivo flexible: autocierre y bloqueo de re-fichaje.
async function horasTrabajadasPeriodo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  empleadoUserId: string,
  fechaISO: string,
  modo: "diario" | "semanal",
  excluirFichajeId?: string,
): Promise<number> {
  let q = supabase
    .from("fichajes")
    .select("id, hora_entrada, hora_salida, horas_totales")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoUserId);
  if (modo === "semanal") {
    const { lunes, domingo } = semanaDeFecha(fechaISO);
    q = q.gte("fecha", lunes).lte("fecha", domingo);
  } else {
    q = q.eq("fecha", fechaISO);
  }
  const { data } = await q;
  const now = Date.now();
  let total = 0;
  for (const f of data ?? []) {
    if (excluirFichajeId && (f.id as string) === excluirFichajeId) continue;
    if (f.hora_salida) {
      total += Number(f.horas_totales ?? 0);
    } else if (f.hora_entrada) {
      total += Math.max(
        0,
        (now - new Date(f.hora_entrada as string).getTime()) / 3600000,
      );
    }
  }
  return total;
}

function fmtHorasObjetivo(h: number): string {
  return `${Math.round(h * 100) / 100} h`;
}

export async function getMiFichajeHoy(): Promise<{
  ok: boolean;
  data: MiFichajeHoy | null;
  error?: string;
}> {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, data: null, error: "No autenticado" };
    // Agnóstico de empresa: cierra huérfanos y busca el fichaje de hoy del
    // empleado en CUALQUIERA de sus empresas (no la de la cookie), para que el
    // botón de salida aparezca aunque la empresa activa sea otra.
    await autoCerrarFichajesHuerfanos(supabase, null, user.id);
    const { data, error } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empleado_id", user.id)
      .eq("fecha", todayISO())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };
    // La empresa relevante es la del propio fichaje, no la cookie.
    const empresaId = data.empresa_id as string;

    // ─── Jornada flexible: objetivo de horas + autocierre ──────────────────
    // Si el empleado tiene hoy un turno flexible y su fichaje abierto ya
    // alcanzó las horas que le quedaban del periodo (día o semana), se cierra
    // automáticamente cuando se consulta el fichaje (red de seguridad servidor).
    let registro: Record<string, unknown> = data;
    let flexible = false;
    let flexModo: "diario" | "semanal" | null = null;
    let flexObjetivoHoras: number | null = null;
    let flexRestanteHoras: number | null = null;

    const fechaRef = data.fecha as string;
    const { data: empRow } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (empRow?.id) {
      const horario = await getHorarioDia(
        supabase,
        empresaId,
        empRow.id as string,
        fechaRef,
      );
      if (horario.tipo === "flexible" && horario.objetivoHoras > 0) {
        flexible = true;
        flexModo = horario.modo;
        flexObjetivoHoras = horario.objetivoHoras;

        const abierto =
          !data.hora_salida &&
          (data.estado === "trabajando" || data.estado === "pausa");
        const consumidoOtros = await horasTrabajadasPeriodo(
          supabase,
          empresaId,
          user.id,
          fechaRef,
          horario.modo,
          abierto ? (data.id as string) : undefined,
        );
        let restante = Math.max(0, horario.objetivoHoras - consumidoOtros);

        if (abierto && data.hora_entrada) {
          const entradaMs = new Date(data.hora_entrada as string).getTime();
          const elapsed = (Date.now() - entradaMs) / 3600000;
          if (elapsed >= restante - 1 / 3600) {
            // Cierre automático capando las horas a las que quedaban.
            const horas = Math.round(restante * 10000) / 10000;
            const salidaISO = new Date(entradaMs + restante * 3600000).toISOString();
            const incidencia =
              (data.incidencia as string | null) ??
              "Cierre automático: objetivo de horas flexible alcanzado";
            await supabase
              .from("fichajes")
              .update({
                hora_salida: salidaISO,
                horas_totales: horas,
                estado: "completado",
                incidencia,
              })
              .eq("id", data.id as string);
            registro = {
              ...data,
              hora_salida: salidaISO,
              horas_totales: horas,
              estado: "completado",
              incidencia,
            };
            restante = 0;
          }
        }
        flexRestanteHoras = restante;
      }
    }

    return {
      ok: true,
      data: {
        id: registro.id as string,
        fecha: registro.fecha as string,
        horaEntrada: (registro.hora_entrada as string | null) ?? null,
        horaSalida: (registro.hora_salida as string | null) ?? null,
        pausaInicio: (registro.pausa_inicio as string | null) ?? null,
        pausaFin: (registro.pausa_fin as string | null) ?? null,
        horasTotales: (registro.horas_totales as number | null) ?? 0,
        estado: (registro.estado as string | null) ?? "pendiente",
        incidencia: (registro.incidencia as string | null) ?? null,
        modoTeletrabajo: Boolean(registro.modo_teletrabajo),
        local: (registro.centro as string | null) ?? null,
        flexible,
        flexModo,
        flexObjetivoHoras,
        flexRestanteHoras,
        zonaHoraria: await getZonaHorariaEmpresa(supabase, empresaId),
      },
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiFichajeHoy:", msg);
    return { ok: false, data: null, error: msg };
  }
}

/**
 * Ventana horaria de fichaje del empleado para HOY.
 *
 * Resuelve el horario del día (motor `getHorarioDia`) y devuelve, en minutos del
 * día (0–1439), la hora de ENTRADA prevista (inicio del primer tramo) y la de
 * SALIDA prevista (fin del último tramo). El móvil usa esto para mostrar el
 * pop-up de fichar solo dentro de ±N minutos de esas horas.
 *
 * `tieneHorario` es true únicamente cuando hoy hay un horario FIJO con tramos.
 * Para jornada flexible o sin horario no existe "hora de fichaje" que vigilar.
 */
export interface VentanaFichajeHoy {
  ok: boolean;
  tieneHorario: boolean;
  entradaMin: number | null;
  salidaMin: number | null;
  cruzaMedianoche: boolean;
  /** Config del aviso (pop-up) de fichar — Ajustes RRHH → Fichajes. */
  popupMargenAntesMin: number;
  popupMargenDespuesMin: number;
  avisoSonido: boolean;
  avisoVibracion: boolean;
  reavisoActivo: boolean;
  reavisoIntervaloMin: number;
  /**
   * Zona horaria de la empresa cuyo turno marca la ventana, para que el móvil
   * calcule el "ahora" en la misma zona que entradaMin/salidaMin (PRP-069).
   */
  zonaHoraria: string;
  error?: string;
}

/** Config del pop-up de fichar para una empresa (defaults = comportamiento actual). */
async function leerPopupConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string | null,
): Promise<{
  popupMargenAntesMin: number;
  popupMargenDespuesMin: number;
  avisoSonido: boolean;
  avisoVibracion: boolean;
  reavisoActivo: boolean;
  reavisoIntervaloMin: number;
}> {
  const def = {
    popupMargenAntesMin: 15,
    popupMargenDespuesMin: 15,
    avisoSonido: false,
    avisoVibracion: false,
    reavisoActivo: false,
    reavisoIntervaloMin: 5,
  };
  if (!empresaId) return def;
  const { data: cfg } = await supabase
    .from("empresa_fichajes_config")
    .select(
      "popup_margen_antes_min, popup_margen_despues_min, aviso_sonido, aviso_vibracion, reaviso_activo, reaviso_intervalo_min",
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return {
    popupMargenAntesMin: (cfg?.popup_margen_antes_min as number | null) ?? 15,
    popupMargenDespuesMin: (cfg?.popup_margen_despues_min as number | null) ?? 15,
    avisoSonido: !!cfg?.aviso_sonido,
    avisoVibracion: !!cfg?.aviso_vibracion,
    reavisoActivo: !!cfg?.reaviso_activo,
    reavisoIntervaloMin: (cfg?.reaviso_intervalo_min as number | null) ?? 5,
  };
}

export async function getMiVentanaFichajeHoy(): Promise<VentanaFichajeHoy> {
  const base = {
    tieneHorario: false,
    entradaMin: null as number | null,
    salidaMin: null as number | null,
    cruzaMedianoche: false,
    popupMargenAntesMin: 15,
    popupMargenDespuesMin: 15,
    avisoSonido: false,
    avisoVibracion: false,
    reavisoActivo: false,
    reavisoIntervaloMin: 5,
    zonaHoraria: ZONA_HORARIA_DEFAULT,
  };
  try {
    const { supabase, user, empresaId: cookieEmpresaId } = await getContext();
    if (!user) return { ok: false, ...base, error: "No autenticado" };

    // Ventana UNIFICADA: combina los turnos FIJOS de hoy de TODAS sus empresas
    // (p.ej. mañana en una empresa + noche en otra). El pop-up es un aviso; la
    // ventana dura de fichaje la valida el server en `ficharEntradaPersonal`.
    const horarios = await getHorariosDiaUnificado(supabase, user.id, todayISO());

    const fijos: { empresaId: string; entradaMin: number; salidaMin: number }[] = [];
    for (const h of horarios) {
      if (h.horario.tipo !== "fijo") continue;
      for (const tr of h.horario.tramos) {
        const e = hhmmAMinutos(tr.inicio);
        const s = hhmmAMinutos(tr.fin);
        if (e == null || s == null) continue;
        fijos.push({ empresaId: h.empresaId, entradaMin: e, salidaMin: s });
      }
    }

    // Empresa para la config del pop-up: la del tramo más temprano; si no hay
    // tramos fijos, la empresa activa (cookie) o la primera con horario.
    const empresaPopup =
      fijos.length > 0
        ? fijos.reduce((a, b) => (b.entradaMin < a.entradaMin ? b : a)).empresaId
        : cookieEmpresaId ?? horarios[0]?.empresaId ?? null;
    const popup = await leerPopupConfig(supabase, empresaPopup);
    const zonaHoraria = await getZonaHorariaEmpresa(supabase, empresaPopup);

    if (fijos.length === 0) {
      return { ok: true, ...base, ...popup, zonaHoraria };
    }

    // Entrada prevista = el primer tramo del día; salida = el último.
    const entradaMin = Math.min(...fijos.map((f) => f.entradaMin));
    const salidaMin = Math.max(...fijos.map((f) => f.salidaMin));

    return {
      ok: true,
      tieneHorario: true,
      entradaMin,
      salidaMin,
      cruzaMedianoche: salidaMin <= entradaMin,
      ...popup,
      zonaHoraria,
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiVentanaFichajeHoy:", msg);
    return { ok: false, ...base, error: msg };
  }
}

export type ModoFichaje = "presencial" | "teletrabajo";

/**
 * Indica si el empleado puede ELEGIR fichar como teletrabajo en esta empresa.
 * La UI usa esto para decidir si pregunta "¿presencial o teletrabajo?" antes de
 * fichar. Si es false, el fichaje es siempre presencial (con ubicación).
 */
export async function getMiConfigFichaje(): Promise<{ ok: boolean; permiteTeletrabajo: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, permiteTeletrabajo: false, error: "No autenticado" };
    const { data: empleado, error } = await supabase
      .from("empleados")
      .select("permite_teletrabajo")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
       return { ok: true, permiteTeletrabajo: Boolean(empleado?.permite_teletrabajo) };
  } catch (err: unknown) {
    return { ok: false, permiteTeletrabajo: false, error: extractErrorMessage(err) };
  }
}

export type TipoFichajeDisponible = {
  codigo: string;
  nombre: string;
  color: string;
  requiere_solicitud: boolean;
};

/**
 * Tipos de fichaje que el empleado puede usar HOY: los de fichaje normal
 * siempre, y los "solo por solicitud" únicamente si tiene una solicitud de
 * trabajo aprobada vigente hoy. Sirve para que la UI muestre un selector.
 */
export async function getTiposFichajeDisponibles(): Promise<{
  ok: boolean;
  data: TipoFichajeDisponible[];
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data: tiposData } = await supabase
      .from("tipos_fichaje")
      .select("codigo, nombre, color, requiere_solicitud")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("orden", { ascending: true });
    const tipos = (tiposData ?? []) as TipoFichajeDisponible[];

    const necesitaSolicitud = tipos.some((t) => t.requiere_solicitud);
    // Subtipos de solicitud de trabajo aprobados y vigentes hoy. El código EXT se
    // habilita SOLO con 'horas_extras'; el resto de tipos que requieren solicitud
    // (p.ej. día trabajado) con 'dia_trabajado'.
    let subtiposHoy = new Set<string>();
    if (necesitaSolicitud) {
      // "Hoy" en la zona de la empresa (PRP-069).
      const tzEmp = await getZonaHorariaEmpresa(supabase, empresaId);
      const { fecha: hoyLocal } = ahoraEnZona(tzEmp);
      const { data: sol } = await supabase
        .from("solicitudes_personal")
        .select("subtipo")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .eq("tipo", "trabajo")
        .eq("estado", "aprobada")
        .lte("fecha_inicio", hoyLocal)
        .or(`fecha_fin.is.null,fecha_fin.gte.${hoyLocal}`);
      subtiposHoy = new Set((sol ?? []).map((s) => s.subtipo as string));
    }

    // Un tipo que requiere solicitud se habilita si hay una solicitud del subtipo
    // que le corresponde: EXT ← horas_extras; los demás ← dia_trabajado.
    const habilitado = (codigo: string): boolean =>
      codigo === "EXT" ? subtiposHoy.has("horas_extras") : subtiposHoy.has("dia_trabajado");

    const disponibles = tipos.filter((t) => !t.requiere_solicitud || habilitado(t.codigo));
    return { ok: true, data: disponibles };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getTiposFichajeDisponibles:", msg);
    return { ok: false, data: [], error: msg };
  }
}

type EvalEntradaResultado =
  | { ok: true; tipoSel: { codigo: string } | null; horaEntradaOverrideISO: string | null }
  | { ok: false; error: string; fueraDeHora?: boolean };

/**
 * ¿Puede el empleado fichar AHORA su entrada en esta empresa? Resuelve el tipo
 * de fichaje y aplica las reglas de disponibilidad (solicitud / horario fijo /
 * flexible) de ESA empresa. Única fuente de esta validación: el fichaje
 * presencial la usa para elegir, entre los locales cercanos, la empresa en la
 * que el empleado tiene turno ahora (el GPS solo confirma la presencia).
 */
async function evaluarEntradaFichaje(
  supabase: Parameters<typeof getHorarioDia>[0],
  args: {
    empresaId: string;
    empleadoId: string;
    userId: string;
    tipoCodigo?: string;
  },
): Promise<EvalEntradaResultado> {
  const { empresaId, empleadoId, userId, tipoCodigo } = args;
  // "Hoy" y "ahora" en la zona horaria de ESTA empresa candidata (PRP-069): la
  // ventana de fichaje se valida contra el horario local de la empresa.
  const tz = await getZonaHorariaEmpresa(supabase, empresaId);
  const { fecha: hoyMadrid, minutos: ahoraMin } = ahoraEnZona(tz);
  let horaEntradaOverrideISO: string | null = null;

  const { data: tiposData } = await supabase
    .from("tipos_fichaje")
    .select("codigo, nombre, requiere_solicitud, margen_antes_min, margen_despues_min")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("orden", { ascending: true });
  const tiposActivos = (tiposData ?? []) as {
    codigo: string;
    nombre: string;
    requiere_solicitud: boolean;
    margen_antes_min: number;
    margen_despues_min: number;
  }[];

  let tipoSel = tipoCodigo
    ? tiposActivos.find((t) => t.codigo.toUpperCase() === tipoCodigo.toUpperCase()) ?? null
    : null;
  if (!tipoSel) tipoSel = tiposActivos.find((t) => !t.requiere_solicitud) ?? null;

  if (tipoSel) {
    if (tipoSel.requiere_solicitud) {
      // El subtipo debe coincidir con el tipo: EXT ← horas_extras; resto ← dia_trabajado.
      const subtipoReq = tipoSel.codigo.toUpperCase() === "EXT" ? "horas_extras" : "dia_trabajado";
      const { data: sol } = await supabase
        .from("solicitudes_personal")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("user_id", userId)
        .eq("tipo", "trabajo")
        .eq("subtipo", subtipoReq)
        .eq("estado", "aprobada")
        .lte("fecha_inicio", hoyMadrid)
        .or(`fecha_fin.is.null,fecha_fin.gte.${hoyMadrid}`)
        .limit(1);
      if (!sol || sol.length === 0) {
        return {
          ok: false,
          error: `Para fichar como "${tipoSel.nombre}" necesitas una solicitud de ${subtipoReq === "horas_extras" ? "horas extras" : "día trabajado"} aprobada para hoy.`,
        };
      }
    } else {
      const horario = await getHorarioDia(supabase, empresaId, empleadoId, hoyMadrid);

      const { data: cfgFuera } = await supabase
        .from("empresa_fichajes_config")
        .select("permitir_fuera_horario")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      const permitirFuera = !!cfgFuera?.permitir_fuera_horario;

      if (
        !permitirFuera &&
        (horario.tipo === "ninguno" ||
          (horario.tipo === "flexible" && horario.objetivoHoras <= 0))
      ) {
        return {
          ok: false,
          error: "No tienes horario asignado para hoy, así que no puedes fichar el horario normal. Aun así, siempre puedes fichar por solicitud y tu responsable lo revisará.",
        };
      }

      if (!permitirFuera && horario.tipo === "flexible") {
        const consumido = await horasTrabajadasPeriodo(
          supabase,
          empresaId,
          userId,
          hoyMadrid,
          horario.modo,
        );
        if (consumido >= horario.objetivoHoras - 1 / 3600) {
          return {
            ok: false,
            error:
              horario.modo === "semanal"
                ? `Ya has completado tus ${fmtHorasObjetivo(horario.objetivoHoras)} de esta semana. Podrás volver a fichar el lunes que viene.`
                : `Ya has completado tus ${fmtHorasObjetivo(horario.objetivoHoras)} de hoy. Podrás volver a fichar mañana.`,
          };
        }
      } else if (!permitirFuera && horario.tipo === "fijo") {
        const tramos = horario.tramos;
        const { data: cfg } = await supabase
          .from("empresa_fichajes_config")
          .select("*")
          .eq("empresa_id", empresaId)
          .maybeSingle();
        const permitirAntes = cfg ? !!cfg.permitir_antes : true;
        const permitirDespues = cfg ? !!cfg.permitir_despues : true;
        const margenAntes = permitirAntes ? ((cfg?.margen_antes_min as number) ?? 15) : 0;
        const margenDespues = permitirDespues ? ((cfg?.margen_despues_min as number) ?? 15) : 0;
        const redondearAntes = cfg ? !!cfg.redondear_antes : true;
        const redondearDespues = cfg ? !!cfg.redondear_despues : false;

        const inicios = tramos
          .map((t) => hhmmAMinutos(t.inicio))
          .filter((m): m is number => m != null);
        const startMin = inicios.length ? Math.min(...inicios) : 0;
        const lower = startMin - margenAntes;
        const upper = startMin + margenDespues;
        const enVentana = (m: number) => m >= lower && m <= upper;
        const dentro =
          enVentana(ahoraMin) || enVentana(ahoraMin + 1440) || enVentana(ahoraMin - 1440);

        if (!dentro) {
          return {
            ok: false,
            fueraDeHora: true,
            error: `No se te permite fichar: estás fuera de hora. Tu turno empieza a las ${minutosAHHMM(startMin)}. Si necesitas registrar estas horas, puedes pedir que las validen.`,
          };
        }

        const llegaAntes = ahoraMin < startMin;
        const llegaDespues = ahoraMin > startMin;
        if ((llegaAntes && redondearAntes) || (llegaDespues && redondearDespues)) {
          horaEntradaOverrideISO = new Date(
            Date.now() - (ahoraMin - startMin) * 60000,
          ).toISOString();
        }
      }
    }
  }

  return {
    ok: true,
    tipoSel: tipoSel ? { codigo: tipoSel.codigo } : null,
    horaEntradaOverrideISO,
  };
}

export async function ficharEntradaPersonal(
  geo?: GeoInput,
  modoSolicitado?: ModoFichaje,
  tipoCodigo?: string,
) {
  try {
    const { supabase, user, empresaId: cookieEmpresaId, nombre } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };

    // ─── Resolver empresa + empleado + local ───────────────────────────────
    // PRESENCIAL: la geo solo CONFIRMA que estás en alguno de tus locales; la
    // EMPRESA la decide tu TURNO (se prueba cada local cercano y se ficha en
    // aquel donde puedes fichar ahora). Sin turno en ninguno, no se ficha.
    // TELETRABAJO: sin geo → empresa activa (cookie) y su fila de empleado.
    let empresaId = "";
    let empleadoId = "";
    let localElegidoId = "";
    let centro = "";
    let modoTeletrabajo = false;
    let tipoSel: { codigo: string } | null = null;
    let horaEntradaOverrideISO: string | null = null;

    if (modoSolicitado === "teletrabajo") {
      if (!cookieEmpresaId) return { ok: false, error: "No autenticado" };
      const { data: empleado, error: empErr } = await supabase
        .from("empleados")
        .select("id, permite_teletrabajo")
        .eq("user_id", user.id)
        .eq("empresa_id", cookieEmpresaId)
        .maybeSingle();
      if (empErr) throw empErr;
      if (!empleado) {
        return { ok: false, error: "Tu usuario no está vinculado a ningún empleado." };
      }
      if (!empleado.permite_teletrabajo) {
        return { ok: false, error: "No tienes el teletrabajo permitido en esta empresa." };
      }
      const { data: locs } = await supabase
        .from("empleado_locales")
        .select("locales!inner(id, nombre, empresa_id)")
        .eq("empleado_id", empleado.id)
        .eq("locales.empresa_id", cookieEmpresaId);
      const primero = (locs ?? [])
        .map((r) => (r as unknown as { locales: { id: string; nombre: string | null } }).locales)
        .filter(Boolean)[0];
      if (!primero) {
        return {
          ok: false,
          error: "No tienes ningún local asignado en esta empresa. Pide a tu responsable que te asigne uno.",
        };
      }
      empresaId = cookieEmpresaId;
      empleadoId = empleado.id as string;
      localElegidoId = primero.id;
      centro = primero.nombre ?? "";
      modoTeletrabajo = true;

      const ev = await evaluarEntradaFichaje(supabase, {
        empresaId,
        empleadoId,
        userId: user.id,
        tipoCodigo,
      });
      if (!ev.ok) {
        return ev.fueraDeHora
          ? { ok: false, error: ev.error, fueraDeHora: true }
          : { ok: false, error: ev.error };
      }
      tipoSel = ev.tipoSel;
      horaEntradaOverrideISO = ev.horaEntradaOverrideISO;
    } else {
      if (!geo) {
        return {
          ok: false,
          error: "Activa la geolocalización para poder fichar de forma presencial.",
        };
      }
      const pres = await resolverCandidatosPorGeo(supabase, user.id, geo);
      if (!pres.ok) return { ok: false, error: pres.error };
      // La empresa la decide el TURNO: se prueba cada local cercano (más cerca
      // primero) y se ficha en aquel donde el empleado puede fichar ahora.
      let elegido:
        | {
            empresaId: string;
            localId: string;
            centro: string;
            tipoSel: { codigo: string } | null;
            horaEntradaOverrideISO: string | null;
          }
        | null = null;
      let primerFallo: { error: string; fueraDeHora?: boolean } | null = null;
      for (const c of pres.candidatos) {
        const ev = await evaluarEntradaFichaje(supabase, {
          empresaId: c.empresaId,
          empleadoId: c.empleadoId,
          userId: user.id,
          tipoCodigo,
        });
        if (ev.ok) {
          elegido = {
            empresaId: c.empresaId,
            localId: c.localId,
            centro: c.centro,
            tipoSel: ev.tipoSel,
            horaEntradaOverrideISO: ev.horaEntradaOverrideISO,
          };
          break;
        }
        if (!primerFallo) primerFallo = { error: ev.error, fueraDeHora: ev.fueraDeHora };
      }
      if (!elegido) {
        const error =
          primerFallo?.error ??
          "No tienes turno a esta hora en ninguno de tus locales cercanos.";
        return primerFallo?.fueraDeHora
          ? { ok: false, error, fueraDeHora: true }
          : { ok: false, error };
      }
      empresaId = elegido.empresaId;
      localElegidoId = elegido.localId;
      centro = elegido.centro;
      tipoSel = elegido.tipoSel;
      horaEntradaOverrideISO = elegido.horaEntradaOverrideISO;
    }

    const ahora = new Date();
    const { data, error } = await supabase
      .from("fichajes")
      .insert({
        empresa_id: empresaId,
        empleado_id: user.id,
        empleado_nombre: nombre || "Sin nombre",
        fecha: todayISO(),
        // Oficial (la que cuenta): redondeada al turno si aplica. Real: instante
        // físico del fichaje, siempre, para auditoría en RRHH.
        hora_entrada: horaEntradaOverrideISO ?? ahora.toISOString(),
        hora_entrada_real: ahora.toISOString(),
        estado: "trabajando",
        local_id: localElegidoId,
        lat_entrada: geo?.lat ?? null,
        lng_entrada: geo?.lng ?? null,
        precision_entrada_metros: geo?.precision ?? null,
        modo_teletrabajo: modoTeletrabajo,
        centro,
        // Tipo elegido (NOR/EXT del catálogo); normal por defecto si no se indicó.
        tipo: tipoSel?.codigo ?? "NOR",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] ficharEntradaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

function redondearHoras(ms: number): number {
  return Math.round((ms / 3600000) * 10000) / 10000;
}

export async function ficharSalidaPersonal(fichajeId: string, geo?: GeoInput) {
  try {
    const { supabase, user, nombre } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data: fichaje, error: fetchErr } = await supabase
      .from("fichajes")
      .select("hora_entrada, local_id, modo_teletrabajo, empresa_id, fecha, centro, tipo")
      .eq("id", fichajeId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!fichaje.modo_teletrabajo && fichaje.local_id) {
      if (!geo) {
        return {
          ok: false,
          error: "Activa la geolocalización para registrar la salida.",
        };
      }
      const { data: local, error: localErr } = await supabase
        .from("locales")
        .select("lat, lng, radio_metros, nombre")
        .eq("id", fichaje.local_id)
        .single();
      if (localErr) throw localErr;
      if (local && local.lat != null && local.lng != null) {
        const dist = distanciaMetros(geo.lat, geo.lng, local.lat, local.lng);
        if (dist > local.radio_metros) {
          return {
            ok: false,
            error: `Estás a ${Math.round(dist)} m de "${local.nombre}". Acércate al local para registrar la salida.`,
          };
        }
      }
    }

    const ahora = new Date();
    if (!fichaje.hora_entrada) {
      // Sin hora de entrada no hay nada que repartir ni cronometrar.
      const { error } = await supabase
        .from("fichajes")
        .update({
          hora_salida: ahora.toISOString(),
          hora_salida_real: ahora.toISOString(),
          horas_totales: 0,
          estado: "completado",
          lat_salida: geo?.lat ?? null,
          lng_salida: geo?.lng ?? null,
          precision_salida_metros: geo?.precision ?? null,
        })
        .eq("id", fichajeId);
      if (error) throw error;
      return { ok: true, data: { horas_totales: 0 } };
    }

    const entrada = new Date(fichaje.hora_entrada as string);
    const entradaMs = entrada.getTime();
    const horasTotales = redondearHoras(ahora.getTime() - entradaMs);

    // ─── Reparto de jornada partida entre empresas ─────────────────────────
    // Si la jornada continua cubre tramos planificados de MÁS de una empresa,
    // se reparte: el corte sigue el horario; lo no cubierto se marca para
    // revisión. La empresa NO la elige el empleado (sale del horario), y no
    // tiene que desfichar/refichar a mitad de jornada.
    // Minutos del día en la zona horaria de la empresa del fichaje (PRP-069).
    const tzFichaje = await getZonaHorariaEmpresa(supabase, (fichaje.empresa_id as string | null) ?? null);
    const entradaMin = minutosDiaEnZona(entrada, tzFichaje);
    const salidaMin = entradaMin + (ahora.getTime() - entradaMs) / 60000;
    const horarios = await getHorariosDiaUnificado(
      supabase,
      user.id,
      fichaje.fecha as string,
    );
    const tramos: TramoEmpresaMin[] = [];
    for (const h of horarios) {
      if (h.horario.tipo !== "fijo") continue;
      for (const tr of h.horario.tramos) {
        const s = hhmmAMinutos(tr.inicio);
        const e = hhmmAMinutos(tr.fin);
        if (s == null || e == null) continue;
        tramos.push({ empresaId: h.empresaId, startMin: s, endMin: e });
      }
    }
    const reparto = planificarReparto(entradaMin, salidaMin, tramos);

    // Sin reparto (una sola empresa) → cierre normal del fichaje.
    if (reparto.length <= 1) {
      const { error } = await supabase
        .from("fichajes")
        .update({
          hora_salida: ahora.toISOString(),
          hora_salida_real: ahora.toISOString(),
          horas_totales: horasTotales,
          estado: "completado",
          lat_salida: geo?.lat ?? null,
          lng_salida: geo?.lng ?? null,
          precision_salida_metros: geo?.precision ?? null,
        })
        .eq("id", fichajeId);
      if (error) throw error;
      return { ok: true, data: { horas_totales: horasTotales } };
    }

    // Reparto real: 1 fila por empresa, atadas por `sesion_id`.
    const sesionId = crypto.randomUUID();
    const locales = await getMisLocales(supabase, user.id);
    const localPorEmpresa = new Map<string, { id: string; nombre: string }>();
    for (const l of locales) {
      if (!localPorEmpresa.has(l.empresaId)) {
        localPorEmpresa.set(l.empresaId, { id: l.id, nombre: l.nombre });
      }
    }
    const isoDeMin = (min: number) =>
      new Date(entradaMs + (min - entradaMin) * 60000).toISOString();

    for (let i = 0; i < reparto.length; i++) {
      const seg = reparto[i];
      const esUltimo = i === reparto.length - 1;
      const localSeg =
        seg.empresaId === fichaje.empresa_id
          ? { id: (fichaje.local_id as string | null) ?? null, nombre: (fichaje.centro as string | null) ?? "" }
          : (() => {
              const l = localPorEmpresa.get(seg.empresaId);
              return { id: l?.id ?? null, nombre: l?.nombre ?? "" };
            })();
      const horasSeg = redondearHoras((seg.finMin - seg.inicioMin) * 60000);
      const finISO = esUltimo ? ahora.toISOString() : isoDeMin(seg.finMin);
      const revision = !seg.cubierto;
      const motivoTxt =
        seg.motivo === "solape"
          ? "Turnos de empresas distintas SOLAPADOS — revisar configuración de turnos"
          : seg.motivo === "hueco"
            ? "Hueco entre turnos: la jornada no es seguida — el empleado debía desfichar y volver a fichar"
            : "Horas fuera del horario planificado (reparto multi-empresa)";
      const incidencia = revision ? motivoTxt : null;

      if (i === 0) {
        // El primer segmento reaprovecha la fila original.
        const { error } = await supabase
          .from("fichajes")
          .update({
            empresa_id: seg.empresaId,
            local_id: localSeg.id,
            centro: localSeg.nombre,
            hora_salida: finISO,
            hora_salida_real: esUltimo ? ahora.toISOString() : null,
            horas_totales: horasSeg,
            estado: "completado",
            sesion_id: sesionId,
            requiere_revision: revision,
            revision_motivo: revision ? motivoTxt : null,
            incidencia,
            // Geo de salida solo si este segmento es además el último.
            lat_salida: esUltimo ? geo?.lat ?? null : null,
            lng_salida: esUltimo ? geo?.lng ?? null : null,
            precision_salida_metros: esUltimo ? geo?.precision ?? null : null,
          })
          .eq("id", fichajeId);
        if (error) throw error;
      } else {
        // Segmentos siguientes → filas nuevas en su empresa.
        const { error } = await supabase.from("fichajes").insert({
          empresa_id: seg.empresaId,
          empleado_id: user.id,
          empleado_nombre: nombre || "Sin nombre",
          fecha: fichaje.fecha as string,
          // Cortes planificados del reparto: la hora real solo existe en el
          // segmento que cierra físicamente (último); el resto es un corte.
          hora_entrada: isoDeMin(seg.inicioMin),
          hora_entrada_real: null,
          hora_salida: finISO,
          hora_salida_real: esUltimo ? ahora.toISOString() : null,
          horas_totales: horasSeg,
          estado: "completado",
          local_id: localSeg.id,
          centro: localSeg.nombre,
          modo_teletrabajo: Boolean(fichaje.modo_teletrabajo),
          tipo: (fichaje.tipo as string | null) ?? "NOR",
          sesion_id: sesionId,
          requiere_revision: revision,
          revision_motivo: revision
            ? "Horas fuera del horario planificado (reparto multi-empresa)"
            : null,
          incidencia,
          // La geo de salida va en el último segmento (el que cierra ahora).
          lat_salida: esUltimo ? geo?.lat ?? null : null,
          lng_salida: esUltimo ? geo?.lng ?? null : null,
          precision_salida_metros: esUltimo ? geo?.precision ?? null : null,
        });
        if (error) throw error;
      }
    }

    return { ok: true, data: { horas_totales: horasTotales, repartido: reparto.length } };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] ficharSalidaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Paralización manual del fichaje (cierre anticipado).
 * El empleado para su jornada antes de que se cierre por horario/autocierre.
 * Se exige un motivo, que queda guardado y vinculado al fichaje, y el fichaje
 * se marca para revisión (icono de alerta en la gestión de fichajes).
 */
export async function paralizarFichajePersonal(
  fichajeId: string,
  motivo: string,
  geo?: GeoInput,
) {
  try {
    const motivoLimpio = (motivo ?? "").trim();
    if (!motivoLimpio) {
      return { ok: false, error: "Indica el motivo de la paralización." };
    }
    const { supabase } = await getContext();
    const { data: fichaje, error: fetchErr } = await supabase
      .from("fichajes")
      .select("hora_entrada, local_id, modo_teletrabajo")
      .eq("id", fichajeId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!fichaje.modo_teletrabajo && fichaje.local_id) {
      if (!geo) {
        return { ok: false, error: "Activa la geolocalización para paralizar el fichaje." };
      }
      const { data: local, error: localErr } = await supabase
        .from("locales")
        .select("lat, lng, radio_metros, nombre")
        .eq("id", fichaje.local_id)
        .single();
      if (localErr) throw localErr;
      if (local && local.lat != null && local.lng != null) {
        const dist = distanciaMetros(geo.lat, geo.lng, local.lat, local.lng);
        if (dist > local.radio_metros) {
          return {
            ok: false,
            error: `Estás a ${Math.round(dist)} m de "${local.nombre}". Acércate al local para paralizar el fichaje.`,
          };
        }
      }
    }

    const ahora = new Date();
    let horasTotales = 0;
    if (fichaje?.hora_entrada) {
      const entrada = new Date(fichaje.hora_entrada as string);
      horasTotales =
        Math.round(((ahora.getTime() - entrada.getTime()) / 3600000) * 10000) / 10000;
    }
    const { error } = await supabase
      .from("fichajes")
      .update({
        hora_salida: ahora.toISOString(),
        horas_totales: horasTotales,
        estado: "completado",
        lat_salida: geo?.lat ?? null,
        lng_salida: geo?.lng ?? null,
        precision_salida_metros: geo?.precision ?? null,
        cierre_anticipado: true,
        cierre_anticipado_motivo: motivoLimpio,
        requiere_revision: true,
        revision_motivo: `Paralización antes de horario: ${motivoLimpio}`,
        incidencia: "Fichaje paralizado por el empleado antes de su horario",
      })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true, data: { horas_totales: horasTotales } };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] paralizarFichajePersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function iniciarPausaPersonal(fichajeId: string) {
  try {
    const { supabase } = await getContext();
    const ahora = new Date().toTimeString().slice(0, 8);
    const { error } = await supabase
      .from("fichajes")
      .update({ pausa_inicio: ahora, estado: "pausa" })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] iniciarPausaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function finalizarPausaPersonal(fichajeId: string) {
  try {
    const { supabase } = await getContext();
    const ahora = new Date().toTimeString().slice(0, 8);
    const { error } = await supabase
      .from("fichajes")
      .update({ pausa_fin: ahora, estado: "trabajando" })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] finalizarPausaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function listarMisFichajes(limite = 60): Promise<{
  ok: boolean;
  data: MiFichajeHoy[];
  error?: string;
}> {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, data: [], error: "No autenticado" };
    // Histórico UNIFICADO: todos los fichajes del empleado en TODAS sus empresas
    // (RLS limita a las suyas). Cada fichaje conserva su `centro`/local, que
    // distingue de qué empresa es.
    await autoCerrarFichajesHuerfanos(supabase, null, user.id);
    const { data, error } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empleado_id", user.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    // Historial multi-empresa: cada fichaje se muestra en la zona horaria de SU
    // empresa (PRP-069). Resolvemos la zona por empresa una sola vez (caché).
    const tzPorEmpresa = new Map<string, string>();
    const zonaDe = async (empresaId: string | null): Promise<string> => {
      if (!empresaId) return ZONA_HORARIA_DEFAULT;
      const cacheada = tzPorEmpresa.get(empresaId);
      if (cacheada) return cacheada;
      const tz = await getZonaHorariaEmpresa(supabase, empresaId);
      tzPorEmpresa.set(empresaId, tz);
      return tz;
    };
    const filas = await Promise.all(
      (data ?? []).map(async (f: Record<string, unknown>) => ({
        id: f.id as string,
        fecha: f.fecha as string,
        horaEntrada: (f.hora_entrada as string | null) ?? null,
        horaSalida: (f.hora_salida as string | null) ?? null,
        pausaInicio: (f.pausa_inicio as string | null) ?? null,
        pausaFin: (f.pausa_fin as string | null) ?? null,
        horasTotales: (f.horas_totales as number | null) ?? 0,
        estado: (f.estado as string | null) ?? "pendiente",
        incidencia: (f.incidencia as string | null) ?? null,
        modoTeletrabajo: Boolean(f.modo_teletrabajo),
        local: (f.centro as string | null) ?? null,
        flexible: false,
        flexModo: null,
        flexObjetivoHoras: null,
        flexRestanteHoras: null,
        zonaHoraria: await zonaDe((f.empresa_id as string | null) ?? null),
      })),
    );
    return { ok: true, data: filas };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarMisFichajes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/**
 * Zona horaria (IANA) de la empresa activa, resuelta en servidor (PRP-069).
 * La usan vistas cliente que muestran instantes (p. ej. la hora de los mensajes
 * de chat) sin consultar la BD desde el cliente. Fallback: Europe/Madrid.
 */
export async function getZonaHorariaActiva(): Promise<string> {
  try {
    const { supabase, empresaId } = await getContext();
    return await getZonaHorariaEmpresa(supabase, empresaId);
  } catch {
    return ZONA_HORARIA_DEFAULT;
  }
}

export interface ComunicadoVisible {
  id: string;
  titulo: string;
  contenido: string;
  prioridad: string;
  createdAt: string;
  /** Zona horaria de la empresa para formatear `createdAt` (instante). */
  zonaHoraria: string;
}

export async function listarComunicadosVisibles(): Promise<{
  ok: boolean;
  data: ComunicadoVisible[];
  error?: string;
}> {
  try {
    const { supabase, user, empresaId, departamento, rolLabel } =
      await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    const zonaHoraria = await getZonaHorariaEmpresa(supabase, empresaId);

    const { data, error } = await supabase
      .from("comunicados")
      .select(
        "id, titulo, cuerpo, prioridad, created_at, estado, toda_empresa, roles_destinatarios, empleados_destinatarios, departamentos_destinatarios",
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const dep = (departamento ?? "").trim().toLowerCase();
    const rol = (rolLabel ?? "").trim().toLowerCase();

    const visibles = (data ?? []).filter((c: Record<string, unknown>) => {
      const estado = (c.estado as string | undefined) ?? "publicado";
      if (estado === "borrador" || estado === "archivado") return false;

      // Difusión a toda la empresa: visible para todos.
      if ((c.toda_empresa as boolean | undefined) === true) return true;

      const empleados = (c.empleados_destinatarios as string[] | undefined) ?? [];
      if (empleados.includes(user.id)) return true;

      const departamentos = (
        c.departamentos_destinatarios as string[] | undefined
      ) ?? [];
      if (
        dep &&
        departamentos.some((d) => (d ?? "").trim().toLowerCase() === dep)
      ) {
        return true;
      }

      const roles = (c.roles_destinatarios as string[] | undefined) ?? [];
      const rolesLower = roles.map((r) => (r ?? "").trim().toLowerCase());
      if (rol && rolesLower.includes(rol)) return true;
      if (dep && rolesLower.includes(dep)) return true;

      return false;
    });

    return {
      ok: true,
      data: visibles.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        titulo: (c.titulo as string) ?? "",
        contenido: (c.cuerpo as string | null | undefined) ?? "",
        prioridad: (c.prioridad as string) ?? "normal",
        createdAt: c.created_at as string,
        zonaHoraria,
      })),
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarComunicadosVisibles:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── CALENDARIO MENSUAL ──────────────────────────────────────

export async function getMiCalendarioMes(
  anio: number,
  mes: number,
): Promise<{ ok: boolean; data: DiaCalendario[]; error?: string }> {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, data: [], error: "No autenticado" };
    const { desde, hasta } = monthBounds(anio, mes);

    // Calendario UNIFICADO: fichajes y solicitudes del empleado en TODAS sus
    // empresas (RLS limita a las suyas). Un día repartido entre dos empresas
    // suma las horas de ambas.
    const [fichajesRes, solicitudesRes] = await Promise.all([
      supabase
        .from("fichajes")
        .select("fecha, horas_totales, estado")
        .eq("empleado_id", user.id)
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase
        .from("solicitudes_personal")
        .select("tipo, subtipo, fecha_inicio, fecha_fin, estado")
        .eq("user_id", user.id)
        .eq("estado", "aprobada")
        .or(`fecha_inicio.lt.${hasta},fecha_fin.gte.${desde}`),
    ]);

    if (fichajesRes.error) throw fichajesRes.error;
    if (solicitudesRes.error) throw solicitudesRes.error;

    const map = new Map<string, DiaCalendario>();
    for (const f of fichajesRes.data ?? []) {
      const fecha = f.fecha as string;
      const prev = map.get(fecha) ?? {
        fecha,
        fichado: false,
        horasFichaje: 0,
        ausencia: null,
        trabajoExtra: null,
      };
      prev.fichado = true;
      // Suma (no sobrescribe): un día puede tener fichajes en 2 empresas.
      prev.horasFichaje += (f.horas_totales as number | null) ?? 0;
      map.set(fecha, prev);
    }

    for (const s of solicitudesRes.data ?? []) {
      const ini = new Date((s.fecha_inicio as string) + "T00:00:00Z");
      const fin = new Date(((s.fecha_fin as string | null) ?? (s.fecha_inicio as string)) + "T00:00:00Z");
      const startBound = new Date(desde + "T00:00:00Z");
      const endBound = new Date(hasta + "T00:00:00Z");
      const cur = new Date(Math.max(ini.getTime(), startBound.getTime()));
      const stop = new Date(Math.min(fin.getTime(), endBound.getTime() - 86400000));
      while (cur.getTime() <= stop.getTime()) {
        const key = cur.toISOString().split("T")[0];
        const prev = map.get(key) ?? {
          fecha: key,
          fichado: false,
          horasFichaje: 0,
          ausencia: null,
          trabajoExtra: null,
        };
        if (s.tipo === "ausencia") {
          prev.ausencia = s.subtipo as SolicitudSubtipoAusencia;
        } else if (s.tipo === "trabajo") {
          prev.trabajoExtra = s.subtipo as SolicitudSubtipoTrabajo;
        }
        map.set(key, prev);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return { ok: true, data: Array.from(map.values()) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiCalendarioMes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── SOLICITUDES ─────────────────────────────────────────────

function mapSolicitud(row: Record<string, unknown>): SolicitudPersonal {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    userId: row.user_id as string,
    empleadoNombre: (row.empleado_nombre as string) ?? "",
    tipo: row.tipo as SolicitudTipo,
    subtipo: row.subtipo as SolicitudSubtipo,
    fechaInicio: row.fecha_inicio as string,
    fechaFin: (row.fecha_fin as string | null) ?? null,
    horas: (row.horas as number | null) ?? null,
    motivo: (row.motivo as string) ?? "",
    estado: row.estado as SolicitudEstado,
    createdAt: row.created_at as string,
  };
}

export async function listarMisSolicitudes(limite = 20): Promise<{
  ok: boolean;
  data: SolicitudPersonal[];
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("solicitudes_personal")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(mapSolicitud) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarMisSolicitudes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/**
 * ¿El empleado ya tiene una solicitud de baja de contrato en curso?
 * Una baja de contrato es irreversible y no modificable: si hay una pendiente
 * o aprobada, la UI debe impedir crear otra. Devuelve la fecha efectiva y el
 * estado de la existente para poder informar al usuario.
 */
export async function getMiBajaContratoEnCurso(): Promise<{
  ok: boolean;
  enCurso: boolean;
  fechaFin?: string | null;
  estado?: string | null;
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId)
      return { ok: false, enCurso: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("solicitudes_personal")
      .select("estado, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .eq("subtipo", "baja_contrato")
      .in("estado", ["pendiente", "aprobada"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, enCurso: false };
    return {
      ok: true,
      enCurso: true,
      fechaFin: (data.fecha_fin as string | null) ?? null,
      estado: (data.estado as string | null) ?? null,
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiBajaContratoEnCurso:", msg);
    return { ok: false, enCurso: false, error: msg };
  }
}

export interface NuevaSolicitudInput {
  tipo: SolicitudTipo;
  subtipo: SolicitudSubtipo;
  fechaInicio: string;
  fechaFin?: string | null;
  horas?: number | null;
  /** Tramo (HH:MM) para solicitudes de trabajo; se materializa en el fichaje al aprobar. */
  horaInicio?: string | null;
  horaFin?: string | null;
  motivo?: string;
}

export interface MiVacacionesInfo {
  /** false = no tiene calendario asignado (no puede pedir vacaciones). */
  tieneCalendario: boolean;
  /** true = calendario predeterminado: aplica todos los años (bloqueos recurrentes). */
  esPredeterminado: boolean;
  calendarioNombre: string | null;
  anio: number;
  diasTotales: number;
  diasGastados: number;
  diasRestantes: number;
  bloqueos: { fechaInicio: string; fechaFin: string; motivo: string | null }[];
}

/**
 * Saldo de vacaciones del propio empleado (Mi Panel): días totales / gastados /
 * restantes del año de su calendario + los periodos bloqueados, para mostrarlo
 * y validarlo en el modal de solicitud antes de enviar.
 */
export async function getMiVacacionesInfo(): Promise<{
  ok: boolean;
  data: MiVacacionesInfo | null;
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: null, error: "No autenticado" };

    const vacio: MiVacacionesInfo = {
      tieneCalendario: false,
      esPredeterminado: false,
      calendarioNombre: null,
      anio: new Date().getUTCFullYear(),
      diasTotales: 0,
      diasGastados: 0,
      diasRestantes: 0,
      bloqueos: [],
    };

    const { data: emp } = await supabase
      .from("empleados")
      .select("calendario_vacaciones_id")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .maybeSingle();
    const calendarioId = (emp?.calendario_vacaciones_id as string | null) ?? null;
    if (!calendarioId) return { ok: true, data: vacio };

    const [{ data: cal }, { data: bloqueos }] = await Promise.all([
      supabase
        .from("rrhh_calendarios_vacaciones")
        .select("nombre, anio, dias_totales")
        .eq("id", calendarioId)
        .maybeSingle(),
      supabase
        .from("rrhh_calendario_vacaciones_bloqueos")
        .select("fecha_inicio, fecha_fin, motivo")
        .eq("calendario_id", calendarioId)
        .order("fecha_inicio", { ascending: true }),
    ]);
    if (!cal) return { ok: true, data: vacio };

    // Predeterminado (anio null) → cuenta el año actual como referencia.
    const esPredeterminado = (cal.anio as number | null) == null;
    const anio = (cal.anio as number | null) ?? new Date().getUTCFullYear();
    const diasTotales = cal.dias_totales as number;
    const inicioAnio = `${anio}-01-01`;
    const inicioAnioSig = `${anio + 1}-01-01`;
    const { data: existentes } = await supabase
      .from("solicitudes_personal")
      .select("fecha_inicio, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .eq("tipo", "ausencia")
      .eq("subtipo", "vacaciones")
      .in("estado", ["pendiente", "aprobada"])
      .lt("fecha_inicio", inicioAnioSig)
      .or(`fecha_fin.gte.${inicioAnio},fecha_fin.is.null`);
    const diasGastados = (existentes ?? []).reduce(
      (acc: number, s: { fecha_inicio: string; fecha_fin: string | null }) =>
        acc + diasSolicitudEnAnio(s.fecha_inicio, s.fecha_fin, anio),
      0,
    );

    return {
      ok: true,
      data: {
        tieneCalendario: true,
        esPredeterminado,
        calendarioNombre: cal.nombre as string,
        anio,
        diasTotales,
        diasGastados,
        diasRestantes: Math.max(0, diasTotales - diasGastados),
        bloqueos: (bloqueos ?? []).map((b: { fecha_inicio: string; fecha_fin: string; motivo: string | null }) => ({
          fechaInicio: b.fecha_inicio,
          fechaFin: b.fecha_fin,
          motivo: b.motivo ?? null,
        })),
      },
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiVacacionesInfo:", msg);
    return { ok: false, data: null, error: msg };
  }
}

const SUBTIPO_AUSENCIA_KEYWORD: Record<
  Exclude<SolicitudSubtipoAusencia, "baja_contrato">,
  string
> = {
  baja_medica: "baja",
  vacaciones: "vacacion",
  permiso: "permiso",
};

// Ventana de preaviso para la solicitud de baja de contrato (días naturales).
const BAJA_CONTRATO_PREAVISO_MIN_DIAS = 15;
const BAJA_CONTRATO_PREAVISO_MAX_DIAS = 45;

function diasNaturales(desde: string, hasta: string): number {
  const a = new Date(desde + "T00:00:00Z");
  const b = new Date(hasta + "T00:00:00Z");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function formatFechaEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diasEntreFechas(inicio: string, fin: string | null): number {
  const ini = new Date(inicio + "T00:00:00Z");
  const end = new Date((fin ?? inicio) + "T00:00:00Z");
  if (Number.isNaN(ini.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - ini.getTime()) / 86400000) + 1;
  return Math.max(0, diff);
}

function diasSolicitudEnAnio(inicio: string, fin: string | null, anio: number): number {
  const ini = new Date(inicio + "T00:00:00Z");
  const end = new Date((fin ?? inicio) + "T00:00:00Z");
  if (Number.isNaN(ini.getTime()) || Number.isNaN(end.getTime())) return 0;
  const yearStart = new Date(Date.UTC(anio, 0, 1));
  const yearEndExclusive = new Date(Date.UTC(anio + 1, 0, 1));
  const lo = ini.getTime() > yearStart.getTime() ? ini : yearStart;
  const hi = end.getTime() < yearEndExclusive.getTime() ? end : new Date(yearEndExclusive.getTime() - 86400000);
  if (hi.getTime() < lo.getTime()) return 0;
  return Math.floor((hi.getTime() - lo.getTime()) / 86400000) + 1;
}

async function userTieneRolDirector(userId: string): Promise<boolean> {
  const { esDirector } = await getRolContext(userId);
  return esDirector;
}

export async function crearSolicitudPersonal(input: NuevaSolicitudInput) {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    if (
      input.tipo === "ausencia" &&
      !["baja_medica", "vacaciones", "permiso", "baja_contrato"].includes(input.subtipo)
    ) {
      return { ok: false, error: "Subtipo de ausencia no válido" };
    }
    if (input.tipo === "trabajo" && !["horas_extras", "dia_trabajado"].includes(input.subtipo)) {
      return { ok: false, error: "Subtipo de trabajo no válido" };
    }

    // BAJA DE CONTRATO: reglas propias. Cliente solo elige fecha_fin (último día efectivo);
    // el servidor fija fecha_inicio = hoy (primer día de preaviso) y exige 15-45 días.
    if (input.tipo === "ausencia" && input.subtipo === "baja_contrato") {
      const hoy = todayISO();
      if (!input.fechaFin) {
        return { ok: false, error: "Indica la fecha solicitada de baja" };
      }
      const dias = diasNaturales(hoy, input.fechaFin);
      if (dias < BAJA_CONTRATO_PREAVISO_MIN_DIAS) {
        return {
          ok: false,
          error: `El preaviso mínimo es de ${BAJA_CONTRATO_PREAVISO_MIN_DIAS} días naturales. La fecha más cercana que puedes solicitar es ${formatFechaEs(
            new Date(Date.now() + BAJA_CONTRATO_PREAVISO_MIN_DIAS * 86400000)
              .toISOString()
              .split("T")[0],
          )}.`,
        };
      }
      if (dias > BAJA_CONTRATO_PREAVISO_MAX_DIAS) {
        return {
          ok: false,
          error: `El preaviso máximo es de ${BAJA_CONTRATO_PREAVISO_MAX_DIAS} días naturales.`,
        };
      }
      // Evita duplicados: si ya hay una baja_contrato pendiente o aprobada, bloquea.
      const { data: existente } = await supabase
        .from("solicitudes_personal")
        .select("id, estado")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .eq("subtipo", "baja_contrato")
        .in("estado", ["pendiente", "aprobada"])
        .limit(1)
        .maybeSingle();
      if (existente) {
        return {
          ok: false,
          error: "Ya tienes una solicitud de baja de contrato en curso.",
        };
      }
      const { data, error } = await supabase
        .from("solicitudes_personal")
        .insert({
          empresa_id: empresaId,
          user_id: user.id,
          empleado_nombre: nombre || "Sin nombre",
          tipo: input.tipo,
          subtipo: input.subtipo,
          fecha_inicio: hoy,
          fecha_fin: input.fechaFin,
          horas: null,
          motivo: input.motivo ?? "",
          estado: "pendiente",
        })
        .select()
        .single();
      if (error) throw error;

      // Side-effects (no bloqueantes): firma eIDAS + aviso a RRHH.
      // Si fallan, la solicitud queda creada igual y RRHH la verá en pendientes.
      try {
        await onBajaContratoCreada({
          empresaId,
          userId: user.id,
          fechaInicio: hoy,
          fechaFin: input.fechaFin,
          diasPreaviso: dias,
          motivo: input.motivo ?? null,
          nombreFallback: nombre || "",
        });
      } catch (e) {
        console.error(
          "[mi-panel] baja_contrato side-effects:",
          extractErrorMessage(e),
        );
      }

      return { ok: true, data: mapSolicitud(data as Record<string, unknown>) };
    }

    // VACACIONES: se validan contra el calendario de vacaciones del empleado
    // (días disponibles + periodos bloqueados). Es obligatorio tener uno.
    if (input.tipo === "ausencia" && input.subtipo === "vacaciones") {
      const { data: emp } = await supabase
        .from("empleados")
        .select("calendario_vacaciones_id")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .maybeSingle();

      const calendarioId = (emp?.calendario_vacaciones_id as string | null) ?? null;
      if (!calendarioId) {
        return {
          ok: false,
          error:
            "No tienes un calendario de vacaciones asignado. Pídele a RRHH que te asigne uno antes de solicitar vacaciones.",
        };
      }

      const { data: cal } = await supabase
        .from("rrhh_calendarios_vacaciones")
        .select("nombre, anio, dias_totales")
        .eq("id", calendarioId)
        .maybeSingle();
      if (!cal) {
        return {
          ok: false,
          error: "Tu calendario de vacaciones ya no está disponible. Contacta con RRHH.",
        };
      }

      const inicio = input.fechaInicio;
      const fin = input.fechaFin || input.fechaInicio;
      if (fin < inicio) {
        return { ok: false, error: "La fecha de fin no puede ser anterior a la fecha de inicio" };
      }

      // Calendario predeterminado (anio null) → aplica todos los años: el año de
      // cómputo es el de la fecha solicitada y los bloqueos se repiten cada año.
      const esPredeterminado = (cal.anio as number | null) == null;
      const anio =
        (cal.anio as number | null) ??
        new Date(inicio + "T00:00:00Z").getUTCFullYear();
      const diasTotales = cal.dias_totales as number;

      // 1) Periodos bloqueados (recurrentes si el calendario es predeterminado).
      const { data: bloqueos } = await supabase
        .from("rrhh_calendario_vacaciones_bloqueos")
        .select("fecha_inicio, fecha_fin, motivo")
        .eq("calendario_id", calendarioId);
      const choque = (bloqueos ?? []).find(
        (b: { fecha_inicio: string; fecha_fin: string }) =>
          bloqueoSolapaRango(
            { fechaInicio: b.fecha_inicio, fechaFin: b.fecha_fin },
            inicio,
            fin,
            esPredeterminado,
          ),
      ) as { fecha_inicio: string; fecha_fin: string; motivo: string | null } | undefined;
      if (choque) {
        return {
          ok: false,
          error:
            `Esas fechas caen en un periodo bloqueado` +
            (choque.motivo ? ` (${choque.motivo})` : "") +
            (esPredeterminado
              ? ` (se repite cada año, del ${formatFechaEs(choque.fecha_inicio).slice(0, 5)} al ${formatFechaEs(choque.fecha_fin).slice(0, 5)}).`
              : `, del ${formatFechaEs(choque.fecha_inicio)} al ${formatFechaEs(choque.fecha_fin)}.`) +
            ` No se pueden pedir vacaciones en esos días.`,
        };
      }

      // 2) Días disponibles según el calendario.
      const diasSolicitados = diasSolicitudEnAnio(inicio, fin, anio);
      if (!esPredeterminado && diasSolicitados === 0) {
        return {
          ok: false,
          error: `Tu calendario de vacaciones es del año ${anio}. Selecciona fechas dentro de ese año.`,
        };
      }

      const inicioAnio = `${anio}-01-01`;
      const inicioAnioSig = `${anio + 1}-01-01`;
      const { data: existentes } = await supabase
        .from("solicitudes_personal")
        .select("fecha_inicio, fecha_fin")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .eq("tipo", "ausencia")
        .eq("subtipo", "vacaciones")
        .in("estado", ["pendiente", "aprobada"])
        .lt("fecha_inicio", inicioAnioSig)
        .or(`fecha_fin.gte.${inicioAnio},fecha_fin.is.null`);
      const diasUsados = (existentes ?? []).reduce(
        (acc: number, s: { fecha_inicio: string; fecha_fin: string | null }) =>
          acc + diasSolicitudEnAnio(s.fecha_inicio, s.fecha_fin, anio),
        0,
      );

      if (diasUsados + diasSolicitados > diasTotales) {
        const restantes = Math.max(0, diasTotales - diasUsados);
        return {
          ok: false,
          error:
            `Te queda${restantes === 1 ? "" : "n"} ${restantes} día${restantes === 1 ? "" : "s"} de vacaciones ` +
            `de ${diasTotales} en ${anio} (ya llevas ${diasUsados} usado${diasUsados === 1 ? "" : "s"}) ` +
            `y estás pidiendo ${diasSolicitados}. No se puede registrar la solicitud.`,
        };
      }
    }

    // Resto de ausencias (baja médica, permiso): límite anual de tipos_ausencia.
    if (input.tipo === "ausencia" && input.subtipo !== "vacaciones") {
      const subtipoAus = input.subtipo as Exclude<
        SolicitudSubtipoAusencia,
        "baja_contrato"
      >;
      const keyword = SUBTIPO_AUSENCIA_KEYWORD[subtipoAus];

      const { data: tipoAusencia } = await supabase
        .from("tipos_ausencia")
        .select("nombre, limite_dias, activo")
        .eq("empresa_id", empresaId)
        .ilike("nombre", `%${keyword}%`)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .limit(1)
        .maybeSingle();

      const limite = (tipoAusencia?.limite_dias as number | null | undefined) ?? null;

      if (limite != null && limite > 0) {
        const esDirector = await userTieneRolDirector(user.id);
        if (!esDirector) {
          const anio = new Date(input.fechaInicio + "T00:00:00Z").getUTCFullYear();
          const diasSolicitados = diasSolicitudEnAnio(input.fechaInicio, input.fechaFin ?? null, anio);

          const inicioAnio = `${anio}-01-01`;
          const inicioAnioSig = `${anio + 1}-01-01`;
          const { data: existentes } = await supabase
            .from("solicitudes_personal")
            .select("fecha_inicio, fecha_fin")
            .eq("empresa_id", empresaId)
            .eq("user_id", user.id)
            .eq("tipo", "ausencia")
            .eq("subtipo", subtipoAus)
            .in("estado", ["pendiente", "aprobada"])
            .lt("fecha_inicio", inicioAnioSig)
            .or(`fecha_fin.gte.${inicioAnio},fecha_fin.is.null`);

          const diasUsados = (existentes ?? []).reduce(
            (acc: number, s: { fecha_inicio: string; fecha_fin: string | null }) =>
              acc + diasSolicitudEnAnio(s.fecha_inicio, s.fecha_fin, anio),
            0,
          );

          if (diasUsados + diasSolicitados > limite) {
            const restantes = Math.max(0, limite - diasUsados);
            const nombreTipo = (tipoAusencia?.nombre as string | undefined) ?? subtipoAus;
            return {
              ok: false,
              error:
                `Has alcanzado el límite anual de ${nombreTipo}: ${limite} día${limite === 1 ? "" : "s"} por año. ` +
                `Ya llevas ${diasUsados} usado${diasUsados === 1 ? "" : "s"} en ${anio} ` +
                `(te queda${restantes === 1 ? "" : "n"} ${restantes}) y estás pidiendo ${diasSolicitados}. ` +
                `No se puede registrar la solicitud.`,
            };
          }
        }
      }

      // Aviso suave si fechaFin < fechaInicio (validación básica de coherencia)
      if (input.fechaFin && diasEntreFechas(input.fechaInicio, input.fechaFin) === 0) {
        return { ok: false, error: "La fecha de fin no puede ser anterior a la fecha de inicio" };
      }
    }

    const { data, error } = await supabase
      .from("solicitudes_personal")
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        empleado_nombre: nombre || "Sin nombre",
        tipo: input.tipo,
        subtipo: input.subtipo,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin ?? null,
        horas: input.horas ?? null,
        hora_inicio: input.horaInicio ?? null,
        hora_fin: input.horaFin ?? null,
        motivo: input.motivo ?? "",
        estado: "pendiente",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: mapSolicitud(data as Record<string, unknown>) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] crearSolicitudPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function anularMiSolicitud(id: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    // Solo se puede anular mientras está PENDIENTE (sin respuesta de RRHH).
    // Si ya fue aprobada o rechazada, el UPDATE no afecta filas y la solicitud
    // sigue su curso: devolvemos un error claro en vez de un falso "anulada".
    const { data, error } = await supabase
      .from("solicitudes_personal")
      .update({ estado: "anulada" })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("estado", "pendiente")
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        ok: false,
        error:
          "Esta solicitud ya ha recibido respuesta y no se puede anular: se llevará a cabo lo que indica.",
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] anularMiSolicitud:", msg);
    return { ok: false, error: msg };
  }
}

// ─── ADMIN / RRHH: gestión de solicitudes ──────────────────

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * ¿El usuario es el validador asignado de esta solicitud según su tipo?
 * Las de trabajo las valida `empleados.validador_trabajo_id` del solicitante;
 * las de ausencia, `empleados.validador_ausencias_id`. Solo ese empleado puede
 * aprobar/denegar.
 */
async function esValidadorAsignado(
  supabase: ServerClient,
  userId: string,
  solicitud: { empresa_id: string; user_id: string; tipo: SolicitudTipo },
): Promise<boolean> {
  const empresaId = solicitud.empresa_id;
  const [{ data: actual }, { data: solicitante }] = await Promise.all([
    supabase.from("empleados").select("id").eq("user_id", userId).eq("empresa_id", empresaId).maybeSingle(),
    supabase
      .from("empleados")
      .select("validador_trabajo_id, validador_ausencias_id")
      .eq("user_id", solicitud.user_id)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
  ]);
  if (!actual?.id || !solicitante) return false;
  const validadorId =
    solicitud.tipo === "trabajo"
      ? (solicitante.validador_trabajo_id as string | null)
      : (solicitante.validador_ausencias_id as string | null);
  return !!validadorId && validadorId === actual.id;
}

export async function listarSolicitudesEmpresa(filtro: "pendientes" | "todas" = "pendientes") {
  try {
    const { supabase, empresaId, user } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    const query = supabase
      .from("solicitudes_personal")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtro === "pendientes") {
      query.eq("estado", "pendiente");
    } else {
      query.in("estado", ["aprobada", "rechazada"]);
    }
    const { data, error } = await query;
    if (error) throw error;

    // Marca cada solicitud con si el usuario actual es su validador asignado
    // (solo él puede aprobar/denegar). Todos ven todas; el control es por fila.
    let miEmpleadoId: string | null = null;
    const validadoresPorUser = new Map<string, { t: string | null; a: string | null }>();
    if (user) {
      const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
      const [{ data: actual }, { data: solicitantes }] = await Promise.all([
        supabase.from("empleados").select("id").eq("user_id", user.id).eq("empresa_id", empresaId).maybeSingle(),
        userIds.length > 0
          ? supabase
              .from("empleados")
              .select("user_id, validador_trabajo_id, validador_ausencias_id")
              .eq("empresa_id", empresaId)
              .in("user_id", userIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      ]);
      miEmpleadoId = (actual?.id as string | null) ?? null;
      for (const s of solicitantes ?? []) {
        validadoresPorUser.set(s.user_id as string, {
          t: (s.validador_trabajo_id as string | null) ?? null,
          a: (s.validador_ausencias_id as string | null) ?? null,
        });
      }
    }

    const dataConFlag = (data ?? []).map((row) => {
      const base = mapSolicitud(row);
      const v = validadoresPorUser.get(base.userId);
      const validadorId = base.tipo === "trabajo" ? v?.t : v?.a;
      const puedoValidar = !!miEmpleadoId && !!validadorId && validadorId === miEmpleadoId;
      return { ...base, puedoValidar };
    });

    return { ok: true, data: dataConFlag };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarSolicitudesEmpresa:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function aprobarSolicitud(id: string, notasRevision?: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };

    // Cargamos la solicitud antes del UPDATE para decidir si hay notificación.
    const { data: solicitud, error: fetchErr } = await supabase
      .from("solicitudes_personal")
      .select("id, empresa_id, user_id, tipo, empleado_nombre, subtipo, fecha_inicio, fecha_fin, horas, hora_inicio, hora_fin")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!solicitud) return { ok: false, error: "Solicitud no encontrada" };

    // Solo el validador asignado del empleado puede aprobarla.
    if (!(await esValidadorAsignado(supabase, user.id, {
      empresa_id: solicitud.empresa_id as string,
      user_id: solicitud.user_id as string,
      tipo: solicitud.tipo as SolicitudTipo,
    }))) {
      return { ok: false, error: "Solo el validador asignado de este empleado puede aprobar esta solicitud." };
    }

    // Solicitud de TRABAJO (día trabajado / horas extras): al aprobar se crea el
    // fichaje con el tramo indicado (NOR/EXT). Si el tramo se solapa con otro
    // fichaje de ese día, NO se aprueba y se avisa (varios tramos disjuntos por
    // día están permitidos; pisarse en el tiempo no).
    if (solicitud.tipo === "trabajo") {
      const { materializarFichajeDeSolicitud } = await import(
        "@/features/mi-panel/services/solicitud-a-fichaje"
      );
      const res = await materializarFichajeDeSolicitud(supabase, {
        id: solicitud.id as string,
        empresa_id: solicitud.empresa_id as string,
        user_id: solicitud.user_id as string,
        empleado_nombre: (solicitud.empleado_nombre as string | null) ?? null,
        subtipo: solicitud.subtipo as string,
        fecha_inicio: solicitud.fecha_inicio as string,
        hora_inicio: (solicitud.hora_inicio as string | null) ?? null,
        hora_fin: (solicitud.hora_fin as string | null) ?? null,
      });
      if (!res.ok) return { ok: false, error: res.error ?? "No se pudo registrar el fichaje de la solicitud." };
    }

    const { error } = await supabase
      .from("solicitudes_personal")
      .update({
        estado: "aprobada",
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
        notas_revision: notasRevision ?? null,
      })
      .eq("id", id);
    if (error) throw error;

    if (solicitud.subtipo === "baja_contrato") {
      // Notificación al empleado. No bloqueamos la aprobación si el envío falla.
      try {
        await notificarBajaContratoRecibida({
          empresaId: solicitud.empresa_id as string,
          userId: solicitud.user_id as string,
          empleadoNombre: (solicitud.empleado_nombre as string) ?? "",
          fechaInicio: solicitud.fecha_inicio as string,
          fechaFin: (solicitud.fecha_fin as string | null) ?? null,
          notasRevision: notasRevision ?? null,
        });
      } catch (e) {
        console.error(
          "[mi-panel] aprobarSolicitud → email baja_contrato:",
          extractErrorMessage(e),
        );
      }
    }

    // Push PWA al solicitante. No bloqueamos si el envío falla.
    try {
      const { sendPushToUser } = await import(
        "@/features/mi-panel/mobile/lib/push-server"
      );
      await sendPushToUser({
        userId: solicitud.user_id as string,
        empresaId: solicitud.empresa_id as string,
        eventType: "solicitud_resuelta",
        payload: {
          title: "Solicitud aprobada",
          body: `Tu solicitud (${solicitud.subtipo ?? "petición"}) ha sido aprobada.`,
          url: "/m/solicitudes",
          tag: `solicitud-${solicitud.id}`,
          data: { url: "/m/solicitudes" },
        },
      });
    } catch (e) {
      console.error("[mi-panel] aprobarSolicitud → push:", extractErrorMessage(e));
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] aprobarSolicitud:", msg);
    return { ok: false, error: msg };
  }
}

async function notificarBajaContratoRecibida(args: {
  empresaId: string;
  userId: string;
  empleadoNombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  notasRevision: string | null;
}): Promise<void> {
  if (!args.fechaFin) return;
  const supabase = await createClient();

  const [empleadoRes, empresaRes] = await Promise.all([
    supabase
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal")
      .eq("empresa_id", args.empresaId)
      .eq("user_id", args.userId)
      .maybeSingle(),
    supabase
      .from("empresas")
      .select("nombre")
      .eq("id", args.empresaId)
      .maybeSingle(),
  ]);

  const emp = empleadoRes.data as
    | { nombre: string | null; apellidos: string | null; email_empresa: string | null; email_personal: string | null }
    | null;
  const destino = emp?.email_empresa || emp?.email_personal;
  if (!destino) {
    console.warn("[mi-panel] baja_contrato sin email destino para user", args.userId);
    return;
  }

  const nombre =
    (emp ? `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() : "") ||
    args.empleadoNombre ||
    "compañero/a";
  const empresaNombre =
    (empresaRes.data?.nombre as string | undefined) ?? "tu empresa";
  const diasPreaviso = diasNaturales(args.fechaInicio, args.fechaFin);

  const { subject, html, text } = bajaContratoRecibidaEmail({
    recipientName: nombre,
    empresaNombre,
    fechaSolicitud: formatFechaEs(args.fechaInicio),
    fechaBaja: formatFechaEs(args.fechaFin),
    diasPreaviso,
    notasRevision: args.notasRevision,
  });

  await sendEmail({
    to: destino,
    subject,
    html,
    text,
    empresaId: args.empresaId,
    // Reply-To siempre no-reply: no se responde al software.
  });
}

// ─── Baja de contrato: side-effects al crear la solicitud ────

async function onBajaContratoCreada(args: {
  empresaId: string;
  userId: string;
  fechaInicio: string;
  fechaFin: string;
  diasPreaviso: number;
  motivo: string | null;
  nombreFallback: string;
}): Promise<void> {
  const admin = createAdminClient();

  const [empleadoRes, empresaRes] = await Promise.all([
    admin
      .from("empleados")
      .select("id, nombre, apellidos, dni_nie, local_id")
      .eq("empresa_id", args.empresaId)
      .eq("user_id", args.userId)
      .maybeSingle(),
    admin
      .from("empresas")
      .select("nombre, datos_generales")
      .eq("id", args.empresaId)
      .maybeSingle(),
  ]);

  const emp = empleadoRes.data as
    | {
        id: string;
        nombre: string | null;
        apellidos: string | null;
        dni_nie: string | null;
        local_id: string | null;
      }
    | null;
  if (!emp) {
    console.warn(
      "[mi-panel] baja_contrato: no se encontró empleado para user",
      args.userId,
    );
    return;
  }

  const empresaNombre =
    (empresaRes.data?.nombre as string | undefined) ?? "Tu empresa";
  const empresaCif: string | null = null;

  // Ciudad para la cabecera de la carta (best-effort).
  let ciudad: string | null = null;
  if (emp.local_id) {
    const { data: local } = await admin
      .from("locales")
      .select("ciudad")
      .eq("id", emp.local_id)
      .maybeSingle();
    if (local) {
      ciudad = (local.ciudad as string | null) ?? null;
    }
  }

  const empleadoNombre =
    `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() ||
    args.nombreFallback ||
    "Empleado/a";

  // 1) Generar PDF de la carta de baja voluntaria. El generador devuelve también
  //    la posición EXACTA de la firma (calculada, no a ojo), para que el trazo
  //    quede centrado sobre la zona "Firma del trabajador" automáticamente.
  let pdfBuffer: Buffer | null = null;
  let posicionFirma: {
    pagina: number;
    xPct: number;
    yPct: number;
    anchoPct: number;
  } | null = null;
  try {
    const carta = await generarCartaBajaVoluntariaPDF({
      empleadoNombre,
      empleadoDni: emp.dni_nie,
      empresaNombre,
      empresaCif,
      ciudad,
      fechaSolicitud: formatFechaEs(args.fechaInicio),
      fechaBaja: formatFechaEs(args.fechaFin),
      diasPreaviso: args.diasPreaviso,
      motivo: args.motivo,
    });
    pdfBuffer = carta.buffer;
    posicionFirma = carta.posicionFirma;
  } catch (e) {
    console.error("[mi-panel] baja_contrato: PDF falló:", extractErrorMessage(e));
  }

  // 2) Crear solicitud de firma eIDAS. Igual que el contrato interno de entrada:
  //    firma manuscrita + código OTP por email (doble factor). El paso OTP es
  //    obligatorio en todas las modalidades, así que "manuscrita_digital" exige
  //    ambas cosas: validar el código y dibujar la firma sobre el documento.
  if (pdfBuffer) {
    const firma = await crearFirmaInterno({
      empresaId: args.empresaId,
      empleadoId: emp.id,
      pdf: pdfBuffer,
      titulo: "Carta de baja voluntaria",
      tipo: "baja_voluntaria",
      modalidad: "manuscrita_digital",
      validez: "eidas_simple",
      // El enlace de firma vale 1 hora desde la solicitud; luego queda anulado.
      plazoHoras: 1,
      observaciones: `Solicitud de baja con fecha efectiva ${formatFechaEs(args.fechaFin)} (${args.diasPreaviso} días de preaviso). Enlace de firma válido 1 hora.`,
      enviadoPorUserId: args.userId,
      enviadoPorNombre: empleadoNombre,
      // El empleado firma su email personal si lo tiene (documento personal).
      preferirEmailPersonal: true,
      // Firma colocada AUTOMÁTICAMENTE sobre la zona "Firma del trabajador":
      // el propio generador del PDF calculó la posición exacta del hueco, así
      // que queda centrada sin ajustar coordenadas a ojo. El empleado no arrastra.
      posicionFirmaDefault: posicionFirma,
    });
    if (!firma.ok) {
      console.error("[mi-panel] baja_contrato: firma no creada:", firma.error);
    }
  }

  // 3) Aviso por email al buzón de RRHH de la empresa (Datos generales).
  const dgEmpresa =
    (empresaRes.data?.datos_generales as Record<string, unknown> | null) ?? null;
  const pickCorreoEmpresa = (k: string): string | null => {
    const v = dgEmpresa?.[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const destinoEmpresa =
    pickCorreoEmpresa("correoRrhh") ?? pickCorreoEmpresa("correoGeneral");
  if (destinoEmpresa) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com";
    const { bajaContratoAvisoRrhhEmail } = await import(
      "@/lib/email/templates/baja-contrato-rrhh"
    );
    const { subject, html, text } = bajaContratoAvisoRrhhEmail({
      empleadoNombre,
      empleadoDni: emp.dni_nie,
      empresaNombre,
      fechaSolicitud: formatFechaEs(args.fechaInicio),
      fechaBaja: formatFechaEs(args.fechaFin),
      diasPreaviso: args.diasPreaviso,
      motivo: args.motivo,
      enlacePanel: `${appUrl}/rrhh/solicitudes`,
    });
    await sendEmail({
      to: destinoEmpresa,
      subject,
      html,
      text,
      empresaId: args.empresaId,
      // Reply-To siempre no-reply: la empresa lo gestiona desde el panel de RRHH.
    });
  } else {
    console.warn(
      "[mi-panel] baja_contrato: sin correo de RRHH/general en Datos generales para empresa",
      args.empresaId,
    );
  }
}

export async function rechazarSolicitud(id: string, notasRevision?: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data: solicitud } = await supabase
      .from("solicitudes_personal")
      .select("id, empresa_id, user_id, tipo, subtipo")
      .eq("id", id)
      .maybeSingle();
    if (!solicitud) return { ok: false, error: "Solicitud no encontrada" };

    // Solo el validador asignado del empleado puede denegarla.
    if (!(await esValidadorAsignado(supabase, user.id, {
      empresa_id: solicitud.empresa_id as string,
      user_id: solicitud.user_id as string,
      tipo: solicitud.tipo as SolicitudTipo,
    }))) {
      return { ok: false, error: "Solo el validador asignado de este empleado puede denegar esta solicitud." };
    }

    const { error } = await supabase
      .from("solicitudes_personal")
      .update({
        estado: "rechazada",
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
        notas_revision: notasRevision ?? null,
      })
      .eq("id", id);
    if (error) throw error;

    if (solicitud) {
      try {
        const { sendPushToUser } = await import(
          "@/features/mi-panel/mobile/lib/push-server"
        );
        await sendPushToUser({
          userId: solicitud.user_id as string,
          empresaId: solicitud.empresa_id as string,
          eventType: "solicitud_resuelta",
          payload: {
            title: "Solicitud rechazada",
            body: `Tu solicitud (${solicitud.subtipo ?? "petición"}) no ha sido aprobada.`,
            url: "/m/solicitudes",
            tag: `solicitud-${solicitud.id}`,
            data: { url: "/m/solicitudes" },
          },
        });
      } catch (e) {
        console.error("[mi-panel] rechazarSolicitud → push:", extractErrorMessage(e));
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] rechazarSolicitud:", msg);
    return { ok: false, error: msg };
  }
}

// ─── TAREAS DE VALIDACIÓN (para el validador) ────────────────

export interface TareasValidacion {
  /** Si la empresa tiene activadas estas tareas (Ajustes → RRHH). */
  activo: boolean;
  ausencia: number;
  trabajo: number;
}

/**
 * Solicitudes pendientes que el usuario actual debe validar, agrupadas por tipo.
 * Alimenta el recuadro de "tareas de validación" del Mi Panel. Se calcula en
 * vivo: aparece cada día mientras haya pendientes y desaparece al resolverlas.
 * Gobernado por el toggle `empresa_rrhh_config.tareas_validador_activo`.
 */
export async function getTareasValidacionPendientes(): Promise<{
  ok: boolean;
  data: TareasValidacion;
  error?: string;
}> {
  const vacio: TareasValidacion = { activo: false, ausencia: 0, trabajo: 0 };
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: true, data: vacio };

    const { data: cfg } = await supabase
      .from("empresa_rrhh_config")
      .select("tareas_validador_activo")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    // Default activo si no hay fila/columna (las empresas vienen sembradas).
    const activo = cfg ? (cfg.tareas_validador_activo as boolean) !== false : true;
    if (!activo) return { ok: true, data: { ...vacio, activo: false } };

    const { data: miEmpleado } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!miEmpleado?.id) return { ok: true, data: { activo: true, ausencia: 0, trabajo: 0 } };
    const miId = miEmpleado.id as string;

    const { data: validados } = await supabase
      .from("empleados")
      .select("user_id, validador_trabajo_id, validador_ausencias_id")
      .eq("empresa_id", empresaId)
      .or(`validador_trabajo_id.eq.${miId},validador_ausencias_id.eq.${miId}`);
    const usersTrabajo = (validados ?? [])
      .filter((e) => e.validador_trabajo_id === miId)
      .map((e) => e.user_id as string);
    const usersAusencia = (validados ?? [])
      .filter((e) => e.validador_ausencias_id === miId)
      .map((e) => e.user_id as string);

    const contar = async (userIds: string[], tipo: SolicitudTipo) => {
      if (userIds.length === 0) return 0;
      const { count } = await supabase
        .from("solicitudes_personal")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("estado", "pendiente")
        .eq("tipo", tipo)
        .in("user_id", userIds);
      return count ?? 0;
    };
    const [trabajo, ausencia] = await Promise.all([
      contar(usersTrabajo, "trabajo"),
      contar(usersAusencia, "ausencia"),
    ]);

    return { ok: true, data: { activo: true, ausencia, trabajo } };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getTareasValidacionPendientes:", msg);
    return { ok: false, data: vacio, error: msg };
  }
}

// ─── RESUMEN MI PANEL ────────────────────────────────────────

export interface MiPanelResumen {
  points: {
    acumulados: number;
    canjeables: number;
    nivelNombre: string | null;
    nivelColor: string | null;
    nivelIcon: string | null;
    siguienteNombre: string | null;
    progresoPct: number;
    faltan: number;
  };
  fichajes: {
    mesCount: number;
    mesHoras: number;
    incidencias: number;
  };
  solicitudes: {
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
  };
  comunicados: {
    total: number;
    ultimoTitulo: string | null;
    ultimaFecha: string | null;
  };
  cuestionarios: {
    pendientes: number;
  };
  formacion: {
    cursosAsignados: number;
    cursosCompletados: number;
  };
  /** Zona horaria de la empresa para formatear instantes (p.ej. `ultimaFecha`). */
  zonaHoraria: string;
}

const EMPTY_RESUMEN: MiPanelResumen = {
  points: {
    acumulados: 0,
    canjeables: 0,
    nivelNombre: null,
    nivelColor: null,
    nivelIcon: null,
    siguienteNombre: null,
    progresoPct: 0,
    faltan: 0,
  },
  fichajes: { mesCount: 0, mesHoras: 0, incidencias: 0 },
  solicitudes: { pendientes: 0, aprobadas: 0, rechazadas: 0 },
  comunicados: { total: 0, ultimoTitulo: null, ultimaFecha: null },
  cuestionarios: { pendientes: 0 },
  formacion: { cursosAsignados: 0, cursosCompletados: 0 },
  zonaHoraria: ZONA_HORARIA_DEFAULT,
};

export async function getMiPanelResumen(): Promise<{
  ok: boolean;
  data: MiPanelResumen;
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) {
      return { ok: false, data: EMPTY_RESUMEN, error: "No autenticado" };
    }

    const now = new Date();
    const anio = now.getFullYear();
    const mes = now.getMonth() + 1;
    const { desde, hasta } = monthBounds(anio, mes);

    const [
      balance,
      niveles,
      fichajesMes,
      solicitudes,
      comunicadosVisibles,
    ] = await Promise.all([
      getMiBalance(supabase, user.id).catch(() => ({
        empresaId: "",
        userId: user.id,
        toquesAcumulados: 0,
        toquesCanjeables: 0,
        ultimoMovimientoAt: null,
      })),
      getNiveles(supabase, empresaId).catch(() => []),
      supabase
        .from("fichajes")
        .select("horas_totales, estado, incidencia")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", user.id)
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase
        .from("solicitudes_personal")
        .select("estado")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id),
      listarComunicadosVisibles(),
    ]);

    const nivelProgreso = calcularNivel(balance.toquesAcumulados, niveles);

    const fRows = (fichajesMes.data ?? []) as Array<{
      horas_totales: number | null;
      estado: string | null;
      incidencia: string | null;
    }>;
    const mesHoras = fRows.reduce((acc, r) => acc + (r.horas_totales ?? 0), 0);
    const incidencias = fRows.filter((r) => Boolean(r.incidencia)).length;

    const sRows = (solicitudes.data ?? []) as Array<{ estado: string | null }>;
    const pendientes = sRows.filter((s) => s.estado === "pendiente").length;
    const aprobadas = sRows.filter((s) => s.estado === "aprobada").length;
    const rechazadas = sRows.filter((s) => s.estado === "rechazada").length;

    const comunicados = comunicadosVisibles.ok ? comunicadosVisibles.data : [];
    const ultimo = comunicados[0] ?? null;
    const zonaHoraria = await getZonaHorariaEmpresa(supabase, empresaId);

    return {
      ok: true,
      data: {
        points: {
          acumulados: balance.toquesAcumulados,
          canjeables: balance.toquesCanjeables,
          nivelNombre: nivelProgreso.actual?.nombre ?? null,
          nivelColor: nivelProgreso.actual?.badgeColor ?? null,
          nivelIcon: nivelProgreso.actual?.badgeIcon ?? null,
          siguienteNombre: nivelProgreso.siguiente?.nombre ?? null,
          progresoPct: nivelProgreso.progresoPct,
          faltan: nivelProgreso.toquesParaSiguiente,
        },
        fichajes: {
          mesCount: fRows.length,
          mesHoras: Math.round(mesHoras * 100) / 100,
          incidencias,
        },
        solicitudes: { pendientes, aprobadas, rechazadas },
        comunicados: {
          total: comunicados.length,
          ultimoTitulo: ultimo?.titulo ?? null,
          ultimaFecha: ultimo?.createdAt ?? null,
        },
        cuestionarios: { pendientes: 0 },
        formacion: { cursosAsignados: 0, cursosCompletados: 0 },
        zonaHoraria,
      },
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiPanelResumen:", msg);
    return { ok: false, data: EMPTY_RESUMEN, error: msg };
  }
}
