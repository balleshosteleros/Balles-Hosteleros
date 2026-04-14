/**
 * Tipos y schemas Zod para la integración con Ágora POS.
 *
 * ─── FLUJO DE DATOS ÁGORA → BD ────────────────────────────────────────────────
 *
 *  [Ágora POS]                     [Este módulo]                    [Supabase]
 *      │                                 │                               │
 *      │  Datos crudos (API / CSV)        │                               │
 *      │ ──────────────────────────────► │                               │
 *      │  { agora_id, nombre,            │  agoraVentaRawSchema          │
 *      │    categoria, precio_venta? }   │  .safeParse(registro)         │
 *      │                                 │                               │
 *      │                        válido   │ ──────────────────────────── ►│ upsert productos
 *      │                                 │  onConflict: empresa_id,      │ (agora_id como clave)
 *      │                                 │  agora_id                     │
 *      │                      inválido   │                               │
 *      │                                 │ → error_detail en             │
 *      │                                 │   agora_sync_log              │
 *      │                                 │                               │
 *      │          timeout / sin respuesta│                               │
 *      │ ────────────────────────────── X│ → Regla Seguridad Ágora:      │
 *      │                                 │   mostrar error exacto        │
 *      │                                 │   + pedir aprobación          │
 *      │                                 │   NO reintentar solo          │
 *
 * ─── FORMATO REAL DE ÁGORA ────────────────────────────────────────────────────
 *
 * Basado en los 74 productos reales de data-productos-venta.ts:
 *   agora_id: strings numéricos, sin decimales (ej: "1833", "2543")
 *   nombre:   string libre, mayúsculas/minúsculas mixtas
 *   categoria: string libre (ej: "Para empezar", "De la tierra")
 *   precio_venta: opcional (Ágora no siempre lo incluye en la exportación)
 *
 * ─── REGLA DE SEGURIDAD ÁGORA ─────────────────────────────────────────────────
 * Ante cualquier error (timeout, datos corruptos, fallo BD):
 *   1. Detener inmediatamente
 *   2. Mostrar error exacto
 *   3. Preguntar: "Balles, el botón [X] ha fallado al comunicarse con Ágora.
 *      ¿Quieres que reintente la conexión, que ignore el error o que cree
 *      un registro de backup?"
 *   4. Solo actuar bajo aprobación explícita
 */

import { z } from "zod";

// ─── SCHEMA RAW (entrada desde Ágora) ─────────────────────────────────────────

/**
 * Valida cada registro tal como llega de Ágora POS.
 * Diseñado para los 74 productos reales con agora_id numérico tipo "1833".
 */
export const agoraVentaRawSchema = z.object({
  agora_id: z
    .string()
    .min(1, "agora_id obligatorio")
    .regex(/^\d+$/, "agora_id debe ser numérico (ej: '1833')"),
  nombre: z.string().min(1, "nombre obligatorio").max(255),
  categoria: z.string().min(1, "categoría obligatoria"),
  precio_venta: z.string().optional().nullable(),
});

export type AgoraVentaRaw = z.infer<typeof agoraVentaRawSchema>;

// ─── SCHEMA VALIDADA (listo para upsert en BD) ────────────────────────────────

/**
 * Datos de Ágora ya validados, mapeados al formato de la tabla `productos`.
 * Solo productos de tipo "venta" tienen agora_id no nulo.
 */
export const agoraVentaValidadaSchema = agoraVentaRawSchema.transform((raw) => ({
  agora_id: raw.agora_id,
  nombre: raw.nombre.trim(),
  categoria: raw.categoria.trim(),
  precio_venta: raw.precio_venta ?? null,
  tipo: "venta" as const,
  estado: "Activo" as const,
  unidad: "ud" as const,
}));

export type AgoraVentaValidada = z.infer<typeof agoraVentaValidadaSchema>;

// ─── RESULTADO DE SINCRONIZACIÓN ──────────────────────────────────────────────

/**
 * Resultado de procesar un lote de registros de Ágora.
 * Incluye tanto los válidos (listos para upsert) como los errores por registro.
 */
export interface AgoraBatchResult {
  validos: AgoraVentaValidada[];
  errores: AgoraRegistroError[];
}

export interface AgoraRegistroError {
  registro: unknown;
  motivo: string;
  campo?: string;
}

// ─── ESTADOS DE SINCRONIZACIÓN ────────────────────────────────────────────────

export type AgoraSyncStatus = "ok" | "partial" | "timeout" | "error";

/**
 * Registro que se guarda en agora_sync_log tras cada intento de sincronización.
 */
export interface AgoraSyncLogEntry {
  empresa_id: string;
  status: AgoraSyncStatus;
  total_records: number;
  ok_records: number;
  error_records: number;
  retry_count: number;
  error_detail?: AgoraRegistroError[] | null;
  created_by?: string | null;
}

// ─── FUNCIÓN DE VALIDACIÓN EN LOTE ────────────────────────────────────────────

/**
 * Valida un array de registros crudos de Ágora.
 * Retorna válidos e inválidos por separado (nunca lanza excepción).
 *
 * @example
 * const { validos, errores } = validarLoteAgora(registrosCrudos);
 * // errores se guardan en agora_sync_log, validos van al upsert
 */
export function validarLoteAgora(registros: unknown[]): AgoraBatchResult {
  const validos: AgoraVentaValidada[] = [];
  const errores: AgoraRegistroError[] = [];

  for (const registro of registros) {
    const result = agoraVentaValidadaSchema.safeParse(registro);
    if (result.success) {
      validos.push(result.data);
    } else {
      const primerError = result.error.issues[0];
      errores.push({
        registro,
        motivo: primerError?.message ?? "Validación fallida",
        campo: primerError?.path.join("."),
      });
    }
  }

  return { validos, errores };
}
