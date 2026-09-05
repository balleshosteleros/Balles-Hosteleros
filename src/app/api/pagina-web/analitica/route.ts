/**
 * POST /api/pagina-web/analitica
 *
 * Recoge lo que hace el visitante en una página pública: los clics de los
 * botones y el tiempo que ha estado. Es una ruta PÚBLICA, sin sesión: quien
 * navega la web es un cliente anónimo.
 *
 * Es una ruta y no una server action a propósito: el aviso de tiempo se manda
 * con `navigator.sendBeacon` al cerrar la pestaña, y sendBeacon solo sabe hacer
 * un POST normal. Una server action nunca llegaría a salir.
 *
 * NO se guarda cookie, IP ni identificador de navegador: solo se suma 1 al
 * contador del día de esa página.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registrarClic, registrarTiempo } from "@/features/marketing/pagina-web/services/analitica";
import { esRobot } from "@/features/marketing/pagina-web/services/visitas";

export const runtime = "nodejs";

const clicSchema = z.object({
  tipo: z.literal("clic"),
  paginaId: z.string().guid(),
  destino: z.string().min(1).max(300),
  etiqueta: z.string().max(120).default(""),
});

const tiempoSchema = z.object({
  tipo: z.literal("tiempo"),
  paginaId: z.string().guid(),
  /** Segundos que la página ha estado VISIBLE, no los que la pestaña existió. */
  segundos: z.number().int().min(0).max(7200),
  /** ¿Pulsó algo o bajó por la página? Si no, cuenta como rebote. */
  interactuo: z.boolean().default(false),
});

const bodySchema = z.discriminatedUnion("tipo", [clicSchema, tiempoSchema]);

export async function POST(req: NextRequest) {
  try {
    const userAgent = req.headers.get("user-agent");
    // Un buscador que rastrea la web no pulsa botones ni "está" un rato: si se
    // contara, la media de tiempo la marcarían los robots y no los clientes.
    if (esRobot(userAgent)) return NextResponse.json({ ok: true });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const evento = parsed.data;
    if (evento.tipo === "clic") {
      await registrarClic(evento.paginaId, evento.destino, evento.etiqueta, userAgent);
    } else {
      // Una visita de menos de 2 segundos no es una visita: es un rebote
      // instantáneo o una precarga del navegador. Sumarla hunde la media.
      if (evento.segundos >= 2) {
        await registrarTiempo(evento.paginaId, evento.segundos, evento.interactuo, userAgent);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Nunca se devuelve error al visitante: la medida es secundaria, la web es
    // el servicio.
    console.error("[api][pagina-web][analitica] fatal:", err);
    return NextResponse.json({ ok: true });
  }
}
