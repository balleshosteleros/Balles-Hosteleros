/**
 * Subida de modelos fiscales por la GESTORÍA (endpoint PÚBLICO, sin sesión).
 *
 * GET  → datos del periodo + lista de modelos con su estado.
 * POST accion=validar   → adjunta UN modelo a STAGING (valida con IA al momento).
 * POST accion=confirmar → subida TODO-O-NADA: si están todos los obligatorios,
 *        mueve staging → modelos_aeat; si falta alguno, no confirma nada.
 *
 * El token identifica empresa + ejercicio + periodo; la gestoría nunca ve datos
 * de otras empresas ni otros periodos.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenModelosGestoria,
  listarModelosDelToken,
  stagingSubidaModelo,
  confirmarSubidaModelos,
} from "@/features/gestoria/modelos/services/gestoria-modelos-tokens";
import type { ModeloTipo } from "@/features/gestoria/modelos/types/modelos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mensajeReason(reason: "not_found" | "expired" | "completed"): string {
  return reason === "expired"
    ? "El enlace ha caducado. Pide a la empresa que te lo reenvíe."
    : reason === "completed"
      ? "Los modelos de este periodo ya se subieron."
      : "Enlace no válido.";
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const res = await resolverTokenModelosGestoria(admin, token);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, reason: res.reason, message: mensajeReason(res.reason) },
      { status: 404 },
    );
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", res.row.empresa_id)
    .maybeSingle();
  const modelos = await listarModelosDelToken(admin, res.row);

  return NextResponse.json({
    ok: true,
    empresaNombre: (empresa?.nombre as string) ?? "la empresa",
    ejercicio: res.row.ejercicio,
    periodo: res.row.periodo,
    grupo: res.row.grupo,
    modelos,
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenModelosGestoria(admin, token);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: mensajeReason(res.reason) }, { status: 404 });
    }

    const fd = await req.formData();
    const accion = (fd.get("accion") as string | null) ?? "validar";

    // ── Confirmar (todo-o-nada) ──
    if (accion === "confirmar") {
      const result = await confirmarSubidaModelos(admin, res.row);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, faltan: result.faltan },
          { status: result.status },
        );
      }
      return NextResponse.json({ ok: true, confirmados: result.confirmados });
    }

    // ── Validar/adjuntar UN modelo a staging ──
    const tipo = fd.get("tipo") as string | null;
    const file = fd.get("file") as File | null;
    if (!tipo) return NextResponse.json({ ok: false, error: "Falta el tipo de modelo" }, { status: 400 });
    if (!file) return NextResponse.json({ ok: false, error: "Adjunta el modelo (PDF)" }, { status: 400 });

    // Seguridad: el tipo debe pertenecer a los modelos esperados de este token.
    const esperados = await listarModelosDelToken(admin, res.row);
    if (!esperados.some((m) => m.tipo === tipo)) {
      return NextResponse.json(
        { ok: false, error: "Ese modelo no corresponde a este periodo" },
        { status: 400 },
      );
    }

    const result = await stagingSubidaModelo(admin, res.row, tipo as ModeloTipo, file);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, iaMotivo: result.iaMotivo },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, iaMotivo: result.iaMotivo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[gestoria/modelos] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
