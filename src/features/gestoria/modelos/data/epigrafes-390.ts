/**
 * Catálogo oficial del Modelo 390 (Resumen anual IVA).
 * Consolida los 4 trimestres del 303.
 * Ejercicio 2026.
 */

export const CASILLAS_390 = {
  REGIMEN_GENERAL: {
    BASE_21: "100",
    CUOTA_21: "101",
    BASE_10: "102",
    CUOTA_10: "103",
    BASE_4: "104",
    CUOTA_4: "105",
    TOTAL_BASES: "108",
    TOTAL_CUOTAS: "109",
  },
  DEDUCIBLE: {
    INTERIOR_BIENES_BASE: "190",
    INTERIOR_BIENES_CUOTA: "191",
    INTERIOR_INVERSION_BASE: "192",
    INTERIOR_INVERSION_CUOTA: "193",
    IMPORTACIONES_BASE: "194",
    IMPORTACIONES_CUOTA: "195",
    INTRACOM_BASE: "196",
    INTRACOM_CUOTA: "197",
    TOTAL_BASES_DEDUCIBLE: "597",
    TOTAL_CUOTAS_DEDUCIBLE: "598",
  },
  RESULTADO: {
    REGIMEN_GENERAL_DEVENGADO: "599",
    TOTAL_DEDUCIBLE: "645",
    LIQUIDACION_ANUAL: "658",
    RESULTADO: "660",
  },
} as const;

/**
 * Correspondencia casilla 303 (trimestral) → casilla 390 (resumen anual).
 * Cubre las tres bases/cuotas devengadas y TODOS los bloques de IVA soportado
 * que el 303 admite: interior corriente (28/29), interior inversión (30/31),
 * importaciones corrientes (32/33) e inversión (34/35), e intracomunitarias
 * corrientes (36/37) e inversión (38/39).
 */
export const MAPPING_303_A_390: Record<string, string> = {
  "01": "100",
  "03": "101",
  "04": "102",
  "06": "103",
  "07": "104",
  "09": "105",
  "28": "190",
  "29": "191",
  "30": "192",
  "31": "193",
  "32": "194",
  "33": "195",
  "34": "194",
  "35": "195",
  "36": "196",
  "37": "197",
  "38": "196",
  "39": "197",
};
