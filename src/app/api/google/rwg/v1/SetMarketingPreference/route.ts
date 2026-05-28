import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withMetricas } from "@/features/canales-google-rwg/lib/instrumentacion";
import { resolveEmpresaByPlaceId } from "@/features/canales-google-rwg/lib/booking-server-resolver";
import { RWG_EXTERNAL_ORIGEN } from "@/features/canales-google-rwg/lib/proto-types";
import type { SetMarketingPreferenceResponse } from "@/features/canales-google-rwg/lib/proto-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  merchant_id: z.string().min(1).max(200),
  user_information: z.object({
    user_id: z.string().max(200).optional(),
    given_name: z.string().max(120).optional(),
    family_name: z.string().max(120).optional(),
    telephone: z.string().max(40).optional(),
    email: z.string().email().max(160).optional(),
  }),
  is_opted_in: z.boolean(),
});

export const POST = withMetricas("SetMarketingPreference", async (request) => {
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const body: SetMarketingPreferenceResponse = {};
    return { status: 400, body, metrica: { causa: "invalid_payload" } };
  }

  const data = parsed.data;
  const admin = createAdminClient();

  const merchant = await resolveEmpresaByPlaceId(admin, data.merchant_id);
  if (!merchant) {
    const body: SetMarketingPreferenceResponse = {};
    return { status: 200, body, metrica: { causa: "merchant_unknown" } };
  }

  // Localizar cliente por email O teléfono dentro de la empresa.
  const email = data.user_information.email ?? null;
  const tel = data.user_information.telephone ?? null;
  if (!email && !tel) {
    const body: SetMarketingPreferenceResponse = {};
    return { status: 200, body, metrica: { empresaId: merchant.empresaId, causa: "no_identifier" } };
  }

  let query = admin
    .from("clientes_sala")
    .select("id")
    .eq("empresa_id", merchant.empresaId)
    .limit(1);
  if (email) query = query.eq("email", email);
  else if (tel) query = query.eq("telefono", tel);

  const { data: cliente } = await query.maybeSingle();
  if (!cliente) {
    const body: SetMarketingPreferenceResponse = {};
    return { status: 200, body, metrica: { empresaId: merchant.empresaId, causa: "client_not_found" } };
  }

  await admin
    .from("clientes_sala")
    .update({
      acepta_marketing_email: data.is_opted_in,
      marketing_optin_origen: RWG_EXTERNAL_ORIGEN,
      marketing_optin_at: new Date().toISOString(),
    })
    .eq("id", cliente.id);

  const body: SetMarketingPreferenceResponse = {};
  return {
    status: 200, body,
    metrica: { empresaId: merchant.empresaId, causa: "ok" },
  };
});
