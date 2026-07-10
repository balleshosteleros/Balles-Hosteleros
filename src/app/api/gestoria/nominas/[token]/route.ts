/**
 * Subida de nóminas por la GESTORÍA (endpoint PÚBLICO, sin sesión).
 *
 * GET  → datos mínimos para la pantalla: empresa + mes del enlace.
 * POST → recibe un archivo (PDF con todas las nóminas o una suelta), lo lee con
 *        IA, empareja cada nómina por DNI/nombre y vuelca neto/SS/IRPF + adjunta
 *        el PDF en `rrhh_pagos`. Avisa a RRHH con el resumen. Multi-uso: la
 *        gestoría puede subir varias veces mientras el enlace esté vigente.
 *
 * Seguridad: el token identifica empresa+mes; la gestoría solo puede volcar
 * nóminas de esa empresa (el emparejado es contra sus empleados).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenNominasGestoria,
  procesarSubidaNominasGestoria,
  nombreMes,
} from "@/features/rrhh/services/nominas/nominas-gestoria";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Un PDF con todas las nóminas + lectura IA puede tardar: damos margen amplio.
export const maxDuration = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const res = await resolverTokenNominasGestoria(admin, token);
  if (!res.ok) {
    const message =
      res.reason === "expired"
        ? "El enlace ha caducado. Pide a la empresa que te lo reenvíe."
        : "Enlace no válido.";
    return NextResponse.json({ ok: false, reason: res.reason, message }, { status: 404 });
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", res.row.empresa_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    empresaNombre: (empresa?.nombre as string) ?? "la empresa",
    periodo: res.row.periodo,
    mesLabel: nombreMes(res.row.periodo),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenNominasGestoria(admin, token);
    if (!res.ok) {
      const message = res.reason === "expired" ? "El enlace ha caducado." : "Enlace no válido.";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    const fd = await req.formData();
    const file = fd.get("archivo") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Adjunta las nóminas" }, { status: 400 });

    const result = await procesarSubidaNominasGestoria(admin, res.row, file);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

    const r = result.resultado;
    return NextResponse.json({
      ok: true,
      guardadas: r.guardadas,
      yaExistian: r.yaExistian,
      sinEmpleado: r.sinEmpleado,
      // Rechazadas por pertenecer a un mes distinto al solicitado.
      mesIncorrecto: r.mesIncorrecto,
      // El archivo tiene errores → NO se ha subido NADA; hay que corregir y resubir.
      rechazadoTodo: r.rechazadoTodo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[gestoria/nominas] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
