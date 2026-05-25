import { NextResponse } from "next/server";
import {
  responderChatPublico,
  type ChatMensaje,
} from "@/features/calidad/inspecciones/chat-publico";

interface Body {
  mensajes: ChatMensaje[];
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

  if (!Array.isArray(body.mensajes)) {
    return NextResponse.json(
      { ok: false, error: "mensajes inválido" },
      { status: 400 },
    );
  }

  const res = await responderChatPublico({ token, mensajes: body.mensajes });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, respuesta: res.respuesta });
}
