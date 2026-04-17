/**
 * Validación de cuadre: compara las casillas calculadas del modelo
 * con los totales brutos de las facturas de ese periodo.
 * Alerta si hay desviación > 1 céntimo (tolerancia por redondeo).
 */
import type { CasillasMap, FacturaParaModelo, ModeloTipo } from "../types/modelos";

export interface ResultadoCuadre {
  cuadra: boolean;
  diferencia: number;
  mensaje: string;
  nivel: "ok" | "aviso" | "error";
  detalles: Array<{ concepto: string; casillas: number; facturas: number; diff: number }>;
}

const TOLERANCIA = 0.02;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validarCuadre(
  tipo: ModeloTipo,
  casillas: CasillasMap,
  facturas: FacturaParaModelo[],
): ResultadoCuadre {
  const detalles: ResultadoCuadre["detalles"] = [];

  if (tipo === "303") {
    const ivaRepercutidoFact = round2(
      facturas
        .filter((f) => f.tipo === "VENTA")
        .reduce((acc, f) => acc + f.iva_importe * (f.tipo_factura === "rectificativa" ? -1 : 1), 0),
    );
    const ivaRepercutidoCas = round2(
      (casillas["03"] ?? 0) + (casillas["06"] ?? 0) + (casillas["09"] ?? 0),
    );
    detalles.push({
      concepto: "IVA repercutido",
      facturas: ivaRepercutidoFact,
      casillas: ivaRepercutidoCas,
      diff: round2(ivaRepercutidoFact - ivaRepercutidoCas),
    });

    const baseRepercutidoFact = round2(
      facturas
        .filter((f) => f.tipo === "VENTA")
        .reduce((acc, f) => acc + f.base_imponible * (f.tipo_factura === "rectificativa" ? -1 : 1), 0),
    );
    const baseRepercutidoCas = round2(
      (casillas["01"] ?? 0) + (casillas["04"] ?? 0) + (casillas["07"] ?? 0),
    );
    detalles.push({
      concepto: "Base imponible ventas",
      facturas: baseRepercutidoFact,
      casillas: baseRepercutidoCas,
      diff: round2(baseRepercutidoFact - baseRepercutidoCas),
    });
  }

  if (tipo === "130") {
    const ingresosFact = round2(
      facturas
        .filter((f) => f.tipo === "VENTA")
        .reduce((acc, f) => acc + f.base_imponible, 0),
    );
    detalles.push({
      concepto: "Ingresos",
      facturas: ingresosFact,
      casillas: casillas["01"] ?? 0,
      diff: round2(ingresosFact - (casillas["01"] ?? 0)),
    });

    const gastosFact = round2(
      facturas
        .filter((f) => f.tipo === "COMPRA")
        .reduce((acc, f) => acc + f.base_imponible, 0),
    );
    detalles.push({
      concepto: "Gastos",
      facturas: gastosFact,
      casillas: casillas["02"] ?? 0,
      diff: round2(gastosFact - (casillas["02"] ?? 0)),
    });
  }

  const maxDiff = detalles.reduce((m, d) => Math.max(m, Math.abs(d.diff)), 0);
  const cuadra = maxDiff < TOLERANCIA;
  const nivel: ResultadoCuadre["nivel"] =
    cuadra ? "ok" : maxDiff < 10 ? "aviso" : "error";

  const mensaje = cuadra
    ? "✓ Cuadre correcto con facturas"
    : `Desviación máxima: ${maxDiff.toFixed(2)} €`;

  return { cuadra, diferencia: maxDiff, mensaje, nivel, detalles };
}
