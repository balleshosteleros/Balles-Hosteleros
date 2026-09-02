"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import {
  ESTADOS_NO_OCUPANTES,
  horaAMinutosJornada,
} from "@/features/sala/lib/reserva-conflicto";
import {
  DURACION_RESERVA_DEFAULT_MINUTOS,
  type TurnoReserva,
} from "@/features/sala/data/reservas";

/**
 * Propuesta de mesa para "el sistema elige".
 *
 * El motor NO asigna nada a ciegas: devuelve una PROPUESTA que el usuario ve y
 * acepta (o no) antes de que la reserva se cree. Y cuando no puede proponer
 * nada, distingue POR QUÉ, porque cada motivo pide una salida distinta:
 *
 *   SIN_CAPACIDAD  → hay mesas libres a esa hora, pero ninguna admite a ese
 *                    grupo por catálogo. El local decide a mano dónde sentarlo.
 *   SIN_HUECO      → hay mesas del tamaño adecuado, pero todas están ocupadas
 *                    en esa franja. Aquí no hay nada que elegir: cambia la hora.
 *   SIN_MESAS      → el ámbito de búsqueda (zona o local) no tiene mesas activas.
 */
export type MotivoSinPropuesta = "SIN_CAPACIDAD" | "SIN_HUECO" | "SIN_MESAS";

export interface MesaPropuesta {
  /** id de la mesa suelta; null si la propuesta es una unión de mesas. */
  mesaId: string | null;
  /** Código tal cual va a BD: "R3" o "M1+M2" si es unión. */
  codigo: string;
  capacidadMin: number;
  capacidadMax: number;
  zonaNombre: string;
  salaNombre: string;
  /** true si la propuesta une varias mesas físicas. */
  esUnion: boolean;
}

export type PropuestaMesaResultado =
  | { encontrada: true; mesa: MesaPropuesta }
  | {
      encontrada: false;
      motivo: MotivoSinPropuesta;
      /**
       * Mesas libres en la franja que NO admiten al grupo por capacidad. Solo
       * se rellena en SIN_CAPACIDAD: son exactamente las que el usuario puede
       * forzar a mano si decide sentar ahí al grupo igualmente.
       */
      libresNoAptas: MesaPropuesta[];
      /** Ámbito buscado, para poder redactar el aviso: nombre de zona o null. */
      zonaBuscada: string | null;
    };

/** Mesa del catálogo, ya normalizada con su zona y su sala. */
interface MesaCatalogo {
  id: string;
  codigo: string;
  capacidadMin: number;
  capacidadMax: number;
  zonaId: string;
  zonaNombre: string;
  salaNombre: string;
}

function parteNumericaCodigo(codigo: string): number {
  const match = codigo.match(/\d+/);
  return match ? parseInt(match[0], 10) : 9999;
}

/**
 * Busca una mesa para (fecha, hora, duración, personas) dentro del ámbito
 * pedido, y explica el resultado.
 *
 * Ámbito de búsqueda (regla del dueño):
 *   - Con `zona`  → SOLO mesas de esa zona. El sistema nunca cambia de zona por
 *                   su cuenta: si el usuario pidió Terraza, no se propone Salón.
 *   - Sin `zona`  → TODAS las zonas y salas del local.
 *
 * La duración es la REAL de la reserva que se está creando (override incluido),
 * no la default de la empresa: reservar 4 horas ocupa 4 horas.
 */
export async function proponerMesaAutomatica(input: {
  fecha: string;
  hora: string;
  personas: number;
  turno: TurnoReserva;
  /** Nombre de zona en mayúsculas ("TERRAZA"). Vacío/null = todas las zonas. */
  zona?: string | null;
  localId: string;
  /** Duración real de esta reserva. Si falta, se usa la default de empresa. */
  duracionMin?: number | null;
  /** Al editar, la propia reserva no cuenta como ocupante. */
  ignoreReservaId?: string | null;
}): Promise<{ ok: true; data: PropuestaMesaResultado } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ok: false, error: "Sesión no válida" };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    if (!input.localId) return { ok: false, error: "Sin local seleccionado" };

    const personas = Math.max(1, Math.round(input.personas));
    const zonaFiltro = (input.zona ?? "").trim().toUpperCase();

    // Duración: la de la reserva manda; si no viene, la configurada por empresa.
    let duracionMin = input.duracionMin ?? 0;
    if (!(duracionMin > 0)) {
      const cfg = await getReservasConfig();
      duracionMin =
        cfg.ok && cfg.data && cfg.data.duracionReservaMin > 0
          ? cfg.data.duracionReservaMin
          : DURACION_RESERVA_DEFAULT_MINUTOS;
    }

    // 1. Catálogo de mesas activas del local (con zona y sala), filtrado por
    //    zona si el usuario eligió una. Sin filtro = todas las salas del local.
    const { data: mesasRows, error: errMesas } = await supabase
      .from("mesas")
      .select(
        "id, codigo, capacidad_min, capacidad_max, zona_id, zonas!inner(id, nombre, salas!inner(nombre))",
      )
      .eq("local_id", input.localId)
      .eq("activa", true);
    if (errMesas) throw errMesas;

    const catalogo: MesaCatalogo[] = (mesasRows ?? [])
      .map((m) => {
        const z = m.zonas as unknown as
          | { id?: string; nombre?: string; salas?: { nombre?: string } | { nombre?: string }[] }
          | { id?: string; nombre?: string; salas?: { nombre?: string } | { nombre?: string }[] }[]
          | null;
        const zona = Array.isArray(z) ? z[0] : z;
        const s = zona?.salas;
        const salaNombre = Array.isArray(s) ? (s[0]?.nombre ?? "") : (s?.nombre ?? "");
        return {
          id: m.id as string,
          codigo: ((m.codigo as string) ?? "").trim(),
          capacidadMin: Number(m.capacidad_min) || 1,
          capacidadMax: Number(m.capacidad_max) || 1,
          zonaId: (zona?.id as string) ?? (m.zona_id as string) ?? "",
          zonaNombre: zona?.nombre ?? "",
          salaNombre,
        };
      })
      .filter((m) => m.codigo)
      .filter((m) => !zonaFiltro || m.zonaNombre.toUpperCase() === zonaFiltro);

    if (catalogo.length === 0) {
      return {
        ok: true,
        data: { encontrada: false, motivo: "SIN_MESAS", libresNoAptas: [], zonaBuscada: input.zona ?? null },
      };
    }

    // 2. Bloqueos manuales: una mesa bloqueada no existe para la asignación.
    const bloqueadas = await getMesasBloqueadas(supabase as unknown as SupabaseClient, {
      empresaId,
      localId: input.localId,
      fechaISO: input.fecha,
      turno: input.turno,
    });
    const disponiblesCatalogo = catalogo.filter((m) => !bloqueadas.has(m.id));

    // 3. Ocupación real en la franja [hora, hora + duración).
    //    Cada reserva se mide con SU duración: una de 4h bloquea 4h.
    let resQuery = supabase
      .from("reservas")
      .select("id, mesa, hora, duracion_minutos")
      .eq("empresa_id", empresaId)
      .eq("fecha", input.fecha)
      .not("mesa", "is", null)
      .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
    if (input.ignoreReservaId) resQuery = resQuery.neq("id", input.ignoreReservaId);
    const { data: reservasRows, error: errRes } = await resQuery;
    if (errRes) throw errRes;

    const inicioMin = horaAMinutosJornada(input.hora);
    const finMin = inicioMin + Math.max(1, duracionMin);
    const ocupados = new Set<string>();
    for (const r of reservasRows ?? []) {
      const codigoRaw = ((r.mesa as string) ?? "").trim();
      if (!codigoRaw) continue;
      const otroInicio = horaAMinutosJornada((r.hora as string) ?? "");
      const dur = Number(r.duracion_minutos);
      const otroFin =
        otroInicio + Math.max(1, Number.isFinite(dur) && dur > 0 ? dur : duracionMin);
      if (!(otroInicio < finMin && inicioMin < otroFin)) continue;
      // Una reserva sobre unión ("M1+M2") ocupa cada mesa por separado.
      for (const parte of codigoRaw.split("+")) {
        const limpio = parte.trim().toUpperCase();
        if (limpio) ocupados.add(limpio);
      }
    }

    const libres = disponiblesCatalogo.filter((m) => !ocupados.has(m.codigo.toUpperCase()));

    // 4. Mesas sueltas que además ADMITEN al grupo por catálogo.
    const aptasLibres = libres.filter(
      (m) => m.capacidadMin <= personas && m.capacidadMax >= personas,
    );

    // 5. Uniones que admiten al grupo con TODAS sus mesas libres. Se miran
    //    siempre: un grupo de 8 puede no caber en ninguna mesa suelta y sí en
    //    una unión perfectamente disponible.
    const uniones = await listarUnionesAptas(supabase as unknown as SupabaseClient, {
      localId: input.localId,
      personas,
      zonaFiltro,
      ocupados,
      bloqueadas,
      catalogo: disponiblesCatalogo,
    });

    if (aptasLibres.length > 0 || uniones.length > 0) {
      // Preferencia: mesa suelta antes que unión (no se parten mesas sin
      // necesidad) y, dentro de las sueltas, la MÁS AJUSTADA al grupo para no
      // gastar una mesa de 10 en una pareja. A igual ajuste, orden por código.
      if (aptasLibres.length > 0) {
        const ordenadas = [...aptasLibres].sort((a, b) => {
          if (a.capacidadMax !== b.capacidadMax) return a.capacidadMax - b.capacidadMax;
          const na = parteNumericaCodigo(a.codigo);
          const nb = parteNumericaCodigo(b.codigo);
          if (na !== nb) return na - nb;
          return a.codigo.localeCompare(b.codigo);
        });
        const elegida = ordenadas[0];
        return {
          ok: true,
          data: {
            encontrada: true,
            mesa: {
              mesaId: elegida.id,
              codigo: elegida.codigo,
              capacidadMin: elegida.capacidadMin,
              capacidadMax: elegida.capacidadMax,
              zonaNombre: elegida.zonaNombre,
              salaNombre: elegida.salaNombre,
              esUnion: false,
            },
          },
        };
      }
      return { ok: true, data: { encontrada: true, mesa: uniones[0] } };
    }

    // 6. No hay propuesta. Ahora toca explicar POR QUÉ, que es lo que decide
    //    si el usuario puede hacer algo (elegir mesa a mano) o no (cambiar hora).
    //
    //    Si quedan mesas LIBRES en la franja pero ninguna admite al grupo, el
    //    problema es de capacidad, no de horario: se ofrecen esas mesas para
    //    que el local decida a mano.
    if (libres.length > 0) {
      const libresNoAptas = [...libres]
        .sort((a, b) => {
          if (a.capacidadMax !== b.capacidadMax) return b.capacidadMax - a.capacidadMax;
          return a.codigo.localeCompare(b.codigo, undefined, { numeric: true });
        })
        .map((m) => ({
          mesaId: m.id,
          codigo: m.codigo,
          capacidadMin: m.capacidadMin,
          capacidadMax: m.capacidadMax,
          zonaNombre: m.zonaNombre,
          salaNombre: m.salaNombre,
          esUnion: false,
        }));
      return {
        ok: true,
        data: {
          encontrada: false,
          motivo: "SIN_CAPACIDAD",
          libresNoAptas,
          zonaBuscada: input.zona ?? null,
        },
      };
    }

    // Ninguna mesa libre en la franja: es un problema de horario.
    return {
      ok: true,
      data: {
        encontrada: false,
        motivo: "SIN_HUECO",
        libresNoAptas: [],
        zonaBuscada: input.zona ?? null,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-propuesta-mesa] proponerMesaAutomatica:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Uniones ("M1+M2") que admiten al grupo y tienen TODAS sus mesas libres.
 *
 * Regla del dueño: basta con que un componente esté ocupado, bloqueado o
 * inactivo para que la unión entera deje de estar disponible.
 */
async function listarUnionesAptas(
  supabase: SupabaseClient,
  ctx: {
    localId: string;
    personas: number;
    zonaFiltro: string;
    ocupados: Set<string>;
    bloqueadas: Set<string>;
    catalogo: MesaCatalogo[];
  },
): Promise<MesaPropuesta[]> {
  const { data: combis, error } = await supabase
    .from("mesa_combinaciones")
    .select("id, codigo, capacidad_min, capacidad_max, zona_id, zonas(nombre)")
    .eq("local_id", ctx.localId)
    .eq("activa", true)
    .lte("capacidad_min", ctx.personas)
    .gte("capacidad_max", ctx.personas)
    .order("capacidad_max", { ascending: true });
  if (error || !combis || combis.length === 0) return [];

  const combisFiltradas = combis.filter((c) => {
    if (!ctx.zonaFiltro) return true;
    const z = c.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
    const nombre = Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
    return nombre.toUpperCase() === ctx.zonaFiltro;
  });
  if (combisFiltradas.length === 0) return [];

  const { data: comps } = await supabase
    .from("mesa_combinacion_componentes")
    .select("combinacion_id, mesas!inner(id, codigo, activa)")
    .in(
      "combinacion_id",
      combisFiltradas.map((c) => c.id as string),
    );

  const porCombi = new Map<string, { codigos: string[]; usable: boolean }>();
  for (const c of comps ?? []) {
    const m = c.mesas as unknown as { id: string; codigo: string; activa: boolean } | null;
    if (!m) continue;
    const key = c.combinacion_id as string;
    const acc = porCombi.get(key) ?? { codigos: [], usable: true };
    acc.codigos.push(m.codigo);
    if (!m.activa || ctx.bloqueadas.has(m.id) || ctx.ocupados.has(m.codigo.toUpperCase())) {
      acc.usable = false;
    }
    porCombi.set(key, acc);
  }

  const out: MesaPropuesta[] = [];
  for (const c of combisFiltradas) {
    const acc = porCombi.get(c.id as string);
    if (!acc || !acc.usable || acc.codigos.length < 2) continue;
    const z = c.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
    const zonaNombre = Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
    // La sala se toma del catálogo por el primer componente: todas las mesas de
    // una unión cuelgan de la misma zona, y la zona de una sola sala.
    const primera = ctx.catalogo.find(
      (m) => m.codigo.toUpperCase() === (acc.codigos[0] ?? "").toUpperCase(),
    );
    out.push({
      mesaId: null,
      codigo: (c.codigo as string) ?? acc.codigos.join("+"),
      capacidadMin: Number(c.capacidad_min) || 1,
      capacidadMax: Number(c.capacidad_max) || 1,
      zonaNombre: zonaNombre || (primera?.zonaNombre ?? ""),
      salaNombre: primera?.salaNombre ?? "",
      esUnion: true,
    });
  }
  return out;
}
