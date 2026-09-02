/**
 * Confirmación de liquidación por el EMPLEADO (endpoint PÚBLICO, sin sesión).
 *
 * GET  → detalle de SU liquidación del mes (recuadro con sus datos).
 * POST → marca la liquidación como confirmada (rrhh_pagos.confirmacion_aceptada_at).
 *
 * Seguridad: el token identifica empresa+empleado+mes+pago; solo puede confirmar
 * ESE pago. Hash-only (nunca se guarda el token en claro).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenConfirmacionPago,
  detalleLiquidacionPorToken,
  confirmarLiquidacionPorToken,
  type MotivoTokenLiquidacion,
} from "@/features/rrhh/services/nominas/rrhh-pagos-confirmacion";

/**
 * Texto para el empleado según por qué no abre el enlace. Un enlace YA USADO se
 * dice con esas palabras: no es un error suyo ni un enlace roto.
 */
function mensajeMotivo(reason: MotivoTokenLiquidacion): string {
  if (reason === "used") return "Este enlace ya se ha usado: tu liquidación ya está confirmada.";
  if (reason === "expired") return "El enlace ha caducado. Pide a la empresa que te lo reenvíe.";
  return "Enlace no válido.";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const res = await resolverTokenConfirmacionPago(admin, token);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, reason: res.reason, message: mensajeMotivo(res.reason) },
      { status: 404 },
    );
  }

  const det = await detalleLiquidacionPorToken(admin, res.row);
  if (!det.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: det.reason,
        message: det.reason ? mensajeMotivo(det.reason) : det.error,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, detalle: det.detalle });
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenConfirmacionPago(admin, token);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: res.reason, error: mensajeMotivo(res.reason) },
        { status: 404 },
      );
    }

    const result = await confirmarLiquidacionPorToken(admin, {
      id: res.row.id,
      empresa_id: res.row.empresa_id,
      pago_id: res.row.pago_id,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "No se pudo confirmar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[liquidacion] confirmar fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
