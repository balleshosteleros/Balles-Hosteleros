/**
 * Subida del COMPROBANTE de una baja médica por la GESTORÍA (endpoint PÚBLICO,
 * sin sesión: el token del enlace es la credencial).
 *
 * POST → recibe el PDF, lo archiva en la carpeta «Bajas médicas» del trabajador
 *        y deja constancia en el historial de la solicitud.
 *
 * El enlace NO se consume: si la gestoría sube un comprobante equivocado, puede
 * volver y reemplazarlo mientras no caduque.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenComprobante,
  procesarSubidaComprobante,
} from "@/features/rrhh/services/gestoria/baja-medica-documentos";

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

    const res = await resolverTokenComprobante(admin, token);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: MENSAJE_INVALIDO[res.reason] },
        { status: 404 },
      );
    }

    const fd = await req.formData();
    const file = fd.get("documento") as File | null;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Adjunta el comprobante (PDF)" },
        { status: 400 },
      );
    }

    const result = await procesarSubidaComprobante(admin, res.row, file);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[gestoria/baja-medica] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
