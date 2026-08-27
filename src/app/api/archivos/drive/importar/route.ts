import { NextResponse } from "next/server";
import { importarUnidad } from "@/features/archivos/actions/importar-drive-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRP-081 — Copiar una tanda de archivos de Drive a R2.
 *
 * Va en una ruta de API y NO en una server action por el tiempo máximo: una
 * server action muere al llegar a su límite SIN guardar el progreso, así que
 * la importación se quedaba en 0 archivos por muchas vueltas que diera.
 *
 * Cada llamada copia lo que le da tiempo y devuelve `terminada: false` si
 * queda trabajo; la pantalla vuelve a llamar y sigue donde lo dejó.
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      unidadId?: string;
      unidadNombre?: string;
      mapeo?: Record<string, string>;
      importacionId?: string;
    };

    if (!body.unidadId || !body.mapeo) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos de la importación" },
        { status: 400 },
      );
    }

    const res = await importarUnidad(
      body.unidadId,
      body.unidadNombre ?? "",
      body.mapeo,
      body.importacionId,
    );

    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al importar";
    console.error("[archivos drive importar]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
