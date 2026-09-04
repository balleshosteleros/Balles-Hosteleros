"use server";

import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import {
  listCombinaciones,
  listComponentesTodas,
} from "@/features/sala/planos/actions/combinaciones-actions";
import {
  listPlanos,
  listPlanosConSalas,
} from "@/features/sala/planos/actions/planos-actions";
import {
  listOrdenCompleto,
  type OrdenPorComensales,
} from "@/features/sala/planos/actions/orden-asignacion-actions";
import {
  getExigirZonaCliente,
  listGruposZonas,
  type GrupoZona,
} from "@/features/sala/planos/actions/grupos-zonas-actions";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";
import type {
  LocalMin,
  Mesa,
  MesaCombinacion,
  Plano,
  Sala,
  Zona,
} from "@/features/sala/planos/data/planos";

export interface EstructuraContext {
  locales: LocalMin[];
  localId: string;
  salas: Sala[];
  zonas: Zona[];
  mesas: Mesa[];
  combinaciones: MesaCombinacion[];
  planos: Plano[];
  /** plano_id → sala_ids activas en ese plano. */
  salasPorPlano: Record<string, string[]>;
}

const VACIO: EstructuraContext = {
  locales: [],
  localId: "",
  salas: [],
  zonas: [],
  mesas: [],
  combinaciones: [],
  planos: [],
  salasPorPlano: {},
};

/**
 * Todo lo que necesita la pestaña Estructura en UN solo viaje.
 *
 * Antes iba en dos tandas: primero se pedían los locales y, sólo cuando
 * contestaban, se pedía el resto. Con el servidor lejos, esa espera se pagaba
 * dos veces seguidas y la pestaña se quedaba en blanco mientras tanto. Aquí el
 * salto de los locales ocurre en el servidor —donde la base de datos está al
 * lado— y al navegador vuelve todo junto.
 */
export async function loadEstructuraContext(
  localIdOverride?: string,
): Promise<{ ok: true; data: EstructuraContext }> {
  try {
    const localesRes = await listLocalesEmpresa();
    if (!localesRes.ok || localesRes.data.length === 0) {
      return { ok: true, data: VACIO };
    }
    const localId = localIdOverride || localesRes.data[0].id;
    const [s, z, m, c, pcs] = await Promise.all([
      listSalas(localId),
      listZonas(localId),
      listMesas(localId),
      listCombinaciones(localId),
      listPlanosConSalas(localId),
    ]);
    const salasPorPlano: Record<string, string[]> = {};
    for (const [pid, sids] of pcs.data.salasPorPlano) salasPorPlano[pid] = sids;
    return {
      ok: true,
      data: {
        locales: localesRes.data,
        localId,
        salas: s.ok ? s.data : [],
        zonas: z.ok ? z.data : [],
        mesas: m.ok ? m.data : [],
        combinaciones: c.ok ? c.data : [],
        planos: pcs.data.planos,
        salasPorPlano,
      },
    };
  } catch (err) {
    console.error("[estructura] context:", err);
    return { ok: true, data: VACIO };
  }
}

export interface ZonasClienteContext {
  locales: LocalMin[];
  localId: string;
  empresaId: string | null;
  /** ¿Se obliga al cliente a elegir zona al reservar por la web? */
  exigir: boolean;
  zonas: Zona[];
  mesas: Mesa[];
  publicas: GrupoZona[];
}

const ZONAS_VACIO: ZonasClienteContext = {
  locales: [],
  localId: "",
  empresaId: null,
  exigir: false,
  zonas: [],
  mesas: [],
  publicas: [],
};

/**
 * Todo lo de la pestaña Zonas cliente en UN viaje.
 *
 * Antes: locales y empresa primero, luego el ajuste de "exigir zona", y sólo
 * entonces zonas, mesas y grupos. Tres esperas encadenadas con la pantalla en
 * blanco. Ahora se resuelven todas en el servidor y vuelven juntas.
 */
export async function loadZonasClienteContext(
  localIdOverride?: string,
): Promise<{ ok: true; data: ZonasClienteContext }> {
  try {
    const [localesRes, empresaId] = await Promise.all([
      listLocalesEmpresa(),
      getEmpresaActivaId(),
    ]);
    if (!localesRes.ok || localesRes.data.length === 0) {
      return { ok: true, data: { ...ZONAS_VACIO, empresaId: empresaId ?? null } };
    }
    const localId = localIdOverride || localesRes.data[0].id;
    const [cfg, z, m, p] = await Promise.all([
      empresaId ? getExigirZonaCliente(empresaId) : Promise.resolve(null),
      listZonas(localId),
      listMesas(localId),
      listGruposZonas(localId),
    ]);
    return {
      ok: true,
      data: {
        locales: localesRes.data,
        localId,
        empresaId: empresaId ?? null,
        exigir: cfg?.ok ? cfg.data : false,
        zonas: z.ok ? z.data : [],
        mesas: m.ok ? m.data : [],
        publicas: p.ok ? p.data : [],
      },
    };
  } catch (err) {
    console.error("[zonas-cliente] context:", err);
    return { ok: true, data: ZONAS_VACIO };
  }
}

export interface OrdenContext {
  locales: LocalMin[];
  localId: string;
  planos: Plano[];
  planoId: string;
  mesas: Mesa[];
  zonas: Zona[];
  combinaciones: MesaCombinacion[];
  componentes: { combinacionId: string; mesaId: string; orden: number }[];
  /** Orden ya cargado del plano elegido, para no encadenar otra espera más. */
  orden: OrdenPorComensales;
}

const ORDEN_VACIO: OrdenContext = {
  locales: [],
  localId: "",
  planos: [],
  planoId: "",
  mesas: [],
  zonas: [],
  combinaciones: [],
  componentes: [],
  orden: {},
};

/**
 * Todo lo de la pestaña Orden en UN viaje: locales, datos del local Y el orden
 * del plano que se va a mostrar.
 *
 * Antes eran TRES esperas encadenadas —locales, luego el local, luego el orden
 * del plano—, cada una esperando a la anterior. Aquí se encadenan en el
 * servidor, junto a la base de datos, y al navegador llega todo junto.
 */
export async function loadOrdenContext(
  localIdOverride?: string,
  planoIdOverride?: string,
): Promise<{ ok: true; data: OrdenContext }> {
  try {
    const localesRes = await listLocalesEmpresa();
    if (!localesRes.ok || localesRes.data.length === 0) {
      return { ok: true, data: ORDEN_VACIO };
    }
    const localId = localIdOverride || localesRes.data[0].id;
    const [p, m, z, c, comp] = await Promise.all([
      listPlanos(localId),
      listMesas(localId),
      listZonas(localId),
      listCombinaciones(localId),
      listComponentesTodas(localId),
    ]);
    const planos = p.ok ? p.data : [];
    const principal = planos.find((x) => x.esPrincipal && x.activo) ?? planos[0];
    const planoId = planoIdOverride || principal?.id || "";
    const ordenRes = planoId ? await listOrdenCompleto(planoId) : null;
    return {
      ok: true,
      data: {
        locales: localesRes.data,
        localId,
        planos,
        planoId,
        mesas: m.ok ? m.data : [],
        zonas: z.ok ? z.data : [],
        combinaciones: c.ok ? c.data : [],
        componentes: comp.ok ? comp.data : [],
        orden: ordenRes?.ok ? (ordenRes.data as OrdenPorComensales) : {},
      },
    };
  } catch (err) {
    console.error("[orden] context:", err);
    return { ok: true, data: ORDEN_VACIO };
  }
}
