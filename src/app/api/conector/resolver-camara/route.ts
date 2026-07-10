/**
 * POST /api/conector/resolver-camara — traduce (conector, canal) → camara_id.
 *
 * El grabador Dahua sube por FTP organizando por CANAL (1..16), no por el uuid
 * de nuestra cámara. El relay FTP pregunta aquí: "para mi device_token y el
 * canal N, ¿qué cámara es?". Devolvemos el uuid de la cámara de esa empresa cuyo
 * campo `canal` coincide.
 *
 * Autenticación: `Authorization: Bearer <device_token>` del conector emparejado.
 * Service role → no pasa por RLS; filtramos por la empresa dueña del conector.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashDeviceToken } from "@/features/camaras/lib/pairing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({ canal: z.number().int().min(1).max(64) });

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta device_token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "canal inválido" }, { status: 400 });
  }

  const supabase = service();
  const { data: conector } = await supabase
    .from("conectores")
    .select("id, empresa_id, activo")
    .eq("device_token_hash", hashDeviceToken(token))
    .maybeSingle();

  if (!conector || !conector.activo) {
    return NextResponse.json({ ok: false, error: "Dispositivo no autorizado" }, { status: 401 });
  }

  // Cámara de esta empresa vinculada al conector con ese canal. Si no está
  // vinculada al conector todavía, aceptamos también por empresa + canal.
  const { data: camara } = await supabase
    .from("camaras")
    .select("id")
    .eq("empresa_id", conector.empresa_id)
    .eq("canal", parsed.data.canal)
    .order("conector_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!camara) {
    return NextResponse.json({ ok: false, error: "Canal sin cámara asignada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, camara_id: camara.id });
}
