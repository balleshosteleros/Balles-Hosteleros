import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoMesa } from "@/features/sala/planos/data/planos";
import {
  ESTADOS_NO_OCUPANTES,
  getDuracionReservaMin,
  horaAMinutos,
} from "@/features/sala/lib/reserva-conflicto";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";

export type AsignacionInput = {
  localId: string;
  empresaId: string;
  fecha: string;
  hora: string;
  personas: number;
  salaId?: string | null;
  zonaId?: string | null;
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
 *      → primera mesa libre del orden manual.
 *   5. Si no → fallback: primera por parte numérica del código.
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
    if (input.tipo) mesasQuery = mesasQuery.eq("tipo", input.tipo);

    const { data: mesas, error: errMesas } = await mesasQuery;
    if (errMesas) throw errMesas;
    if (!mesas || mesas.length === 0) {
      return { ok: true, mesa: null, razon: "SIN_CANDIDATAS" };
    }

    // Bloqueos manuales (Configuración → Bloqueos): prevalecen sobre el plano.
    const bloqueadas = await getMesasBloqueadas(supabase, {
      empresaId: input.empresaId,
      localId: input.localId,
      fechaISO: input.fecha,
    });

    // 4. Reservas vivas del día. Filtramos solape en JS usando la
    // `duracion_reserva_min` configurada por empresa (aplica a todos los
    // planos y reservas — fuente única).
    const duracionMin = await getDuracionReservaMin(supabase, input.empresaId);
    const { data: ocupantes, error: errOcup } = await supabase
      .from("reservas")
      .select("mesa, hora")
      .eq("empresa_id", input.empresaId)
      .eq("fecha", input.fecha)
      .not("mesa", "is", null)
      .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
    if (errOcup) throw errOcup;
    const inicioNuevo = horaAMinutos(input.hora);
    const finNuevo = inicioNuevo + duracionMin;
    const codigosOcupados = new Set<string>();
    for (const r of ocupantes ?? []) {
      const codigo = (r.mesa as string) ?? "";
      if (!codigo) continue;
      const otroInicio = horaAMinutos((r.hora as string) ?? "");
      const otroFin = otroInicio + duracionMin;
      if (otroInicio < finNuevo && inicioNuevo < otroFin) {
        codigosOcupados.add(codigo);
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

    if (libres.length === 0) {
      return { ok: true, mesa: null, razon: "SIN_MESAS_LIBRES" };
    }

    // 5. Orden manual por (plano, comensales).
    const { data: orden, error: errOrden } = await supabase
      .from("plano_orden_asignacion")
      .select("mesa_id, posicion")
      .eq("plano_id", planoId)
      .eq("comensales", input.personas)
      .order("posicion", { ascending: true });
    if (errOrden) throw errOrden;

    if (orden && orden.length > 0) {
      const libresById = new Map(libres.map((m) => [m.id, m]));
      for (const fila of orden) {
        const libre = libresById.get(fila.mesa_id as string);
        if (libre) {
          return { ok: true, mesa: { ...libre, planoId } };
        }
      }
    }

    // 6. Fallback: parte numérica del código ascendente, desempate alfabético.
    libres.sort((a, b) => {
      const na = parteNumericaCodigo(a.codigo);
      const nb = parteNumericaCodigo(b.codigo);
      if (na !== nb) return na - nb;
      return a.codigo.localeCompare(b.codigo);
    });

    return { ok: true, mesa: { ...libres[0], planoId } };
  } catch (err: unknown) {
    const detalle = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asignacion-mesa] error:", detalle);
    return { ok: false, razon: "ERROR", detalle };
  }
}
