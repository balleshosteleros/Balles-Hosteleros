import { NextResponse } from "next/server";
import { regenerarQrTokenPublico } from "@/features/calidad/inspecciones/public-data";

interface Body {
  envio_id: string;
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

  if (!body.envio_id) {
    return NextResponse.json({ ok: false, error: "Falta envio_id" }, { status: 400 });
  }

  const res = await regenerarQrTokenPublico({
    publicToken: token,
    envioId: body.envio_id,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, qr: res.qr });
}
