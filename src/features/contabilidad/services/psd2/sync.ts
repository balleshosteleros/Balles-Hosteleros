import type { SupabaseClient } from "@supabase/supabase-js";
import { getProvider, type ProviderId } from "./providers";
import { toDbTransaction } from "./mappers";

const OVERLAP_DAYS = 3;
const INITIAL_DAYS = 90;

export type SyncMode = "INITIAL" | "INCREMENTAL" | "MANUAL";

export interface SyncResult {
  ok: boolean;
  movimientos_new: number;
  movimientos_dup: number;
  error?: string;
}

export interface RunSyncParams {
  empresaId: string;
  accountId: string;
  externalId: string;
  provider: ProviderId;
  connectionId: string;
  mode: SyncMode;
  lastSyncAt?: string | null;
}

function daysAgoISO(days: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function runSyncForAccount(
  db: SupabaseClient,
  params: RunSyncParams,
): Promise<SyncResult> {
  const started = Date.now();
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  let dateFrom: string;

  if (params.mode === "INITIAL") {
    dateFrom = daysAgoISO(INITIAL_DAYS, today);
  } else if (params.lastSyncAt) {
    const base = new Date(params.lastSyncAt);
    base.setDate(base.getDate() - OVERLAP_DAYS);
    dateFrom = base.toISOString().slice(0, 10);
  } else {
    dateFrom = daysAgoISO(OVERLAP_DAYS, today);
  }

  await db
    .from("bank_accounts")
    .update({ sync_status: "SYNCING" })
    .eq("id", params.accountId);

  try {
    const provider = getProvider(params.provider);
    const transactions = await provider.getTransactions(params.externalId, {
      dateFrom,
      dateTo,
    });

    let novedosos = 0;
    let duplicados = 0;

    if (transactions.length > 0) {
      const rows = transactions.map((t) =>
        toDbTransaction(t, {
          empresaId: params.empresaId,
          accountId: params.accountId,
          provider: params.provider,
        }),
      );
      const ids = rows.map((r) => r.provider_tx_id);

      const { data: existentes } = await db
        .from("bank_transactions")
        .select("provider_tx_id")
        .eq("account_id", params.accountId)
        .in("provider_tx_id", ids);
      const existingSet = new Set(
        (existentes ?? []).map(
          (e: { provider_tx_id: string }) => e.provider_tx_id,
        ),
      );
      novedosos = rows.filter((r) => !existingSet.has(r.provider_tx_id)).length;
      duplicados = rows.length - novedosos;

      const { error: upsertErr } = await db
        .from("bank_transactions")
        .upsert(rows, { onConflict: "account_id,provider_tx_id" });
      if (upsertErr) throw upsertErr;
    }

    await db
      .from("bank_accounts")
      .update({
        sync_status: "OK",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", params.accountId);

    await db.from("bank_sync_logs").insert({
      empresa_id: params.empresaId,
      connection_id: params.connectionId,
      account_id: params.accountId,
      tipo: params.mode,
      status: "OK",
      movimientos_new: novedosos,
      movimientos_dup: duplicados,
      duration_ms: Date.now() - started,
    });

    return { ok: true, movimientos_new: novedosos, movimientos_dup: duplicados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .from("bank_accounts")
      .update({ sync_status: "ERROR" })
      .eq("id", params.accountId);
    await db.from("bank_sync_logs").insert({
      empresa_id: params.empresaId,
      connection_id: params.connectionId,
      account_id: params.accountId,
      tipo: params.mode,
      status: "ERROR",
      movimientos_new: 0,
      movimientos_dup: 0,
      error_message: msg,
      duration_ms: Date.now() - started,
    });
    return { ok: false, movimientos_new: 0, movimientos_dup: 0, error: msg };
  }
}
