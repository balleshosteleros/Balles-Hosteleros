/**
 * Motor de cálculo puro del Modelo 347 (Operaciones con terceros > 3.005,06 €/año).
 * Agrupa por contacto. Separa por trimestre + total anual.
 */
import type { FacturaParaModelo } from "../types/modelos";
import { UMBRAL_MODELO_347 } from "../types/modelos";
import { claveOperacion347DesdeFactura, type ClaveOperacion347 } from "../data/epigrafes-347";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Registro347 {
  contacto_id: string;
  nif: string;
  nombre: string;
  tipo_contacto: "EMPRESA" | "AUTONOMO" | "PARTICULAR";
  clave: ClaveOperacion347;
  importe_t1: number;
  importe_t2: number;
  importe_t3: number;
  importe_t4: number;
  importe_total: number;
}

export interface Calcular347Input {
  facturas: FacturaParaModelo[];
  excluirContactosDe111?: Set<string>;
  excluirContactosDe115?: Set<string>;
}

function trimestreDeFecha(fecha: string): "t1" | "t2" | "t3" | "t4" {
  const mes = Number.parseInt(fecha.slice(5, 7), 10);
  if (mes <= 3) return "t1";
  if (mes <= 6) return "t2";
  if (mes <= 9) return "t3";
  return "t4";
}

export function calcular347(input: Calcular347Input): Registro347[] {
  const { facturas, excluirContactosDe111, excluirContactosDe115 } = input;
  const acumulado = new Map<string, Registro347>();

  for (const f of facturas) {
    if (!f.contacto_id || !f.contacto_documento) continue;
    if (excluirContactosDe111?.has(f.contacto_id)) continue;
    if (excluirContactosDe115?.has(f.contacto_id)) continue;

    const clave = claveOperacion347DesdeFactura(f.tipo);
    const k = `${f.contacto_id}|${clave}`;
    const registro =
      acumulado.get(k) ??
      ({
        contacto_id: f.contacto_id,
        nif: f.contacto_documento,
        nombre: f.contacto_nombre ?? "",
        tipo_contacto: f.contacto_tipo ?? "EMPRESA",
        clave,
        importe_t1: 0,
        importe_t2: 0,
        importe_t3: 0,
        importe_t4: 0,
        importe_total: 0,
      } as Registro347);

    const importeConIva = f.total;
    const trimestre = trimestreDeFecha(f.fecha_emision);
    registro[`importe_${trimestre}` as "importe_t1"] += importeConIva;
    registro.importe_total += importeConIva;

    acumulado.set(k, registro);
  }

  return Array.from(acumulado.values())
    .map((r) => ({
      ...r,
      importe_t1: round2(r.importe_t1),
      importe_t2: round2(r.importe_t2),
      importe_t3: round2(r.importe_t3),
      importe_t4: round2(r.importe_t4),
      importe_total: round2(r.importe_total),
    }))
    .filter((r) => Math.abs(r.importe_total) >= UMBRAL_MODELO_347)
    .sort((a, b) => b.importe_total - a.importe_total);
}
