import "server-only";

/**
 * Validación por IA (visión) de un PDF de modelo fiscal subido por la gestoría.
 *
 * Objetivo: detectar si la gestoría se equivocó de archivo. Gemini lee el
 * justificante AEAT (nativo, sin extraer texto) y devuelve qué modelo, empresa
 * y periodo detecta; comparamos con lo esperado por el hueco de subida.
 *
 * Los justificantes AEAT reales incluyen texto legible como "Modelo 303",
 * "B09654955 BACANAL SYSTEM SL" y "2026 1T", así que la lectura es fiable.
 * Patrón calcado de rrhh/services/nominas/extraer-nominas.ts.
 */

import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import type { ModeloTipo, ModeloPeriodo } from "../types/modelos";
import { MODELO_LABEL } from "../types/modelos";

export interface ValidacionModeloEsperado {
  tipo: ModeloTipo;
  ejercicio: number;
  periodo: ModeloPeriodo;
  nif: string | null;
  razonSocial: string | null;
}

export interface ResultadoValidacionModelo {
  coincide: boolean;
  motivo: string;
  /** Lo que la IA detectó (para trazas/depuración). */
  detectado: {
    tipo: string;
    nif: string;
    razonSocial: string;
    ejercicio: string;
    periodo: string;
  } | null;
  confianza: number;
}

const RESPUESTA_SCHEMA = {
  type: "object",
  properties: {
    tipoDetectado: {
      type: "string",
      description:
        "Número/tipo de modelo o documento detectado: '303','111','130','115','390','347','200','190', 'PYG' (pérdidas y ganancias), 'BALANCE' (balance de situación), 'LIBRO_MAYOR', u 'OTRO' si no se identifica.",
    },
    nifDetectado: { type: "string", description: "NIF/CIF de la empresa del documento, o cadena vacía." },
    razonSocialDetectada: { type: "string", description: "Razón social de la empresa del documento, o cadena vacía." },
    ejercicioDetectado: { type: "string", description: "Año/ejercicio fiscal del documento (AAAA), o cadena vacía." },
    periodoDetectado: {
      type: "string",
      description: "Periodo: '1T','2T','3T','4T' para trimestral, 'ANUAL' para anual, o cadena vacía.",
    },
    confianza: { type: "number", description: "Confianza 0..1 de la lectura." },
  },
  required: [
    "tipoDetectado",
    "nifDetectado",
    "razonSocialDetectada",
    "ejercicioDetectado",
    "periodoDetectado",
    "confianza",
  ],
};

interface RespuestaIA {
  tipoDetectado: string;
  nifDetectado: string;
  razonSocialDetectada: string;
  ejercicioDetectado: string;
  periodoDetectado: string;
  confianza: number;
}

const periodoLegible: Record<ModeloPeriodo, string> = {
  T1: "1T",
  T2: "2T",
  T3: "3T",
  T4: "4T",
  ANUAL: "ANUAL",
};

function normNif(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Valida un PDF contra lo esperado. Si Gemini no está configurado, NO bloquea
 * (devuelve coincide=true con motivo informativo) para no impedir la subida en
 * entornos sin IA — la gestoría es un actor de confianza y el objetivo es solo
 * cazar errores obvios.
 */
export async function validarModeloPdfIA(input: {
  buffer: Buffer;
  esperado: ValidacionModeloEsperado;
}): Promise<ResultadoValidacionModelo> {
  const { buffer, esperado } = input;
  const tipoLabel = MODELO_LABEL[esperado.tipo];
  const periodoEsp = periodoLegible[esperado.periodo];

  const prompt =
    `Este PDF debería ser el documento fiscal "${tipoLabel}" (tipo ${esperado.tipo}) ` +
    `de la empresa ${esperado.razonSocial ?? ""} (NIF ${esperado.nif ?? ""}), ` +
    `ejercicio ${esperado.ejercicio}, periodo ${periodoEsp}. ` +
    "Léelo e identifica QUÉ documento es en realidad: su tipo de modelo/documento, la empresa (NIF y razón social) " +
    "y el ejercicio/periodo. No asumas que coincide: reporta lo que REALMENTE ves en el documento. " +
    "Para modelos AEAT el tipo aparece como 'Modelo NNN'. PYG=cuenta de pérdidas y ganancias, " +
    "BALANCE=balance de situación, LIBRO_MAYOR=libro mayor. Responde solo con el JSON pedido.";

  let ia: RespuestaIA;
  try {
    const { data } = await geminiJSON<RespuestaIA>(prompt, {
      responseSchema: RESPUESTA_SCHEMA as never,
      temperature: 0.1,
      attachments: [{ mimeType: "application/pdf", base64: buffer.toString("base64") }],
    });
    ia = data;
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return {
        coincide: true,
        motivo: "IA no configurada: subida aceptada sin validación automática.",
        detectado: null,
        confianza: 0,
      };
    }
    // Ante un fallo puntual de IA, no bloqueamos la subida (best-effort).
    console.error("[modelos] validarModeloPdfIA:", err);
    return {
      coincide: true,
      motivo: "No se pudo validar con IA; subida aceptada.",
      detectado: null,
      confianza: 0,
    };
  }

  const detectado = {
    tipo: ia.tipoDetectado,
    nif: ia.nifDetectado,
    razonSocial: ia.razonSocialDetectada,
    ejercicio: ia.ejercicioDetectado,
    periodo: ia.periodoDetectado,
  };

  // --- Comparaciones ---
  const tipoOk =
    normNif(ia.tipoDetectado) === normNif(esperado.tipo) ||
    ia.tipoDetectado.toUpperCase().includes(esperado.tipo.toUpperCase());

  // NIF: si lo esperado tiene NIF y la IA leyó uno, deben coincidir.
  const nifEsp = normNif(esperado.nif);
  const nifIA = normNif(ia.nifDetectado);
  const nifOk = !nifEsp || !nifIA || nifEsp === nifIA;

  // Ejercicio: si la IA lo leyó, debe coincidir.
  const ejercicioOk =
    !ia.ejercicioDetectado || ia.ejercicioDetectado.includes(String(esperado.ejercicio));

  // Periodo: si la IA lo leyó, debe coincidir.
  const periodoOk =
    !ia.periodoDetectado ||
    normNif(ia.periodoDetectado) === normNif(periodoEsp);

  if (!tipoOk) {
    return {
      coincide: false,
      motivo: `El documento parece ser "${ia.tipoDetectado}", pero se esperaba ${tipoLabel}.`,
      detectado,
      confianza: ia.confianza,
    };
  }
  if (!nifOk) {
    return {
      coincide: false,
      motivo: `El NIF del documento (${ia.nifDetectado}) no coincide con el de la empresa (${esperado.nif}).`,
      detectado,
      confianza: ia.confianza,
    };
  }
  if (!ejercicioOk) {
    return {
      coincide: false,
      motivo: `El ejercicio del documento (${ia.ejercicioDetectado}) no coincide con ${esperado.ejercicio}.`,
      detectado,
      confianza: ia.confianza,
    };
  }
  if (!periodoOk) {
    return {
      coincide: false,
      motivo: `El periodo del documento (${ia.periodoDetectado}) no coincide con ${periodoEsp}.`,
      detectado,
      confianza: ia.confianza,
    };
  }

  return {
    coincide: true,
    motivo: "El documento coincide con el modelo solicitado.",
    detectado,
    confianza: ia.confianza,
  };
}
