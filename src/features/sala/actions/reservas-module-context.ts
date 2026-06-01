"use server";

import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import {
  listPlanos,
  getPlanoActivoConPosiciones,
} from "@/features/sala/planos/actions/planos-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import { listReservaEtiquetas } from "@/features/sala/actions/reserva-etiquetas-actions";
import type {
  LocalMin,
  Sala,
  Plano,
  Zona,
  Mesa as MesaConfig,
  MesaPosicion,
} from "@/features/sala/planos/data/planos";
import type { ReservaEtiqueta } from "@/features/sala/data/reservas";

export interface ReservasModuleContext {
  locales: LocalMin[];
  localId: string;
  salas: Sala[];
  planos: Plano[];
  zonas: Zona[];
  mesas: MesaConfig[];
  posiciones: MesaPosicion[];
  etiquetas: ReservaEtiqueta[];
}

const EMPTY: ReservasModuleContext = {
  locales: [],
  localId: "",
  salas: [],
  planos: [],
  zonas: [],
  mesas: [],
  posiciones: [],
  etiquetas: [],
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

    const [salasRes, planosRes, zonasRes, mesasRes, planoActivoRes, etiquetasRes] =
      await Promise.all([
        listSalas(localId),
        listPlanos(localId),
        listZonas(localId),
        listMesas(localId),
        getPlanoActivoConPosiciones(localId),
        listReservaEtiquetas({ soloActivos: true }),
      ]);

    return {
      ok: true,
      data: {
        locales: localesRes.data,
        localId,
        salas: salasRes.ok ? salasRes.data : [],
        planos: planosRes.ok ? planosRes.data : [],
        zonas: zonasRes.ok ? zonasRes.data : [],
        mesas: mesasRes.ok ? mesasRes.data : [],
        posiciones:
          planoActivoRes.ok && planoActivoRes.data
            ? planoActivoRes.data.posiciones
            : [],
        etiquetas: etiquetasRes.ok ? etiquetasRes.data : [],
      },
    };
  } catch (err) {
    console.error("[reservas-module-context] load:", err);
    return { ok: true, data: EMPTY };
  }
}
