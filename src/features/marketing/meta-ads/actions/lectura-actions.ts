"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";
import {
  getMetaCredenciales,
  getMetaEstado,
} from "@/features/marketing/meta-ads/services/meta-credenciales";
import { sincronizarEstructura } from "@/features/marketing/meta-ads/services/meta-lectura";
import {
  getGastoDelMes,
  sincronizarInsights,
  type GastoDelMes,
} from "@/features/marketing/meta-ads/services/meta-insights";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { MetaApiError } from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Fase 3 — Lectura del árbol de tres niveles.
 *
 * Se lee del ESPEJO, no de Meta: la pantalla tiene que abrir al instante y la
 * API tiene cupo. El botón de refrescar y el cron son los que van a Meta.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Puerta de entrada: sesión, empresa y permiso del módulo.
 *
 * Sin bypass de administrador — quien no tenga MARKETING en su rol no entra,
 * aunque sea dirección. Y se comprueba AQUÍ, en el servidor: esconder el menú
 * no es proteger nada, porque la acción se puede llamar igualmente.
 */
async function contexto(): Promise<
  { ok: true; empresaId: string; userId: string } | { ok: false; error: string }
> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const { permisos } = await getUserPermisos();
  if (!puedeVerModulo(permisos, "MARKETING")) {
    return fallo("No tienes permiso para ver la publicidad de Meta.");
  }
  return { ok: true, empresaId, userId };
}

export interface NumerosNivel {
  gastoCent: number;
  impresiones: number;
  clics: number;
  resultados: number;
  /** El alcance NO se suma entre días (son personas únicas): esto es el mejor día. */
  alcanceDiaMaximo: number;
  costeResultadoCent: number | null;
}

export interface AnuncioArbol {
  metaId: string;
  nombre: string;
  estado: string | null;
  estadoEfectivo: string | null;
  formato: string | null;
  vistaPreviaUrl: string | null;
  numeros: NumerosNivel;
}

export interface ConjuntoArbol {
  metaId: string;
  nombre: string;
  estado: string | null;
  estadoEfectivo: string | null;
  presupuestoDiarioCent: number | null;
  presupuestoTotalCent: number | null;
  inicioAt: string | null;
  finAt: string | null;
  /** Dónde sale: facebook, instagram… tal como lo tiene el conjunto en Meta. */
  plataformas: string[];
  numeros: NumerosNivel;
  anuncios: AnuncioArbol[];
}

export interface CampanaArbol {
  metaId: string;
  nombre: string;
  objetivo: string | null;
  estado: string | null;
  estadoEfectivo: string | null;
  presupuestoDiarioCent: number | null;
  presupuestoTotalCent: number | null;
  creadaEnSoftware: boolean;
  numeros: NumerosNivel;
  conjuntos: ConjuntoArbol[];
}

export interface ArbolMeta {
  conectado: boolean;
  nombreCuenta: string | null;
  /** Si la página tiene Instagram vinculado; sin él el anuncio solo sale en Facebook. */
  hayInstagram: boolean;
  moneda: string;
  campanas: CampanaArbol[];
  gasto: GastoDelMes;
  desde: string;
  hasta: string;
  ultimaSincronizacion: string | null;
}

const NUMEROS_VACIOS: NumerosNivel = {
  gastoCent: 0,
  impresiones: 0,
  clics: 0,
  resultados: 0,
  alcanceDiaMaximo: 0,
  costeResultadoCent: null,
};

interface FilaResumen {
  meta_id: string;
  gasto_cent: number;
  impresiones: number;
  clics: number;
  resultados: number;
  alcance_dia_maximo: number;
  coste_resultado_cent: number | null;
}

/** Resumen de un nivel, indexado por id de Meta para cruzarlo con la estructura. */
async function resumenPorNivel(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  nivel: "campana" | "conjunto" | "anuncio",
  desde: string,
  hasta: string,
): Promise<Map<string, NumerosNivel>> {
  const { data } = await admin.rpc("meta_resumen_nivel", {
    p_empresa: empresaId,
    p_nivel: nivel,
    p_desde: desde,
    p_hasta: hasta,
  });

  const mapa = new Map<string, NumerosNivel>();
  for (const fila of (data ?? []) as FilaResumen[]) {
    mapa.set(fila.meta_id, {
      gastoCent: Number(fila.gasto_cent ?? 0),
      impresiones: Number(fila.impresiones ?? 0),
      clics: Number(fila.clics ?? 0),
      resultados: Number(fila.resultados ?? 0),
      alcanceDiaMaximo: Number(fila.alcance_dia_maximo ?? 0),
      costeResultadoCent:
        fila.coste_resultado_cent != null ? Number(fila.coste_resultado_cent) : null,
    });
  }
  return mapa;
}

/** Saca de dónde sale el anuncio (facebook / instagram) del público del conjunto. */
function plataformasDe(publico: unknown): string[] {
  const p = publico as { publisher_platforms?: unknown } | null;
  const lista = p?.publisher_platforms;
  if (!Array.isArray(lista)) return [];
  return lista.filter((x): x is string => typeof x === "string");
}

/**
 * El árbol completo de la empresa activa, con los números del período pedido.
 * `dias` por defecto 30, como el Administrador de anuncios.
 */
export async function getArbolMetaAction(dias = 30): Promise<Resultado<ArbolMeta>> {
  const ctx = await contexto();
  if (!ctx.ok) return ctx;
  const { empresaId } = ctx;

  const admin = createAdminClient();
  const estado = await getMetaEstado(admin, empresaId);

  const zona = await getZonaHorariaEmpresa(admin, empresaId);
  const hasta = hoyEnZona(zona);
  const desde = new Date(new Date(`${hasta}T00:00:00Z`).getTime() - (dias - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const vacio: ArbolMeta = {
    conectado: false,
    nombreCuenta: estado.nombreCuenta,
    hayInstagram: Boolean(estado.nombreInstagram),
    moneda: estado.moneda,
    campanas: [],
    gasto: { gastadoCent: 0, topeCent: estado.topeGastoMensualCent, bloqueado: false, mes: hasta.slice(0, 7) },
    desde,
    hasta,
    ultimaSincronizacion: null,
  };

  if (!estado.activo || !estado.adAccountId) return { ok: true, data: vacio };

  const [campanas, conjuntos, anuncios] = await Promise.all([
    admin
      .from("meta_campanas")
      .select("meta_id, nombre, objetivo, estado, estado_efectivo, presupuesto_diario_cent, presupuesto_total_cent, creada_en_software, sincronizado_at")
      .eq("empresa_id", empresaId)
      .order("sincronizado_at", { ascending: false }),
    admin
      .from("meta_conjuntos")
      .select("meta_id, campana_meta_id, nombre, estado, estado_efectivo, presupuesto_diario_cent, presupuesto_total_cent, publico, inicio_at, fin_at")
      .eq("empresa_id", empresaId),
    admin
      .from("meta_anuncios")
      .select("meta_id, conjunto_meta_id, nombre, estado, estado_efectivo, formato, vista_previa_url")
      .eq("empresa_id", empresaId),
  ]);

  const [numCampanas, numConjuntos, numAnuncios] = await Promise.all([
    resumenPorNivel(admin, empresaId, "campana", desde, hasta),
    resumenPorNivel(admin, empresaId, "conjunto", desde, hasta),
    resumenPorNivel(admin, empresaId, "anuncio", desde, hasta),
  ]);

  // Anuncios agrupados por su conjunto, y conjuntos por su campaña.
  const anunciosPorConjunto = new Map<string, AnuncioArbol[]>();
  for (const a of (anuncios.data ?? []) as Record<string, string | null>[]) {
    const conjuntoId = a.conjunto_meta_id as string;
    const lista = anunciosPorConjunto.get(conjuntoId) ?? [];
    lista.push({
      metaId: a.meta_id as string,
      nombre: a.nombre as string,
      estado: a.estado,
      estadoEfectivo: a.estado_efectivo,
      formato: a.formato,
      vistaPreviaUrl: a.vista_previa_url,
      numeros: numAnuncios.get(a.meta_id as string) ?? NUMEROS_VACIOS,
    });
    anunciosPorConjunto.set(conjuntoId, lista);
  }

  const conjuntosPorCampana = new Map<string, ConjuntoArbol[]>();
  for (const s of (conjuntos.data ?? []) as Record<string, unknown>[]) {
    const campanaId = s.campana_meta_id as string;
    const metaId = s.meta_id as string;
    const lista = conjuntosPorCampana.get(campanaId) ?? [];
    lista.push({
      metaId,
      nombre: s.nombre as string,
      estado: (s.estado as string) ?? null,
      estadoEfectivo: (s.estado_efectivo as string) ?? null,
      presupuestoDiarioCent: (s.presupuesto_diario_cent as number) ?? null,
      presupuestoTotalCent: (s.presupuesto_total_cent as number) ?? null,
      inicioAt: (s.inicio_at as string) ?? null,
      finAt: (s.fin_at as string) ?? null,
      plataformas: plataformasDe(s.publico),
      numeros: numConjuntos.get(metaId) ?? NUMEROS_VACIOS,
      anuncios: anunciosPorConjunto.get(metaId) ?? [],
    });
    conjuntosPorCampana.set(campanaId, lista);
  }

  const filasCampanas = (campanas.data ?? []) as Record<string, unknown>[];
  const arbol: CampanaArbol[] = filasCampanas.map((c) => {
    const metaId = c.meta_id as string;
    return {
      metaId,
      nombre: c.nombre as string,
      objetivo: (c.objetivo as string) ?? null,
      estado: (c.estado as string) ?? null,
      estadoEfectivo: (c.estado_efectivo as string) ?? null,
      presupuestoDiarioCent: (c.presupuesto_diario_cent as number) ?? null,
      presupuestoTotalCent: (c.presupuesto_total_cent as number) ?? null,
      creadaEnSoftware: Boolean(c.creada_en_software),
      numeros: numCampanas.get(metaId) ?? NUMEROS_VACIOS,
      conjuntos: conjuntosPorCampana.get(metaId) ?? [],
    };
  });

  let gasto: GastoDelMes;
  try {
    gasto = await getGastoDelMes(admin, empresaId, estado.topeGastoMensualCent);
  } catch {
    // El gasto no se pudo calcular: se marca bloqueado por prudencia, porque
    // con dinero de por medio es peor gastar de más que pedir un reintento.
    gasto = {
      gastadoCent: 0,
      topeCent: estado.topeGastoMensualCent,
      bloqueado: true,
      mes: hasta.slice(0, 7),
    };
  }

  return {
    ok: true,
    data: {
      conectado: true,
      nombreCuenta: estado.nombreCuenta,
      hayInstagram: Boolean(estado.nombreInstagram),
      moneda: estado.moneda,
      campanas: arbol,
      gasto,
      desde,
      hasta,
      ultimaSincronizacion: (filasCampanas[0]?.sincronizado_at as string) ?? null,
    },
  };
}

/**
 * Botón "Actualizar": va a Meta ahora mismo y refresca el espejo.
 * El cron hace lo mismo cada hora; esto es para cuando alguien acaba de tocar
 * algo en el Administrador de anuncios y no quiere esperar.
 */
export async function refrescarMetaAction(): Promise<
  Resultado<{ campanas: number; conjuntos: number; anuncios: number }>
> {
  const ctx = await contexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const cred = await getMetaCredenciales(admin, ctx.empresaId);
  if (!cred) return fallo("Esta empresa no tiene Meta conectado. Ve a Ajustes → Integraciones.");

  try {
    const estructura = await sincronizarEstructura(admin, ctx.empresaId, cred);
    await Promise.all([
      sincronizarInsights(admin, ctx.empresaId, cred, "campana"),
      sincronizarInsights(admin, ctx.empresaId, cred, "conjunto"),
      sincronizarInsights(admin, ctx.empresaId, cred, "anuncio"),
    ]);
    return { ok: true, data: estructura };
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo(err instanceof Error ? err.message : "No se pudo actualizar desde Meta.");
  }
}

export interface AccionRegistrada {
  id: string;
  empleado: string;
  accion: string;
  nivel: string;
  metaId: string;
  detalle: Record<string, unknown>;
  cuando: string;
}

/**
 * Quién ha tocado la publicidad y cuándo: quién activó el gasto, quién lo paró
 * y quién cambió un presupuesto.
 *
 * El nombre sale del registro (se congeló al hacer la acción), no de un cruce
 * con la tabla de usuarios: así sigue diciendo quién fue aunque esa persona ya
 * no trabaje en la empresa.
 */
export async function getHistorialMetaAction(
  metaId?: string,
  limite = 50,
): Promise<Resultado<AccionRegistrada[]>> {
  const ctx = await contexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let consulta = admin
    .from("meta_acciones")
    .select("id, usuario_nombre, accion, nivel, meta_id, detalle, created_at")
    .eq("empresa_id", ctx.empresaId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (metaId) consulta = consulta.eq("meta_id", metaId);

  const { data, error } = await consulta;
  if (error) return fallo(error.message);

  return {
    ok: true,
    data: (data ?? []).map((f) => {
      const fila = f as Record<string, unknown>;
      return {
        id: fila.id as string,
        empleado: (fila.usuario_nombre as string) || "Empleado dado de baja",
        accion: fila.accion as string,
        nivel: fila.nivel as string,
        metaId: fila.meta_id as string,
        detalle: (fila.detalle as Record<string, unknown>) ?? {},
        cuando: fila.created_at as string,
      };
    }),
  };
}
