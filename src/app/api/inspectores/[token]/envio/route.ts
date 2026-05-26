import { NextResponse } from "next/server";
import { submitInspeccion } from "@/features/calidad/inspecciones/public-data";

interface RespuestaBody {
  pregunta_id: string;
  valor: string | number | null;
}

interface Body {
  local_id: string | null;
  inspector_id: string | null;
  nombre_inspector: string;
  telefono_inspector: string | null;
  fecha_inspeccion: string | null;
  nombre_jefe_sala: string | null;
  respuestas: RespuestaBody[];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token faltante" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.inspector_id) {
    return NextResponse.json(
      { ok: false, error: "Debes elegirte en el desplegable de inspectores" },
      { status: 400 },
    );
  }
  if (!body.nombre_inspector?.trim()) {
    return NextResponse.json({ ok: false, error: "Falta el nombre del inspector" }, { status: 400 });
  }
  if (!Array.isArray(body.respuestas)) {
    return NextResponse.json({ ok: false, error: "Respuestas inválidas" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent");

  const res = await submitInspeccion({
    token,
    local_id: body.local_id,
    inspector_id: body.inspector_id,
    nombre_inspector: body.nombre_inspector.trim(),
    telefono_inspector: body.telefono_inspector?.trim() || null,
    fecha_inspeccion: body.fecha_inspeccion,
    nombre_jefe_sala: body.nombre_jefe_sala?.trim() || null,
    respuestas: body.respuestas,
    ip,
    user_agent: userAgent,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    envioId: res.envioId,
    numero: res.numero,
    qr: res.qr,
  });
}
