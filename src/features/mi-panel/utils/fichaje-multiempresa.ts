// Helpers multi-empresa para el fichaje del empleado (PRP-060).
//
// Un empleado puede tener UNA fila en `empleados` por cada empresa del grupo
// (no hay ficha única). El fichaje en Mi Panel es AGNÓSTICO de empresa: la
// presencia se valida por geolocalización (local más cercano entre TODAS sus
// empresas) y el horario del día se resuelve combinando los turnos de cada
// empresa. La atribución a una u otra empresa queda por debajo (cumplimiento
// legal), nunca la elige el empleado.
//
// Todos los helpers reciben el cliente Supabase (igual que `horario-empleado`)
// para poder usarse desde server actions sin violar las reglas de "use server".

import type { SupabaseClient } from "@supabase/supabase-js";
import { distanciaMetros } from "@/features/rrhh/utils/geo";
import { getHorarioDia, hhmmAMinutos, type HorarioDia } from "@/features/rrhh/utils/horario-empleado";

/** Una fila de empleado del usuario en una empresa concreta. */
export interface FilaEmpleadoEmpresa {
  empresaId: string;
  /** `empleados.id` — distinto por empresa; NO es el `user_id`. */
  empleadoId: string;
  permiteTeletrabajo: boolean;
}

/** Local de fichaje con su empresa/empleado de origen, para resolver por geo. */
export interface LocalMultiEmpresa {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  radioMetros: number;
  empresaId: string;
  empleadoId: string;
}

/** Horario del día de una empresa concreta del usuario. */
export interface HorarioEmpresaDia {
  empresaId: string;
  empleadoId: string;
  horario: HorarioDia;
}

/**
 * Todas las filas de `empleados` del usuario (una por empresa a la que
 * pertenece). Base de toda la lógica agnóstica de empresa.
 */
export async function getMisFilasEmpleado(
  supabase: SupabaseClient,
  userId: string,
): Promise<FilaEmpleadoEmpresa[]> {
  const { data, error } = await supabase
    .from("empleados")
    .select("id, empresa_id, permite_teletrabajo")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    empresaId: r.empresa_id as string,
    empleadoId: r.id as string,
    permiteTeletrabajo: Boolean((r as { permite_teletrabajo?: boolean }).permite_teletrabajo),
  }));
}

/**
 * Todos los locales donde el usuario puede fichar, de TODAS sus empresas, cada
 * uno etiquetado con la empresa y el `empleado.id` correspondientes.
 */
export async function getMisLocales(
  supabase: SupabaseClient,
  userId: string,
  filas?: FilaEmpleadoEmpresa[],
): Promise<LocalMultiEmpresa[]> {
  const rows = filas ?? (await getMisFilasEmpleado(supabase, userId));
  if (rows.length === 0) return [];
  const empleadoIds = rows.map((f) => f.empleadoId);
  const empresaPorEmpleado = new Map(rows.map((f) => [f.empleadoId, f.empresaId]));

  const { data, error } = await supabase
    .from("empleado_locales")
    .select("empleado_id, locales!inner(id, nombre, lat, lng, radio_metros, empresa_id)")
    .in("empleado_id", empleadoIds);
  if (error) throw error;

  const out: LocalMultiEmpresa[] = [];
  for (const r of data ?? []) {
    const row = r as unknown as {
      empleado_id: string;
      locales: {
        id: string;
        nombre: string | null;
        lat: number | null;
        lng: number | null;
        radio_metros: number;
        empresa_id: string;
      } | null;
    };
    const l = row.locales;
    if (!l) continue;
    out.push({
      id: l.id,
      nombre: l.nombre ?? "",
      lat: l.lat,
      lng: l.lng,
      radioMetros: l.radio_metros,
      // La empresa "real" es la del local; el empleado.id es el de la fila.
      empresaId: l.empresa_id ?? empresaPorEmpleado.get(row.empleado_id) ?? "",
      empleadoId: row.empleado_id,
    });
  }
  return out;
}

/** Resultado de resolver dónde está el empleado al fichar. */
export type PresenciaGeo =
  | {
      ok: true;
      empresaId: string;
      empleadoId: string;
      localId: string;
      centro: string;
      distancia: number;
    }
  | {
      ok: false;
      /** Motivo legible para la UI. */
      error: string;
      /** Local más cercano (aunque fuera de radio), para el mensaje. */
      masCercano?: { nombre: string; dist: number; radio: number };
      sinUbicacion?: boolean;
    };

/**
 * Resuelve, a partir de la geolocalización, en qué local (y por tanto en qué
 * empresa + empleado) está el usuario. Recorre los locales de TODAS sus
 * empresas y elige el más cercano dentro de su radio. Desempate: el más
 * cercano en metros. El empleado nunca elige empresa: sale del local.
 */
export async function resolverPresenciaPorGeo(
  supabase: SupabaseClient,
  userId: string,
  geo: { lat: number; lng: number },
  filas?: FilaEmpleadoEmpresa[],
): Promise<PresenciaGeo> {
  const locales = await getMisLocales(supabase, userId, filas);
  if (locales.length === 0) {
    return {
      ok: false,
      error: "No tienes ningún local asignado. Pide a tu responsable que te asigne uno.",
    };
  }

  let mejor: { local: LocalMultiEmpresa; dist: number } | null = null;
  let masCercano: { nombre: string; dist: number; radio: number } | null = null;
  let algunoConUbicacion = false;

  for (const l of locales) {
    if (l.lat == null || l.lng == null) continue;
    algunoConUbicacion = true;
    const dist = distanciaMetros(geo.lat, geo.lng, l.lat, l.lng);
    if (!masCercano || dist < masCercano.dist) {
      masCercano = { nombre: l.nombre, dist, radio: l.radioMetros };
    }
    if (dist <= l.radioMetros && (!mejor || dist < mejor.dist)) {
      mejor = { local: l, dist };
    }
  }

  if (!algunoConUbicacion) {
    return {
      ok: false,
      sinUbicacion: true,
      error: "Tus locales no tienen ubicación configurada. Avisa a tu responsable.",
    };
  }
  if (!mejor) {
    return {
      ok: false,
      error: masCercano
        ? `Estás a ${Math.round(masCercano.dist)} m de "${masCercano.nombre}" (radio permitido ${masCercano.radio} m). Acércate a un local asignado para fichar.`
        : "No estás dentro del radio de ninguno de tus locales.",
      masCercano: masCercano ?? undefined,
    };
  }

  return {
    ok: true,
    empresaId: mejor.local.empresaId,
    empleadoId: mejor.local.empleadoId,
    localId: mejor.local.id,
    centro: mejor.local.nombre,
    distancia: mejor.dist,
  };
}

/**
 * Horario del día del usuario en CADA una de sus empresas. La ventana de
 * fichaje y el reparto de jornada partida se construyen combinando estos
 * resultados (cada tramo conserva su empresa). Devuelve solo las empresas que
 * tienen algún horario ese día (tipo != "ninguno").
 */
export async function getHorariosDiaUnificado(
  supabase: SupabaseClient,
  userId: string,
  fechaISO: string,
  filas?: FilaEmpleadoEmpresa[],
): Promise<HorarioEmpresaDia[]> {
  const rows = filas ?? (await getMisFilasEmpleado(supabase, userId));
  const out: HorarioEmpresaDia[] = [];
  for (const f of rows) {
    const horario = await getHorarioDia(supabase, f.empresaId, f.empleadoId, fechaISO);
    if (horario.tipo === "ninguno") continue;
    out.push({ empresaId: f.empresaId, empleadoId: f.empleadoId, horario });
  }
  return out;
}

// ─── Reparto de jornada partida entre empresas (PRP-060 Fase 4) ─────────────

/** Tramo fijo planificado, en minutos desde las 00:00 de la fecha (Madrid). */
export interface TramoEmpresaMin {
  empresaId: string;
  startMin: number;
  /** Si endMin <= startMin se asume cruce de medianoche (el planner lo normaliza). */
  endMin: number;
}

/** Motivo por el que un segmento queda marcado como erróneo / a revisar. */
export type MotivoReparto = "fuera_horario" | "hueco" | "solape";

/** Segmento del fichaje real atribuido a una empresa. */
export interface SegmentoReparto {
  empresaId: string;
  inicioMin: number;
  finMin: number;
  /** false = ese tramo no es válido (fuera de horario, hueco o solape) → revisión. */
  cubierto: boolean;
  /** Si !cubierto, por qué. */
  motivo?: MotivoReparto;
}

/**
 * Reparte un fichaje continuo [entradaMin, salidaMin] (minutos desde las 00:00
 * de su fecha, en Madrid; `salidaMin` puede exceder 1440 si cruza medianoche)
 * entre las empresas según los tramos FIJOS planificados ese día.
 *
 * Reglas (PRP-060):
 * - Solo se reparte de forma SEGUIDA cuando los turnos son CONTIGUOS (uno acaba
 *   donde el otro empieza). El corte entre empresas sigue el horario planificado.
 * - HUECO entre turnos (acaba a las 12:00, el otro empieza a las 12:05): NO es una
 *   jornada seguida — el empleado debería haber desfichado y vuelto a fichar
 *   entrada. El tiempo del hueco se marca como ERROR (`motivo:"hueco"`). El cierre
 *   automático al fin del turno se encarga de desfichar en el primero.
 * - SOLAPE de turnos de distinta empresa (se pisan): no se puede estar en dos
 *   sitios a la vez → se marca como ERROR (`motivo:"solape"`) y se atribuye a una
 *   sola empresa (la del turno que empieza antes), nunca doble.
 * - Tiempo ANTES del primer turno o DESPUÉS del último → ERROR (`motivo:"fuera_horario"`).
 * - Devuelve [] cuando NO hay reparto que hacer (0/1 tramo, una sola empresa o
 *   intervalo vacío): el llamador usa el cierre normal de un solo fichaje.
 */
export function planificarReparto(
  entradaMin: number,
  salidaMin: number,
  tramos: TramoEmpresaMin[],
): SegmentoReparto[] {
  if (salidaMin <= entradaMin || tramos.length === 0) return [];

  const trs = tramos
    .map((t) => ({
      empresaId: t.empresaId,
      startMin: t.startMin,
      endMin: t.endMin <= t.startMin ? t.endMin + 1440 : t.endMin,
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Si todo el horario del día es de una sola empresa, no hay reparto.
  if (new Set(trs.map((t) => t.empresaId)).size <= 1) return [];

  const firstStart = Math.min(...trs.map((t) => t.startMin));
  const lastEnd = Math.max(...trs.map((t) => t.endMin));

  // Turno más cercano a un minuto `m` (por distancia a sus fronteras).
  const turnoMasCercano = (m: number) => {
    let best = trs[0];
    let bestDist = Infinity;
    for (const t of trs) {
      const d = m < t.startMin ? t.startMin - m : m > t.endMin ? m - t.endMin : 0;
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  };

  // Puntos de corte: extremos del intervalo + fronteras de tramo interiores.
  const cortes = new Set<number>([entradaMin, salidaMin]);
  for (const t of trs) {
    if (t.startMin > entradaMin && t.startMin < salidaMin) cortes.add(t.startMin);
    if (t.endMin > entradaMin && t.endMin < salidaMin) cortes.add(t.endMin);
  }
  const puntos = Array.from(cortes).sort((a, b) => a - b);

  const segs: SegmentoReparto[] = [];
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i];
    const b = puntos[i + 1];
    if (b <= a) continue;
    const m = (a + b) / 2;
    // Turnos que cubren este instante (ordenados por inicio).
    const cubren = trs.filter((t) => m >= t.startMin && m < t.endMin);
    const empresasAqui = new Set(cubren.map((t) => t.empresaId));

    let empresaId: string;
    let cubierto: boolean;
    let motivo: MotivoReparto | undefined;

    if (empresasAqui.size >= 2) {
      // SOLAPE de empresas distintas → error; se atribuye al que empieza antes.
      empresaId = cubren[0].empresaId;
      cubierto = false;
      motivo = "solape";
    } else if (cubren.length >= 1) {
      // Dentro de un único turno (o varios de la misma empresa) → válido.
      empresaId = cubren[0].empresaId;
      cubierto = true;
    } else if (m < firstStart || m > lastEnd) {
      // Antes del primer turno o después del último → fuera de horario.
      empresaId = turnoMasCercano(m).empresaId;
      cubierto = false;
      motivo = "fuera_horario";
    } else {
      // HUECO entre turnos → no es jornada seguida (debería haber refichado).
      empresaId = turnoMasCercano(m).empresaId;
      cubierto = false;
      motivo = "hueco";
    }

    const last = segs[segs.length - 1];
    if (last && last.empresaId === empresaId && last.motivo === motivo) {
      // Fusiona solo tramos contiguos de la misma empresa Y mismo estado/motivo.
      last.finMin = b;
    } else {
      segs.push({ empresaId, inicioMin: a, finMin: b, cubierto, motivo });
    }
  }

  // Un único segmento → no hay reparto real.
  return segs.length <= 1 ? [] : segs;
}

/** Minutos del día (0–1439) de una fecha concreta, en zona Europe/Madrid. */
export function minutosMadridDe(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Salida prevista del empleado el día `fecha`, según su horario UNIFICADO entre
 * empresas:
 *  · FIJO     → fin del último tramo fijo, colocado en la fecha de la entrada.
 *  · FLEXIBLE → solo si su objetivo es DIARIO: hora de entrada + horas del día.
 * Devuelve `null` si no se puede predecir (sin horario, flexible semanal, o
 * jornada que cruza medianoche, que la cierra el cron de huérfanos).
 */
export async function calcularSalidaPrevista(
  client: SupabaseClient,
  userId: string,
  fecha: string,
  horaEntradaISO: string,
): Promise<Date | null> {
  const horarios = await getHorariosDiaUnificado(client, userId, fecha);
  const starts: number[] = [];
  const ends: number[] = [];
  let objetivoFlexHoras = 0;
  for (const h of horarios) {
    if (h.horario.tipo === "fijo") {
      for (const tr of h.horario.tramos) {
        const s = hhmmAMinutos(tr.inicio);
        const e = hhmmAMinutos(tr.fin);
        if (s != null) starts.push(s);
        if (e != null) ends.push(e);
      }
    } else if (h.horario.tipo === "flexible" && h.horario.modo === "diario") {
      objetivoFlexHoras = Math.max(objetivoFlexHoras, h.horario.objetivoHoras || 0);
    }
  }
  const entrada = new Date(horaEntradaISO);
  if (ends.length) {
    const entradaMin = Math.min(...starts);
    const salidaMin = Math.max(...ends);
    if (salidaMin <= entradaMin) return null; // cruza medianoche → cron de huérfanos
    // Coloca la salida en la misma fecha local de la entrada.
    return new Date(entrada.getTime() + (salidaMin - minutosMadridDe(entrada)) * 60000);
  }
  if (objetivoFlexHoras > 0) {
    return new Date(entrada.getTime() + objetivoFlexHoras * 3600000);
  }
  return null;
}

function textoMotivo(motivo: MotivoReparto | undefined): string {
  return motivo === "solape"
    ? "Turnos de empresas distintas SOLAPADOS — revisar configuración de turnos"
    : motivo === "hueco"
      ? "Hueco entre turnos: la jornada no es seguida — el empleado debía desfichar y volver a fichar"
      : "Horas fuera del horario planificado (reparto multi-empresa)";
}

/** Contexto mínimo del fichaje abierto que se va a cerrar (con o sin reparto). */
export interface CierreCtx {
  fichajeId: string;
  /** `fichajes.empleado_id` = auth uid del empleado. */
  userId: string;
  nombre: string;
  empresaId: string;
  localId: string | null;
  centro: string;
  tipo: string | null;
  modoTeletrabajo: boolean;
  fecha: string;
  /** ISO de la hora de entrada. */
  horaEntrada: string;
}

/**
 * Cierra un fichaje a la hora `salida`, repartiéndolo entre empresas según el
 * horario UNIFICADO del día si la jornada continua cubre tramos de más de una
 * empresa. Reutilizable desde la salida manual (Mi Panel) y desde el cron de
 * auto-salida (con `autoCierre`). Con `autoCierre` se guarda como un fichaje
 * normal (NO se marca para revisión) y deja `hora_salida_real = null` como único
 * rastro de que el empleado no fichó salida.
 */
export async function cerrarConReparto(
  client: SupabaseClient,
  ctx: CierreCtx,
  salida: Date,
  opts?: {
    geo?: { lat: number; lng: number; precision: number } | null;
    autoCierre?: boolean;
  },
): Promise<{ horas: number; repartido: number }> {
  const entradaMs = new Date(ctx.horaEntrada).getTime();
  const salidaMs = salida.getTime();
  const horas = Math.round(((salidaMs - entradaMs) / 3600000) * 10000) / 10000;
  const geo = opts?.geo ?? null;
  const auto = opts?.autoCierre ?? false;
  const horaSalidaReal = auto ? null : salida.toISOString();

  const entradaMin = minutosMadridDe(new Date(ctx.horaEntrada));
  const salidaMin = entradaMin + (salidaMs - entradaMs) / 60000;

  const horarios = await getHorariosDiaUnificado(client, ctx.userId, ctx.fecha);
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

  // Sin reparto (una sola empresa) → cierre simple del fichaje.
  if (reparto.length <= 1) {
    await client
      .from("fichajes")
      .update({
        hora_salida: salida.toISOString(),
        hora_salida_real: horaSalidaReal,
        horas_totales: horas,
        estado: "completado",
        lat_salida: geo?.lat ?? null,
        lng_salida: geo?.lng ?? null,
        precision_salida_metros: geo?.precision ?? null,
        // Auto-cierre: se guarda como un fichaje normal, NO se marca para revisión.
        // El único rastro de que el empleado no fichó salida es `hora_salida_real = null`.
      })
      .eq("id", ctx.fichajeId);
    return { horas, repartido: 1 };
  }

  // Reparto real: 1 fila por empresa, atadas por `sesion_id`.
  const sesionId = crypto.randomUUID();
  const locales = await getMisLocales(client, ctx.userId);
  const localPorEmpresa = new Map<string, { id: string; nombre: string }>();
  for (const l of locales) {
    if (!localPorEmpresa.has(l.empresaId)) localPorEmpresa.set(l.empresaId, { id: l.id, nombre: l.nombre });
  }
  const isoDeMin = (min: number) => new Date(entradaMs + (min - entradaMin) * 60000).toISOString();

  for (let i = 0; i < reparto.length; i++) {
    const seg = reparto[i];
    const esUltimo = i === reparto.length - 1;
    const localSeg =
      seg.empresaId === ctx.empresaId
        ? { id: ctx.localId, nombre: ctx.centro }
        : localPorEmpresa.get(seg.empresaId) ?? { id: null as string | null, nombre: "" };
    const horasSeg = Math.round((((seg.finMin - seg.inicioMin) * 60000) / 3600000) * 10000) / 10000;
    const finISO = esUltimo ? salida.toISOString() : isoDeMin(seg.finMin);
    // El auto-cierre NO marca revisión (se guarda como fichaje normal); solo la
    // marca un tramo realmente no cubierto por el horario, que es otra anomalía.
    const revision = !seg.cubierto;
    const motivoTxt = !seg.cubierto ? textoMotivo(seg.motivo) : null;
    const incidencia = revision ? motivoTxt : null;
    const salidaRealSeg = esUltimo ? horaSalidaReal : null;
    const geoSeg = esUltimo ? geo : null;

    if (i === 0) {
      await client
        .from("fichajes")
        .update({
          empresa_id: seg.empresaId,
          local_id: localSeg.id,
          centro: localSeg.nombre,
          hora_salida: finISO,
          hora_salida_real: salidaRealSeg,
          horas_totales: horasSeg,
          estado: "completado",
          sesion_id: sesionId,
          requiere_revision: revision,
          revision_motivo: revision ? motivoTxt : null,
          incidencia,
          lat_salida: geoSeg?.lat ?? null,
          lng_salida: geoSeg?.lng ?? null,
          precision_salida_metros: geoSeg?.precision ?? null,
        })
        .eq("id", ctx.fichajeId);
    } else {
      await client.from("fichajes").insert({
        empresa_id: seg.empresaId,
        empleado_id: ctx.userId,
        empleado_nombre: ctx.nombre || "Sin nombre",
        fecha: ctx.fecha,
        hora_entrada: isoDeMin(seg.inicioMin),
        hora_entrada_real: null,
        hora_salida: finISO,
        hora_salida_real: salidaRealSeg,
        horas_totales: horasSeg,
        estado: "completado",
        local_id: localSeg.id,
        centro: localSeg.nombre,
        modo_teletrabajo: ctx.modoTeletrabajo,
        tipo: ctx.tipo ?? "ENT",
        sesion_id: sesionId,
        requiere_revision: revision,
        revision_motivo: revision ? motivoTxt : null,
        incidencia,
        lat_salida: geoSeg?.lat ?? null,
        lng_salida: geoSeg?.lng ?? null,
        precision_salida_metros: geoSeg?.precision ?? null,
      });
    }
  }
  return { horas, repartido: reparto.length };
}
