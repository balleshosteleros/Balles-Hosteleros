"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { construirSerie, type FilaAgregada } from "./serie";
import { restarDias } from "./rangos";
import type {
  BotonPulsado,
  ComportamientoWeb,
  OrigenVisitas,
  SerieEstadisticas,
} from "./types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const consultaSchema = z.object({
  id: z.string().uuid(),
  /** Cuántos días hacia atrás, contando hoy. */
  dias: z.number().int().min(1).max(400),
});

/**
 * Las dos gráficas leen tablas distintas con las mismas columnas, así que la
 * consulta es una sola parametrizada por tabla y por columna de enlace.
 *
 * El periodo se calcula AQUÍ, con la zona horaria de la empresa, y no en el
 * navegador: el reloj del móvil de quien mira puede estar en otro huso (o mal
 * puesto) y entonces "los últimos 30 días" no coincidirían con los días con los
 * que se guardaron los escaneos.
 *
 * Se filtra SIEMPRE por `empresa_id` además de por el id del QR o de la página:
 * la RLS impide ver lo de otra empresa, pero no acota a la empresa ACTIVA, que
 * es la que el usuario tiene delante.
 */
async function leerSerie(
  tabla: "qr_escaneos" | "paginas_web_visitas",
  columnaEnlace: "qr_id" | "pagina_id",
  input: z.input<typeof consultaSchema>,
): Promise<ActionResult<SerieEstadisticas>> {
  try {
    const parsed = consultaSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "No se pudo leer el periodo pedido." };
    }
    const { id, dias } = parsed.data;

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const hasta = hoyEnZona(tz);
    const desde = restarDias(hasta, dias - 1);

    const filas = await leerTodas<FilaAgregada>(() =>
      supabase
        .from(tabla)
        .select("fecha, dispositivo, total")
        .eq(columnaEnlace, id)
        .eq("empresa_id", empresaId)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: true }),
    );

    return { ok: true, data: construirSerie(filas, desde, hasta) };
  } catch (err) {
    console.error(`[marketing][estadisticas][${tabla}] fatal:`, err);
    return { ok: false, error: friendlyError(err, "estadisticasMarketing") };
  }
}

export async function escaneosDeQr(
  input: z.input<typeof consultaSchema>,
): Promise<ActionResult<SerieEstadisticas>> {
  return leerSerie("qr_escaneos", "qr_id", input);
}

export async function visitasDePaginaWeb(
  input: z.input<typeof consultaSchema>,
): Promise<ActionResult<SerieEstadisticas>> {
  return leerSerie("paginas_web_visitas", "pagina_id", input);
}

/** Fila cruda de `paginas_web_clics`. */
interface FilaClic {
  destino: string;
  etiqueta: string | null;
  total: number;
}

/** Fila cruda de `paginas_web_tiempo`. */
interface FilaTiempo {
  total_segundos: number;
  visitas_medidas: number;
  rebotes: number;
}

/** Fila cruda de `paginas_web_origenes`. */
interface FilaOrigen {
  origen: string;
  total: number;
}

/**
 * Qué hace la gente dentro de la web: botones pulsados, cuánto se queda y de
 * dónde llega. Mismo periodo y misma zona horaria que la gráfica de visitas,
 * para que los dos números de la misma pantalla hablen del mismo tramo.
 *
 * Se filtra SIEMPRE por `empresa_id` además de por la página: la RLS impide ver
 * lo de otra empresa, pero no acota a la empresa ACTIVA, que es la que el
 * usuario tiene delante.
 */
export async function comportamientoDePaginaWeb(
  input: z.input<typeof consultaSchema>,
): Promise<ActionResult<ComportamientoWeb>> {
  try {
    const parsed = consultaSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "No se pudo leer el periodo pedido." };
    }
    const { id, dias } = parsed.data;

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const hasta = hoyEnZona(tz);
    const desde = restarDias(hasta, dias - 1);

    // Se filtra SIEMPRE por página Y por empresa, y siempre dentro del periodo.
    const [clics, tiempos, origenes] = await Promise.all([
      leerTodas<FilaClic>(() =>
        supabase
          .from("paginas_web_clics")
          .select("destino, etiqueta, total")
          .eq("pagina_id", id)
          .eq("empresa_id", empresaId)
          .gte("fecha", desde)
          .lte("fecha", hasta),
      ),
      leerTodas<FilaTiempo>(() =>
        supabase
          .from("paginas_web_tiempo")
          .select("total_segundos, visitas_medidas, rebotes")
          .eq("pagina_id", id)
          .eq("empresa_id", empresaId)
          .gte("fecha", desde)
          .lte("fecha", hasta),
      ),
      leerTodas<FilaOrigen>(() =>
        supabase
          .from("paginas_web_origenes")
          .select("origen, total")
          .eq("pagina_id", id)
          .eq("empresa_id", empresaId)
          .gte("fecha", desde)
          .lte("fecha", hasta),
      ),
    ]);

    return {
      ok: true,
      data: {
        ...agruparBotones(clics),
        ...resumirTiempo(tiempos),
        origenes: agruparOrigenes(origenes),
      },
    };
  } catch (err) {
    console.error("[marketing][estadisticas][comportamiento] fatal:", err);
    return { ok: false, error: friendlyError(err, "estadisticasMarketing") };
  }
}

/**
 * Junta las filas por destino. El mismo botón aparece en varias filas (una por
 * día y por tipo de aparato) y, si su texto se editó a mitad de mes, con dos
 * etiquetas distintas: se queda la más reciente que traiga texto.
 */
function agruparBotones(filas: FilaClic[]): Pick<ComportamientoWeb, "botones" | "clicsTotales"> {
  const porDestino = new Map<string, BotonPulsado>();
  let clicsTotales = 0;

  for (const fila of filas) {
    const total = Number(fila.total) || 0;
    clicsTotales += total;

    const previo = porDestino.get(fila.destino);
    const etiqueta = (fila.etiqueta ?? "").trim();
    if (previo) {
      previo.total += total;
      if (!previo.etiqueta && etiqueta) previo.etiqueta = etiqueta;
    } else {
      porDestino.set(fila.destino, {
        destino: fila.destino,
        etiqueta: etiqueta || fila.destino,
        total,
      });
    }
  }

  const botones = [...porDestino.values()].sort((a, b) => b.total - a.total);
  return { botones, clicsTotales };
}

/** Media de segundos y porcentaje de rebote del periodo entero. */
function resumirTiempo(
  filas: FilaTiempo[],
): Pick<ComportamientoWeb, "segundosMedios" | "visitasMedidas" | "porcentajeRebote"> {
  let segundos = 0;
  let visitas = 0;
  let rebotes = 0;

  for (const fila of filas) {
    segundos += Number(fila.total_segundos) || 0;
    visitas += Number(fila.visitas_medidas) || 0;
    rebotes += Number(fila.rebotes) || 0;
  }

  return {
    segundosMedios: visitas > 0 ? segundos / visitas : 0,
    visitasMedidas: visitas,
    // Sin visitas medidas NO es "0% de rebote": es que no se sabe. Un cero
    // aquí se leería como "nadie se va nunca", que es justo lo contrario.
    porcentajeRebote: visitas > 0 ? (rebotes / visitas) * 100 : null,
  };
}

/** Junta los orígenes de todos los días del periodo, de mayor a menor. */
function agruparOrigenes(filas: FilaOrigen[]): OrigenVisitas[] {
  const porOrigen = new Map<string, number>();
  for (const fila of filas) {
    porOrigen.set(fila.origen, (porOrigen.get(fila.origen) ?? 0) + (Number(fila.total) || 0));
  }
  return [...porOrigen.entries()]
    .map(([origen, total]) => ({ origen, total }))
    .sort((a, b) => b.total - a.total);
}
