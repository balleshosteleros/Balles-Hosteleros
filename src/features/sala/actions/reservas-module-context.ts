"use server";

import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import {
  listPlanosConSalas,
  getPlanoActivoConPosiciones,
} from "@/features/sala/planos/actions/planos-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import { listSalaDecoracionesByLocal } from "@/features/sala/planos/actions/sala-decoraciones-actions";
import { listReservaEtiquetas } from "@/features/sala/actions/reserva-etiquetas-actions";
import type {
  LocalMin,
  Sala,
  Plano,
  Zona,
  Mesa as MesaConfig,
  MesaPosicion,
  SalaDecoracion,
} from "@/features/sala/planos/data/planos";
import type { ReservaEtiqueta } from "@/features/sala/data/reservas";

export interface ReservasModuleContext {
  locales: LocalMin[];
  localId: string;
  salas: Sala[];
  planos: Plano[];
  /** Mapa plano_id → sala_ids asociadas. Necesario para resolver zonas del plano vigente del día. */
  planoSalas: Record<string, string[]>;
  zonas: Zona[];
  mesas: MesaConfig[];
  posiciones: MesaPosicion[];
  etiquetas: ReservaEtiqueta[];
  decoraciones: SalaDecoracion[];
}

const EMPTY: ReservasModuleContext = {
  locales: [],
  localId: "",
  salas: [],
  planos: [],
  planoSalas: {},
  zonas: [],
  mesas: [],
  posiciones: [],
  etiquetas: [],
  decoraciones: [],
};

/**
 * Carga TODO el contexto inicial del módulo /sala/reservas en un solo round-trip
 * paralelo. Reemplaza ~6 useEffects en cascada por una única llamada.
 */
export async function loadReservasModuleContext(
  localIdOverride?: string,
): Promise<{ ok: true; data: ReservasModuleContext }> {
  try {
    const localesRes = await listLocalesEmpresa();
    if (!localesRes.ok || localesRes.data.length === 0) {
      return { ok: true, data: EMPTY };
    }
    const localId = localIdOverride || localesRes.data[0].id;

    const [
      salasRes,
      planosConSalasRes,
      zonasRes,
      mesasRes,
      planoActivoRes,
      etiquetasRes,
      decoracionesRes,
    ] = await Promise.all([
      listSalas(localId),
      listPlanosConSalas(localId),
      listZonas(localId),
      listMesas(localId),
      getPlanoActivoConPosiciones(localId),
      listReservaEtiquetas({ soloActivos: true }),
      listSalaDecoracionesByLocal(localId),
    ]);

    const planoSalas: Record<string, string[]> = {};
    if (planosConSalasRes.ok) {
      planosConSalasRes.data.salasPorPlano.forEach((salaIds, planoId) => {
        planoSalas[planoId] = salaIds;
      });
    }

    return {
      ok: true,
      data: {
        locales: localesRes.data,
        localId,
        salas: salasRes.ok ? salasRes.data : [],
        planos: planosConSalasRes.ok ? planosConSalasRes.data.planos : [],
        planoSalas,
        zonas: zonasRes.ok ? zonasRes.data : [],
        mesas: mesasRes.ok ? mesasRes.data : [],
        posiciones:
          planoActivoRes.ok && planoActivoRes.data
            ? planoActivoRes.data.posiciones
            : [],
        etiquetas: etiquetasRes.ok ? etiquetasRes.data : [],
        decoraciones: decoracionesRes.ok ? decoracionesRes.data : [],
      },
    };
  } catch (err) {
    console.error("[reservas-module-context] load:", err);
    return { ok: true, data: EMPTY };
  }
}
