/**
 * Subida de los DOCUMENTOS OFICIALES de la baja por la GESTORÍA (endpoint
 * PÚBLICO, sin sesión).
 *
 * GET  → datos mínimos para la pantalla: trabajador, DNI/NIE y qué documentos
 *        faltan por subir.
 * POST → recibe un PDF (`clave` = justificante | certificado), lo archiva en la
 *        carpeta del trabajador y se lo envía por email.
 *
 * A diferencia del contrato del alta, el enlace NO se consume con la primera
 * subida: se piden DOS documentos y la gestoría puede volver a por el segundo.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenDocsBaja,
  procesarSubidaDocBaja,
  DOCS_BAJA,
  type ClaveDocBaja,
} from "@/features/rrhh/services/gestoria/gestoria-baja-documentos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MENSAJE_INVALIDO = {
  expired: "El enlace ha caducado. Pide a la empresa que te lo reenvíe.",
  not_found: "Enlace no válido.",
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const res = await resolverTokenDocsBaja(admin, token);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, reason: res.reason, message: MENSAJE_INVALIDO[res.reason] },
      { status: 404 },
    );
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
      nombre: `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "Trabajador",
      dniNie: (emp?.dni_nie as string | null) ?? null,
    },
    empresaNombre: (empresa?.nombre as string) ?? "la empresa",
    documentos: DOCS_BAJA.map((d) => ({
      ...d,
      subido:
        d.clave === "justificante"
          ? res.row.justificante_subido_en != null
          : res.row.certificado_subido_en != null,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();

    const res = await resolverTokenDocsBaja(admin, token);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: MENSAJE_INVALIDO[res.reason] }, { status: 404 });
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
    console.error("[gestoria/baja] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
