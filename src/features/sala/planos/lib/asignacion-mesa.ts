import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoMesa } from "@/features/sala/planos/data/planos";
import {
  ESTADOS_NO_OCUPANTES,
  getDuracionReservaMin,
  franjasSolapan,
} from "@/features/sala/lib/reserva-conflicto";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";

export type AsignacionInput = {
  localId: string;
  empresaId: string;
  fecha: string;
  hora: string;
  personas: number;
  salaId?: string | null;
  zonaId?: string | null;
  /**
   * Varias zonas a la vez: el cliente eligió un GRUPO público ("Sala") que
   * engloba varias zonas internas (Cuadrado, Redondas, VIP…). La asignación
   * queda restringida a esas y solo a esas.
   */
  zonaIds?: string[] | null;
  tipo?: TipoMesa | null;
};

export type AsignacionResultado =
  | { ok: true; mesa: { id: string; codigo: string; zonaNombre: string; planoId: string } }
  | { ok: true; mesa: null; razon: "SIN_MESAS_LIBRES" | "SIN_CANDIDATAS" }
  | { ok: false; razon: "SIN_PLANO_ACTIVO" | "ERROR"; detalle?: string };

function parteNumericaCodigo(codigo: string): number {
  const match = codigo.match(/\d+/);
  return match ? parseInt(match[0], 10) : 9999;
}

/**
 * Códigos de mesa ocupados en la franja de la reserva pedida.
 *
 * Una reserva sobre una unión guarda el código compuesto ("M1+M2"), así que se
 * separa por "+": si M1+M2 está reservada, M1 y M2 están ocupadas por separado.
 */
async function codigosOcupadosEnFranja(
  supabase: SupabaseClient,
  input: AsignacionInput,
): Promise<Set<string>> {
  const duracionMin = await getDuracionReservaMin(supabase, input.empresaId);
  const { data: ocupantes } = await supabase
    .from("reservas")
    .select("mesa, hora, duracion_minutos")
    .eq("empresa_id", input.empresaId)
    .eq("fecha", input.fecha)
    .not("mesa", "is", null)
    .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);

  const ocupados = new Set<string>();
  for (const r of ocupantes ?? []) {
    const codigo = (r.mesa as string) ?? "";
    if (!codigo) continue;
    // Cada reserva ocupa su mesa durante SU duración, no la de la empresa: si
    // no, una comida larga ya guardada dejaba su mesa como libre en la parte
    // final de su intervalo y se le podía asignar a otro grupo encima.
    const durOtra = Number(r.duracion_minutos);
    const duracionOtra =
      Number.isFinite(durOtra) && durOtra > 0 ? durOtra : duracionMin;
    // Minutos de jornada: la madrugada pertenece a la noche anterior, así que
    // una reserva de 00:30 choca con la de 23:30 que aún no ha terminado.
    if (franjasSolapan(input.hora, duracionMin, (r.hora as string) ?? "", duracionOtra)) {
      for (const parte of codigo.split("+")) {
        const limpio = parte.trim();
        if (limpio) ocupados.add(limpio);
      }
    }
  }
  return ocupados;
}

/**
 * Uniones que admiten al grupo, con TODAS sus mesas libres, de la más ajustada
 * a la más grande.
 *
 * Regla del dueño: una unión solo se puede dar si todas sus mesas están libres;
 * en cuanto una está ocupada, la unión entera deja de estar disponible.
 *
 * Se ordenan por capacidad máxima ascendente para no gastar la unión grande en
 * un grupo pequeño.
 */
async function listarUnionesLibres(
  supabase: SupabaseClient,
  input: AsignacionInput,
  ctx: { codigosOcupados: Set<string>; bloqueadas: Set<string> },
): Promise<Array<{ id: string; codigo: string; zonaNombre: string }>> {
  let query = supabase
    .from("mesa_combinaciones")
    .select("id, codigo, capacidad_min, capacidad_max, zona_id, tipo, activa")
    .eq("local_id", input.localId)
    .eq("activa", true)
    .lte("capacidad_min", input.personas)
    .gte("capacidad_max", input.personas)
    .order("capacidad_max", { ascending: true });
  if (input.zonaId) query = query.eq("zona_id", input.zonaId);
  if (input.zonaIds && input.zonaIds.length > 0) {
    query = query.in("zona_id", input.zonaIds);
  }
  if (input.tipo) query = query.eq("tipo", input.tipo);

  const { data: combis, error } = await query;
  if (error || !combis || combis.length === 0) return [];

  const { data: componentes } = await supabase
    .from("mesa_combinacion_componentes")
    .select("combinacion_id, mesa_id, mesas!inner(id, codigo, activa, zona_id, zonas!inner(nombre))")
    .in(
      "combinacion_id",
      combis.map((c) => c.id as string),
    );

  const porCombi = new Map<
    string,
    Array<{ id: string; codigo: string; activa: boolean; zonaNombre: string }>
  >();
  for (const c of componentes ?? []) {
    const m = c.mesas as unknown as {
      id: string;
      codigo: string;
      activa: boolean;
      zonas?: { nombre?: string } | { nombre?: string }[];
    };
    if (!m) continue;
    const z = m.zonas;
    const zonaNombre = Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
    const lista = porCombi.get(c.combinacion_id as string) ?? [];
    lista.push({ id: m.id, codigo: m.codigo, activa: m.activa, zonaNombre });
    porCombi.set(c.combinacion_id as string, lista);
  }

  const libres: Array<{ id: string; codigo: string; zonaNombre: string }> = [];
  for (const comb of combis) {
    const partes = porCombi.get(comb.id as string) ?? [];
    if (partes.length < 2) continue; // union mal formada: no la usamos
    const todasUsables = partes.every(
      (m) =>
        m.activa &&
        !ctx.codigosOcupados.has(m.codigo) &&
        !ctx.bloqueadas.has(m.id),
    );
    if (!todasUsables) continue;
    libres.push({
      id: comb.id as string,
      codigo: comb.codigo as string,
      zonaNombre: partes[0]?.zonaNombre ?? "",
    });
  }
  return libres;
}

/**
 * Recorre el orden de preferencia de (plano, comensales) y devuelve la primera
 * opción que esté libre — sea mesa suelta o combinación, según lo haya
 * ordenado el responsable en Configuración → Orden.
 *
 * Devuelve `null` si no hay orden definido o si ninguna de sus posiciones está
 * libre; en ambos casos el motor cae a su criterio por defecto.
 */
async function primeraPreferida(
  supabase: SupabaseClient,
  planoId: string,
  personas: number,
  disponibles: {
    mesas: Array<{ id: string; codigo: string; zonaNombre: string }>;
    uniones: Array<{ id: string; codigo: string; zonaNombre: string }>;
  },
): Promise<{ id: string; codigo: string; zonaNombre: string } | null> {
  const { data: orden, error } = await supabase
    .from("plano_orden_asignacion")
    .select("mesa_id, combinacion_id, posicion")
    .eq("plano_id", planoId)
    .eq("comensales", personas)
    .order("posicion", { ascending: true });
  // Un fallo leyendo la preferencia no debe tumbar la reserva: se ignora y se
  // usa el orden por defecto.
  if (error) {
    console.error("[asignacion-mesa] orden preferencia:", error);
    return null;
  }
  if (!orden || orden.length === 0) return null;

  const mesasById = new Map(disponibles.mesas.map((m) => [m.id, m]));
  const unionesById = new Map(disponibles.uniones.map((u) => [u.id, u]));

  for (const fila of orden) {
    const mesaId = fila.mesa_id as string | null;
    const combiId = fila.combinacion_id as string | null;
    const encontrada = mesaId ? mesasById.get(mesaId) : combiId ? unionesById.get(combiId) : null;
    if (encontrada) return encontrada;
  }
  return null;
}

/**
 * Asigna automáticamente una mesa a unos comensales en (local, fecha, hora).
 * Recibe el cliente Supabase explícitamente para poder ejecutarse tanto con
 * el cliente autenticado (sala / panel interno) como con el admin (form
 * público anónimo que ya bypasea RLS por su naturaleza pública).
 *
 * Algoritmo (PRP-048):
 *   1. Resolver plano principal activo del local.
 *   2. Candidatas = mesas activas de las salas del plano, capacidad >= pax,
 *      filtradas por sala/zona/tipo opcionales.
 *   3. Excluir mesas con reserva viva en ±2h de la hora pedida.
 *   4. Si hay `plano_orden_asignacion(plano_id, comensales=pax)` no vacío
 *      → primera opción libre del orden manual, sea mesa suelta o unión.
 *      La lista manda: una unión puede ir por delante de una mesa suelta.
 *   5. Si no → fallback: mesa suelta (por código) antes que unión (la más
 *      ajustada al grupo).
 *   6. Si ninguna libre → mesa=null, razón=SIN_MESAS_LIBRES.
 */
export async function asignarMesaAutomatica(
  supabase: SupabaseClient,
  input: AsignacionInput,
): Promise<AsignacionResultado> {
  try {
    // 1. Plano principal activo del local.
    const { data: plano, error: errPlano } = await supabase
      .from("planos")
      .select("id")
      .eq("local_id", input.localId)
      .eq("es_principal", true)
      .eq("activo", true)
      .maybeSingle();
    if (errPlano) throw errPlano;
    if (!plano) return { ok: false, razon: "SIN_PLANO_ACTIVO" };

    const planoId = plano.id as string;

    // 2. Salas asociadas al plano.
    const { data: ps, error: errPS } = await supabase
      .from("plano_salas")
      .select("sala_id")
      .eq("plano_id", planoId);
    if (errPS) throw errPS;
    const salaIds = (ps ?? []).map((r) => r.sala_id as string);
    let salaIdsFiltradas = salaIds;
    if (input.salaId) {
      salaIdsFiltradas = salaIds.filter((id) => id === input.salaId);
    }
    if (salaIdsFiltradas.length === 0) {
      return { ok: true, mesa: null, razon: "SIN_CANDIDATAS" };
    }

    // 3. Mesas candidatas (capacidad + filtros).
    let mesasQuery = supabase
      .from("mesas")
      .select("id, codigo, capacidad_min, capacidad_max, tipo, zona_id, zonas!inner(id, nombre, sala_id)")
      .eq("local_id", input.localId)
      .eq("activa", true)
      .in("zonas.sala_id", salaIdsFiltradas)
      .lte("capacidad_min", input.personas)
      .gte("capacidad_max", input.personas);
    if (input.zonaId) mesasQuery = mesasQuery.eq("zona_id", input.zonaId);
    if (input.zonaIds && input.zonaIds.length > 0) {
      mesasQuery = mesasQuery.in("zona_id", input.zonaIds);
    }
    if (input.tipo) mesasQuery = mesasQuery.eq("tipo", input.tipo);

    const { data: mesas, error: errMesas } = await mesasQuery;
    if (errMesas) throw errMesas;

    // Bloqueos manuales (Configuración → Bloqueos): prevalecen sobre el plano.
    // Se acotan al turno de la hora pedida — un bloqueo cubre su turno y solo
    // ese, así que bloquear la comida no puede dejar la mesa muerta en la cena.
    const bloqueadas = await getMesasBloqueadas(supabase, {
      empresaId: input.empresaId,
      localId: input.localId,
      fechaISO: input.fecha,
      turno: turnoDeHora(input.hora),
    });

    // Ninguna mesa SUELTA admite ese grupo (caso tipico: 8 personas y la mesa
    // mas grande es de 6). No es un "no hay sitio": puede haber una union que
    // si lo admita, asi que hay que mirarla antes de rechazar.
    if (!mesas || mesas.length === 0) {
      const ocupadosSinCandidatas = await codigosOcupadosEnFranja(supabase, input);
      const uniones = await listarUnionesLibres(supabase, input, {
        codigosOcupados: ocupadosSinCandidatas,
        bloqueadas,
      });
      if (uniones.length > 0) {
        // Con solo uniones disponibles, el orden manual sigue mandando.
        const preferida = await primeraPreferida(supabase, planoId, input.personas, {
          mesas: [],
          uniones,
        });
        return { ok: true, mesa: { ...(preferida ?? uniones[0]), planoId } };
      }
      return { ok: true, mesa: null, razon: "SIN_CANDIDATAS" };
    }

    // 4. Reservas vivas del día. Filtramos solape en JS usando la
    // `duracion_reserva_min` configurada por empresa (aplica a todos los
    // planos y reservas — fuente única).
    const duracionMin = await getDuracionReservaMin(supabase, input.empresaId);
    const { data: ocupantes, error: errOcup } = await supabase
      .from("reservas")
      .select("mesa, hora, duracion_minutos")
      .eq("empresa_id", input.empresaId)
      .eq("fecha", input.fecha)
      .not("mesa", "is", null)
      .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
    if (errOcup) throw errOcup;
    // Una reserva sobre una union guarda el codigo compuesto ("M1+M2"), asi
    // que hay que separarlo: si M1+M2 esta reservada, M1 y M2 estan ocupadas
    // individualmente y no se pueden volver a dar sueltas.
    const codigosOcupados = new Set<string>();
    for (const r of ocupantes ?? []) {
      const codigo = (r.mesa as string) ?? "";
      if (!codigo) continue;
      // Cada reserva ocupa su mesa durante SU duración (ver arriba).
      const durOtra = Number(r.duracion_minutos);
      const duracionOtra =
        Number.isFinite(durOtra) && durOtra > 0 ? durOtra : duracionMin;
      // Minutos de jornada: cubre el cruce de medianoche (23:30 vs 00:30).
      if (franjasSolapan(input.hora, duracionMin, (r.hora as string) ?? "", duracionOtra)) {
        for (const parte of codigo.split("+")) {
          const limpio = parte.trim();
          if (limpio) codigosOcupados.add(limpio);
        }
      }
    }

    type MesaCandidata = {
      id: string;
      codigo: string;
      zonaNombre: string;
    };
    const libres: MesaCandidata[] = mesas
      .filter((m) => !codigosOcupados.has(m.codigo as string))
      .filter((m) => !bloqueadas.has(m.id as string))
      .map((m) => {
        const z = m.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
        const zonaNombre = Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
        return {
          id: m.id as string,
          codigo: m.codigo as string,
          zonaNombre,
        };
      });

    // 5. Orden manual por (plano, comensales). Manda sobre todo lo demás: si
    // el responsable puso una unión por delante de una mesa suelta, se respeta.
    // Por eso las uniones se calculan ANTES de decidir, no como último recurso.
    const uniones = await listarUnionesLibres(supabase, input, {
      codigosOcupados,
      bloqueadas,
    });

    const preferida = await primeraPreferida(supabase, planoId, input.personas, {
      mesas: libres,
      uniones,
    });
    if (preferida) return { ok: true, mesa: { ...preferida, planoId } };

    // 6. Sin preferencia configurada (o toda ocupada): criterio por defecto.
    // Mesa suelta antes que unión, para no partir mesas sin necesidad, y
    // dentro de las sueltas por parte numérica del código.
    if (libres.length > 0) {
      libres.sort((a, b) => {
        const na = parteNumericaCodigo(a.codigo);
        const nb = parteNumericaCodigo(b.codigo);
        if (na !== nb) return na - nb;
        return a.codigo.localeCompare(b.codigo);
      });
      return { ok: true, mesa: { ...libres[0], planoId } };
    }

    // Ninguna mesa suelta libre: la unión más ajustada al grupo.
    if (uniones.length > 0) return { ok: true, mesa: { ...uniones[0], planoId } };

    return { ok: true, mesa: null, razon: "SIN_MESAS_LIBRES" };
  } catch (err: unknown) {
    const detalle = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asignacion-mesa] error:", detalle);
    return { ok: false, razon: "ERROR", detalle };
  }
}
