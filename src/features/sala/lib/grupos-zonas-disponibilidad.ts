import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ESTADOS_NO_OCUPANTES,
  getDuracionReservaMin,
  franjasSolapan,
} from "@/features/sala/lib/reserva-conflicto";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";

/**
 * Disponibilidad por grupo de zonas para el motor web.
 *
 * El cliente elige un GRUPO ("Sala"), no una zona interna. Esta función dice,
 * para cada grupo, si le queda algo libre a esa fecha/hora y para ese número
 * de comensales — y así el formulario puede pintar en gris "Sala (completo)"
 * en vez de dejar que el cliente lo intente y falle.
 *
 * Usa el mismo criterio de ocupación que `asignacion-mesa.ts`: una reserva
 * sobre una unión ocupa todas sus mesas, y una unión solo está libre si lo
 * están todas las suyas.
 */

export interface GrupoZonaDisponible {
  id: string;
  nombre: string;
  /** Zonas internas que la componen (para restringir la asignación después). */
  zonaIds: string[];
  /** ¿Queda alguna mesa o combinación libre para ese grupo de comensales? */
  disponible: boolean;
  /** Cuántas opciones libres quedan. Informativo. */
  opcionesLibres: number;
}

export async function getGruposZonasDisponibles(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    localId: string;
    fecha: string;
    hora: string;
    personas: number;
  },
): Promise<GrupoZonaDisponible[]> {
  // 1. Grupos activos con sus zonas internas.
  const { data: gruposRaw, error: errGrupos } = await supabase
    .from("grupos_zonas")
    .select("id, nombre, orden, activa")
    .eq("local_id", params.localId)
    .eq("activa", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (errGrupos || !gruposRaw || gruposRaw.length === 0) {
    if (errGrupos) console.error("[grupos-zonas-disp] grupos:", errGrupos);
    return [];
  }

  const grupoIds = gruposRaw.map((g) => g.id as string);
  const { data: rel, error: errRel } = await supabase
    .from("grupo_zona_zonas")
    .select("grupo_zona_id, zona_id")
    .in("grupo_zona_id", grupoIds);
  if (errRel) {
    console.error("[grupos-zonas-disp] relaciones:", errRel);
    return [];
  }

  const zonasPorGrupo = new Map<string, string[]>();
  for (const r of rel ?? []) {
    const k = r.grupo_zona_id as string;
    const lista = zonasPorGrupo.get(k);
    if (lista) lista.push(r.zona_id as string);
    else zonasPorGrupo.set(k, [r.zona_id as string]);
  }

  // 2. Mesas activas de esas zonas.
  const todasLasZonas = [...new Set([...zonasPorGrupo.values()].flat())];
  if (todasLasZonas.length === 0) return [];

  const { data: mesasRaw, error: errMesas } = await supabase
    .from("mesas")
    .select("id, codigo, zona_id, capacidad_min, capacidad_max")
    .eq("local_id", params.localId)
    .eq("activa", true)
    .in("zona_id", todasLasZonas);
  if (errMesas) {
    console.error("[grupos-zonas-disp] mesas:", errMesas);
    return [];
  }

  // 3. Combinaciones activas de esas zonas, con sus mesas.
  const { data: combisRaw, error: errCombis } = await supabase
    .from("mesa_combinaciones")
    .select("id, codigo, zona_id, capacidad_min, capacidad_max")
    .eq("local_id", params.localId)
    .eq("activa", true)
    .in("zona_id", todasLasZonas);
  if (errCombis) {
    console.error("[grupos-zonas-disp] combinaciones:", errCombis);
    return [];
  }

  const combiIds = (combisRaw ?? []).map((c) => c.id as string);
  const mesasDeCombi = new Map<string, string[]>();
  if (combiIds.length > 0) {
    const { data: comps } = await supabase
      .from("mesa_combinacion_componentes")
      .select("combinacion_id, mesas!inner(codigo)")
      .in("combinacion_id", combiIds);
    for (const c of comps ?? []) {
      const m = c.mesas as unknown as { codigo?: string } | { codigo?: string }[] | null;
      const codigo = Array.isArray(m) ? (m[0]?.codigo ?? "") : (m?.codigo ?? "");
      if (!codigo) continue;
      const k = c.combinacion_id as string;
      const lista = mesasDeCombi.get(k);
      if (lista) lista.push(codigo);
      else mesasDeCombi.set(k, [codigo]);
    }
  }

  // 4. Qué está ocupado a esa hora.
  const duracionMin = await getDuracionReservaMin(supabase, params.empresaId);
  const { data: reservas } = await supabase
    .from("reservas")
    .select("mesa, hora, duracion_minutos")
    .eq("empresa_id", params.empresaId)
    .eq("fecha", params.fecha)
    .not("mesa", "is", null)
    .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);

  const ocupadas = new Set<string>();
  for (const r of reservas ?? []) {
    const codigo = (r.mesa as string) ?? "";
    if (!codigo) continue;
    // Cada reserva ocupa su mesa durante SU duración, no la de la empresa: una
    // comida de 3 h ya guardada bloquea las tres horas, aunque la duración por
    // defecto sea de 2. Comparar ambas franjas con la duración por defecto
    // dejaba libres huecos que en realidad estaban pillados.
    const durOtra = Number(r.duracion_minutos);
    const duracionOtra =
      Number.isFinite(durOtra) && durOtra > 0 ? durOtra : duracionMin;
    if (!franjasSolapan(params.hora, duracionMin, (r.hora as string) ?? "", duracionOtra)) {
      continue;
    }
    for (const parte of codigo.split("+")) {
      const limpio = parte.trim();
      if (limpio) ocupadas.add(limpio);
    }
  }

  // El bloqueo vale para SU turno: se acota al de la hora consultada para no
  // cerrar la cena por haber bloqueado la comida.
  const bloqueadas = await getMesasBloqueadas(supabase, {
    empresaId: params.empresaId,
    localId: params.localId,
    fechaISO: params.fecha,
    turno: turnoDeHora(params.hora),
  });
  for (const m of mesasRaw ?? []) {
    if (bloqueadas.has(m.id as string)) ocupadas.add(m.codigo as string);
  }

  // 5. Contar opciones libres de cada grupo para ESE número de comensales.
  return gruposRaw.map((g) => {
    const id = g.id as string;
    const zonaIds = zonasPorGrupo.get(id) ?? [];
    const zonaSet = new Set(zonaIds);
    let libres = 0;

    for (const m of mesasRaw ?? []) {
      if (!zonaSet.has(m.zona_id as string)) continue;
      const min = (m.capacidad_min as number) ?? 1;
      const max = (m.capacidad_max as number) ?? 1;
      if (params.personas < min || params.personas > max) continue;
      if (!ocupadas.has(m.codigo as string)) libres++;
    }

    for (const c of combisRaw ?? []) {
      if (!zonaSet.has(c.zona_id as string)) continue;
      const min = (c.capacidad_min as number) ?? 1;
      const max = (c.capacidad_max as number) ?? 1;
      if (params.personas < min || params.personas > max) continue;
      const partes = mesasDeCombi.get(c.id as string) ?? [];
      if (partes.length < 2) continue;
      if (partes.every((p) => !ocupadas.has(p))) libres++;
    }

    return {
      id,
      nombre: g.nombre as string,
      zonaIds,
      disponible: libres > 0,
      opcionesLibres: libres,
    };
  });
}

/**
 * Grupos de zonas activos, sin mirar ocupación.
 *
 * Lo usa el formulario público mientras el cliente todavía no ha elegido hora:
 * la ocupación se calcula por franja, así que sin hora no hay nada que contar,
 * pero el recuadro de zona ya puede salir con todas las opciones. Al elegir
 * hora se vuelve a pedir con `getGruposZonasDisponibles` y ahí sí se marcan
 * las llenas.
 */
export async function getGruposZonasActivos(
  supabase: SupabaseClient,
  localId: string,
): Promise<GrupoZonaDisponible[]> {
  const { data: gruposRaw, error } = await supabase
    .from("grupos_zonas")
    .select("id, nombre, orden, activa")
    .eq("local_id", localId)
    .eq("activa", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error || !gruposRaw || gruposRaw.length === 0) {
    if (error) console.error("[grupos-zonas-activos]", error);
    return [];
  }

  const grupoIds = gruposRaw.map((g) => g.id as string);
  const { data: rel } = await supabase
    .from("grupo_zona_zonas")
    .select("grupo_zona_id, zona_id")
    .in("grupo_zona_id", grupoIds);

  const zonasPorGrupo = new Map<string, string[]>();
  for (const r of rel ?? []) {
    const k = r.grupo_zona_id as string;
    const lista = zonasPorGrupo.get(k);
    if (lista) lista.push(r.zona_id as string);
    else zonasPorGrupo.set(k, [r.zona_id as string]);
  }

  return gruposRaw.map((g) => ({
    id: g.id as string,
    nombre: g.nombre as string,
    zonaIds: zonasPorGrupo.get(g.id as string) ?? [],
    // Sin hora no se puede afirmar que esté completa: se enseña elegible.
    disponible: true,
    opcionesLibres: 0,
  }));
}
