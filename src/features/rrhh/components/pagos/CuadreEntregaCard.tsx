"use client";

/**
 * El cuadre de la entrega mensual de la gestoría, en una tarjeta de esquina.
 *
 * La entrega de un mes son DOS documentos que se revisan por separado, y cada uno
 * cuadra contra las nóminas de SU mes:
 *
 *   NÓMINAS          → las del mes que se está viendo.
 *   SEGUROS SOCIALES → el recibo de cotizaciones, que cotiza el mes ANTERIOR: la
 *                      Seguridad Social se liquida a mes vencido, así que con las
 *                      nóminas de julio llega el recibo de junio. Compararlo con
 *                      julio daría un descuadre que no existe.
 *
 * Los dos importes se enseñan SIEMPRE, cuadren o no: lo que dice el sistema
 * (las nóminas volcadas) frente a lo que dice el papel de la gestoría. Ver los
 * dos números es lo que permite aprobar con criterio, y no solo un tick.
 *
 * La tarjeta se pinta en todos los meses, incluso vacíos: si desapareciera cuando
 * no hay nada, no habría forma de ver de un vistazo que falta una entrega.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import type { HistoricoEntrada } from "@/features/rrhh/actions/nominas-aprobacion-actions";
import { HistoricoEntrega } from "./HistoricoEntrega";

/** Un bloque de la tarjeta, ya resuelto por quien la usa. */
export interface BloqueCuadre {
  clave: "nominas" | "seguros";
  titulo: string;
  /** Mes al que se refiere ESTE bloque (AAAA-MM), que no siempre es el que se ve. */
  periodo: string;
  /** "julio 2026" */
  mesLabel: string;
  /** Lo que dice el sistema. `null` = todavía no hay nóminas de ese mes. */
  sistema: number | null;
  /** Lo que dice el documento de la gestoría. `null` = no entregado o ilegible. */
  gestoria: number | null;
  aprobadoEn: string | null;
  rechazadoEn: string | null;
  /** Quién aprobó, ya resuelto a nombre. */
  aprobadoPor: string | null;
  /** Aclaración bajo las cifras: qué falta, o por qué no se puede comprobar. */
  nota: string | null;
  /** Sin permiso, la tarjeta informa pero no deja actuar. */
  puedeGestionar: boolean;
}

interface Props {
  bloques: BloqueCuadre[];
  /** Mes que se está viendo: el histórico es de él. */
  periodo: string;
  onAprobar: (clave: BloqueCuadre["clave"]) => void;
  onRechazar: (clave: BloqueCuadre["clave"]) => void;
  onReabrir: (clave: BloqueCuadre["clave"]) => void;
  /** Abre el diálogo de documentos del mes. */
  onVerDocumentos: () => void;
  /** En marcha ahora mismo (bloquea los botones de ese bloque). */
  ocupado: BloqueCuadre["clave"] | null;
  cargarHistorico: () => Promise<HistoricoEntrada[]>;
}

function fmt(n: number): string {
  return (
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
  );
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CuadreEntregaCard({
  bloques,
  periodo,
  onAprobar,
  onRechazar,
  onReabrir,
  onVerDocumentos,
  ocupado,
  cargarHistorico,
}: Props) {
  const [verHistorico, setVerHistorico] = useState(false);

  return (
    <div className="w-full sm:w-[420px] sm:shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden">
      {bloques.map((b, i) => (
        <Bloque
          key={b.clave}
          b={b}
          primero={i === 0}
          ocupado={ocupado === b.clave}
          onAprobar={() => onAprobar(b.clave)}
          onRechazar={() => onRechazar(b.clave)}
          onReabrir={() => onReabrir(b.clave)}
          onVerDocumentos={onVerDocumentos}
        />
      ))}

      {/* Todo lo que le ha pasado al mes. Va plegado: es consulta, no algo que
          haya que mirar cada día. */}
      <button
        type="button"
        onClick={() => setVerHistorico((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", verHistorico && "rotate-180")} />
        Ver histórico
      </button>

      {verHistorico && <HistoricoEntrega periodo={periodo} cargar={cargarHistorico} />}
    </div>
  );
}

function Bloque({
  b,
  primero,
  ocupado,
  onAprobar,
  onRechazar,
  onReabrir,
  onVerDocumentos,
}: {
  b: BloqueCuadre;
  primero: boolean;
  ocupado: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
  onReabrir: () => void;
  onVerDocumentos: () => void;
}) {
  // Al céntimo, igual que el cuadre del servidor: en dinero no hay holgura.
  const hayDatos = b.sistema != null && b.gestoria != null;
  const cuadra = hayDatos && Math.abs((b.sistema ?? 0) - (b.gestoria ?? 0)) < 0.005;
  const diferencia = hayDatos ? Math.abs((b.sistema ?? 0) - (b.gestoria ?? 0)) : null;
  const resuelto = b.aprobadoEn != null || b.rechazadoEn != null;

  return (
    <div className={cn("p-3.5", !primero && "border-t")}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-xs font-semibold uppercase tracking-wide">{b.titulo}</span>
          <span className="shrink-0 text-xs text-muted-foreground">· {b.mesLabel}</span>
        </div>
        <Estado b={b} cuadra={cuadra} hayDatos={hayDatos} diferencia={diferencia} />
      </div>

      {/* Los DOS importes, siempre: es la comparación lo que se aprueba. */}
      <div className="mb-2.5 flex items-end gap-4">
        <Cifra etiqueta="Sistema" valor={b.sistema} />
        <span className="pb-1 text-[11px] text-muted-foreground">frente a</span>
        <Cifra etiqueta="Gestoría" valor={b.gestoria} mal={hayDatos && !cuadra} />
      </div>

      <div className="flex items-center gap-2">
        {b.aprobadoEn ? (
          <>
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              <b className="font-semibold text-emerald-600">Aprobado</b> · {fmtFecha(b.aprobadoEn)}
              {b.aprobadoPor ? ` por ${b.aprobadoPor}` : ""}
            </p>
            {b.puedeGestionar && (
              <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={onReabrir} disabled={ocupado}>
                {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reabrir"}
              </Button>
            )}
          </>
        ) : b.rechazadoEn ? (
          <p className="text-xs text-muted-foreground">
            <b className="font-semibold text-destructive">Devuelto</b> · {fmtFecha(b.rechazadoEn)},
            esperando la corrección
          </p>
        ) : (
          <>
            <Button
              size="sm"
              className="h-8 flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onAprobar}
              disabled={!hayDatos || !b.puedeGestionar || ocupado}
              title={!hayDatos ? "Falta el documento de la gestoría" : undefined}
            >
              {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aprobar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={onRechazar}
              disabled={!hayDatos || !b.puedeGestionar || ocupado}
            >
              Rechazar
            </Button>
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={onVerDocumentos}>
              {hayDatos ? "Ver" : "Subir"}
            </Button>
          </>
        )}
      </div>

      {b.nota && !resuelto && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{b.nota}</p>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor, mal }: { etiqueta: string; valor: number | null; mal?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{etiqueta}</p>
      <p className={cn("whitespace-nowrap text-base font-semibold tabular-nums", mal && "text-destructive")}>
        {valor == null ? "—" : fmt(valor)}
      </p>
    </div>
  );
}

/** Píldora de estado: manda lo ya decidido; si no, lo que dice el cuadre. */
function Estado({
  b,
  cuadra,
  hayDatos,
  diferencia,
}: {
  b: BloqueCuadre;
  cuadra: boolean;
  hayDatos: boolean;
  diferencia: number | null;
}) {
  const base =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold";

  if (b.aprobadoEn) {
    return (
      <span className={cn(base, "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400")}>
        <CheckCircle2 className="h-3 w-3" /> Aprobado
      </span>
    );
  }
  if (b.rechazadoEn) {
    return (
      <span className={cn(base, "border-destructive/40 bg-destructive/5 text-destructive")}>
        <XCircle className="h-3 w-3" /> Devuelto
      </span>
    );
  }
  if (!hayDatos) {
    return (
      <span className={cn(base, "border-border text-muted-foreground")}>
        <AlertTriangle className="h-3 w-3" /> Sin documento
      </span>
    );
  }
  if (cuadra) {
    return (
      <span className={cn(base, "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400")}>
        <CheckCircle2 className="h-3 w-3" /> Cuadra
      </span>
    );
  }
  return (
    <span className={cn(base, "border-destructive/40 bg-destructive/5 text-destructive")}>
      <XCircle className="h-3 w-3" /> {diferencia != null ? fmt(diferencia) : "Descuadre"}
    </span>
  );
}
