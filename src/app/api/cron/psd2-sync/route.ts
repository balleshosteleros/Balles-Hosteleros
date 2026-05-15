import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSyncForAccount } from "@/features/contabilidad/services/psd2/sync";
import type { ProviderId } from "@/features/contabilidad/services/psd2/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface AccountRow {
  id: string;
  empresa_id: string;
  external_id: string;
  provider: string;
  connection_id: string;
  last_sync_at: string | null;
  bank_connections: { status: string; expires_at: string | null } | null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      `id, empresa_id, external_id, provider, connection_id, last_sync_at,
       bank_connections!inner ( status, expires_at )`,
    )
    .eq("activo", true)
    .eq("bank_connections.status", "ACTIVE");

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const cuentas = (data ?? []) as unknown as AccountRow[];
  const ejecutadas: Array<{
    accountId: string;
    ok: boolean;
    movimientos_new: number;
    movimientos_dup: number;
    error?: string;
  }> = [];
  let hayErrores = false;

  for (const c of cuentas) {
    const res = await runSyncForAccount(supabase, {
      empresaId: c.empresa_id,
      accountId: c.id,
      externalId: c.external_id,
      provider: c.provider as ProviderId,
      connectionId: c.connection_id,
      mode: "INCREMENTAL",
      lastSyncAt: c.last_sync_at,
    });
    ejecutadas.push({ accountId: c.id, ...res });
    if (!res.ok) hayErrores = true;
  }

  const ahora = new Date();
  const en7d = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("bank_connections")
    .update({ status: "REQUIRES_RECONSENT" })
    .eq("status", "ACTIVE")
    .lt("expires_at", en7d)
    .gte("expires_at", ahora.toISOString());

  await supabase
    .from("bank_connections")
    .update({ status: "EXPIRED" })
    .in("status", ["ACTIVE", "REQUIRES_RECONSENT"])
    .lt("expires_at", ahora.toISOString());

  return NextResponse.json(
    {
      ok: !hayErrores,
      total: cuentas.length,
      ejecutadas,
      ejecutadoEn: new Date().toISOString(),
    },
    { status: hayErrores ? 207 : 200 },
  );
}
