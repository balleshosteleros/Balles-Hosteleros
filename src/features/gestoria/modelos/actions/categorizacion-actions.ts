"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categorizarFacturas, importeParaCasilla, tipoAporteDesdeCasilla } from "../services/categorizacion-ia";
import { listFacturasParaModelo, recalcularCasillas } from "./modelos-actions";
import type { ModeloTipo, ReglaCategorizacionIA } from "../types/modelos";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: data?.empresa_id ?? null };
}

export async function correrIA(
  modeloId: string,
): Promise<{
  ok: boolean;
  asignaciones?: number;
  dudosas?: number;
  tokensInput?: number;
  tokensOutput?: number;
  error?: string;
}> {
  try {
    const { supabase, empresaId, user } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const { data: modelo, error: mErr } = await supabase
      .from("modelos_aeat")
      .select("id, tipo, periodo, ejercicio, estado")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .single();
    if (mErr) throw mErr;

    if (modelo.estado === "PRESENTADO") {
      return { ok: false, error: "Modelo presentado es inmutable" };
    }

    if (modelo.tipo === "347" || modelo.tipo === "390") {
      return { ok: false, error: "Los modelos anuales se calculan desde los trimestres, no requieren IA" };
    }

    const facturasRes = await listFacturasParaModelo(modeloId);
    if (!facturasRes.ok) return { ok: false, error: facturasRes.error };

    const { data: reglasRows } = await supabase
      .from("reglas_categorizacion_ia")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("activa", true);

    const reglas = (reglasRows ?? []) as ReglaCategorizacionIA[];

    const res = await categorizarFacturas({
      facturas: facturasRes.data,
      modeloTipo: modelo.tipo as ModeloTipo,
      reglas,
    });

    await supabase.from("asignaciones_modelo").delete().eq("modelo_id", modeloId);

    if (res.asignaciones.length > 0) {
      const rows = res.asignaciones.map((a) => ({
        modelo_id: modeloId,
        factura_id: a.factura_id,
        casilla: a.casilla,
        importe: a.importe,
        tipo_aporte: a.tipo_aporte,
        origen: a.confianza === 1 ? "regla" : "ia",
        confianza_ia: a.confianza,
        explicacion_ia: a.explicacion,
      }));
      const { error: insErr } = await supabase.from("asignaciones_modelo").insert(rows);
      if (insErr) throw insErr;
    }

    await supabase
      .from("modelos_aeat")
      .update({
        ia_corrida_en: new Date().toISOString(),
        ia_tokens_input: res.tokensInput,
        ia_tokens_output: res.tokensOutput,
      })
      .eq("id", modeloId);

    await recalcularCasillas(modeloId);

    const dudosas = res.asignaciones.filter((a) => a.confianza < 0.6).length;

    revalidatePath(`/gestoria/modelos/${modeloId}`);
    return {
      ok: true,
      asignaciones: res.asignaciones.length,
      dudosas,
      tokensInput: res.tokensInput,
      tokensOutput: res.tokensOutput,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorizacion] correrIA:", msg);
    return { ok: false, error: msg };
  }
}

export async function reasignarFactura(input: {
  modeloId: string;
  facturaId: string;
  casilla: string;
  crearRegla?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const { data: modelo, error: mErr } = await supabase
      .from("modelos_aeat")
      .select("id, tipo, estado")
      .eq("id", input.modeloId)
      .eq("empresa_id", empresaId)
      .single();
    if (mErr) throw mErr;
    if (modelo.estado === "PRESENTADO")
      return { ok: false, error: "Modelo presentado es inmutable" };

    const { data: facturaRow } = await supabase
      .from("facturas")
      .select("*, contactos_contables(nombre, documento, tipo)")
      .eq("id", input.facturaId)
      .single();
    if (!facturaRow) return { ok: false, error: "Factura no encontrada" };

    const factura = {
      id: facturaRow.id,
      tipo: facturaRow.tipo as "COMPRA" | "VENTA",
      tipo_factura: facturaRow.tipo_factura ?? "ordinaria",
      contacto_id: facturaRow.contacto_id,
      base_imponible: Number(facturaRow.base_imponible),
      iva_pct: Number(facturaRow.iva_pct),
      iva_importe: Number(facturaRow.iva_importe),
      iva_deducible_pct: Number(facturaRow.iva_deducible_pct ?? 100),
      total: Number(facturaRow.total),
      concepto: facturaRow.concepto ?? "",
      numero_factura: facturaRow.numero_factura ?? "",
      fecha_emision: facturaRow.fecha_emision,
    };

    const importe = importeParaCasilla(
      modelo.tipo as ModeloTipo,
      input.casilla,
      factura,
    );
    const tipo_aporte = tipoAporteDesdeCasilla(
      modelo.tipo as ModeloTipo,
      input.casilla,
    );

    await supabase
      .from("asignaciones_modelo")
      .delete()
      .eq("modelo_id", input.modeloId)
      .eq("factura_id", input.facturaId);

    const { error: insErr } = await supabase.from("asignaciones_modelo").insert({
      modelo_id: input.modeloId,
      factura_id: input.facturaId,
      casilla: input.casilla,
      importe,
      tipo_aporte,
      origen: "manual",
      creada_por: user.id,
    });
    if (insErr) throw insErr;

    if (input.crearRegla && facturaRow.contacto_id) {
      await supabase.from("reglas_categorizacion_ia").insert({
        empresa_id: empresaId,
        patron: {
          contacto_id: facturaRow.contacto_id,
          tipo_factura: facturaRow.tipo,
        },
        modelo_tipo: modelo.tipo,
        casilla: input.casilla,
        activa: true,
      });
    }

    await recalcularCasillas(input.modeloId);
    revalidatePath(`/gestoria/modelos/${input.modeloId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorizacion] reasignarFactura:", msg);
    return { ok: false, error: msg };
  }
}

export async function eliminarAsignacion(
  modeloId: string,
  facturaId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("asignaciones_modelo")
      .delete()
      .eq("modelo_id", modeloId)
      .eq("factura_id", facturaId);
    if (error) throw error;
    await recalcularCasillas(modeloId);
    revalidatePath(`/gestoria/modelos/${modeloId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
