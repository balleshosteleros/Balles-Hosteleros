/**
 * Categorización IA de facturas a casillas AEAT con Gemini.
 *
 * Flujo:
 *  1. Aplicar reglas aprendidas (cero tokens gastados si el patrón coincide).
 *  2. Facturas sin regla → batch de 100 a Gemini con structured output.
 *  3. Retornar asignaciones `{factura_id, casilla, tipo_aporte, importe, confianza, explicacion}`.
 *
 * Los motores de cálculo son puros — esta capa sólo decide *a qué casilla* va cada factura.
 */
import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import { geminiJSON } from "@/lib/ia/gemini";
import type {
  FacturaParaModelo,
  ModeloTipo,
  ReglaCategorizacionIA,
  ResultadoCategorizacionIA,
  TipoAporte,
} from "../types/modelos";
import { RETENCION_ALQUILERES_PCT } from "../types/modelos";
import { EPIGRAFES_303 } from "../data/epigrafes-303";
import { EPIGRAFES_130, CASILLAS_130 } from "../data/epigrafes-130";
import { EPIGRAFES_111 } from "../data/epigrafes-111";
import { EPIGRAFES_115, CASILLAS_115 } from "../data/epigrafes-115";

const BATCH_SIZE = 100;
const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    asignaciones: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          factura_id: { type: SchemaType.STRING },
          casilla: { type: SchemaType.STRING },
          confianza: { type: SchemaType.NUMBER },
          explicacion: { type: SchemaType.STRING },
        },
        required: ["factura_id", "casilla", "confianza", "explicacion"],
      },
    },
  },
  required: ["asignaciones"],
};

const RespuestaIAZ = z.object({
  asignaciones: z.array(
    z.object({
      factura_id: z.string(),
      casilla: z.string(),
      confianza: z.number().min(0).max(1),
      explicacion: z.string(),
    }),
  ),
});

function epigrafesDelModelo(tipo: ModeloTipo): Array<{
  codigo: string;
  etiqueta: string;
  casilla: string;
  tipoIva?: number | "cualquiera";
  aplicaA: ("COMPRA" | "VENTA")[];
  palabrasClave?: string[];
}> {
  switch (tipo) {
    case "303":
      return EPIGRAFES_303.flatMap((e) =>
        e.casillaBase
          ? [
              {
                codigo: e.codigo,
                etiqueta: e.etiqueta,
                casilla: e.casillaBase,
                tipoIva: e.tipoIva,
                aplicaA: e.aplicaA,
                palabrasClave: e.palabrasClave,
              },
            ]
          : [],
      );
    case "130":
      return EPIGRAFES_130.flatMap((e) =>
        e.casillaBase
          ? [
              {
                codigo: e.codigo,
                etiqueta: e.etiqueta,
                casilla: e.casillaBase,
                aplicaA: e.aplicaA,
                palabrasClave: e.palabrasClave,
              },
            ]
          : [],
      );
    case "111":
      return EPIGRAFES_111.flatMap((e) =>
        e.casillaBase
          ? [
              {
                codigo: e.codigo,
                etiqueta: e.etiqueta,
                casilla: e.casillaBase,
                aplicaA: e.aplicaA,
                palabrasClave: e.palabrasClave,
              },
            ]
          : [],
      );
    case "115":
      return EPIGRAFES_115.flatMap((e) =>
        e.casillaBase
          ? [
              {
                codigo: e.codigo,
                etiqueta: e.etiqueta,
                casilla: e.casillaBase,
                aplicaA: e.aplicaA,
                palabrasClave: e.palabrasClave,
              },
            ]
          : [],
      );
    default:
      return [];
  }
}

export function tipoAporteDesdeCasilla(
  tipo: ModeloTipo,
  casilla: string,
): TipoAporte {
  if (tipo === "303") {
    const esCuota = ["03", "06", "09", "29", "31", "33", "35", "37", "39", "41"].includes(casilla);
    return esCuota ? "iva" : "base";
  }
  if (tipo === "111") {
    const esRetencion = ["03", "06", "09", "12"].includes(casilla);
    return esRetencion ? "retencion" : "base";
  }
  if (tipo === "115") {
    return casilla === CASILLAS_115.IMPORTE_RETENCIONES ? "retencion" : "base";
  }
  return "base";
}

export function importeParaCasilla(
  tipo: ModeloTipo,
  casilla: string,
  factura: FacturaParaModelo,
): number {
  const signo = factura.tipo_factura === "rectificativa" ? -1 : 1;
  if (tipo === "303") {
    const esCuota = ["03", "06", "09", "29", "31", "33", "35", "37", "39", "41"].includes(casilla);
    if (esCuota) {
      const deducible = (factura.iva_deducible_pct ?? 100) / 100;
      return signo * factura.iva_importe * (factura.tipo === "COMPRA" ? deducible : 1);
    }
    return signo * factura.base_imponible;
  }
  if (tipo === "130") {
    if (casilla === CASILLAS_130.INGRESOS && factura.tipo === "VENTA") {
      return signo * factura.base_imponible;
    }
    if (casilla === CASILLAS_130.GASTOS && factura.tipo === "COMPRA") {
      return signo * factura.base_imponible;
    }
  }
  if (tipo === "111") {
    const esRetencion = ["03", "06", "09", "12"].includes(casilla);
    if (esRetencion) return signo * Math.abs(factura.iva_importe);
    return signo * factura.base_imponible;
  }
  if (tipo === "115") {
    if (casilla === CASILLAS_115.BASE_RETENCIONES) return signo * factura.base_imponible;
    if (casilla === CASILLAS_115.IMPORTE_RETENCIONES) {
      return signo * round2((factura.base_imponible * RETENCION_ALQUILERES_PCT) / 100);
    }
  }
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function aplicarReglas(
  facturas: FacturaParaModelo[],
  reglas: ReglaCategorizacionIA[],
  modeloTipo: ModeloTipo,
): {
  asignadas: ResultadoCategorizacionIA[];
  pendientes: FacturaParaModelo[];
} {
  const reglasModelo = reglas.filter((r) => r.modelo_tipo === modeloTipo && r.activa);
  const asignadas: ResultadoCategorizacionIA[] = [];
  const pendientes: FacturaParaModelo[] = [];

  for (const f of facturas) {
    const regla = reglasModelo.find((r) => {
      if (r.patron.contacto_id && r.patron.contacto_id !== f.contacto_id) return false;
      if (
        r.patron.concepto_contiene &&
        !f.concepto.toLowerCase().includes(r.patron.concepto_contiene.toLowerCase())
      )
        return false;
      if (r.patron.tipo_iva !== undefined && r.patron.tipo_iva !== f.iva_pct) return false;
      if (r.patron.tipo_factura && r.patron.tipo_factura !== f.tipo) return false;
      return true;
    });

    if (regla) {
      asignadas.push({
        factura_id: f.id,
        casilla: regla.casilla,
        tipo_aporte: tipoAporteDesdeCasilla(modeloTipo, regla.casilla),
        importe: importeParaCasilla(modeloTipo, regla.casilla, f),
        confianza: 1,
        explicacion: `Regla aprendida (aplicada ${regla.veces_aplicada + 1} veces)`,
      });
    } else {
      pendientes.push(f);
    }
  }

  return { asignadas, pendientes };
}

function buildSystemPrompt(modeloTipo: ModeloTipo): string {
  const epigrafes = epigrafesDelModelo(modeloTipo);
  const epigrafesTxt = epigrafes
    .map(
      (e) =>
        `  - Casilla ${e.casilla} · ${e.etiqueta}${e.tipoIva ? ` (IVA ${e.tipoIva === "cualquiera" ? "cualquier %" : `${e.tipoIva} %`})` : ""}${e.palabrasClave?.length ? ` — palabras clave: ${e.palabrasClave.join(", ")}` : ""} — aplica a ${e.aplicaA.join("/")}`,
    )
    .join("\n");

  return `Eres un asesor fiscal experto en AEAT (Agencia Tributaria española) especializado en hostelería y restauración (régimen general IVA).

Tu tarea: clasificar CADA factura recibida a la CASILLA correcta del modelo ${modeloTipo} oficial.

CASILLAS DISPONIBLES DEL MODELO ${modeloTipo}:
${epigrafesTxt}

REGLAS ESTRICTAS:
- Devuelve JSON con array "asignaciones", una entrada por factura de entrada.
- "casilla" debe ser exactamente uno de los códigos listados arriba (ej "01", "03", "29"...).
- "confianza" de 0 a 1:
    · 1.0 = seguro al 100 % (matches exactos de palabras clave + tipo IVA + tipo factura)
    · 0.7-0.9 = alta probabilidad (encaja pero ambiguo entre 1-2 casillas)
    · < 0.6 = dudoso, requiere revisión humana
- "explicacion": 1 frase explicando por qué elegiste esa casilla. Si es dudoso, di qué otras casillas considerabas.
- NO inventes casillas que no estén en la lista.
- Si la factura NO encaja en ninguna casilla del modelo ${modeloTipo} (p.ej. una factura profesional al pedir el 303 de ventas), asígnala a la casilla más aplicable con confianza < 0.3.

CONTEXTO HOSTELERÍA:
- Compras habituales: materias primas (carne, pescado, verdura, bebidas) → IVA soportado bienes corrientes (casilla 28/29 en 303).
- Ventas típicas: menús y consumiciones al 10 % (casillas 04/06 del 303).
- Inversiones: horno, cámara, mobiliario → bienes de inversión (casillas 30/31).`;
}

function buildBatchPrompt(facturas: FacturaParaModelo[]): string {
  const lista = facturas
    .map(
      (f) =>
        `- id=${f.id} tipo=${f.tipo} tipo_factura=${f.tipo_factura} fecha=${f.fecha_emision} base=${f.base_imponible.toFixed(2)} iva_pct=${f.iva_pct} iva=${f.iva_importe.toFixed(2)} proveedor="${(f.contacto_nombre ?? "").slice(0, 60)}" concepto="${f.concepto.slice(0, 120)}"`,
    )
    .join("\n");

  return `FACTURAS A CLASIFICAR:
${lista}

Devuelve JSON { "asignaciones": [...] } con exactamente ${facturas.length} entradas (una por factura).`;
}

export interface CategorizarInput {
  facturas: FacturaParaModelo[];
  modeloTipo: ModeloTipo;
  reglas?: ReglaCategorizacionIA[];
}

export interface CategorizarResult {
  asignaciones: ResultadoCategorizacionIA[];
  tokensInput: number;
  tokensOutput: number;
  batchesEjecutados: number;
  aplicadasPorRegla: number;
}

export async function categorizarFacturas(
  input: CategorizarInput,
): Promise<CategorizarResult> {
  const { facturas, modeloTipo } = input;
  const reglas = input.reglas ?? [];

  const { asignadas: porRegla, pendientes } = aplicarReglas(facturas, reglas, modeloTipo);

  const asignaciones: ResultadoCategorizacionIA[] = [...porRegla];
  let tokensInput = 0;
  let tokensOutput = 0;
  let batches = 0;

  const systemInstruction = buildSystemPrompt(modeloTipo);

  for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
    const batch = pendientes.slice(i, i + BATCH_SIZE);
    const prompt = buildBatchPrompt(batch);

    try {
      const res = await geminiJSON<unknown>(prompt, {
        systemInstruction,
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      });
      const parsed = RespuestaIAZ.safeParse(res.data);
      if (!parsed.success) {
        console.warn("[categorizacion-ia] Zod falló en batch", i, parsed.error.message);
        continue;
      }

      tokensInput += res.tokensInput ?? 0;
      tokensOutput += res.tokensOutput ?? 0;
      batches++;

      for (const a of parsed.data.asignaciones) {
        const fact = batch.find((f) => f.id === a.factura_id);
        if (!fact) continue;
        asignaciones.push({
          factura_id: a.factura_id,
          casilla: a.casilla,
          tipo_aporte: tipoAporteDesdeCasilla(modeloTipo, a.casilla),
          importe: importeParaCasilla(modeloTipo, a.casilla, fact),
          confianza: a.confianza,
          explicacion: a.explicacion,
        });
      }
    } catch (err) {
      console.error("[categorizacion-ia] batch falló:", err);
    }
  }

  return {
    asignaciones,
    tokensInput,
    tokensOutput,
    batchesEjecutados: batches,
    aplicadasPorRegla: porRegla.length,
  };
}
