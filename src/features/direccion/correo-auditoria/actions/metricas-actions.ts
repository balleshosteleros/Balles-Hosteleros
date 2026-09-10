"use server";

/**
 * Los números del panel de auditoría de correos (PRP-094, Fase 3).
 *
 * Todo sale de la base: el panel NUNCA llama a Gmail al pintarse. Traer el
 * correo es otro trabajo (el cron), y así cambiar de periodo es instantáneo.
 *
 * El ranking y la serie se agregan en la base con dos funciones SQL. Bajar
 * miles de filas para contarlas en el navegador sería lento y, peor, chocaría
 * con el corte de 1.000 filas de Supabase: el panel enseñaría un ranking
 * incompleto sin decir nada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import { rangoDePeriodo, diasDelRango } from "../services/periodos";
import type {
  DatosPanelCorreo,
  FiltrosPanelCorreo,
} from "../types";

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

/** Panel vacío: se devuelve cuando no hay sesión o no hay empresa activa. */
const VACIO: DatosPanelCorreo = {
  rango: { desde: "", hasta: "", etiqueta: "" },
  buzones: [],
  totalEntrantes: 0,
  totalSalientes: 0,
  mediaDiaria: 0,
  contactosDistintos: 0,
  serie: [],
  ranking: [],
  hayBuzonesConectados: false,
};

export async function getPanelCorreoAction(
  filtros: FiltrosPanelCorreo,
): Promise<DatosPanelCorreo> {
  const { supabase, user, empresaId } = await getCtx();
  if (!user || !empresaId) return VACIO;

  const tz = await getZonaHorariaEmpresa(
    supabase as unknown as SupabaseClient,
    empresaId,
  );
  const rango = rangoDePeriodo(filtros.periodo, tz);

  // Los buzones de la empresa, con su estado. Se devuelven SIEMPRE, también los
  // que no están conectados: que un buzón no se pueda leer es información, y
  // enseñarlo con un 0 sería mentir.
  const { data: filasBuzones } = await supabase
    .from("correo_buzones")
    .select("id, email, etiqueta, conexion")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo")
    .order("etiqueta");

  const buzones = (filasBuzones ?? []).map((b) => ({
    id: b.id as string,
    email: String(b.email ?? ""),
    etiqueta: String(b.etiqueta ?? ""),
    conexion: b.conexion as "sin_conectar" | "conectado" | "caducado",
  }));

  const conectados = buzones.filter((b) => b.conexion !== "sin_conectar");
  if (!conectados.length) {
    return { ...VACIO, rango, buzones, hayBuzonesConectados: false };
  }

  // Un buzón concreto, o todos los que se pueden leer.
  const buzonIds = filtros.buzonId ? [filtros.buzonId] : conectados.map((b) => b.id);

  const [serieRes, rankingRes, distintosRes] = await Promise.all([
    supabase.rpc("correo_serie_dias", {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
      p_buzon_ids: buzonIds,
      p_incluir_automaticos: filtros.incluirAutomaticos,
    }),
    supabase.rpc("correo_ranking_contactos", {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
      p_buzon_ids: buzonIds,
      p_por_dominio: filtros.porDominio,
      p_incluir_automaticos: filtros.incluirAutomaticos,
      p_limite: 100,
    }),
    // Aparte del ranking: el ranking se corta en 100 filas y este número tiene
    // que ser el de verdad, también en un buzón con cientos de contactos.
    supabase.rpc("correo_contactos_distintos", {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
      p_buzon_ids: buzonIds,
      p_por_dominio: filtros.porDominio,
      p_incluir_automaticos: filtros.incluirAutomaticos,
    }),
  ]);

  type FilaSerie = { dia: string; entrantes: number; salientes: number };
  type FilaRanking = {
    contacto: string;
    nombre: string;
    entrantes: number;
    salientes: number;
    total: number;
    porcentaje: number | string;
    acumulado: number | string;
  };

  const porDia = new Map<string, FilaSerie>();
  for (const f of (serieRes.data ?? []) as FilaSerie[]) {
    porDia.set(f.dia, f);
  }

  // Los días sin correo se rellenan con ceros: en la gráfica, un día que no
  // aparece y un día sin correo se ven igual, y no son lo mismo.
  const serie = diasDelRango(rango.desde, rango.hasta).map((dia) => ({
    dia,
    entrantes: porDia.get(dia)?.entrantes ?? 0,
    salientes: porDia.get(dia)?.salientes ?? 0,
  }));

  const ranking = ((rankingRes.data ?? []) as FilaRanking[]).map((f) => ({
    contacto: f.contacto,
    nombre: f.nombre ?? "",
    entrantes: Number(f.entrantes),
    salientes: Number(f.salientes),
    total: Number(f.total),
    porcentaje: Number(f.porcentaje ?? 0),
    acumulado: Number(f.acumulado ?? 0),
  }));

  const totalEntrantes = serie.reduce((s, d) => s + d.entrantes, 0);
  const totalSalientes = serie.reduce((s, d) => s + d.salientes, 0);

  return {
    rango,
    buzones,
    totalEntrantes,
    totalSalientes,
    // Media por día del rango, con un decimal: en un mes, «12,4 al día» dice
    // mucho más que el total de 372.
    mediaDiaria:
      serie.length > 0
        ? Math.round(((totalEntrantes + totalSalientes) / serie.length) * 10) / 10
        : 0,
    contactosDistintos: Number(distintosRes.data ?? 0),
    serie,
    ranking,
    hayBuzonesConectados: true,
  };
}
