import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withMetricas } from "@/features/canales-google-rwg/lib/instrumentacion";
import { resolveEmpresaByPlaceId } from "@/features/canales-google-rwg/lib/booking-server-resolver";
import { lookupAvailability } from "@/features/canales-google-rwg/lib/availability-resolver";
import type { BatchAvailabilityLookupResponse } from "@/features/canales-google-rwg/lib/proto-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  merchant_id: z.string().min(1).max(200),
  slot_time: z
    .array(
      z.object({
        service_id: z.string().min(1).max(120),
        start_sec: z.number().int().positive(),
        duration_sec: z.number().int().positive().optional(),
        resources: z
          .object({
            party_size: z.number().int().min(1).max(50).optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const POST = withMetricas("BatchAvailabilityLookup", async (request) => {
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const empty: BatchAvailabilityLookupResponse = { slot_time_availability: [] };
    return { status: 400, body: empty, metrica: { causa: "invalid_payload" } };
  }

  const admin = createAdminClient();
  const merchant = await resolveEmpresaByPlaceId(admin, parsed.data.merchant_id);
  if (!merchant) {
    // Platform Policy: nunca 404. Devolver lista vacía.
    const empty: BatchAvailabilityLookupResponse = { slot_time_availability: [] };
    return { status: 200, body: empty, metrica: { causa: "merchant_unknown" } };
  }

  const slots = await lookupAvailability(admin, merchant.empresaId, parsed.data.slot_time);
  const body: BatchAvailabilityLookupResponse = { slot_time_availability: slots };
  return {
    status: 200,
    body,
    metrica: { empresaId: merchant.empresaId, causa: "ok" },
  };
});
