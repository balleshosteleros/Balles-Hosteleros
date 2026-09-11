/**
 * Subida del comprobante desde el enlace de RECORDATORIO (por hash). Mismo
 * comportamiento que la ruta por token; solo cambia cómo se resuelve.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenComprobantePorHash,
  procesarSubidaComprobante,
} from "@/features/rrhh/services/gestoria/baja-medica-documentos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenComprobantePorHash(admin, hash);
    if (!res.ok) {
      const message =
        res.reason === "expired" ? "El enlace ha caducado." : "Enlace no válido.";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
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
    console.error("[gestoria/baja-medica/r] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
