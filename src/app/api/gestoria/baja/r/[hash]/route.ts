/**
 * Subida de documentos de la baja desde el enlace de RECORDATORIO (por hash).
 * Mismo comportamiento que la ruta por token; solo cambia cómo se resuelve.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenDocsBajaPorHash,
  procesarSubidaDocBaja,
  DOCS_BAJA,
  type ClaveDocBaja,
} from "@/features/rrhh/services/gestoria/gestoria-baja-documentos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenDocsBajaPorHash(admin, hash);
    if (!res.ok) {
      const message =
        res.reason === "expired" ? "El enlace ha caducado." : "Enlace no válido.";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    const fd = await req.formData();
    const clave = fd.get("clave") as string | null;
    if (!clave || !DOCS_BAJA.some((d) => d.clave === clave)) {
      return NextResponse.json({ ok: false, error: "Documento no reconocido" }, { status: 400 });
    }
    const file = fd.get("documento") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Adjunta el documento (PDF)" }, { status: 400 });

    const result = await procesarSubidaDocBaja(admin, res.row, clave as ClaveDocBaja, file);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[gestoria/baja/r] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
