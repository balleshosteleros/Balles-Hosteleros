/**
 * Cron: marca como `expirado` cualquier documento de firma pendiente
 * cuyo plazo (`expira_en`) haya vencido, y limpia tokens/OTPs antiguos.
 *
 * Schedule: 03:00 UTC diario (vercel.json).
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { registrarEvento } from "@/features/rrhh/services/firmas/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RETENCION_TOKENS_DIAS = 30;
const RETENCION_OTPS_DIAS = 7;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const ahora = new Date().toISOString();

  const { data: vencidos, error: selErr } = await admin
    .from("firmas_documentos")
    .select("id")
    .eq("estado", "pendiente")
    .lt("expira_en", ahora);
  if (selErr) {
    console.error("[cron/firmas-expirar] select:", selErr);
    return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
  }

  let expirados = 0;
  for (const doc of vencidos ?? []) {
    const docId = doc.id as string;
    const { error: updErr } = await admin
      .from("firmas_documentos")
      .update({ estado: "expirado" })
      .eq("id", docId)
      .eq("estado", "pendiente");
    if (updErr) {
      console.error("[cron/firmas-expirar] update:", docId, updErr.message);
      continue;
    }
    try {
      await registrarEvento({
        documentoId: docId,
        tipo: "expirado",
        metadata: { motivo: "plazo_vencido" },
      });
      await admin.from("firmas_tokens").delete().eq("documento_id", docId);
      expirados++;
    } catch (e) {
      console.error("[cron/firmas-expirar] evento:", docId, e);
    }
  }

  const cutoffTokens = new Date(Date.now() - RETENCION_TOKENS_DIAS * 86_400_000).toISOString();
  const cutoffOtps = new Date(Date.now() - RETENCION_OTPS_DIAS * 86_400_000).toISOString();

  const { count: tokensBorrados } = await admin
    .from("firmas_tokens")
    .delete({ count: "exact" })
    .or(`consumido_en.lt.${cutoffTokens},expira_en.lt.${cutoffTokens}`);

  const { count: otpsBorrados } = await admin
    .from("firmas_otps")
    .delete({ count: "exact" })
    .lt("created_at", cutoffOtps);

  return NextResponse.json({
    ok: true,
    ejecutadoEn: ahora,
    expirados,
    tokensBorrados: tokensBorrados ?? 0,
    otpsBorrados: otpsBorrados ?? 0,
  });
}
