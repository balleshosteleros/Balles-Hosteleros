"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  getProvider,
  type ProviderId,
} from "@/features/contabilidad/services/psd2/providers";
import {
  ibanHash,
  ibanLast4,
} from "@/features/contabilidad/services/psd2/mappers";
import { runSyncForAccount } from "@/features/contabilidad/services/psd2/sync";

const DEFAULT_PROVIDER: ProviderId = "gocardless";
const ACCESS_VALID_FOR_DAYS = 90;

const BANCOS_BASE: Array<{
  institution_id: string;
  institution_name: string;
  provider: "manual" | "gocardless";
  status: "ACTIVE" | "NOT_CONNECTED";
}> = [
  { institution_id: "manual:efectivo",          institution_name: "Efectivo",          provider: "manual",     status: "ACTIVE" },
  { institution_id: "pending:revolut",          institution_name: "Revolut",           provider: "gocardless", status: "NOT_CONNECTED" },
  { institution_id: "pending:bbva",             institution_name: "BBVA",              provider: "gocardless", status: "NOT_CONNECTED" },
  { institution_id: "manual:fondos-de-caja",    institution_name: "Fondos de Caja",    provider: "manual",     status: "ACTIVE" },
  { institution_id: "manual:liquidez",          institution_name: "Liquidez",          provider: "manual",     status: "ACTIVE" },
  { institution_id: "manual:fianza",            institution_name: "Fianza",            provider: "manual",     status: "ACTIVE" },
  { institution_id: "manual:facturas-externas", institution_name: "Facturas Externas", provider: "manual",     status: "ACTIVE" },
  { institution_id: "manual:patrimonio",        institution_name: "Patrimonio",        provider: "manual",     status: "ACTIVE" },
];

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: (data?.empresa_id ?? null) as string | null };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function listarBancosES() {
  try {
    const provider = getProvider(DEFAULT_PROVIDER);
    const institutions = await provider.listInstitutions("ES");
    return { ok: true as const, data: institutions };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] listarBancosES:", msg);
    return { ok: false as const, error: msg, data: [] };
  }
}

export async function crearRequisition(input: {
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) {
      return { ok: false as const, error: "No autenticado" };
    }

    const reference = randomUUID();
    const provider = getProvider(DEFAULT_PROVIDER);
    const redirectUrl = `${appUrl()}/contabilidad/bancos/callback`;

    const req = await provider.createRequisition({
      institutionId: input.institutionId,
      redirectUrl,
      reference,
      userLanguage: "ES",
      accessValidForDays: ACCESS_VALID_FOR_DAYS,
    });

    const { error } = await supabase.from("bank_connections").insert({
      empresa_id: empresaId,
      provider: DEFAULT_PROVIDER,
      institution_id: input.institutionId,
      institution_name: input.institutionName,
      institution_logo: input.institutionLogo ?? null,
      requisition_id: req.id,
      reference,
      status: "PENDING",
      created_by: user.id,
    });
    if (error) throw error;

    return { ok: true as const, redirectUrl: req.link, reference };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] crearRequisition:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function finalizarConexion(reference: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("id, provider, requisition_id, status")
      .eq("reference", reference)
      .eq("empresa_id", empresaId)
      .single();
    if (connErr || !conn) {
      return { ok: false as const, error: "Conexión no encontrada" };
    }

    const provider = getProvider(conn.provider as ProviderId);
    const req = await provider.getRequisition(conn.requisition_id);

    if (req.accounts.length === 0) {
      await supabase
        .from("bank_connections")
        .update({
          status: "ERROR",
          last_error: "Sin cuentas tras el consentimiento.",
        })
        .eq("id", conn.id);
      return { ok: false as const, error: "No se asociaron cuentas." };
    }

    let cuentasCreadas = 0;
    let movimientosImportados = 0;
    for (const externalId of req.accounts) {
      const info = await provider.getAccount(externalId).catch(() => null);
      const balances = await provider.getBalances(externalId).catch(() => []);
      const balanceClosing =
        balances.find((b) => b.type?.toLowerCase().includes("closing")) ??
        balances[0] ??
        null;

      const upsert = {
        empresa_id: empresaId,
        connection_id: conn.id,
        provider: conn.provider,
        external_id: externalId,
        iban_hash: info?.iban ? ibanHash(info.iban) : null,
        iban_last4: info?.iban ? ibanLast4(info.iban) : null,
        nombre: info?.name ?? null,
        titular: info?.ownerName ?? null,
        moneda: info?.currency ?? "EUR",
        balance: balanceClosing?.amount ?? null,
        balance_at: balanceClosing?.referenceDate ?? null,
        sync_status: "IDLE",
      };
      const { data: accRow, error: accErr } = await supabase
        .from("bank_accounts")
        .upsert(upsert, { onConflict: "provider,external_id" })
        .select("id")
        .single();
      if (accErr || !accRow) continue;
      cuentasCreadas++;

      const sync = await runSyncForAccount(supabase, {
        empresaId,
        accountId: accRow.id,
        externalId,
        provider: conn.provider as ProviderId,
        connectionId: conn.id,
        mode: "INITIAL",
      });
      if (sync.ok) movimientosImportados += sync.movimientos_new;
    }

    const expiresAt = new Date(
      Date.now() + ACCESS_VALID_FOR_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    await supabase
      .from("bank_connections")
      .update({ status: "ACTIVE", expires_at: expiresAt, last_error: null })
      .eq("id", conn.id);

    return { ok: true as const, cuentasCreadas, movimientosImportados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] finalizarConexion:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function listarConexiones() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, data: [] };

    const { data, error } = await supabase
      .from("bank_connections")
      .select(
        `id, provider, institution_id, institution_name, institution_logo,
         status, expires_at, last_error, created_at,
         bank_accounts ( id, external_id, iban_last4, nombre, titular,
                         moneda, balance, balance_at, last_sync_at, sync_status )`,
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true as const, data: data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] listarConexiones:", msg);
    return { ok: false as const, data: [], error: msg };
  }
}

export async function sincronizarConexion(connectionId: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("id, provider, status")
      .eq("id", connectionId)
      .eq("empresa_id", empresaId)
      .single();
    if (connErr || !conn) {
      return { ok: false as const, error: "Conexión no encontrada" };
    }
    if (conn.status !== "ACTIVE") {
      return {
        ok: false as const,
        error: "La conexión no está activa, renueva el consentimiento primero.",
      };
    }

    const { data: accounts, error: accErr } = await supabase
      .from("bank_accounts")
      .select("id, external_id, last_sync_at")
      .eq("connection_id", connectionId)
      .eq("activo", true);
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return { ok: false as const, error: "Sin cuentas para sincronizar." };
    }

    let totalNuevos = 0;
    let totalDup = 0;
    const errores: string[] = [];
    for (const a of accounts) {
      const r = await runSyncForAccount(supabase, {
        empresaId,
        accountId: a.id,
        externalId: a.external_id,
        provider: conn.provider as ProviderId,
        connectionId: conn.id,
        mode: "MANUAL",
        lastSyncAt: a.last_sync_at,
      });
      totalNuevos += r.movimientos_new;
      totalDup += r.movimientos_dup;
      if (!r.ok && r.error) errores.push(r.error);
    }

    if (errores.length === accounts.length) {
      return { ok: false as const, error: errores[0] ?? "Error al sincronizar" };
    }

    return {
      ok: true as const,
      cuentasSincronizadas: accounts.length,
      movimientosNuevos: totalNuevos,
      movimientosDuplicados: totalDup,
      errores,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] sincronizarConexion:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function renovarConsentimiento(connectionId: string) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) {
      return { ok: false as const, error: "No autenticado" };
    }

    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("id, provider, institution_id")
      .eq("id", connectionId)
      .eq("empresa_id", empresaId)
      .single();
    if (connErr || !conn) {
      return { ok: false as const, error: "Conexión no encontrada" };
    }

    const reference = randomUUID();
    const provider = getProvider(conn.provider as ProviderId);
    const redirectUrl = `${appUrl()}/contabilidad/bancos/callback`;

    const req = await provider.createRequisition({
      institutionId: conn.institution_id,
      redirectUrl,
      reference,
      userLanguage: "ES",
      accessValidForDays: ACCESS_VALID_FOR_DAYS,
    });

    const { error } = await supabase
      .from("bank_connections")
      .update({
        requisition_id: req.id,
        reference,
        status: "PENDING",
        expires_at: null,
        last_error: null,
      })
      .eq("id", connectionId);
    if (error) throw error;

    return { ok: true as const, redirectUrl: req.link };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] renovarConsentimiento:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function listMovimientosBancarios() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, data: [] };

    const { data, error } = await supabase
      .from("bank_transactions")
      .select(
        `id, account_id, provider, provider_tx_id, booking_date, value_date,
         amount, currency, descripcion, contraparte, referencia, estado,
         bank_accounts!inner ( id, nombre, iban_last4,
           bank_connections!inner ( institution_name ) )`,
      )
      .eq("empresa_id", empresaId)
      .order("booking_date", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { ok: true as const, data: data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] listMovimientosBancarios:", msg);
    return { ok: false as const, data: [], error: msg };
  }
}

export async function seedBancosBase() {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) {
      return { ok: false as const, error: "No autenticado", creadas: 0 };
    }

    const { data: existentes } = await supabase
      .from("bank_connections")
      .select("institution_id")
      .eq("empresa_id", empresaId);
    const ya = new Set((existentes ?? []).map((c) => c.institution_id));

    const rows = BANCOS_BASE
      .filter((b) => !ya.has(b.institution_id))
      .map((b) => ({
        empresa_id: empresaId,
        provider: b.provider,
        institution_id: b.institution_id,
        institution_name: b.institution_name,
        institution_logo: null,
        requisition_id: null,
        reference: null,
        status: b.status,
        created_by: user.id,
      }));

    if (rows.length === 0) {
      return { ok: true as const, creadas: 0 };
    }

    const { error } = await supabase.from("bank_connections").insert(rows);
    if (error) throw error;
    return { ok: true as const, creadas: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] seedBancosBase:", msg);
    return { ok: false as const, error: msg, creadas: 0 };
  }
}

export async function conectarBancoExistente(
  connectionId: string,
  input: { institutionId: string; institutionName: string; institutionLogo?: string },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const reference = randomUUID();
    const provider = getProvider(DEFAULT_PROVIDER);
    const redirectUrl = `${appUrl()}/contabilidad/bancos/callback`;

    const req = await provider.createRequisition({
      institutionId: input.institutionId,
      redirectUrl,
      reference,
      userLanguage: "ES",
      accessValidForDays: ACCESS_VALID_FOR_DAYS,
    });

    const { error } = await supabase
      .from("bank_connections")
      .update({
        provider: DEFAULT_PROVIDER,
        institution_id: input.institutionId,
        institution_name: input.institutionName,
        institution_logo: input.institutionLogo ?? null,
        requisition_id: req.id,
        reference,
        status: "PENDING",
        last_error: null,
      })
      .eq("id", connectionId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    return { ok: true as const, redirectUrl: req.link, reference };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] conectarBancoExistente:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function eliminarConexion(connectionId: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const { error } = await supabase
      .from("bank_connections")
      .delete()
      .eq("id", connectionId)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[psd2] eliminarConexion:", msg);
    return { ok: false as const, error: msg };
  }
}
