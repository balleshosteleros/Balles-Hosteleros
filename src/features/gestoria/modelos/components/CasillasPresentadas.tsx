"use client";

import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ExternalLink } from "lucide-react";
import type { CasillasMap, ModeloTipo } from "../types/modelos";
import { ModeloPdfButton } from "./ModeloPdfButton";

/**
 * Plantilla de lectura del modelo tal y como se presentó: reproduce los bloques
 * del impreso oficial (devengado / deducible / resultado) con el número de
 * casilla al lado de cada importe, como en el papel de la AEAT.
 *
 * Se usa cuando las casillas vienen del justificante (`casillas_origen` =
 * "gestoria"): NO es un editor ni una propuesta, es el dato presentado. Por eso
 * se muestra en solo lectura y con el sello de verificación (CSV).
 */

interface FilaCasilla {
  casilla: string;
  etiqueta: string;
  /** Resalta la fila como resultado del bloque. */
  total?: boolean;
}

interface BloqueCasillas {
  titulo: string;
  filas: FilaCasilla[];
}

/** Estructura del impreso por tipo de modelo, en el orden del original. */
const BLOQUES_POR_TIPO: Partial<Record<ModeloTipo, BloqueCasillas[]>> = {
  "303": [
    {
      titulo: "IVA devengado · régimen general",
      filas: [
        { casilla: "01", etiqueta: "Base imponible 21 %" },
        { casilla: "03", etiqueta: "Cuota 21 %" },
        { casilla: "04", etiqueta: "Base imponible 10 %" },
        { casilla: "06", etiqueta: "Cuota 10 %" },
        { casilla: "07", etiqueta: "Base imponible 4 %" },
        { casilla: "09", etiqueta: "Cuota 4 %" },
        { casilla: "27", etiqueta: "Total cuota devengada", total: true },
      ],
    },
    {
      titulo: "IVA deducible",
      filas: [
        { casilla: "28", etiqueta: "Base · operaciones interiores corrientes" },
        { casilla: "29", etiqueta: "Cuota · operaciones interiores corrientes" },
        { casilla: "30", etiqueta: "Base · bienes de inversión" },
        { casilla: "31", etiqueta: "Cuota · bienes de inversión" },
        { casilla: "45", etiqueta: "Total a deducir", total: true },
      ],
    },
    {
      titulo: "Resultado",
      filas: [
        { casilla: "46", etiqueta: "Resultado régimen general (27 − 45)" },
        { casilla: "64", etiqueta: "Suma de resultados" },
        { casilla: "110", etiqueta: "Cuotas a compensar pendientes de periodos anteriores" },
        { casilla: "78", etiqueta: "Cuotas a compensar aplicadas en este periodo" },
        { casilla: "87", etiqueta: "Cuotas pendientes para periodos posteriores" },
        { casilla: "69", etiqueta: "Resultado de la autoliquidación" },
        { casilla: "71", etiqueta: "A ingresar", total: true },
        { casilla: "72", etiqueta: "A compensar", total: true },
      ],
    },
  ],
  "111": [
    {
      titulo: "Rendimientos del trabajo",
      filas: [
        { casilla: "02", etiqueta: "N.º de perceptores" },
        { casilla: "01", etiqueta: "Importe de las percepciones" },
        { casilla: "03", etiqueta: "Importe de las retenciones" },
      ],
    },
    {
      titulo: "Actividades económicas",
      filas: [
        { casilla: "08", etiqueta: "N.º de perceptores" },
        { casilla: "07", etiqueta: "Importe de las percepciones" },
        { casilla: "09", etiqueta: "Importe de las retenciones" },
      ],
    },
    {
      titulo: "Liquidación",
      filas: [
        { casilla: "28", etiqueta: "Suma de retenciones e ingresos a cuenta" },
        { casilla: "30", etiqueta: "Resultado a ingresar", total: true },
      ],
    },
  ],
  "115": [
    {
      titulo: "Retenciones por arrendamiento",
      filas: [
        { casilla: "01", etiqueta: "N.º de perceptores" },
        { casilla: "02", etiqueta: "Base de las retenciones" },
        { casilla: "03", etiqueta: "Importe de las retenciones" },
        { casilla: "05", etiqueta: "Resultado a ingresar", total: true },
      ],
    },
  ],
  "390": [
    {
      titulo: "Régimen general",
      filas: [
        { casilla: "33", etiqueta: "Total bases devengadas" },
        { casilla: "34", etiqueta: "Total cuotas devengadas" },
        { casilla: "47", etiqueta: "Total cuotas IVA y recargo de equivalencia", total: true },
      ],
    },
    {
      titulo: "Deducciones y resultado",
      filas: [
        { casilla: "64", etiqueta: "Suma de deducciones" },
        { casilla: "65", etiqueta: "Resultado régimen general (47 − 64)" },
        { casilla: "84", etiqueta: "Suma de resultados" },
        { casilla: "85", etiqueta: "Compensación de cuotas del ejercicio anterior" },
        { casilla: "86", etiqueta: "Resultado de la liquidación", total: true },
      ],
    },
    {
      titulo: "Volumen de operaciones",
      filas: [
        { casilla: "95", etiqueta: "Total resultados a ingresar del ejercicio" },
        { casilla: "97", etiqueta: "A compensar del último periodo" },
        { casilla: "108", etiqueta: "Total volumen de operaciones", total: true },
      ],
    },
  ],
  "347": [
    {
      titulo: "Operaciones con terceros",
      filas: [
        { casilla: "01", etiqueta: "N.º de personas y entidades declaradas" },
        { casilla: "02", etiqueta: "Importe total anual de las operaciones", total: true },
      ],
    },
  ],
  "130": [
    {
      titulo: "Actividades económicas",
      filas: [
        { casilla: "01", etiqueta: "Ingresos computables" },
        { casilla: "02", etiqueta: "Gastos deducibles" },
        { casilla: "03", etiqueta: "Rendimiento neto" },
        { casilla: "07", etiqueta: "Pago fraccionado previo" },
        { casilla: "19", etiqueta: "Resultado a ingresar", total: true },
      ],
    },
  ],
};

/** Casillas que son un recuento de personas, no un importe en euros. */
const CASILLAS_CONTADOR = new Set(["02-111", "08-111", "01-115", "01-347"]);

function formatear(tipo: ModeloTipo, casilla: string, valor: number): string {
  if (CASILLAS_CONTADOR.has(`${casilla}-${tipo}`)) {
    return valor.toLocaleString("es-ES", { maximumFractionDigits: 0 });
  }
  return valor.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

interface Props {
  modeloId: string;
  tipo: ModeloTipo;
  casillas: CasillasMap;
  csvAeat: string | null;
  numeroJustificante: string | null;
  documentoOrigenUrl: string | null;
  tienePdf: boolean;
}

export function CasillasPresentadas({
  modeloId,
  tipo,
  casillas,
  csvAeat,
  numeroJustificante,
  documentoOrigenUrl,
  tienePdf,
}: Props) {
  const bloques = BLOQUES_POR_TIPO[tipo];

  return (
    <div className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <div>
            <h2 className="text-base font-semibold leading-tight">Datos presentados</h2>
            <p className="text-xs text-muted-foreground">
              Leídos del justificante de la AEAT. No se recalculan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {documentoOrigenUrl ? (
            <a
              href={documentoOrigenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
              title="Abrir el documento original"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Original
            </a>
          ) : null}
          <ModeloPdfButton modeloId={modeloId} tienePdf={tienePdf} />
        </div>
      </header>

      {csvAeat || numeroJustificante ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {csvAeat ? (
            <span>
              CSV <span className="font-mono text-foreground">{csvAeat}</span>
            </span>
          ) : null}
          {numeroJustificante ? (
            <span>
              Justificante{" "}
              <span className="font-mono text-foreground">{numeroJustificante}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {!bloques ? (
        <p className="p-4 text-sm text-muted-foreground">
          Este documento se guarda como archivo: no tiene casillas que mostrar.
        </p>
      ) : (
        <div className="divide-y">
          {bloques.map((bloque) => {
            const filas = bloque.filas.filter((f) => casillas[f.casilla] !== undefined);
            if (filas.length === 0) return null;
            return (
              <section key={bloque.titulo} className="p-4">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {bloque.titulo}
                </h3>
                <dl className="space-y-1">
                  {filas.map((f) => (
                    <div
                      key={f.casilla}
                      className={`flex items-baseline justify-between gap-3 rounded px-2 py-1.5 ${
                        f.total ? "bg-muted font-semibold" : ""
                      }`}
                    >
                      <dt className="flex min-w-0 items-baseline gap-2 text-sm">
                        <span className="shrink-0 rounded border bg-background px-1.5 font-mono text-[11px] font-bold">
                          {f.casilla}
                        </span>
                        <span className="truncate">{f.etiqueta}</span>
                      </dt>
                      <dd className="shrink-0 font-mono text-sm tabular-nums">
                        {formatear(tipo, f.casilla, casillas[f.casilla])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
          {Object.keys(casillas).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No se pudieron leer las casillas de este justificante. El documento sigue
              disponible arriba.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
