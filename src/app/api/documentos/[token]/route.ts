/**
 * Subida de la documentación de un EMPLEADO por su enlace propio (endpoint
 * PÚBLICO, sin sesión).
 *
 * POST → recibe la foto o el PDF y lo deja directamente en la ficha del
 *        empleado, en la misma ruta que usa la subida manual desde RRHH.
 *
 * El enlace NO se consume al subir: si el documento sale movido o ilegible, el
 * empleado puede repetirlo con el mismo enlace.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenDocEmpleado,
  procesarSubidaDocEmpleado,
} from "@/features/rrhh/services/documentos/empleado-doc-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MENSAJE_INVALIDO = {
  expired: "El enlace ha caducado. Pide a la empresa que te lo reenvíe.",
  not_found: "Enlace no válido.",
} as const;

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenDocEmpleado(admin, token);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: MENSAJE_INVALIDO[res.reason] }, { status: 404 });
    }

    const fd = await req.formData();
    const file = fd.get("documento") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Adjunta el documento" }, { status: 400 });
    }

    const result = await procesarSubidaDocEmpleado(admin, res.row, file);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentos/empleado] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
