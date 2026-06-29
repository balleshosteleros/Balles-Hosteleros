/**
 * Subida del contrato por la gestoría vía enlace de RECORDATORIO (por hash).
 * Mismo flujo que la ruta por-token, pero el identificador es el hash del token
 * (el token en claro no se persiste, así que el correo de recordatorio enlaza
 * por hash). Endpoint PÚBLICO, sin sesión.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenContratoPorHash,
  procesarSubidaContrato,
} from "@/features/rrhh/services/gestoria/gestoria-contrato";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenContratoPorHash(admin, hash);
    if (!res.ok) {
      const message =
        res.reason === "expired"
          ? "El enlace ha caducado."
          : res.reason === "consumed"
            ? "El contrato de este trabajador ya se subió."
            : "Enlace no válido.";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    const fd = await req.formData();
    const file = fd.get("contrato") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Adjunta el contrato (PDF)" }, { status: 400 });

    const result = await procesarSubidaContrato(admin, res.row, file);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[gestoria/contrato/r] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
