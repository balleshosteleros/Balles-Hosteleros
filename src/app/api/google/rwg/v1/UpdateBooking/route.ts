import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withMetricas } from "@/features/canales-google-rwg/lib/instrumentacion";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import type {
  Booking,
  BookingStatus,
  UpdateBookingResponse,
} from "@/features/canales-google-rwg/lib/proto-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TZ_DEFAULT = "Europe/Madrid";

const requestSchema = z.object({
  booking: z.object({
    booking_id: z.string().guid(),
    status: z.enum([
      "CONFIRMED",
      "PENDING_MERCHANT_CONFIRMATION",
      "PENDING_CLIENT_CONFIRMATION",
      "CANCELED",
      "NO_SHOW",
    ]).optional(),
    start_sec: z.number().int().positive().optional(),
    duration_sec: z.number().int().positive().optional(),
    party_size: z.number().int().min(1).max(50).optional(),
  }),
  update_mask: z.string().max(200).optional(),
});

const GOOGLE_TO_BALLES_ESTADO: Record<BookingStatus, string | null> = {
  CONFIRMED: "CONFIRMADA",
  CANCELED: "CANCELADA",
  NO_SHOW: "NO_SHOW",
  PENDING_MERCHANT_CONFIRMATION: "NO_RECONFIRMADA",
  PENDING_CLIENT_CONFIRMATION: "NO_RECONFIRMADA",
};

function startSecToFechaHora(startSec: number, tz: string = TZ_DEFAULT): { fecha: string; hora: string } {
  const d = new Date(startSec * 1000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    fecha: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export const POST = withMetricas("UpdateBooking", async (request) => {
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const body: UpdateBookingResponse = {
      booking_failure: { cause: "BOOKING_FAILURE_REASON_UNSPECIFIED", description: "invalid payload" },
    };
    return { status: 400, body, metrica: { causa: "invalid_payload" } };
  }

  const data = parsed.data;
  const admin = createAdminClient();

  const estadoBalles = data.booking.status ? GOOGLE_TO_BALLES_ESTADO[data.booking.status] : null;

  // Si cambia la hora, la reserva se reescribe en la HORA LOCAL del restaurante:
  // resolvemos la zona desde la empresa de la reserva (PRP-069).
  let tzReserva = TZ_DEFAULT;
  if (data.booking.start_sec) {
    const { data: rsv } = await admin
      .from("reservas")
      .select("empresa_id")
      .eq("id", data.booking.booking_id)
      .maybeSingle();
    tzReserva = await getZonaHorariaEmpresa(admin, (rsv?.empresa_id as string | null) ?? null);
  }
  const fechaHora = data.booking.start_sec ? startSecToFechaHora(data.booking.start_sec, tzReserva) : null;

  const { data: res, error } = await admin.rpc("update_reserva_externa_rwg", {
    p_reserva_id: data.booking.booking_id,
    p_estado: estadoBalles,
    p_fecha: fechaHora?.fecha ?? null,
    p_hora: fechaHora?.hora ?? null,
    p_personas: data.booking.party_size ?? null,
  });

  if (error || !res) {
    const body: UpdateBookingResponse = {
      booking_failure: { cause: "BOOKING_FAILURE_REASON_UNSPECIFIED", description: "reserva no encontrada" },
    };
    return { status: 200, body, metrica: { causa: error?.message?.slice(0, 80) ?? "not_found" } };
  }

  const reservaRow = res as Record<string, unknown>;
  const startSec = data.booking.start_sec
    ?? Math.floor(new Date(`${reservaRow.fecha}T${reservaRow.hora}Z`).getTime() / 1000);
  const booking: Booking = {
    booking_id: reservaRow.id as string,
    merchant_id: data.booking.booking_id, // Google ya lo conoce; lo pasamos vacío si se requiere
    service_id: "",
    start_sec: startSec,
    duration_sec: data.booking.duration_sec,
    status: (data.booking.status ?? "CONFIRMED"),
    party_size: (reservaRow.personas as number) ?? data.booking.party_size,
    user_information: {},
  };

  const body: UpdateBookingResponse = { booking };
  return {
    status: 200, body,
    metrica: { empresaId: reservaRow.empresa_id as string, causa: "ok" },
  };
});
