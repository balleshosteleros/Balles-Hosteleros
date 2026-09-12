/**
 * POST /api/citas/reservar — alguien coge hueco desde un embudo.
 *
 * Público y anónimo. La comprobación de que la hora sigue libre se hace en el
 * servidor (`reservarCita`), no aquí: lo que llega del navegador no vale como
 * verdad.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reservarCita } from "@/features/producto/citas/services/reservar";
import { sincronizarCitaConGoogle } from "@/features/producto/citas/services/google-calendar";
import { notificarCitaConfirmada } from "@/features/producto/citas/services/notificar-cita";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import { extraerIp } from "@/features/marketing/pagina-web/services/ip-hash";

export const runtime = "nodejs";

const bodySchema = z.object({
  calendarioId: z.string().guid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  telefono: z.string().trim().min(5).max(40),
  notas: z.string().trim().max(1000).nullable().optional(),
  paginaId: z.string().guid().nullable().optional(),
  origen: z.string().trim().max(80).nullable().optional(),
  privacidad: z.literal(true, { message: "Hay que aceptar la política de privacidad." }),
});

export async function POST(req: NextRequest) {
  const ip = extraerIp(req.headers) ?? "desconocida";
  if (!rateLimit(`reservar:${ip}`, 5, 60_000).ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    }

    const res = await reservarCita(parsed.data);
    if (!res.ok) return NextResponse.json(res, { status: 409 });

    // Primero el espejo en Google —de ahí sale el enlace de la videollamada— y
    // después la confirmación, que lo lleva dentro. Ninguna de las dos puede
    // tumbar la reserva: la cita ya está guardada y nadie se queda sin su hueco
    // por un problema de terceros.
    //
    // Se ESPERAN las dos. Dejarlas "en segundo plano" no funciona aquí: la
    // función se apaga al responder y el trabajo pendiente se corta a medias
    // —justo lo que dejaba a gente sin correo y sin rastro del fallo.
    try {
      await sincronizarCitaConGoogle(res.citaId);
    } catch (err) {
      console.error("[api/citas/reservar] google:", err);
    }
    try {
      await notificarCitaConfirmada(res.citaId);
    } catch (err) {
      console.error("[api/citas/reservar] confirmación:", err);
    }

    return NextResponse.json({ ok: true, citaId: res.citaId, inicio: res.inicioISO });
  } catch (err) {
    console.error("[api/citas/reservar]", err);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
