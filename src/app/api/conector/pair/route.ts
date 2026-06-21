/**
 * POST /api/conector/pair — el appliance canjea su código de emparejamiento.
 *
 * Lo llama la cajita (Conector Balles) en su primer arranque, por conexión de
 * SALIDA. Valida el `pairing_code` (un solo uso, con caducidad), genera un
 * `device_token` que se entrega UNA sola vez, guarda solo su hash, y marca el
 * conector como `emparejado`.
 *
 * Autenticación: por el propio código de emparejamiento (no por sesión de
 * usuario). Usa service role → no pasa por RLS. No expone datos de la empresa
 * más allá de su id.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generarDeviceToken, hashDeviceToken } from "@/features/camaras/lib/pairing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  pairing_code: z.string().trim().min(6).max(20),
  fw_version: z.string().trim().max(40).nullable().optional(),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  // Normalizamos el código (mayúsculas, sin espacios) para tolerar tecleo manual.
  const code = parsed.data.pairing_code.toUpperCase().replace(/\s+/g, "");
  const supabase = service();

  const { data: conector, error: e0 } = await supabase
    .from("conectores")
    .select("id, empresa_id, estado, pairing_expira")
    .eq("pairing_code", code)
    .maybeSingle();

  if (e0) {
    console.error("[conector/pair] lookup:", e0.message);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
  // Mismo mensaje para "no existe" y "ya usado": no filtramos qué códigos existen.
  if (!conector || conector.estado !== "pendiente") {
    return NextResponse.json({ ok: false, error: "Código no válido o ya usado" }, { status: 404 });
  }
  if (conector.pairing_expira && new Date(conector.pairing_expira).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Código caducado" }, { status: 410 });
  }

  const deviceToken = generarDeviceToken();
  const { error: e1 } = await supabase
    .from("conectores")
    .update({
      estado: "emparejado",
      device_token_hash: hashDeviceToken(deviceToken),
      pairing_code: null, // un solo uso: inutiliza el código
      pairing_expira: null,
      fw_version: parsed.data.fw_version ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", conector.id)
    .eq("estado", "pendiente"); // guard anti-doble-canje concurrente

  if (e1) {
    console.error("[conector/pair] update:", e1.message);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    conector_id: conector.id,
    empresa_id: conector.empresa_id,
    device_token: deviceToken, // se entrega UNA sola vez; el servidor solo guarda el hash
  });
}
