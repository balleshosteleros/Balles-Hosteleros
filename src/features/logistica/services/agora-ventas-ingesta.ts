/**
 * Ingesta de ventas de Ágora POS → pos_tickets / pos_ticket_lineas (PRP-056).
 *
 * Versión TS (servidor) usada por el cron diario. La lógica espeja la del script
 * de backfill `scripts/agora/sync-ventas.mjs`:
 * - Idempotente: numero = "AG-{serie}-{numero}" sobre el único (empresa_id, numero).
 *   Al reprocesar un día se REEMPLAZAN las líneas del ticket.
 * - Ingiere TODAS las facturas (también importe 0 o negativo = devoluciones/abonos).
 * - total del ticket = Invoice.Totals.GrossAmount (autoritativo; no dobla menús).
 *
 * El precio de venta lo manda Ágora (en Balles está bloqueado); aquí NO se toca
 * coste ni stock (viven en Balles).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mapa empresa_id → Workplace.Id de Ágora. */
export const EMPRESA_WORKPLACE: Record<string, number> = {
  "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47": 4, // BACANAL
  "00000000-0000-0000-0000-000000000001": 1, // HABANA
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function agoraGet(path: string): Promise<unknown> {
  const base = (process.env.AGORA_API_URL ?? "").replace(/\/$/, "");
  const token = process.env.AGORA_API_TOKEN;
  if (!base || !token) {
    throw new Error("AGORA_API_URL / AGORA_API_TOKEN no configurados (pendientes en Vercel).");
  }
  const r = await fetch(base + path, { headers: { "Api-Token": token, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Ágora ${path} -> HTTP ${r.status}`);
  return r.json();
}

export type IngestaResultado = { facturas: number; lineas: number; sinProducto: number };

/**
 * Ingiere las facturas de Ágora de un business-day para una empresa.
 * Devuelve el resumen. Lanza si Ágora falla (fail-closed).
 */
export async function ingerirVentasAgoraDia(
  supabase: SupabaseClient,
  empresaId: string,
  businessDay: string,
): Promise<IngestaResultado> {
  const workplaceId = EMPRESA_WORKPLACE[empresaId];
  if (!workplaceId) throw new Error(`Empresa ${empresaId} sin Workplace de Ágora mapeado`);

  const payload = (await agoraGet(`/api/export/?business-day=${businessDay}&filter=Invoices`)) as {
    Invoices?: AgoraInvoice[];
  };
  const propias = (payload.Invoices ?? []).filter((f) => f.Workplace?.Id === workplaceId);
  if (propias.length === 0) return { facturas: 0, lineas: 0, sinProducto: 0 };

  // Tickets
  const ticketRows = propias.map((f) => {
    const comensales = (f.InvoiceItems ?? []).reduce((a, it) => a + (it.Guests ?? 0), 0) || 1;
    const t = f.Totals ?? {};
    return {
      empresa_id: empresaId,
      numero: `AG-${f.Serie}-${f.Number}`,
      origen: "agora",
      agora_serie: String(f.Serie),
      agora_numero: f.Number,
      estado: "COBRADO",
      comensales,
      subtotal: toNum(t.NetAmount),
      iva_total: toNum(t.VatAmount),
      total: toNum(t.GrossAmount),
      abierto_at: f.Date,
      cerrado_at: `${f.BusinessDay}T12:00:00`,
      stock_descontado: true,
      notas: `Ágora ${f.Serie}-${f.Number}`,
    };
  });

  const { data: tickets, error: e1 } = await supabase
    .from("pos_tickets")
    .upsert(ticketRows, { onConflict: "empresa_id,numero" })
    .select("id, numero");
  if (e1) throw e1;
  const idPorNumero = new Map((tickets ?? []).map((t) => [t.numero as string, t.id as string]));
  const ticketIds = (tickets ?? []).map((t) => t.id as string);

  // Reemplazar líneas
  for (let i = 0; i < ticketIds.length; i += 200) {
    const { error } = await supabase.from("pos_ticket_lineas").delete().in("ticket_id", ticketIds.slice(i, i + 200));
    if (error) throw error;
  }

  // Resolver producto_id (prefiere venta) para los ProductId del día
  const productIds = new Set<string>();
  for (const f of propias) for (const it of f.InvoiceItems ?? []) for (const ln of it.Lines ?? []) {
    if (ln.ProductId != null) productIds.add(String(ln.ProductId));
  }
  const prodMap = new Map<string, string>();
  if (productIds.size > 0) {
    const { data: prods, error } = await supabase
      .from("productos")
      .select("id, agora_id, tipo")
      .eq("empresa_id", empresaId)
      .in("agora_id", Array.from(productIds));
    if (error) throw error;
    for (const p of prods ?? []) {
      const k = p.agora_id as string;
      if (p.tipo === "venta" || !prodMap.has(k)) prodMap.set(k, p.id as string);
    }
  }

  // Insertar líneas
  let sinProducto = 0;
  const lineaRows: Record<string, unknown>[] = [];
  for (const f of propias) {
    const ticketId = idPorNumero.get(`AG-${f.Serie}-${f.Number}`);
    if (!ticketId) continue;
    for (const it of f.InvoiceItems ?? []) {
      for (const ln of it.Lines ?? []) {
        if (ln.ProductId == null) continue;
        const pid = prodMap.get(String(ln.ProductId)) ?? null;
        if (!pid) sinProducto++;
        lineaRows.push({
          ticket_id: ticketId,
          producto_id: pid,
          nombre: ln.ProductName ?? `Ágora ${ln.ProductId}`,
          cantidad: toNum(ln.Quantity),
          precio_unitario: toNum(ln.UnitPrice),
          iva_pct: Math.round(toNum(ln.VatRate) * 100),
          descuento_pct: Math.round(toNum(ln.DiscountRate) * 100),
        });
      }
    }
  }
  for (let i = 0; i < lineaRows.length; i += 500) {
    const { error } = await supabase.from("pos_ticket_lineas").insert(lineaRows.slice(i, i + 500));
    if (error) throw error;
  }

  return { facturas: ticketRows.length, lineas: lineaRows.length, sinProducto };
}

// ─── Tipos mínimos del payload de Ágora ───────────────────────────────────
type AgoraLine = {
  ProductId?: number | null;
  ProductName?: string;
  Quantity?: number;
  UnitPrice?: number;
  VatRate?: number;
  DiscountRate?: number;
};
type AgoraInvoiceItem = { Guests?: number; Lines?: AgoraLine[] };
type AgoraInvoice = {
  Serie?: string;
  Number?: number;
  BusinessDay?: string;
  Date?: string;
  Workplace?: { Id?: number };
  Totals?: { GrossAmount?: number; NetAmount?: number; VatAmount?: number };
  InvoiceItems?: AgoraInvoiceItem[];
};
