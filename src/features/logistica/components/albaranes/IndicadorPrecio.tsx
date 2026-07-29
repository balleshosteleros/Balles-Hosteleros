"use client";

/**
 * Indicador de variación de precio para el asistente de verificación de albaranes.
 * Compara el precio LEÍDO en el albarán contra el precio VIGENTE del producto en el
 * catálogo y muestra una flecha (decisión de Iván, 2026-07-29):
 *   - 🔻 flecha AMARILLA hacia abajo → el precio BAJÓ respecto al registrado.
 *   - 🔺 flecha ROJA hacia arriba    → el precio está MÁS CARO.
 *   - ↔️ flecha VERDE doble-punta    → el precio coincide (correcto).
 * Si no hay precio previo con el que comparar, no muestra nada (no inventa señal).
 */

import { ArrowDown, ArrowUp, MoveHorizontal } from "lucide-react";
import { formatNumero } from "@/shared/lib/numero";

export type VariacionPrecio = "baja" | "sube" | "igual" | "sin_referencia";

// Margen para considerar "igual": 1 céntimo o 0,5 % (mismo criterio que el matcher de
// facturas), para no marcar como cambio un redondeo.
const TOL_ABS = 0.01;
const TOL_PCT = 0.005;

export function clasificarVariacion(
  precioLeido: number | null | undefined,
  precioVigente: number | null | undefined,
): VariacionPrecio {
  if (
    precioLeido == null ||
    precioVigente == null ||
    !Number.isFinite(precioLeido) ||
    !Number.isFinite(precioVigente) ||
    precioVigente <= 0
  ) {
    return "sin_referencia";
  }
  const abs = Math.abs(precioLeido - precioVigente);
  const pct = abs / precioVigente;
  if (abs <= TOL_ABS || pct <= TOL_PCT) return "igual";
  return precioLeido < precioVigente ? "baja" : "sube";
}

function fmtEur(n: number): string {
  return `${formatNumero(n, { min: 2, max: 4 })} €`;
}

export function IndicadorPrecio({
  precioLeido,
  precioVigente,
  className = "",
}: {
  precioLeido: number | null | undefined;
  precioVigente: number | null | undefined;
  className?: string;
}) {
  const variacion = clasificarVariacion(precioLeido, precioVigente);
  if (variacion === "sin_referencia") return null;

  const titulo =
    precioVigente != null
      ? `Precio registrado: ${fmtEur(precioVigente)}`
      : undefined;

  if (variacion === "igual") {
    return (
      <span title={titulo ? `${titulo} — correcto` : "Precio correcto"} className="inline-flex">
        <MoveHorizontal
          className={`h-4 w-4 text-emerald-600 ${className}`}
          aria-label="Precio correcto (sin cambios)"
        />
      </span>
    );
  }
  if (variacion === "baja") {
    return (
      <span title={titulo ? `${titulo} — ha bajado` : "El precio ha bajado"} className="inline-flex">
        <ArrowDown
          className={`h-4 w-4 text-amber-500 ${className}`}
          aria-label="El precio ha bajado respecto al registrado"
        />
      </span>
    );
  }
  // sube
  return (
    <span title={titulo ? `${titulo} — más caro` : "El precio está más caro"} className="inline-flex">
      <ArrowUp
        className={`h-4 w-4 text-rose-600 ${className}`}
        aria-label="El precio está más caro que el registrado"
      />
    </span>
  );
}
