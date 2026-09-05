"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { construirSerie, type FilaAgregada } from "./serie";
import type { SerieEstadisticas } from "./types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const rangoSchema = z.object({
  id: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio no válida."),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de fin no válida."),
});

/**
 * Las dos gráficas leen tablas distintas con las mismas columnas, así que la
 * consulta es una sola parametrizada por tabla y por columna de enlace.
 *
 * Se filtra SIEMPRE por `empresa_id` además de por el id del QR o de la página:
 * la RLS impide ver lo de otra empresa, pero no acota a la empresa ACTIVA, que
 * es lo que el usuario está mirando en pantalla.
 */
async function leerSerie(
  tabla: "qr_escaneos" | "paginas_web_visitas",
  columnaEnlace: "qr_id" | "pagina_id",
  input: z.input<typeof rangoSchema>,
): Promise<ActionResult<SerieEstadisticas>> {
  try {
    const parsed = rangoSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const { id, desde, hasta } = parsed.data;
    if (desde > hasta) {
      return { ok: false, error: "La fecha de inicio es posterior a la de fin." };
    }

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

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
  input: z.input<typeof rangoSchema>,
): Promise<ActionResult<SerieEstadisticas>> {
  return leerSerie("qr_escaneos", "qr_id", input);
}

export async function visitasDePaginaWeb(
  input: z.input<typeof rangoSchema>,
): Promise<ActionResult<SerieEstadisticas>> {
  return leerSerie("paginas_web_visitas", "pagina_id", input);
}
