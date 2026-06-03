import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withMetricas } from "@/features/canales-google-rwg/lib/instrumentacion";
import { resolveEmpresaByPlaceId } from "@/features/canales-google-rwg/lib/booking-server-resolver";
import { findOrLinkClienteSala, registrarVisitaCliente } from "@/features/sala/lib/cliente-link";
import type {
  Booking,
  CreateBookingResponse,
} from "@/features/canales-google-rwg/lib/proto-types";
import { RWG_EXTERNAL_ORIGEN, RWG_ORIGEN_CANONICO } from "@/features/canales-google-rwg/lib/proto-types";
import { validarMotorWebReserva } from "@/features/sala/lib/motor-web-validar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TZ_DEFAULT = "Europe/Madrid";

const requestSchema = z.object({
  idempotency_token: z.string().min(1).max(120),
  slot: z.object({
    merchant_id: z.string().min(1).max(200),
    service_id: z.string().min(1).max(120),
    start_sec: z.number().int().positive(),
    duration_sec: z.number().int().positive().optional(),
    resources: z.object({ party_size: z.number().int().min(1).max(50).optional() }).optional(),
    availability_tag: z.string().max(200).optional(),
    confirmation_mode: z.string().optional(),
  }),
  user_information: z.object({
    user_id: z.string().max(200).optional(),
    given_name: z.string().max(120).optional(),
    family_name: z.string().max(120).optional(),
    telephone: z.string().max(40).optional(),
    email: z.string().email().max(160).optional(),
    language_code: z.string().max(10).optional(),
  }),
  notes: z.string().max(500).optional(),
  marketing_opt_in: z.boolean().optional(),
  party_size: z.number().int().min(1).max(50).optional(),
});

function startSecToFechaHora(startSec: number): { fecha: string; hora: string } {
  const d = new Date(startSec * 1000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_DEFAULT,
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

function deducirTurno(hora: string): "COMIDA" | "CENA" {
  const hh = parseInt(hora.slice(0, 2), 10);
  return hh < 17 ? "COMIDA" : "CENA";
}

function bookingDesdeReserva(
  reservaId: string,
  merchantId: string,
  serviceId: string,
  startSec: number,
  durationSec: number | undefined,
  personas: number,
  user: z.infer<typeof requestSchema>["user_information"],
): Booking {
  return {
    booking_id: reservaId,
    merchant_id: merchantId,
    service_id: serviceId,
    start_sec: startSec,
    duration_sec: durationSec,
    status: "CONFIRMED",
    party_size: personas,
    user_information: user,
  };
}

export const POST = withMetricas("CreateBooking", async (request) => {
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const body: CreateBookingResponse = {
      booking_failure: { cause: "BOOKING_FAILURE_REASON_UNSPECIFIED", description: "invalid payload" },
    };
    return { status: 400, body, metrica: { causa: "invalid_payload" } };
  }
  const data = parsed.data;
  const admin = createAdminClient();

  // 1. Resolver merchant
  const merchant = await resolveEmpresaByPlaceId(admin, data.slot.merchant_id);
  if (!merchant) {
    const body: CreateBookingResponse = {
      booking_failure: { cause: "BOOKING_FAILURE_REASON_UNSPECIFIED", description: "unknown merchant" },
    };
    return { status: 200, body, metrica: { causa: "merchant_unknown" } };
  }

  // 2. Idempotencia: si ya existe reserva con este token, devolverla.
  const { data: existente } = await admin
    .from("reservas")
    .select("id, fecha, hora, personas, cliente_nombre, cliente_apellidos, cliente_email, cliente_telefono")
    .eq("empresa_id", merchant.empresaId)
    .eq("external_idempotency_token", data.idempotency_token)
    .maybeSingle();
  if (existente) {
    const personas = (existente.personas as number) ?? data.party_size ?? 2;
    const body: CreateBookingResponse = {
      booking: bookingDesdeReserva(
        existente.id as string,
        data.slot.merchant_id,
        data.slot.service_id,
        data.slot.start_sec,
        data.slot.duration_sec,
        personas,
        data.user_information,
      ),
    };
    return {
      status: 200, body,
      metrica: { empresaId: merchant.empresaId, causa: "idempotent_hit" },
    };
  }

  // 3. Derivar fecha/turno
  const { fecha, hora } = startSecToFechaHora(data.slot.start_sec);
  const turno = deducirTurno(hora);
  const personas = data.party_size ?? data.slot.resources?.party_size ?? 2;

  // 3b. Preferencias del motor (cierre web, tope personas/hora, intervalos).
  const motor = await validarMotorWebReserva(admin, {
    empresaId: merchant.empresaId,
    fecha,
    hora,
    personas,
    turno,
  });
  if (!motor.ok) {
    const body: CreateBookingResponse = {
      booking_failure: { cause: "SLOT_UNAVAILABLE", description: motor.error },
    };
    return {
      status: 200, body,
      metrica: { empresaId: merchant.empresaId, causa: "motor_web_bloquea" },
    };
  }

  // 4. Lock optimista
  const { data: granted, error: lockErr } = await admin.rpc("try_reservar_slot", {
    p_empresa_id: merchant.empresaId,
    p_fecha: fecha,
    p_turno: turno,
    p_personas: personas,
  });
  if (lockErr || granted !== true) {
    const body: CreateBookingResponse = {
      booking_failure: { cause: "SLOT_UNAVAILABLE", description: "slot full" },
    };
    return {
      status: 200, body,
      metrica: { empresaId: merchant.empresaId, causa: "slot_unavailable" },
    };
  }

  // 5. Cliente
  const linkRes = await findOrLinkClienteSala(admin, {
    empresaId: merchant.empresaId,
    nombre: data.user_information.given_name ?? "Cliente",
    apellidos: data.user_information.family_name ?? null,
    email: data.user_information.email ?? null,
    telefono: data.user_information.telephone ?? null,
  });
  if (!linkRes.ok) {
    // Liberar slot (best-effort): el trigger no aplica aquí porque no hay reserva todavía.
    try {
      await admin.rpc("liberar_slot_manual", {
        p_empresa_id: merchant.empresaId, p_fecha: fecha, p_turno: turno, p_personas: personas,
      });
    } catch { /* fail-open */ }
    const body: CreateBookingResponse = {
      booking_failure: { cause: "BOOKING_FAILURE_REASON_UNSPECIFIED", description: "cannot link client" },
    };
    return {
      status: 500, body,
      metrica: { empresaId: merchant.empresaId, causa: "cliente_link_failed" },
    };
  }
  const cliente = linkRes.result.cliente;

  // 6. Snapshot de política de cancelación vigente
  const { data: politicaActiva } = await admin
    .from("politicas_cancelacion")
    .select("*")
    .eq("empresa_id", merchant.empresaId)
    .eq("activa", true)
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 7. INSERT reserva (id generado en código → mismo valor para external_id)
  const reservaId = crypto.randomUUID();
  const { error: insertErr } = await admin.from("reservas").insert({
    id: reservaId,
    empresa_id: merchant.empresaId,
    cliente_nombre: data.user_information.given_name ?? "Cliente",
    cliente_apellidos: data.user_information.family_name ?? null,
    cliente_telefono: data.user_information.telephone ?? null,
    cliente_email: data.user_information.email ?? null,
    cliente_id: cliente.id,
    fecha,
    hora,
    personas,
    turno,
    estado: "CONFIRMADA",
    notas: data.notes ?? null,
    origen: RWG_ORIGEN_CANONICO,
    external_id: reservaId,
    external_origen: RWG_EXTERNAL_ORIGEN,
    external_idempotency_token: data.idempotency_token,
    politica_cancelacion_id: (politicaActiva?.id as string) ?? null,
    politica_cancelacion_snapshot: politicaActiva ?? null,
  });

  if (insertErr) {
    // Race condition de idempotency: otro request paralelo ya insertó con el mismo token.
    if (insertErr.code === "23505") {
      const { data: ganadora } = await admin
        .from("reservas")
        .select("id")
        .eq("empresa_id", merchant.empresaId)
        .eq("external_idempotency_token", data.idempotency_token)
        .maybeSingle();
      if (ganadora) {
        // Liberar nuestro lock duplicado
        try {
          await admin.rpc("liberar_slot_manual", {
            p_empresa_id: merchant.empresaId, p_fecha: fecha, p_turno: turno, p_personas: personas,
          });
        } catch { /* fail-open */ }
        const body: CreateBookingResponse = {
          booking: bookingDesdeReserva(
            ganadora.id as string,
            data.slot.merchant_id, data.slot.service_id,
            data.slot.start_sec, data.slot.duration_sec, personas, data.user_information,
          ),
        };
        return {
          status: 200, body,
          metrica: { empresaId: merchant.empresaId, causa: "idempotent_race_hit" },
        };
      }
    }
    const body: CreateBookingResponse = {
      booking_failure: { cause: "BOOKING_FAILURE_REASON_UNSPECIFIED", description: "insert failed" },
    };
    return {
      status: 500, body,
      metrica: { empresaId: merchant.empresaId, causa: `insert_${insertErr.code ?? "unknown"}` },
    };
  }

  // 8. Visita del cliente
  await registrarVisitaCliente(admin, cliente.id, fecha);

  // 9. OK
  const body: CreateBookingResponse = {
    booking: bookingDesdeReserva(
      reservaId,
      data.slot.merchant_id, data.slot.service_id,
      data.slot.start_sec, data.slot.duration_sec, personas, data.user_information,
    ),
  };
  return {
    status: 200, body,
    metrica: { empresaId: merchant.empresaId, causa: "ok" },
  };
});
