import { createHash } from "crypto";
import type { ProviderTransaction } from "./providers/types";

export function ibanHash(iban: string): string {
  return createHash("sha256")
    .update(iban.replace(/\s+/g, "").toUpperCase())
    .digest("hex");
}

export function ibanLast4(iban: string): string {
  return iban.replace(/\s+/g, "").slice(-4);
}

export interface DbTransactionRow {
  empresa_id: string;
  account_id: string;
  provider: string;
  provider_tx_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  descripcion: string | null;
  contraparte: string | null;
  referencia: string | null;
  estado: "BOOKED" | "PENDING";
  raw: unknown;
}

export function toDbTransaction(
  tx: ProviderTransaction,
  ctx: { empresaId: string; accountId: string; provider: string },
): DbTransactionRow {
  return {
    empresa_id: ctx.empresaId,
    account_id: ctx.accountId,
    provider: ctx.provider,
    provider_tx_id: tx.providerTxId,
    booking_date: tx.bookingDate,
    value_date: tx.valueDate ?? null,
    amount: tx.amount,
    currency: tx.currency,
    descripcion: tx.descripcion ?? null,
    contraparte: tx.contraparte ?? null,
    referencia: tx.referencia ?? null,
    estado: tx.estado,
    raw: tx.raw,
  };
}
