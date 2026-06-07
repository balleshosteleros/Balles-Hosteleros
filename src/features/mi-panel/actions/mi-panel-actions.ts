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
import { bloqueoSolapaRango } from "@/features/rrhh/data/calendarios-vacaciones";
import {
  ahoraEnMadrid,
  getHorarioDia,
  semanaDeFecha,
  hhmmAMinutos,
  minutosAHHMM,
} from "@/features/rrhh/utils/horario-empleado";

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
    .from("profiles")
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
      .from("user_empresas")
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
  empresaId: string,
  empleadoId: string,
): Promise<void> {
  const now = new Date();
  if (now.getHours() < 8) return;
  try {
    await supabase
      .from("fichajes")
      .update({
        estado: "completado",
        hora_salida: now.toISOString(),
        incidencia: "Fichaje sin cierre — pendiente de revisión",
      })
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .lt("fecha", todayISO())
      .is("hora_salida", null)
      .in("estado", ["trabajando", "pausa"]);
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
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: null, error: "No autenticado" };
    await autoCerrarFichajesHuerfanos(supabase, empresaId, user.id);
    const { data, error } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", user.id)
      .eq("fecha", todayISO())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

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
      },
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiFichajeHoy:", msg);
    return { ok: false, data: null, error: msg };
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
    let tieneSolicitudHoy = false;
    if (necesitaSolicitud) {
      const { fecha: hoyMadrid } = ahoraEnMadrid();
      const { data: sol } = await supabase
        .from("solicitudes_personal")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .eq("tipo", "trabajo")
        .eq("estado", "aprobada")
        .lte("fecha_inicio", hoyMadrid)
        .or(`fecha_fin.is.null,fecha_fin.gte.${hoyMadrid}`)
        .limit(1);
      tieneSolicitudHoy = Boolean(sol && sol.length > 0);
    }

    const disponibles = tipos.filter((t) => !t.requiere_solicitud || tieneSolicitudHoy);
    return { ok: true, data: disponibles };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getTiposFichajeDisponibles:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function ficharEntradaPersonal(
  geo?: GeoInput,
  modoSolicitado?: ModoFichaje,
  tipoCodigo?: string,
) {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    const { data: empleado, error: empleadoErr } = await supabase
      .from("empleados")
      .select("id, permite_teletrabajo")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (empleadoErr) throw empleadoErr;
    if (!empleado) {
      return {
        ok: false,
        error: "Tu usuario no está vinculado a ningún empleado.",
      };
    }

    // ─── Tipo de fichaje + reglas de disponibilidad ────────────────────────
    // Resuelve qué tipo se va a registrar y valida sus condiciones ANTES de
    // pedir geolocalización, para fallar rápido con un mensaje claro.
    const { fecha: hoyMadrid, minutos: ahoraMin } = ahoraEnMadrid();
    // Si el redondeo aplica, la entrada se registra a la hora exacta del turno.
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
      : tiposActivos.find((t) => !t.requiere_solicitud) ?? null;

    if (tipoCodigo && !tipoSel) {
      return { ok: false, error: "El tipo de fichaje seleccionado no está disponible." };
    }

    if (tipoSel) {
      if (tipoSel.requiere_solicitud) {
        // Solo disponible si hay una solicitud de trabajo aprobada para hoy.
        const { data: sol } = await supabase
          .from("solicitudes_personal")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("user_id", user.id)
          .eq("tipo", "trabajo")
          .eq("estado", "aprobada")
          .lte("fecha_inicio", hoyMadrid)
          .or(`fecha_fin.is.null,fecha_fin.gte.${hoyMadrid}`)
          .limit(1);
        if (!sol || sol.length === 0) {
          return {
            ok: false,
            error: `Para fichar como "${tipoSel.nombre}" necesitas una solicitud de trabajo aprobada para hoy.`,
          };
        }
      } else {
        // Fichaje normal: exige horario asignado hoy. Si es FIJO, dentro de la
        // ventana de Ajustes RRHH → Fichajes (respecto a la hora de inicio). Si
        // es FLEXIBLE, sin ventana horaria, pero bloqueado si ya alcanzó su
        // objetivo de horas del periodo (día o semana, según el turno).
        const horario = await getHorarioDia(
          supabase,
          empresaId,
          empleado.id,
          hoyMadrid,
        );

        if (
          horario.tipo === "ninguno" ||
          (horario.tipo === "flexible" && horario.objetivoHoras <= 0)
        ) {
          return {
            ok: false,
            error: "No tienes horario asignado para hoy, así que no puedes fichar. Avisa a tu responsable.",
          };
        }

        if (horario.tipo === "flexible") {
          const consumido = await horasTrabajadasPeriodo(
            supabase,
            empresaId,
            user.id,
            hoyMadrid,
            horario.modo,
          );
          // Margen de 1 s para evitar rebotes por redondeo.
          if (consumido >= horario.objetivoHoras - 1 / 3600) {
            return {
              ok: false,
              error:
                horario.modo === "semanal"
                  ? `Ya has completado tus ${fmtHorasObjetivo(horario.objetivoHoras)} de esta semana. Podrás volver a fichar el lunes que viene.`
                  : `Ya has completado tus ${fmtHorasObjetivo(horario.objetivoHoras)} de hoy. Podrás volver a fichar mañana.`,
            };
          }
          // Flexible: sin ventana ni redondeo; se registra la entrada directa.
        } else {
          // tipo "fijo": ventana horaria respecto a la hora de inicio del turno.
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

          // Hora de inicio del turno del día = el tramo más temprano.
          const inicios = tramos
            .map((t) => hhmmAMinutos(t.inicio))
            .filter((m): m is number => m != null);
          const startMin = inicios.length ? Math.min(...inicios) : 0;
          const lower = startMin - margenAntes;
          const upper = startMin + margenDespues;
          const enVentana = (m: number) => m >= lower && m <= upper;
          // Tolerancia de medianoche para turnos que empiezan cerca de las 00:00.
          const dentro =
            enVentana(ahoraMin) || enVentana(ahoraMin + 1440) || enVentana(ahoraMin - 1440);

          if (!dentro) {
            return {
              ok: false,
              fueraDeHora: true,
              error: `No se te permite fichar: estás fuera de hora. Tu turno empieza a las ${minutosAHHMM(startMin)}. Si necesitas registrar estas horas, puedes pedir que las validen.`,
            };
          }

          // Redondeo a la hora exacta del turno (si procede).
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

    // Locales donde puede fichar EN ESTA empresa (tabla puente multi-local).
    const { data: asignados, error: asignadosErr } = await supabase
      .from("empleado_locales")
      .select("locales!inner(id, nombre, lat, lng, radio_metros, empresa_id)")
      .eq("empleado_id", empleado.id)
      .eq("locales.empresa_id", empresaId);
    if (asignadosErr) throw asignadosErr;
    const localesAsignados = (asignados ?? [])
      .map((r) => (r as unknown as { locales: {
        id: string; nombre: string | null; lat: number | null;
        lng: number | null; radio_metros: number;
      } }).locales)
      .filter(Boolean);
    if (localesAsignados.length === 0) {
      return {
        ok: false,
        error: "No tienes ningún local asignado en esta empresa. Pide a tu responsable que te asigne uno.",
      };
    }

    // El empleado solo ficha como teletrabajo si lo tiene permitido Y lo elige
    // explícitamente. En cualquier otro caso (incluido presencial elegido por
    // quien sí puede teletrabajar) se exige ubicación dentro de un local.
    const permiteTeletrabajo = Boolean(empleado.permite_teletrabajo);
    const modoTeletrabajo = permiteTeletrabajo && modoSolicitado === "teletrabajo";
    let centro = "";
    let localElegidoId: string;

    if (!modoTeletrabajo) {
      if (!geo) {
        return {
          ok: false,
          error: "Activa la geolocalización para poder fichar de forma presencial.",
        };
      }
      // Elige el local más cercano dentro de su radio (cualquiera de los suyos).
      let mejor: { id: string; nombre: string; dist: number } | null = null;
      let masCercano: { nombre: string; dist: number; radio: number } | null = null;
      for (const l of localesAsignados) {
        if (l.lat == null || l.lng == null) continue;
        const dist = distanciaMetros(geo.lat, geo.lng, l.lat, l.lng);
        if (!masCercano || dist < masCercano.dist) {
          masCercano = { nombre: l.nombre ?? "", dist, radio: l.radio_metros };
        }
        if (dist <= l.radio_metros && (!mejor || dist < mejor.dist)) {
          mejor = { id: l.id, nombre: l.nombre ?? "", dist };
        }
      }
      if (!mejor) {
        if (!masCercano) {
          return {
            ok: false,
            error: "Tus locales no tienen ubicación configurada. Avisa a tu responsable.",
          };
        }
        return {
          ok: false,
          error: `Estás a ${Math.round(masCercano.dist)} m de "${masCercano.nombre}" (radio permitido ${masCercano.radio} m). Acércate a un local asignado para fichar.`,
        };
      }
      localElegidoId = mejor.id;
      centro = mejor.nombre;
    } else {
      // Teletrabajo: no se valida zona; se usa el local por defecto (primero).
      localElegidoId = localesAsignados[0].id;
      centro = localesAsignados[0].nombre ?? "";
    }

    const ahora = new Date();
    const { data, error } = await supabase
      .from("fichajes")
      .insert({
        empresa_id: empresaId,
        empleado_id: user.id,
        empleado_nombre: nombre || "Sin nombre",
        fecha: todayISO(),
        hora_entrada: horaEntradaOverrideISO ?? ahora.toISOString(),
        estado: "trabajando",
        local_id: localElegidoId,
        lat_entrada: geo?.lat ?? null,
        lng_entrada: geo?.lng ?? null,
        precision_entrada_metros: geo?.precision ?? null,
        modo_teletrabajo: modoTeletrabajo,
        centro,
        tipo: tipoSel?.codigo ?? null,
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

export async function ficharSalidaPersonal(fichajeId: string, geo?: GeoInput) {
  try {
    const { supabase } = await getContext();
    const { data: fichaje, error: fetchErr } = await supabase
      .from("fichajes")
      .select("hora_entrada, local_id, modo_teletrabajo")
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
      })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true, data: { horas_totales: horasTotales } };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] ficharSalidaPersonal:", msg);
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
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    await autoCerrarFichajesHuerfanos(supabase, empresaId, user.id);
    const { data, error } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", user.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).map((f: Record<string, unknown>) => ({
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
      })),
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarMisFichajes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export interface ComunicadoVisible {
  id: string;
  titulo: string;
  contenido: string;
  prioridad: string;
  createdAt: string;
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
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { desde, hasta } = monthBounds(anio, mes);

    const [fichajesRes, solicitudesRes] = await Promise.all([
      supabase
        .from("fichajes")
        .select("fecha, horas_totales, estado")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", user.id)
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase
        .from("solicitudes_personal")
        .select("tipo, subtipo, fecha_inicio, fecha_fin, estado")
        .eq("empresa_id", empresaId)
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
      prev.horasFichaje = (f.horas_totales as number | null) ?? 0;
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

export interface NuevaSolicitudInput {
  tipo: SolicitudTipo;
  subtipo: SolicitudSubtipo;
  fechaInicio: string;
  fechaFin?: string | null;
  horas?: number | null;
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

type SupabaseAny = Awaited<ReturnType<typeof createClient>>;

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

async function userTieneRolDirector(supabase: SupabaseAny, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r: { role: string }) =>
    r.role === "director" || r.role === "admin",
  );
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
        const esDirector = await userTieneRolDirector(supabase, user.id);
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
      .select("id, empresa_id, user_id, tipo, empleado_nombre, subtipo, fecha_inicio, fecha_fin")
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
    // Correo interno a empleado → no-reply: no se responde al software.
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

  // 1) Generar PDF de la carta de baja voluntaria.
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generarCartaBajaVoluntariaPDF({
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
  } catch (e) {
    console.error("[mi-panel] baja_contrato: PDF falló:", extractErrorMessage(e));
  }

  // 2) Crear solicitud de firma eIDAS (modalidad email_otp, más segura).
  if (pdfBuffer) {
    const firma = await crearFirmaInterno({
      empresaId: args.empresaId,
      empleadoId: emp.id,
      pdf: pdfBuffer,
      titulo: "Carta de baja voluntaria",
      tipo: "baja_voluntaria",
      modalidad: "email_otp",
      validez: "eidas_simple",
      plazoDias: 7,
      observaciones: `Solicitud de baja con fecha efectiva ${formatFechaEs(args.fechaFin)} (${args.diasPreaviso} días de preaviso).`,
      enviadoPorUserId: args.userId,
      enviadoPorNombre: empleadoNombre,
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
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.balleshosteleros.com";
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
      // Aviso interno → no-reply: la empresa lo gestiona desde el panel de RRHH.
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
      },
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiPanelResumen:", msg);
    return { ok: false, data: EMPTY_RESUMEN, error: msg };
  }
}
