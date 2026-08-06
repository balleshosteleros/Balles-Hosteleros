"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/**
 * Las preguntas y secciones se duplican en cada versión de la plantilla, así que
 * las tendencias se agrupan por TEXTO (sección + pregunta) y no por id: solo así
 * una misma pregunta mantiene su serie histórica cuando se publica una versión nueva.
 */
function claveTexto(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Pendiente por mínimos cuadrados: puntos/auditoría. Positiva = mejora. */
function tendencia(valores: number[]): number {
  const n = valores.length;
  if (n < 2) return 0;
  const mediaX = (n - 1) / 2;
  const mediaY = valores.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mediaX) * (valores[i] - mediaY);
    den += (i - mediaX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export interface PuntoSerie {
  envio_id: string;
  fecha: string;
  numero_secuencial: number;
  nota: number;
}

export interface PreguntaAnalitica {
  clave: string;
  texto: string;
  seccion: string;
  media: number;
  /** Pendiente de la recta de regresión (puntos sobre 10 por auditoría). */
  tendencia: number;
  veces: number;
  serie: PuntoSerie[];
}

export interface SeccionAnalitica {
  clave: string;
  titulo: string;
  orden: number;
  media: number;
  tendencia: number;
  serie: PuntoSerie[];
  preguntas: PreguntaAnalitica[];
}

export interface AnaliticaAuditorias {
  /** Auditorías incluidas, de más antigua a más reciente. */
  auditorias: Array<{
    id: string;
    fecha: string;
    numero_secuencial: number;
    nota: number | null;
    local_nombre: string;
    version: number;
  }>;
  mediaGlobal: number | null;
  tendenciaGlobal: number;
  secciones: SeccionAnalitica[];
  /** Filtros disponibles calculados sobre los datos reales. */
  plantillas: Array<{ id: string; nombre: string }>;
  locales: Array<{ id: string; nombre: string }>;
}

export interface AnaliticaFiltros {
  plantillaId?: string;
  localId?: string;
  desde?: string;
  hasta?: string;
}

export async function getAnaliticaAuditorias(
  filtros: AnaliticaFiltros = {},
): Promise<AnaliticaAuditorias> {
  const vacio: AnaliticaAuditorias = {
    auditorias: [],
    mediaGlobal: null,
    tendenciaGlobal: 0,
    secciones: [],
    plantillas: [],
    locales: [],
  };

  const { supabase, empresaId } = await ctx();
  if (!empresaId) return vacio;

  // 1. Auditorías de la empresa (solo enviadas: los borradores falsearían las medias).
  let query = supabase
    .from("auditoria_envios")
    .select(`
      id, numero_secuencial, fecha, nota_final, version_id, plantilla_id, local_id,
      plantilla:auditoria_plantillas!auditoria_envios_plantilla_id_fkey(nombre),
      version:auditoria_plantilla_versiones!auditoria_envios_version_id_fkey(version),
      local:locales!auditoria_envios_local_id_fkey(nombre)
    `)
    .eq("empresa_id", empresaId)
    .eq("estado", "enviada")
    .order("fecha", { ascending: true });

  if (filtros.plantillaId) query = query.eq("plantilla_id", filtros.plantillaId);
  if (filtros.localId) query = query.eq("local_id", filtros.localId);
  if (filtros.desde) query = query.gte("fecha", filtros.desde);
  if (filtros.hasta) query = query.lte("fecha", filtros.hasta);

  const { data: envios, error } = await query;
  if (error || !envios || envios.length === 0) {
    if (error) console.error("[auditorias] getAnaliticaAuditorias:", error.message);
    return vacio;
  }

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  // Catálogos de filtro (a partir de lo realmente auditado).
  const plantillasMap = new Map<string, string>();
  const localesMap = new Map<string, string>();
  for (const e of envios) {
    const p = uno(e.plantilla as { nombre: string } | { nombre: string }[] | null);
    const l = uno(e.local as { nombre: string } | { nombre: string }[] | null);
    if (e.plantilla_id && p?.nombre) plantillasMap.set(e.plantilla_id as string, p.nombre);
    if (e.local_id && l?.nombre) localesMap.set(e.local_id as string, l.nombre);
  }

  // 2. Estructura de TODAS las versiones implicadas.
  const versionIds = [...new Set(envios.map((e) => e.version_id as string))];
  const { data: secciones } = await supabase
    .from("auditoria_secciones")
    .select("id, version_id, orden, titulo")
    .in("version_id", versionIds);

  const seccionIds = (secciones ?? []).map((s) => s.id);
  const { data: preguntas } = seccionIds.length
    ? await supabase
        .from("auditoria_preguntas")
        .select("id, seccion_id, texto, tipo, escala_max")
        .in("seccion_id", seccionIds)
        .eq("tipo", "escala")
    : { data: [] as Array<{ id: string; seccion_id: string; texto: string; tipo: string; escala_max: number | null }> };

  // 3. Respuestas de todas las auditorías.
  const envioIds = envios.map((e) => e.id as string);
  const { data: respuestas } = await supabase
    .from("auditoria_respuestas")
    .select("envio_id, pregunta_id, valor_numero")
    .in("envio_id", envioIds)
    .not("valor_numero", "is", null);

  const seccionPorId = new Map((secciones ?? []).map((s) => [s.id as string, s]));
  const preguntaPorId = new Map((preguntas ?? []).map((p) => [p.id as string, p]));

  // 4. Agregación por auditoría → sección → pregunta (con claves de texto).
  //    Cada respuesta se normaliza a 0..10 ANTES de sumarse: así una sección que
  //    mezclase escalas (0..5 y 0..10) sigue promediando bien.
  type Acc = { suma: number; cuenta: number };
  const nuevoAcc = (): Acc => ({ suma: 0, cuenta: 0 });

  const porEnvioSeccion = new Map<string, Map<string, Acc>>();
  const porEnvioPregunta = new Map<string, Map<string, Acc>>();
  const etiquetaSeccion = new Map<string, { titulo: string; orden: number }>();
  const etiquetaPregunta = new Map<string, { texto: string; seccionClave: string; seccionTitulo: string }>();

  for (const r of respuestas ?? []) {
    const pregunta = preguntaPorId.get(r.pregunta_id as string);
    if (!pregunta) continue; // no es escala (observaciones) o versión ajena al filtro
    const seccion = seccionPorId.get(pregunta.seccion_id);
    if (!seccion) continue;

    const envioId = r.envio_id as string;
    const sClave = claveTexto(seccion.titulo);
    const pClave = `${sClave}||${claveTexto(pregunta.texto)}`;
    const escalaMax = pregunta.escala_max ?? 5;
    if (escalaMax <= 0) continue;
    const valor = (Number(r.valor_numero) / escalaMax) * 10;

    if (!etiquetaSeccion.has(sClave)) {
      etiquetaSeccion.set(sClave, { titulo: seccion.titulo, orden: seccion.orden });
    }
    if (!etiquetaPregunta.has(pClave)) {
      etiquetaPregunta.set(pClave, { texto: pregunta.texto, seccionClave: sClave, seccionTitulo: seccion.titulo });
    }

    const mapaS = porEnvioSeccion.get(envioId) ?? new Map<string, Acc>();
    const accS = mapaS.get(sClave) ?? nuevoAcc();
    accS.suma += valor;
    accS.cuenta += 1;
    mapaS.set(sClave, accS);
    porEnvioSeccion.set(envioId, mapaS);

    const mapaP = porEnvioPregunta.get(envioId) ?? new Map<string, Acc>();
    const accP = mapaP.get(pClave) ?? nuevoAcc();
    accP.suma += valor;
    accP.cuenta += 1;
    mapaP.set(pClave, accP);
    porEnvioPregunta.set(envioId, mapaP);
  }

  const meta = envios.map((e) => ({
    id: e.id as string,
    fecha: e.fecha as string,
    numero_secuencial: e.numero_secuencial as number,
    nota: e.nota_final === null || e.nota_final === undefined ? null : Number(e.nota_final),
    local_nombre: uno(e.local as { nombre: string } | { nombre: string }[] | null)?.nombre ?? "—",
    version: uno(e.version as { version: number } | { version: number }[] | null)?.version ?? 1,
  }));

  // 5. Series temporales por sección y pregunta.
  const serieDe = (
    mapa: Map<string, Map<string, Acc>>,
    clave: string,
  ): PuntoSerie[] => {
    const puntos: PuntoSerie[] = [];
    for (const m of meta) {
      const acc = mapa.get(m.id)?.get(clave);
      if (!acc || acc.cuenta === 0) continue;
      const nota = acc.suma / acc.cuenta; // ya normalizada a 0..10
      puntos.push({
        envio_id: m.id,
        fecha: m.fecha,
        numero_secuencial: m.numero_secuencial,
        nota: Math.round(nota * 100) / 100,
      });
    }
    return puntos;
  };

  const media = (nums: number[]): number =>
    nums.length === 0 ? 0 : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;

  const preguntasPorSeccion = new Map<string, PreguntaAnalitica[]>();
  for (const [pClave, info] of etiquetaPregunta) {
    const serie = serieDe(porEnvioPregunta, pClave);
    if (serie.length === 0) continue;
    const notas = serie.map((s) => s.nota);
    const arr = preguntasPorSeccion.get(info.seccionClave) ?? [];
    arr.push({
      clave: pClave,
      texto: info.texto,
      seccion: info.seccionTitulo,
      media: media(notas),
      tendencia: Math.round(tendencia(notas) * 1000) / 1000,
      veces: serie.length,
      serie,
    });
    preguntasPorSeccion.set(info.seccionClave, arr);
  }

  const seccionesAnalitica: SeccionAnalitica[] = [...etiquetaSeccion.entries()]
    .map(([sClave, info]) => {
      const serie = serieDe(porEnvioSeccion, sClave);
      const notas = serie.map((s) => s.nota);
      return {
        clave: sClave,
        titulo: info.titulo,
        orden: info.orden,
        media: media(notas),
        tendencia: Math.round(tendencia(notas) * 1000) / 1000,
        serie,
        preguntas: (preguntasPorSeccion.get(sClave) ?? []).sort((a, b) => a.media - b.media),
      };
    })
    .filter((s) => s.serie.length > 0)
    .sort((a, b) => a.orden - b.orden);

  const notasGlobales = meta.map((m) => m.nota).filter((n): n is number => n !== null);

  return {
    auditorias: meta,
    mediaGlobal: notasGlobales.length ? media(notasGlobales) : null,
    tendenciaGlobal: Math.round(tendencia(notasGlobales) * 1000) / 1000,
    secciones: seccionesAnalitica,
    plantillas: [...plantillasMap].map(([id, nombre]) => ({ id, nombre })),
    locales: [...localesMap].map(([id, nombre]) => ({ id, nombre })),
  };
}
