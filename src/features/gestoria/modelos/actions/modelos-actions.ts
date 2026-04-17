"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  FacturaParaModelo,
  ModeloAeat,
  ModeloEstado,
  ModeloPeriodo,
  ModeloTipo,
} from "../types/modelos";
import { MODELO_PERIODOS_VALIDOS, periodoARangoFechas } from "../types/modelos";
import { calcular303 } from "../services/calculo-303";
import { calcular130 } from "../services/calculo-130";
import { calcular111 } from "../services/calculo-111";
import { calcular115 } from "../services/calculo-115";
import { calcular390 } from "../services/calculo-390";

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

export async function listModelos(
  ejercicio?: number,
): Promise<{ ok: boolean; data: ModeloAeat[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    let q = supabase
      .from("modelos_aeat")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("ejercicio", { ascending: false })
      .order("tipo", { ascending: true })
      .order("periodo", { ascending: true });

    if (ejercicio) q = q.eq("ejercicio", ejercicio);

    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as ModeloAeat[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function getModelo(
  id: string,
): Promise<{ ok: boolean; data?: ModeloAeat; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("modelos_aeat")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (error) throw error;
    return { ok: true, data: data as ModeloAeat };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] get:", msg);
    return { ok: false, error: msg };
  }
}

export async function crearModeloSiNoExiste(input: {
  tipo: ModeloTipo;
  periodo: ModeloPeriodo;
  ejercicio: number;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { supabase, empresaId, user } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    if (!MODELO_PERIODOS_VALIDOS[input.tipo].includes(input.periodo)) {
      return { ok: false, error: `Periodo ${input.periodo} no válido para modelo ${input.tipo}` };
    }

    const { data: existing } = await supabase
      .from("modelos_aeat")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("tipo", input.tipo)
      .eq("periodo", input.periodo)
      .eq("ejercicio", input.ejercicio)
      .maybeSingle();

    if (existing) return { ok: true, id: existing.id };

    const { data, error } = await supabase
      .from("modelos_aeat")
      .insert({
        empresa_id: empresaId,
        tipo: input.tipo,
        periodo: input.periodo,
        ejercicio: input.ejercicio,
        estado: "BORRADOR" as ModeloEstado,
        casillas: {},
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidatePath("/gestoria/modelos");
    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] crear:", msg);
    return { ok: false, error: msg };
  }
}

export async function asegurarModelosDelPeriodo(
  ejercicio: number,
): Promise<{ ok: boolean; creados: number; error?: string }> {
  try {
    const combos: Array<{ tipo: ModeloTipo; periodo: ModeloPeriodo }> = [
      { tipo: "303", periodo: "Q1" },
      { tipo: "303", periodo: "Q2" },
      { tipo: "303", periodo: "Q3" },
      { tipo: "303", periodo: "Q4" },
      { tipo: "130", periodo: "Q1" },
      { tipo: "130", periodo: "Q2" },
      { tipo: "130", periodo: "Q3" },
      { tipo: "130", periodo: "Q4" },
      { tipo: "111", periodo: "Q1" },
      { tipo: "111", periodo: "Q2" },
      { tipo: "111", periodo: "Q3" },
      { tipo: "111", periodo: "Q4" },
      { tipo: "115", periodo: "Q1" },
      { tipo: "115", periodo: "Q2" },
      { tipo: "115", periodo: "Q3" },
      { tipo: "115", periodo: "Q4" },
      { tipo: "390", periodo: "ANUAL" },
      { tipo: "347", periodo: "ANUAL" },
    ];
    let creados = 0;
    for (const c of combos) {
      const { id } = await crearModeloSiNoExiste({ ...c, ejercicio });
      if (id) creados++;
    }
    revalidatePath("/gestoria/modelos");
    return { ok: true, creados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, creados: 0, error: msg };
  }
}

export async function listFacturasParaModelo(
  modeloId: string,
): Promise<{ ok: boolean; data: FacturaParaModelo[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data: modelo, error: mErr } = await supabase
      .from("modelos_aeat")
      .select("id, tipo, periodo, ejercicio")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .single();
    if (mErr) throw mErr;

    const { inicio, fin } = periodoARangoFechas(
      modelo.periodo as ModeloPeriodo,
      modelo.ejercicio as number,
    );

    const { data, error } = await supabase
      .from("facturas")
      .select(
        "id, tipo, tipo_factura, contacto_id, fecha_emision, base_imponible, iva_pct, iva_importe, iva_deducible_pct, total, concepto, numero_factura, contactos_contables(nombre, documento, tipo)",
      )
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", inicio)
      .lte("fecha_emision", fin)
      .neq("estado", "ANULADO");
    if (error) throw error;

    const mapped: FacturaParaModelo[] = (data ?? []).map((row) => {
      const contacto = row.contactos_contables as unknown as
        | { nombre: string; documento: string; tipo: "EMPRESA" | "AUTONOMO" | "PARTICULAR" }
        | null;
      return {
        id: row.id as string,
        tipo: row.tipo as "COMPRA" | "VENTA",
        tipo_factura: (row.tipo_factura as string) ?? "ordinaria",
        contacto_id: row.contacto_id as string | null,
        contacto_nombre: contacto?.nombre,
        contacto_documento: contacto?.documento,
        contacto_tipo: contacto?.tipo,
        fecha_emision: row.fecha_emision as string,
        base_imponible: Number(row.base_imponible),
        iva_pct: Number(row.iva_pct),
        iva_importe: Number(row.iva_importe),
        iva_deducible_pct: Number(row.iva_deducible_pct ?? 100),
        total: Number(row.total),
        concepto: (row.concepto as string) ?? "",
        numero_factura: (row.numero_factura as string) ?? "",
      };
    });

    return { ok: true, data: mapped };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] listFacturasParaModelo:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function listAsignaciones(
  modeloId: string,
): Promise<{ ok: boolean; data: unknown[]; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("asignaciones_modelo")
      .select("*")
      .eq("modelo_id", modeloId);
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] listAsignaciones:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function recalcularCasillas(
  modeloId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: modelo, error: mErr } = await supabase
      .from("modelos_aeat")
      .select("*")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .single();
    if (mErr) throw mErr;

    if (modelo.estado === "PRESENTADO") {
      return { ok: false, error: "Modelo presentado es inmutable" };
    }

    const { data: asignaciones } = await supabase
      .from("asignaciones_modelo")
      .select("*")
      .eq("modelo_id", modeloId);

    const facturasRes = await listFacturasParaModelo(modeloId);
    if (!facturasRes.ok) throw new Error(facturasRes.error);

    let casillas: Record<string, number> = {};
    const tipo = modelo.tipo as ModeloTipo;
    const asgs = (asignaciones ?? []) as {
      factura_id: string;
      casilla: string;
      importe: number;
      tipo_aporte: string;
      origen: string;
      id: string;
      modelo_id: string;
      confianza_ia: number | null;
      explicacion_ia: string | null;
      creada_por: string | null;
      created_at: string;
    }[];

    if (tipo === "303") casillas = calcular303({ asignaciones: asgs as never, facturas: facturasRes.data });
    if (tipo === "130") casillas = calcular130({ asignaciones: asgs as never, facturas: facturasRes.data });
    if (tipo === "111") casillas = calcular111({ asignaciones: asgs as never, facturas: facturasRes.data });
    if (tipo === "115") casillas = calcular115({ asignaciones: asgs as never, facturas: facturasRes.data });
    if (tipo === "390") {
      const { data: trimestres } = await supabase
        .from("modelos_aeat")
        .select("periodo, casillas")
        .eq("empresa_id", empresaId)
        .eq("tipo", "303")
        .eq("ejercicio", modelo.ejercicio);
      casillas = calcular390({
        trimestres: (trimestres ?? []).map((t) => ({
          periodo: t.periodo as "Q1" | "Q2" | "Q3" | "Q4",
          casillas: (t.casillas as Record<string, number>) ?? {},
        })),
      });
    }

    const { error } = await supabase
      .from("modelos_aeat")
      .update({ casillas })
      .eq("id", modeloId);
    if (error) throw error;

    revalidatePath("/gestoria/modelos");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] recalcularCasillas:", msg);
    return { ok: false, error: msg };
  }
}

export async function marcarRevisado(
  modeloId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("modelos_aeat")
      .update({ estado: "REVISADO" })
      .eq("id", modeloId);
    if (error) throw error;
    revalidatePath("/gestoria/modelos");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function resetearAEstadoBorrador(
  modeloId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("modelos_aeat")
      .update({ estado: "BORRADOR" })
      .eq("id", modeloId);
    if (error) throw error;
    revalidatePath("/gestoria/modelos");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
