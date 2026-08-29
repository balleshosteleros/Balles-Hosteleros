import "server-only";

/**
 * TOPE DE GASTO DE IA — freno de mano del consumo mensual.
 *
 * Existe porque la cuenta de Google NO se para sola: el crédito cargado no es
 * un monedero que se vacía, es una cuenta de facturación. Si el consumo lo
 * supera, Google lo cobra a la tarjeta. Un bucle, una subida masiva de
 * documentos o una integración mal configurada podrían gastar sin techo y sin
 * que nadie se entere hasta la factura.
 *
 * Cómo funciona:
 *  1. Cada llamada a la IA apunta sus tokens en `ia_uso_log` (lo hace
 *     `registrarConsumo`, llamado desde el cliente de Gemini).
 *  2. Antes de cada llamada se suma lo gastado en el MES EN CURSO y se compara
 *     con el tope (`IA_TOPE_EUROS_MES`, 5 € por defecto).
 *  3. Al 80% se avisa una sola vez. Al 100% se corta: la IA deja de responder
 *     con un mensaje claro, no con un error técnico.
 *
 * El gasto se calcula con las tarifas de abajo, no lo dice Google: es una
 * estimación deliberadamente CONSERVADORA (redondea hacia arriba) para que el
 * freno salte antes que la factura real, nunca después.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Tope mensual en euros. Configurable sin tocar código. */
export const TOPE_EUROS_MES = Number(process.env.IA_TOPE_EUROS_MES ?? "5");

/** Fracción a la que se avisa (0,8 = 80% del tope). */
const UMBRAL_AVISO = 0.8;

/**
 * Tarifas por MILLÓN de tokens, en dólares (precios públicos de Google).
 * Se pasan a euros con un cambio fijo y conservador.
 *
 * Si un modelo no está aquí, se cobra con la tarifa MÁS CARA de la tabla: es
 * preferible frenar de más que dejar pasar un modelo nuevo sin control.
 */
const TARIFAS: Record<string, { entrada: number; salida: number }> = {
  "gemini-3.1-flash-lite": { entrada: 0.1, salida: 0.4 },
  "gemini-3.7-flash": { entrada: 0.3, salida: 2.5 },
  "gemini-3.5-flash": { entrada: 0.3, salida: 2.5 },
  "gemini-2.5-flash": { entrada: 0.3, salida: 2.5 },
  "gemini-2.5-pro": { entrada: 1.25, salida: 10.0 },
  "gemini-3.1-pro-preview": { entrada: 1.25, salida: 10.0 },
};

/** Cambio USD→EUR fijo, al alza: preferimos sobrestimar el gasto. */
const USD_A_EUR = 0.95;

/** Coste en euros de una llamada, según su modelo y tokens. */
export function costeEuros(
  modelo: string,
  tokensEntrada: number,
  tokensSalida: number,
): number {
  const masCara = Object.values(TARIFAS).reduce((a, b) =>
    a.salida > b.salida ? a : b,
  );
  const t = TARIFAS[modelo] ?? masCara;
  const usd =
    (tokensEntrada / 1_000_000) * t.entrada + (tokensSalida / 1_000_000) * t.salida;
  return usd * USD_A_EUR;
}

/** Primer día del mes en curso, en UTC (la BD guarda en UTC). */
function inicioDeMes(): string {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();
}

export interface EstadoPresupuesto {
  /** Euros consumidos en lo que va de mes. */
  gastado: number;
  /** Tope mensual vigente. */
  tope: number;
  /** true cuando ya no se puede gastar más. */
  agotado: boolean;
  /** true a partir del 80% del tope. */
  enAviso: boolean;
}

/**
 * Cuánto se lleva gastado este mes.
 *
 * Ante cualquier fallo de lectura devuelve gasto 0 (no agotado): un problema de
 * base de datos no puede dejar el software sin IA. El tope protege del gasto
 * descontrolado, no es un mecanismo de seguridad.
 */
export async function estadoPresupuesto(): Promise<EstadoPresupuesto> {
  const base: EstadoPresupuesto = {
    gastado: 0,
    tope: TOPE_EUROS_MES,
    agotado: false,
    enAviso: false,
  };
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ia_uso_log")
      .select("modelo, tokens_input, tokens_output")
      .gte("created_at", inicioDeMes())
      .not("modelo", "is", null);
    if (error || !data) return base;

    const gastado = data.reduce(
      (suma, fila) =>
        suma +
        costeEuros(
          (fila as { modelo: string }).modelo,
          (fila as { tokens_input: number | null }).tokens_input ?? 0,
          (fila as { tokens_output: number | null }).tokens_output ?? 0,
        ),
      0,
    );

    return {
      gastado,
      tope: TOPE_EUROS_MES,
      agotado: gastado >= TOPE_EUROS_MES,
      enAviso: gastado >= TOPE_EUROS_MES * UMBRAL_AVISO,
    };
  } catch (err) {
    console.error("[ia/presupuesto] no se pudo leer el consumo:", err);
    return base;
  }
}

/**
 * Se lanza cuando el mes ya ha agotado el tope. El mensaje está escrito para
 * enseñarse tal cual al usuario: quien lo vea no es quien configuró el tope.
 */
export class PresupuestoIaAgotadoError extends Error {
  /** Cifras reales del corte: van al aviso interno, NUNCA a la pantalla. */
  readonly gastado: number;
  readonly tope: number;

  constructor(gastado: number, tope: number) {
    // El empleado que se topa con esto no tiene por qué enterarse de cuánto
    // gasta la empresa en IA ni de que existe un límite: para él es un fallo
    // del servicio y punto. El detalle viaja por correo a administración.
    super("No se ha podido completar la operación. Inténtalo de nuevo más tarde.");
    this.name = "PresupuestoIaAgotadoError";
    this.gastado = gastado;
    this.tope = tope;
  }
}

/**
 * Guardián: se llama ANTES de gastar. Si el mes está agotado, corta.
 *
 * Devuelve el estado para que quien llama pueda avisar cuando toca.
 */
export async function comprobarPresupuesto(): Promise<EstadoPresupuesto> {
  const estado = await estadoPresupuesto();
  if (estado.agotado) {
    // El aviso de "detenido" se manda desde aquí y no desde quien llama, para
    // que salga TAMBIÉN cuando el corte ocurre en un proceso de fondo (un OCR
    // nocturno) donde no hay nadie mirando la pantalla. `avisarGastoIa` ya se
    // encarga de mandarlo una sola vez al mes.
    const { avisarGastoIa } = await import("@/lib/ia/aviso-gasto");
    void avisarGastoIa("detenido", estado.gastado, estado.tope);
    throw new PresupuestoIaAgotadoError(estado.gastado, estado.tope);
  }
  return estado;
}

/**
 * Apunta lo que ha costado una llamada. Nunca lanza: si el registro falla, la
 * funcionalidad que pidió la IA no debe romperse por no poder anotar el gasto.
 *
 * `feature` identifica quién gastó ("correo.pulir", "albaranes.ocr"...), para
 * poder ver luego en qué se va el dinero.
 */
export async function registrarConsumo(datos: {
  feature: string;
  modelo: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  empresaId?: string | null;
  error?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("ia_uso_log").insert({
      feature: datos.feature,
      modelo: datos.modelo,
      tokens_input: datos.tokensEntrada ?? 0,
      tokens_output: datos.tokensSalida ?? 0,
      empresa_id: datos.empresaId ?? null,
      error: datos.error ?? null,
    });
  } catch (err) {
    console.error("[ia/presupuesto] no se pudo registrar el consumo:", err);
  }
}
