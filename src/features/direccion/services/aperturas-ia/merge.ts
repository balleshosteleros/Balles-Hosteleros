/**
 * Helpers para aplicar un draft IA sobre un EstudioApertura existente.
 *
 * El draft es Partial<>; sólo se sobreescriben los campos no-null / no-undefined.
 * El usuario podrá editar antes de confirmar, así que esto es la operación
 * que ejecuta el botón "Aceptar pestaña" / "Aceptar todo".
 */
import type {
  EstudioApertura,
  PlatoDestacado,
  CategoriaVentaEstimada,
  EscenarioOcupacion,
  ColorPaleta,
} from "@/features/direccion/data/aperturas";
import {
  ESCENARIOS_FIJOS,
  matrizOcupacionVacia,
} from "@/features/direccion/data/aperturas";
import type {
  DraftIAEstudio,
  DraftDatos,
  DraftLocal,
  DraftMarca,
  DraftGastronomia,
  DraftOcupacion,
} from "@/features/direccion/types/aperturas-ia";

function uid(prefix = "ia"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* Devuelve `value` si no es null/undefined; si lo es, devuelve `fallback`. */
function pick<T>(value: T | null | undefined, fallback: T): T {
  return value === null || value === undefined ? fallback : value;
}

/* ────────────── DATOS ────────────── */

export function mergeDatos(
  base: EstudioApertura["datos"],
  draft: DraftDatos | undefined,
): EstudioApertura["datos"] {
  if (!draft) return base;
  return {
    nombre: pick(draft.nombre, base.nombre),
    ciudad: pick(draft.ciudad, base.ciudad),
    zona: pick(draft.zona, base.zona),
    poblacion: pick(draft.poblacion, base.poblacion),
    afluencia: pick(draft.afluencia, base.afluencia),
    tipoLocal: pick(draft.tipoLocal, base.tipoLocal),
    metrosCuadrados: pick(draft.metrosCuadrados, base.metrosCuadrados),
    ventasEstimadas: pick(draft.ventasEstimadas, base.ventasEstimadas),
    ticketMedio: pick(draft.ticketMedio, base.ticketMedio),
    clientesEstimados: pick(draft.clientesEstimados, base.clientesEstimados),
    estacionalidad: pick(draft.estacionalidad, base.estacionalidad),
    competencia: pick(draft.competencia, base.competencia),
    observaciones: pick(draft.observaciones, base.observaciones),
  };
}

/* ────────────── LOCAL ────────────── */

export function mergeLocal(
  base: EstudioApertura["local"],
  draft: DraftLocal | undefined,
): EstudioApertura["local"] {
  if (!draft) return base;
  const c = draft.caracteristicas ?? {};
  const u = draft.ubicacion ?? {};
  return {
    caracteristicas: {
      tipoEstablecimiento: pick(c.tipoEstablecimiento, base.caracteristicas.tipoEstablecimiento),
      metrosUtiles: pick(c.metrosUtiles, base.caracteristicas.metrosUtiles),
      metrosTerraza: pick(c.metrosTerraza, base.caracteristicas.metrosTerraza),
      plazasInterior: pick(c.plazasInterior, base.caracteristicas.plazasInterior),
      plazasTerraza: pick(c.plazasTerraza, base.caracteristicas.plazasTerraza),
      plantasLocal: pick(c.plantasLocal, base.caracteristicas.plantasLocal),
      banos: pick(c.banos, base.caracteristicas.banos),
      acceso: pick(c.acceso, base.caracteristicas.acceso),
      estadoLocal: pick(c.estadoLocal, base.caracteristicas.estadoLocal),
      licenciaActividad: pick(c.licenciaActividad, base.caracteristicas.licenciaActividad),
      salidaHumos: pick(c.salidaHumos, base.caracteristicas.salidaHumos),
      alquilerMensual: pick(c.alquilerMensual, base.caracteristicas.alquilerMensual),
      traspaso: pick(c.traspaso, base.caracteristicas.traspaso),
      duracionContrato: pick(c.duracionContrato, base.caracteristicas.duracionContrato),
      observaciones: pick(c.observaciones, base.caracteristicas.observaciones),
    },
    ubicacion: {
      direccion: pick(u.direccion, base.ubicacion.direccion),
      ciudad: pick(u.ciudad, base.ubicacion.ciudad),
      codigoPostal: pick(u.codigoPostal, base.ubicacion.codigoPostal),
      pais: pick(u.pais, base.ubicacion.pais),
      lat: base.ubicacion.lat,
      lng: base.ubicacion.lng,
      radioKm: base.ubicacion.radioKm,
    },
    fotos: base.fotos,
  };
}

/* ────────────── MARCA ────────────── */

export function mergeMarca(
  base: EstudioApertura["imagenMarca"],
  draft: DraftMarca | undefined,
): EstudioApertura["imagenMarca"] {
  if (!draft) return base;
  const paleta: ColorPaleta[] | undefined = draft.paleta
    ? draft.paleta.map((c) => ({ id: uid("col"), nombre: c.nombre, hex: c.hex }))
    : undefined;
  return {
    claim: pick(draft.claim, base.claim),
    descripcion: pick(draft.descripcion, base.descripcion),
    publicoObjetivo: pick(draft.publicoObjetivo, base.publicoObjetivo),
    valores: pick(draft.valores, base.valores),
    tipografiaTitulares: pick(draft.tipografiaTitulares, base.tipografiaTitulares),
    tipografiaCuerpo: pick(draft.tipografiaCuerpo, base.tipografiaCuerpo),
    paleta: paleta ?? base.paleta,
    logoPath: base.logoPath,
    logoUrl: base.logoUrl,
  };
}

/* ────────────── GASTRONOMÍA ────────────── */

export function mergeGastronomia(
  base: EstudioApertura["propuesta"],
  draft: DraftGastronomia | undefined,
): EstudioApertura["propuesta"] {
  if (!draft) return base;
  const platos: PlatoDestacado[] | undefined = draft.platos
    ? draft.platos.map((p) => ({
        id: uid("plato"),
        nombre: p.nombre ?? "",
        descripcion: p.descripcion ?? "",
        precio: p.precio ?? 0,
        categoria: p.categoria ?? "",
      }))
    : undefined;
  const categoriasVenta: CategoriaVentaEstimada[] | undefined = draft.categoriasVenta
    ? draft.categoriasVenta.map((c) => ({
        id: uid("cat"),
        nombre: c.nombre,
        porcentaje: c.porcentaje,
      }))
    : undefined;
  return {
    concepto: pick(draft.concepto, base.concepto),
    descripcion: pick(draft.descripcion, base.descripcion),
    estiloServicio: pick(draft.estiloServicio, base.estiloServicio),
    rangoPrecioMedio: pick(draft.rangoPrecioMedio, base.rangoPrecioMedio),
    numeroPlatosCarta: pick(draft.numeroPlatosCarta, base.numeroPlatosCarta),
    cartaUrl: pick(draft.cartaUrl, base.cartaUrl),
    platos: platos ?? base.platos,
    categoriasVenta: categoriasVenta ?? base.categoriasVenta,
  };
}

/* ────────────── OCUPACIÓN ────────────── */

/** Mapea por NOMBRE del escenario (la IA devuelve "Conservador" | "Realista" | "Optimista"). */
export function mergeOcupacion(
  base: EstudioApertura["ocupacion"],
  draft: DraftOcupacion | undefined,
): EstudioApertura["ocupacion"] {
  if (!draft || !draft.escenarios) return base;
  type DraftEscenario = NonNullable<DraftOcupacion["escenarios"]>[number];
  const porNombre = new Map<string, DraftEscenario>();
  for (const e of draft.escenarios) {
    if (e?.nombre) porNombre.set(e.nombre.toLowerCase(), e);
  }
  const escenarios: EscenarioOcupacion[] = ESCENARIOS_FIJOS.map((fijo) => {
    const previo = base.escenarios.find((e) => e.id === fijo.id);
    const propuesta = porNombre.get(fijo.nombre.toLowerCase());
    if (!propuesta) {
      return previo ?? { ...fijo, matriz: matrizOcupacionVacia() };
    }
    const matriz = matrizOcupacionVacia();
    for (const [dia, franjas] of Object.entries(propuesta.matriz ?? {})) {
      if (!(dia in matriz)) continue;
      const fila = matriz[dia as keyof typeof matriz];
      for (const [f, v] of Object.entries(franjas ?? {})) {
        if (!(f in fila)) continue;
        const num = Number(v);
        if (Number.isFinite(num)) {
          (fila as Record<string, number>)[f] = Math.max(0, Math.min(100, num));
        }
      }
    }
    return { ...fijo, matriz };
  });
  return {
    escenarios,
    escenarioActivoId: base.escenarioActivoId ?? "esc-realista",
  };
}

/* ────────────── APLICAR DRAFT COMPLETO ────────────── */

/** Aplica todos los bloques presentes en el draft sobre el estudio. */
export function aplicarDraftCompleto(
  estudio: EstudioApertura,
  draft: DraftIAEstudio,
): EstudioApertura {
  return {
    ...estudio,
    datos: mergeDatos(estudio.datos, draft.datos),
    local: mergeLocal(estudio.local, draft.local),
    imagenMarca: mergeMarca(estudio.imagenMarca, draft.marca),
    propuesta: mergeGastronomia(estudio.propuesta, draft.gastronomia),
    ocupacion: mergeOcupacion(estudio.ocupacion, draft.ocupacion),
    // Bloques financieros (opt-in) los aplicará la Fase 6 cuando estén cableados.
  };
}
