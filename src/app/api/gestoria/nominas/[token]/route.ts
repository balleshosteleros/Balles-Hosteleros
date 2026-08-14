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
  guardarTc1Gestoria,
  cuadrarTc1ConNominas,
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
        ? "Este enlace ha caducado. Cada enlace sirve solo para las nóminas de su mes y vence el día 15 del mes siguiente. Ponte en contacto con el departamento de RRHH de la empresa para que te envíe uno nuevo."
        : res.reason === "cerrado"
          ? "Las nóminas de este mes ya se recibieron correctamente. Este enlace queda cerrado: no admite más subidas."
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
      const message =
        res.reason === "expired"
          ? "Este enlace ha caducado y ya no admite subidas. Pide uno nuevo al departamento de RRHH de la empresa."
          : res.reason === "cerrado"
            ? "Las nóminas de este mes ya se recibieron: este enlace ya no admite subidas."
            : "Enlace no válido.";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    const fd = await req.formData();
    const documento = (fd.get("documento") as string | null) ?? "nominas";

    // TC1 (recibo de cotizaciones): documento de EMPRESA, no de un empleado. Va a
    // su propio sitio y NO pasa por la lectura con IA de nóminas.
    if (documento === "tc1") {
      const tc1 = fd.get("archivo") as File | null;
      if (!tc1) return NextResponse.json({ ok: false, error: "Adjunta el TC1" }, { status: 400 });
      const guardado = await guardarTc1Gestoria(admin, res.row, tc1);
      if (!guardado.ok) {
        return NextResponse.json({ ok: false, error: guardado.error }, { status: guardado.status });
      }
      const cuadre = await cuadrarTc1ConNominas(admin, res.row.empresa_id, res.row.periodo);
      return NextResponse.json({ ok: true, documento: "tc1", cuadre });
    }

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
      // Aviso de precaución: SÍ se han volcado, pero el trabajador ya constaba de
      // baja el día de subirlas. La gestoría solo confirma que es correcto.
      inactivos: r.inactivos,
      // Rechazadas por pertenecer a un mes distinto al solicitado.
      mesIncorrecto: r.mesIncorrecto,
      // El archivo tiene errores → NO se ha subido NADA; hay que corregir y resubir.
      rechazadoTodo: r.rechazadoTodo,
      // Cuadre TC1 ↔ nóminas: null mientras no esté el TC1.
      cuadre: await cuadrarTc1ConNominas(admin, res.row.empresa_id, res.row.periodo),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[gestoria/nominas] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
