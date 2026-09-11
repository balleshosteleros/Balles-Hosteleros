"use client";

/**
 * El cuadre de la entrega mensual de la gestoría, en una franja sobre la tabla.
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
 * Va en UNA LÍNEA por documento y ocupa todo el ancho. Antes era una tarjeta alta
 * pegada a la derecha: se comía media pantalla y dejaba un hueco blanco enorme
 * al lado, empujando la tabla —que es lo que se viene a mirar— fuera de la vista.
 *
 * La franja se pinta en todos los meses, incluso vacíos: si desapareciera cuando
 * no hay nada, no habría forma de ver de un vistazo que falta una entrega.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import type { HistoricoEntrada } from "@/features/rrhh/actions/nominas-aprobacion-actions";
import { HistoricoEntrega } from "./HistoricoEntrega";

/** Un bloque de la franja, ya resuelto por quien la usa. */
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
  /** Sin permiso, la franja informa pero no deja actuar. */
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
    <div className="w-full overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Los dos documentos, uno al lado del otro: es la misma entrega. En
          pantalla estrecha se apilan. */}
      <div className="grid grid-cols-1 divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {bloques.map((b) => (
          <Bloque
            key={b.clave}
            b={b}
            ocupado={ocupado === b.clave}
            onAprobar={() => onAprobar(b.clave)}
            onRechazar={() => onRechazar(b.clave)}
            onReabrir={() => onReabrir(b.clave)}
            onVerDocumentos={onVerDocumentos}
          />
        ))}
      </div>

      {/* Todo lo que le ha pasado al mes. Va plegado: es consulta, no algo que
          haya que mirar cada día. */}
      <button
        type="button"
        onClick={() => setVerHistorico((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", verHistorico && "rotate-180")} />
        Ver histórico
      </button>

      {verHistorico && <HistoricoEntrega periodo={periodo} cargar={cargarHistorico} />}
    </div>
  );
}

function Bloque({
  b,
  ocupado,
  onAprobar,
  onRechazar,
  onReabrir,
  onVerDocumentos,
}: {
  b: BloqueCuadre;
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
    <div className="px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide">
            {b.titulo}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">· {b.mesLabel}</span>
        </div>

        <Estado b={b} cuadra={cuadra} hayDatos={hayDatos} diferencia={diferencia} />

        {/* Los DOS importes, siempre: es la comparación lo que se aprueba. */}
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <Cifra etiqueta="Sistema" valor={b.sistema} />
          <span className="text-[11px] text-muted-foreground">frente a</span>
          <Cifra etiqueta="Gestoría" valor={b.gestoria} mal={hayDatos && !cuadra} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {b.aprobadoEn ? (
            <>
              <span className="text-[11px] text-muted-foreground">
                {fmtFecha(b.aprobadoEn)}
                {b.aprobadoPor ? ` · ${b.aprobadoPor}` : ""}
              </span>
              {b.puedeGestionar && (
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onReabrir} disabled={ocupado}>
                  {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reabrir"}
                </Button>
              )}
            </>
          ) : b.rechazadoEn ? (
            <span className="text-[11px] text-muted-foreground">
              {fmtFecha(b.rechazadoEn)} · esperando la corrección
            </span>
          ) : (
            <>
              <Button
                size="sm"
                className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                onClick={onAprobar}
                disabled={!hayDatos || !b.puedeGestionar || ocupado}
                title={!hayDatos ? "Falta el documento de la gestoría" : undefined}
              >
                {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aprobar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={onRechazar}
                disabled={!hayDatos || !b.puedeGestionar || ocupado}
              >
                Rechazar
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onVerDocumentos}>
                {hayDatos ? "Ver" : "Subir"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* La aclaración no puede crecer la franja: una línea, y el resto al pasar
          el ratón por encima. */}
      {b.nota && !resuelto && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={b.nota}>
          {b.nota}
        </p>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor, mal }: { etiqueta: string; valor: number | null; mal?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {etiqueta}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", mal && "text-destructive")}>
        {valor == null ? "—" : fmt(valor)}
      </span>
    </span>
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
