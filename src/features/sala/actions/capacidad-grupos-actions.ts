"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import {
  ESTADOS_NO_OCUPANTES,
  getDuracionReservaMin,
  franjasSolapan,
} from "@/features/sala/lib/reserva-conflicto";
import { getMesasBloqueadas } from "@/features/sala/bloqueos/lib/mesas-bloqueadas";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import { GRUPO_MAX, GRUPO_MIN } from "@/features/sala/data/capacidad-grupos";

/**
 * Capacidad por tamaño de grupo: qué opciones (mesas sueltas y combinaciones)
 * admiten cada número de comensales, y cuántas siguen libres en un día concreto.
 *
 * Responde a la pregunta operativa: "para 7 personas, ¿me queda algo libre el
 * sábado?". Usa el MISMO criterio de ocupación que el motor de asignación
 * (`asignacion-mesa.ts`): una reserva sobre una unión ocupa todas sus mesas, y
 * una unión solo está libre si lo están todas las suyas.
 */


export interface OpcionCapacidad {
  /** Código visible: "TE1" o "TE1+TE2". */
  codigo: string;
  zona: string;
  esCombinacion: boolean;
  capacidadMin: number;
  capacidadMax: number;
  /** Solo en la consulta por día: si sigue libre a esa hora. */
  libre: boolean;
  /** Códigos de las mesas ocupadas que la bloquean (para explicar el porqué). */
  bloqueadaPor: string[];
}

export interface FilaCapacidadGrupo {
  personas: number;
  total: number;
  libres: number;
  /** Desglose por zona: cuántas opciones hay y cuántas libres. */
  porZona: Array<{ zona: string; total: number; libres: number }>;
  opciones: OpcionCapacidad[];
}

export interface CapacidadGruposResult {
  ok: boolean;
  /** Sin fecha: solo el catálogo teórico (todo libre). */
  fecha: string | null;
  hora: string | null;
  filas: FilaCapacidadGrupo[];
  zonas: string[];
  error?: string;
}

const VACIO: CapacidadGruposResult = {
  ok: false,
  fecha: null,
  hora: null,
  filas: [],
  zonas: [],
};

/**
 * @param fecha  YYYY-MM-DD. Si se omite, devuelve el catálogo teórico completo.
 * @param hora   HH:MM. Sin ella, una opción cuenta como ocupada si tiene
 *               CUALQUIER reserva ese día (visión de jornada completa).
 */
export async function getCapacidadPorGrupo(params: {
  localId: string;
  fecha?: string | null;
  hora?: string | null;
}): Promise<CapacidadGruposResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ...VACIO, error: "Sin empresa activa" };
    if (!params.localId) return { ...VACIO, error: "Sin local" };

    const fecha = params.fecha ?? null;
    const hora = params.hora ?? null;

    // 1. Mesas activas con su zona.
    const { data: mesasRaw, error: errMesas } = await supabase
      .from("mesas")
      .select("id, codigo, capacidad_min, capacidad_max, activa, zonas!inner(nombre)")
      .eq("local_id", params.localId)
      .eq("activa", true);
    if (errMesas) throw errMesas;

    type MesaInfo = {
      id: string;
      codigo: string;
      zona: string;
      min: number;
      max: number;
    };
    const mesas: MesaInfo[] = (mesasRaw ?? []).map((m) => {
      const z = m.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
      return {
        id: m.id as string,
        codigo: m.codigo as string,
        zona: Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? ""),
        min: (m.capacidad_min as number) ?? 1,
        max: (m.capacidad_max as number) ?? 1,
      };
    });

    // 2. Combinaciones activas con sus mesas.
    const { data: combisRaw, error: errCombis } = await supabase
      .from("mesa_combinaciones")
      .select("id, codigo, capacidad_min, capacidad_max, activa, zonas(nombre)")
      .eq("local_id", params.localId)
      .eq("activa", true);
    if (errCombis) throw errCombis;

    const combiIds = (combisRaw ?? []).map((c) => c.id as string);
    const componentesPorCombi = new Map<string, string[]>();
    if (combiIds.length > 0) {
      const { data: comps, error: errComps } = await supabase
        .from("mesa_combinacion_componentes")
        .select("combinacion_id, mesas!inner(codigo)")
        .in("combinacion_id", combiIds);
      if (errComps) throw errComps;
      for (const c of comps ?? []) {
        const m = c.mesas as unknown as { codigo?: string } | { codigo?: string }[] | null;
        const codigo = Array.isArray(m) ? (m[0]?.codigo ?? "") : (m?.codigo ?? "");
        if (!codigo) continue;
        const id = c.combinacion_id as string;
        const lista = componentesPorCombi.get(id);
        if (lista) lista.push(codigo);
        else componentesPorCombi.set(id, [codigo]);
      }
    }

    // 3. Qué mesas están ocupadas. Mismo criterio que el motor: una reserva
    //    sobre "TE1+TE2" ocupa TE1 y TE2 por separado.
    const ocupadas = new Set<string>();
    if (fecha) {
      const duracionMin = await getDuracionReservaMin(supabase, empresaId);
      const { data: reservas, error: errRes } = await supabase
        .from("reservas")
        .select("mesa, hora, duracion_minutos")
        .eq("empresa_id", empresaId)
        .eq("fecha", fecha)
        .not("mesa", "is", null)
        .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
      if (errRes) throw errRes;

      for (const r of reservas ?? []) {
        const codigo = (r.mesa as string) ?? "";
        if (!codigo) continue;
        // Sin hora concreta miramos el día entero; con hora, solo lo que solapa.
        if (hora) {
          const horaReserva = (r.hora as string) ?? "";
          // Cada reserva ocupa su mesa durante SU duración: una comida larga ya
          // guardada bloquea todo su intervalo, no solo la duración por defecto.
          const durOtra = Number(r.duracion_minutos);
          const duracionOtra =
            Number.isFinite(durOtra) && durOtra > 0 ? durOtra : duracionMin;
          if (!franjasSolapan(hora, duracionMin, horaReserva, duracionOtra)) continue;
        }
        for (const parte of codigo.split("+")) {
          const limpio = parte.trim();
          if (limpio) ocupadas.add(limpio);
        }
      }

      // Los bloqueos manuales también dejan la mesa fuera de juego, pero solo
      // en su turno. Sin hora concreta no hay turno que mirar y cuentan todos.
      const bloqueadas = await getMesasBloqueadas(supabase, {
        empresaId,
        localId: params.localId,
        fechaISO: fecha,
        turno: hora ? turnoDeHora(hora) : null,
      });
      for (const m of mesas) if (bloqueadas.has(m.id)) ocupadas.add(m.codigo);
    }

    // 4. Catálogo de opciones.
    const opciones: OpcionCapacidad[] = [];

    for (const m of mesas) {
      const bloqueadaPor = ocupadas.has(m.codigo) ? [m.codigo] : [];
      opciones.push({
        codigo: m.codigo,
        zona: m.zona,
        esCombinacion: false,
        capacidadMin: m.min,
        capacidadMax: m.max,
        libre: bloqueadaPor.length === 0,
        bloqueadaPor,
      });
    }

    const zonaDeMesa = new Map(mesas.map((m) => [m.codigo, m.zona]));
    for (const c of combisRaw ?? []) {
      const id = c.id as string;
      const partes = componentesPorCombi.get(id) ?? [];
      if (partes.length < 2) continue; // unión mal formada
      const z = c.zonas as unknown as { nombre?: string } | { nombre?: string }[] | null;
      const zonaCombi =
        (Array.isArray(z) ? z[0]?.nombre : z?.nombre) ??
        zonaDeMesa.get(partes[0]) ??
        "";
      const bloqueadaPor = partes.filter((p) => ocupadas.has(p));
      opciones.push({
        codigo: c.codigo as string,
        zona: zonaCombi,
        esCombinacion: true,
        capacidadMin: (c.capacidad_min as number) ?? 1,
        capacidadMax: (c.capacidad_max as number) ?? 1,
        libre: bloqueadaPor.length === 0,
        bloqueadaPor,
      });
    }

    // 5. Una fila por tamaño de grupo.
    const zonasSet = new Set<string>();
    for (const o of opciones) if (o.zona) zonasSet.add(o.zona);
    const zonas = [...zonasSet].sort((a, b) => a.localeCompare(b, "es"));

    const filas: FilaCapacidadGrupo[] = [];
    for (let n = GRUPO_MIN; n <= GRUPO_MAX; n++) {
      const admiten = opciones
        .filter((o) => n >= o.capacidadMin && n <= o.capacidadMax)
        .sort((a, b) => {
          if (a.esCombinacion !== b.esCombinacion) return a.esCombinacion ? 1 : -1;
          if (a.zona !== b.zona) return a.zona.localeCompare(b.zona, "es");
          return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
        });

      const porZona = zonas
        .map((z) => {
          const deZona = admiten.filter((o) => o.zona === z);
          return {
            zona: z,
            total: deZona.length,
            libres: deZona.filter((o) => o.libre).length,
          };
        })
        .filter((x) => x.total > 0);

      filas.push({
        personas: n,
        total: admiten.length,
        libres: admiten.filter((o) => o.libre).length,
        porZona,
        opciones: admiten,
      });
    }

    return { ok: true, fecha, hora, filas, zonas };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[capacidad-grupos]", msg);
    return { ...VACIO, error: msg };
  }
}
