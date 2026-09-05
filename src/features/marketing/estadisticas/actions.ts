"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { construirSerie, type FilaAgregada } from "./serie";
import { restarDias } from "./rangos";
import type { SerieEstadisticas } from "./types";

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
