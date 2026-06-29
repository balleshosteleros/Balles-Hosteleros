/**
 * Subida del contrato firmado por la GESTORÍA (endpoint PÚBLICO, sin sesión).
 *
 * GET  → datos mínimos para la pantalla pública: nombre + DNI/NIE del trabajador.
 * POST → recibe el PDF, lo guarda, crea la solicitud de firma para el trabajador
 *        y marca el token consumido (lógica en `procesarSubidaContrato`).
 *
 * Seguridad: el token único identifica al empleado; la gestoría nunca ve ni
 * toca datos de otros trabajadores.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenContratoGestoria,
  procesarSubidaContrato,
} from "@/features/rrhh/services/gestoria/gestoria-contrato";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function nombreEmpleado(emp: { nombre: string | null; apellidos: string | null }): string {
  return `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() || "Trabajador";
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const res = await resolverTokenContratoGestoria(admin, token);
  if (!res.ok) {
    const message =
      res.reason === "expired"
        ? "El enlace ha caducado. Pide a la empresa que te lo reenvíe."
        : res.reason === "consumed"
          ? "El contrato de este trabajador ya se subió."
          : "Enlace no válido.";
    return NextResponse.json({ ok: false, reason: res.reason, message }, { status: 404 });
  }

  const { data: emp } = await admin
    .from("empleados")
    .select("nombre, apellidos, dni_nie")
    .eq("id", res.row.empleado_id)
    .maybeSingle();
  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", res.row.empresa_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    trabajador: {
      nombre: nombreEmpleado(emp ?? { nombre: null, apellidos: null }),
      dniNie: (emp?.dni_nie as string | null) ?? null,
    },
    empresaNombre: (empresa?.nombre as string) ?? "la empresa",
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenContratoGestoria(admin, token);
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
    console.error("[gestoria/contrato] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
