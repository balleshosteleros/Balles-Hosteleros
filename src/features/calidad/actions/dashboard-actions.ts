"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  DEFAULT_KPI_THRESHOLDS,
  type CalidadDashboard,
  type KpiThresholds,
} from "@/features/calidad/types/dashboard";

function trimestreActual(now = new Date()): { label: string; inicio: string; fin: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = Math.floor(month / 3);
  const startMonth = q * 3;
  const inicio = new Date(year, startMonth, 1);
  const fin = new Date(year, startMonth + 3, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { label: `T${q + 1} ${year}`, inicio: iso(inicio), fin: iso(fin) };
}

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function getCalidadDashboard(): Promise<CalidadDashboard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const trimestre = trimestreActual();
  const empty: CalidadDashboard = {
    empresaNombre: null,
    trimestre,
    thresholds: DEFAULT_KPI_THRESHOLDS,
    auditorias: {
      enviadasTrimestre: 0,
      pendientesBorrador: 0,
      notaMediaTrimestre: null,
      plantillasActivas: 0,
      porLocal: [],
    },
    inspecciones: {
      enviadasTrimestre: 0,
      pendientesRevision: 0,
      revisadasTrimestre: 0,
      notaMediaTrimestre: null,
      plantillasPublicadas: 0,
    },
    resenas: {
      totalTrimestre: 0,
      ratingMedio: null,
      excelente: 0,
      regular: 0,
      malo: 0,
      sinResponder: 0,
      pctPendientesPct: 0,
    },
    cuestionarios: {
      campanasActivas: 0,
      enviosTotalesActivas: 0,
      respondidosActivas: 0,
      pctRespuestaActivas: 0,
      reunionesPendientesActivas: 0,
      puntosAbiertosTotal: 0,
    },
  };
  if (!user) return empty;
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return empty;

  const [
    { data: empresaRow },
    { data: auditoriasEnvios },
    { data: auditoriaPlantillas },
    { data: inspeccionEnvios },
    { data: inspeccionPlantillas },
    { data: resenasRows },
    { data: campanasActivas },
    { data: puntosAbiertos },
  ] = await Promise.all([
    supabase.from("empresas").select("nombre, config_operativa").eq("id", empresaId).maybeSingle(),
    supabase
      .from("auditoria_envios")
      .select(
        `id, fecha, nota_final, estado,
         local:locales!auditoria_envios_local_id_fkey(nombre)`,
      )
      .eq("empresa_id", empresaId),
    supabase.from("auditoria_plantillas").select("id, archivada").eq("empresa_id", empresaId),
    supabase
      .from("inspeccion_envios")
      .select("id, nota_final, estado, created_at, fecha_inspeccion")
      .eq("empresa_id", empresaId),
    supabase.from("inspeccion_plantilla_versiones").select("id, estado").eq("estado", "publicada"),
    supabase
      .from("resenas")
      .select("*")
      .eq("empresa_id", empresaId),
    supabase
      .from("cuestionario_campanas")
      .select("id, estado")
      .eq("empresa_id", empresaId)
      .eq("estado", "activa"),
    supabase
      .from("cuestionario_puntos")
      .select("id, estado")
      .eq("empresa_id", empresaId)
      .in("estado", ["pendiente", "en_curso"]),
  ]);

  const cfg = (empresaRow?.config_operativa as Record<string, unknown> | null) ?? {};
  const cfgKpis = (cfg["calidad_kpis"] as Partial<KpiThresholds>) ?? {};
  const thresholds: KpiThresholds = { ...DEFAULT_KPI_THRESHOLDS, ...cfgKpis };

  // Auditorías
  const aEnvios = (auditoriasEnvios ?? []) as Array<{
    id: string;
    fecha: string | null;
    nota_final: number | null;
    estado: "borrador" | "enviada";
    local: { nombre?: string } | Array<{ nombre?: string }> | null;
  }>;
  const aTrimestre = aEnvios.filter(
    (e) =>
      e.estado === "enviada" &&
      e.fecha &&
      e.fecha >= trimestre.inicio &&
      e.fecha <= trimestre.fin,
  );
  const aPendientes = aEnvios.filter((e) => e.estado === "borrador").length;
  const porLocalMap = new Map<string, { envios: number; notas: number[] }>();
  for (const e of aTrimestre) {
    const local = Array.isArray(e.local) ? e.local[0] : e.local;
    const nombre = local?.nombre ?? "Sin local";
    const cur = porLocalMap.get(nombre) ?? { envios: 0, notas: [] };
    cur.envios += 1;
    if (typeof e.nota_final === "number") cur.notas.push(e.nota_final);
    porLocalMap.set(nombre, cur);
  }
  const porLocal = Array.from(porLocalMap.entries())
    .map(([local, v]) => ({ local, envios: v.envios, notaMedia: avg(v.notas) }))
    .sort((a, b) => b.envios - a.envios);

  // Inspecciones
  const iEnvios = (inspeccionEnvios ?? []) as Array<{
    id: string;
    nota_final: number | null;
    estado: "pendiente_revision" | "revisado" | "archivado";
    created_at: string;
    fecha_inspeccion: string | null;
  }>;
  const iTrimestre = iEnvios.filter((e) => {
    const ref = (e.fecha_inspeccion ?? e.created_at).slice(0, 10);
    return ref >= trimestre.inicio && ref <= trimestre.fin;
  });
  const iPendientes = iEnvios.filter((e) => e.estado === "pendiente_revision").length;
  const iRevisadasTrim = iTrimestre.filter((e) => e.estado === "revisado").length;

  // Reseñas
  const rRows = (resenasRows ?? []) as Array<{
    id: string;
    rating: number | null;
    estado: string;
    respondida: boolean;
    respuesta_publicada_at: string | null;
    fecha_reseña: string | null;
    created_at: string;
  }>;
  const rTrimestre = rRows.filter((r) => {
    const ref = (r.fecha_reseña ?? r.created_at).slice(0, 10);
    return ref >= trimestre.inicio && ref <= trimestre.fin;
  });
  const sinResponder = rRows.filter((r) => !r.respondida && r.rating != null).length;
  const pctPendientesPct =
    rRows.length === 0 ? 0 : Math.round((sinResponder / rRows.length) * 100);

  // Cuestionarios — usar conteos del modelo (las campañas tienen totales agregados en BD).
  const activasIds = (campanasActivas ?? []).map((c) => c.id as string);
  let enviosTotalesActivas = 0;
  let respondidosActivas = 0;
  let reunionesPendientesActivas = 0;
  if (activasIds.length > 0) {
    const { data: envios } = await supabase
      .from("cuestionario_envios")
      .select("id, respondido, reunion_estado, campana_id")
      .in("campana_id", activasIds);
    const rows = (envios ?? []) as Array<{
      id: string;
      respondido: boolean | null;
      reunion_estado: string | null;
    }>;
    enviosTotalesActivas = rows.length;
    respondidosActivas = rows.filter((r) => r.respondido === true).length;
    reunionesPendientesActivas = rows.filter((r) => r.reunion_estado === "pendiente").length;
  }
  const pctRespuestaActivas =
    enviosTotalesActivas === 0
      ? 0
      : Math.round((respondidosActivas / enviosTotalesActivas) * 100);

  return {
    empresaNombre: (empresaRow?.nombre as string | undefined) ?? null,
    trimestre,
    thresholds,
    auditorias: {
      enviadasTrimestre: aTrimestre.length,
      pendientesBorrador: aPendientes,
      notaMediaTrimestre: avg(aTrimestre.map((e) => e.nota_final)),
      plantillasActivas: (auditoriaPlantillas ?? []).filter(
        (p) => !(p as { archivada: boolean }).archivada,
      ).length,
      porLocal,
    },
    inspecciones: {
      enviadasTrimestre: iTrimestre.length,
      pendientesRevision: iPendientes,
      revisadasTrimestre: iRevisadasTrim,
      notaMediaTrimestre: avg(iTrimestre.map((e) => e.nota_final)),
      plantillasPublicadas: (inspeccionPlantillas ?? []).length,
    },
    resenas: {
      totalTrimestre: rTrimestre.length,
      ratingMedio: avg(rRows.map((r) => r.rating)),
      excelente: rRows.filter((r) => r.estado === "excelente").length,
      regular: rRows.filter((r) => r.estado === "regular").length,
      malo: rRows.filter((r) => r.estado === "malo").length,
      sinResponder,
      pctPendientesPct,
    },
    cuestionarios: {
      campanasActivas: (campanasActivas ?? []).length,
      enviosTotalesActivas,
      respondidosActivas,
      pctRespuestaActivas,
      reunionesPendientesActivas,
      puntosAbiertosTotal: (puntosAbiertos ?? []).length,
    },
  };
}

export async function updateCalidadKpiThresholds(
  thresholds: Partial<KpiThresholds>,
): Promise<{ ok: true; thresholds: KpiThresholds } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data: row, error: readErr } = await supabase
    .from("empresas")
    .select("config_operativa")
    .eq("id", empresaId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  const cfg = ((row?.config_operativa as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  const prevKpis = (cfg["calidad_kpis"] as Partial<KpiThresholds>) ?? {};
  const nextKpis: KpiThresholds = { ...DEFAULT_KPI_THRESHOLDS, ...prevKpis, ...thresholds };
  cfg["calidad_kpis"] = nextKpis;

  const { error: writeErr } = await supabase
    .from("empresas")
    .update({ config_operativa: cfg })
    .eq("id", empresaId);
  if (writeErr) return { ok: false, error: writeErr.message };

  return { ok: true, thresholds: nextKpis };
}
