/**
 * POST /api/citas/anular — quien reservó anula su cita desde el correo.
 *
 * Público y sin sesión: la llave es el token del enlace, que solo tiene quien
 * recibió la confirmación. No se acepta un id de cita: con él, cualquiera que
 * adivinara un identificador podría tirar abajo la agenda.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelarCita } from "@/features/producto/citas/services/cancelar-cita";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import { extraerIp } from "@/features/marketing/pagina-web/services/ip-hash";

export const runtime = "nodejs";

const bodySchema = z.object({ token: z.string().trim().min(20).max(200) });

export async function POST(req: NextRequest) {
  const ip = extraerIp(req.headers) ?? "desconocida";
  if (!rateLimit(`anular-cita:${ip}`, 10, 60_000).ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Enlace no válido." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from("citas")
      .select("id, estado")
      .eq("token_gestion", parsed.data.token)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
    }

    const cita = data as { id: string; estado: string };
    if (cita.estado === "CANCELADA") {
      // Ya estaba anulada: no es un error, es que se pulsó dos veces.
      return NextResponse.json({ ok: true, yaEstaba: true });
    }

    const res = await cancelarCita(cita.id, "CLIENTE_ENLACE");
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error ?? "No se pudo anular." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, yaEstaba: res.yaEstaba === true });
  } catch (err) {
    console.error("[api/citas/anular]", err);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
