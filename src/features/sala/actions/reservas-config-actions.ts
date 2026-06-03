"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CANCELACION_HORAS_DEFAULT,
  CANCELACION_IMPORTE_DEFAULT,
  DURACION_RESERVA_DEFAULT_MINUTOS,
  RECONFIRMACION_DIAS_DEFAULT,
  type EmpresaReservasConfig,
  type DiaSemanaKey,
  type TurnoKey,
  type IntervaloReservaMin,
  type MaxPersonasHoraModo,
  type MaxPersonasReglaTramo,
} from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

const DIAS: DiaSemanaKey[] = ["lun","mar","mie","jue","vie","sab","dom"];
const TURNOS: TurnoKey[] = ["comida","cena"];

function rowToConfig(row: Record<string, unknown>): EmpresaReservasConfig {
  const out: Record<string, unknown> = {
    empresaId: row.empresa_id,
    antelacionMinMinutos: (row.antelacion_min_minutos as number) ?? 0,
    antelacionMaxDias:    (row.antelacion_max_dias as number)    ?? 90,
    duracionReservaMin:   (row.duracion_reserva_min as number)   ?? DURACION_RESERVA_DEFAULT_MINUTOS,
    generalInicioComida:  (row.general_inicio_comida as string | null) ?? null,
    generalFinComida:     (row.general_fin_comida    as string | null) ?? null,
    generalInicioCena:    (row.general_inicio_cena   as string | null) ?? null,
    generalFinCena:       (row.general_fin_cena      as string | null) ?? null,
    generalCerradoComida: Boolean(row.general_cerrado_comida ?? false),
    generalCerradoCena:   Boolean(row.general_cerrado_cena   ?? false),
    generalSlotsInactivosComida: Array.isArray(row.general_slots_inactivos_comida)
      ? (row.general_slots_inactivos_comida as string[])
      : [],
    generalSlotsInactivosCena: Array.isArray(row.general_slots_inactivos_cena)
      ? (row.general_slots_inactivos_cena as string[])
      : [],
    cancelacionHorasAntes:           (row.cancelacion_horas_antes as number) ?? CANCELACION_HORAS_DEFAULT,
    cancelacionImporteEur:           Number(row.cancelacion_importe_eur ?? CANCELACION_IMPORTE_DEFAULT),
    cancelacionPersonalizarMensaje:  Boolean(row.cancelacion_personalizar_mensaje ?? false),
    cancelacionMensajePersonalizado: (row.cancelacion_mensaje_personalizado as string | null) ?? null,
    productoPersonalizarMensaje:     Boolean(row.producto_personalizar_mensaje ?? false),
    productoMensajePersonalizado:    (row.producto_mensaje_personalizado as string | null) ?? null,
    reconfirmacionDiasAntes:        (row.reconfirmacion_dias_antes as number) ?? RECONFIRMACION_DIAS_DEFAULT,
    reconfirmacionLt24hInmediata:   Boolean(row.reconfirmacion_lt_24h_inmediata ?? false),
    recordatorioActivo:             Boolean(row.recordatorio_activo ?? false),
    recordatorioHorasAntes:         (row.recordatorio_horas_antes as number) ?? 3,

    cerrarMotorWebActivo:  Boolean(row.cerrar_motor_web_activo ?? false),
    cerrarMotorWebComida:  (row.cerrar_motor_web_comida as string | null) ?? null,
    cerrarMotorWebCena:    (row.cerrar_motor_web_cena   as string | null) ?? null,

    maxPersonasHoraActivo: Boolean(row.max_personas_hora_activo ?? false),
    maxPersonasHoraModo:   ((row.max_personas_hora_modo as MaxPersonasHoraModo | null) ?? "mismo"),
    maxPersonasHoraGlobal: (row.max_personas_hora_global as number | null) ?? null,
    maxPersonasHoraReglas: Array.isArray(row.max_personas_hora_reglas)
      ? (row.max_personas_hora_reglas as MaxPersonasReglaTramo[])
      : [],

    parpadeoPasadoDuracion: Boolean(row.parpadeo_pasado_duracion ?? false),
    parpadeo0a15:           Boolean(row.parpadeo_0_15 ?? false),
    parpadeo15a30:          Boolean(row.parpadeo_15_30 ?? false),

    intervaloReservaMin: ((row.intervalo_reserva_min as IntervaloReservaMin | null) ?? 15) as IntervaloReservaMin,
    ocultarCanceladas:   Boolean(row.ocultar_canceladas ?? false),
  };
  for (const d of DIAS) {
    for (const t of TURNOS) {
      out[`${d}_inicio_${t}`]  = (row[`${d}_inicio_${t}`]  as string | null) ?? null;
      out[`${d}_fin_${t}`]     = (row[`${d}_fin_${t}`]     as string | null) ?? null;
      out[`${d}_cerrado_${t}`] = (row[`${d}_cerrado_${t}`] as boolean | null) ?? null;
    }
  }
  return out as unknown as EmpresaReservasConfig;
}

/**
 * Devuelve la config de la empresa actual. Si no existe la fila la crea con
 * valores por defecto (datos completos obligatorio: el resto se rellena en el
 * Sheet de configuración).
 */
export async function getReservasConfig() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: null as EmpresaReservasConfig | null };
    const { data, error } = await supabase
      .from("empresa_reservas_config")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (data) return { ok: true, data: rowToConfig(data) };
    // crear fila base
    const { data: created, error: errC } = await supabase
      .from("empresa_reservas_config")
      .insert({ empresa_id: empresaId })
      .select("*")
      .single();
    if (errC) throw errC;
    return { ok: true, data: created ? rowToConfig(created) : null };
  } catch (err) {
    console.error("[reservas-config] get:", err);
    return { ok: false, data: null as EmpresaReservasConfig | null };
  }
}

/**
 * Acepta un objeto parcial con las mismas claves que `EmpresaReservasConfig`
 * (en camelCase) y mapea a snake_case para BD. Solo persiste las claves
 * presentes; null es válido (significa "sin valor en ese nivel").
 */
export async function upsertReservasConfig(updates: Partial<EmpresaReservasConfig>) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const db: Record<string, unknown> = { empresa_id: empresaId };
    if ("antelacionMinMinutos" in updates) db.antelacion_min_minutos = updates.antelacionMinMinutos;
    if ("antelacionMaxDias"    in updates) db.antelacion_max_dias    = updates.antelacionMaxDias;
    if ("duracionReservaMin"   in updates) db.duracion_reserva_min   = updates.duracionReservaMin;
    if ("generalInicioComida"  in updates) db.general_inicio_comida  = updates.generalInicioComida;
    if ("generalFinComida"     in updates) db.general_fin_comida     = updates.generalFinComida;
    if ("generalInicioCena"    in updates) db.general_inicio_cena    = updates.generalInicioCena;
    if ("generalFinCena"       in updates) db.general_fin_cena       = updates.generalFinCena;
    if ("generalCerradoComida" in updates) db.general_cerrado_comida = updates.generalCerradoComida;
    if ("generalCerradoCena"   in updates) db.general_cerrado_cena   = updates.generalCerradoCena;
    if ("generalSlotsInactivosComida" in updates) db.general_slots_inactivos_comida = updates.generalSlotsInactivosComida ?? [];
    if ("generalSlotsInactivosCena"   in updates) db.general_slots_inactivos_cena   = updates.generalSlotsInactivosCena   ?? [];
    if ("cancelacionHorasAntes"           in updates) db.cancelacion_horas_antes           = updates.cancelacionHorasAntes;
    if ("cancelacionImporteEur"           in updates) db.cancelacion_importe_eur           = updates.cancelacionImporteEur;
    if ("cancelacionPersonalizarMensaje"  in updates) db.cancelacion_personalizar_mensaje  = updates.cancelacionPersonalizarMensaje;
    if ("cancelacionMensajePersonalizado" in updates) db.cancelacion_mensaje_personalizado = updates.cancelacionMensajePersonalizado;
    if ("productoPersonalizarMensaje"     in updates) db.producto_personalizar_mensaje     = updates.productoPersonalizarMensaje;
    if ("productoMensajePersonalizado"    in updates) db.producto_mensaje_personalizado    = updates.productoMensajePersonalizado;
    if ("reconfirmacionDiasAntes"         in updates) db.reconfirmacion_dias_antes         = updates.reconfirmacionDiasAntes;
    if ("reconfirmacionLt24hInmediata"    in updates) db.reconfirmacion_lt_24h_inmediata   = updates.reconfirmacionLt24hInmediata;
    if ("recordatorioActivo"              in updates) db.recordatorio_activo               = updates.recordatorioActivo;
    if ("recordatorioHorasAntes"          in updates) db.recordatorio_horas_antes          = updates.recordatorioHorasAntes;
    if ("cerrarMotorWebActivo"  in updates) db.cerrar_motor_web_activo  = updates.cerrarMotorWebActivo;
    if ("cerrarMotorWebComida"  in updates) db.cerrar_motor_web_comida  = updates.cerrarMotorWebComida;
    if ("cerrarMotorWebCena"    in updates) db.cerrar_motor_web_cena    = updates.cerrarMotorWebCena;
    if ("maxPersonasHoraActivo" in updates) db.max_personas_hora_activo = updates.maxPersonasHoraActivo;
    if ("maxPersonasHoraModo"   in updates) db.max_personas_hora_modo   = updates.maxPersonasHoraModo;
    if ("maxPersonasHoraGlobal" in updates) db.max_personas_hora_global = updates.maxPersonasHoraGlobal;
    if ("maxPersonasHoraReglas" in updates) db.max_personas_hora_reglas = updates.maxPersonasHoraReglas;
    if ("parpadeoPasadoDuracion" in updates) db.parpadeo_pasado_duracion = updates.parpadeoPasadoDuracion;
    if ("parpadeo0a15"           in updates) db.parpadeo_0_15            = updates.parpadeo0a15;
    if ("parpadeo15a30"          in updates) db.parpadeo_15_30           = updates.parpadeo15a30;
    if ("intervaloReservaMin"    in updates) db.intervalo_reserva_min    = updates.intervaloReservaMin;
    if ("ocultarCanceladas"      in updates) db.ocultar_canceladas       = updates.ocultarCanceladas;
    for (const d of DIAS) {
      for (const t of TURNOS) {
        const kIni = `${d}_inicio_${t}` as const;
        const kFin = `${d}_fin_${t}` as const;
        const kCer = `${d}_cerrado_${t}` as const;
        if (kIni in updates) db[kIni] = (updates as Record<string, unknown>)[kIni];
        if (kFin in updates) db[kFin] = (updates as Record<string, unknown>)[kFin];
        if (kCer in updates) db[kCer] = (updates as Record<string, unknown>)[kCer];
      }
    }
    const { error } = await supabase
      .from("empresa_reservas_config")
      .upsert(db, { onConflict: "empresa_id" });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-config] upsert:", msg);
    return { ok: false, error: msg };
  }
}
