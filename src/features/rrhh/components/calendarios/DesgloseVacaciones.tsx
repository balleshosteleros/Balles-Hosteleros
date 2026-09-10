"use client";

/**
 * Desglose del cupo de vacaciones de un empleado.
 *
 * Lo ven las dos partes con los mismos números: el empleado al pedir vacaciones
 * y RRHH en la ficha. Por eso vive aquí y no dentro de una de las dos pantallas.
 *
 * Se enseñan cuatro cifras porque responden a preguntas distintas:
 *   - Disfrutados: lo que ya se ha cogido.
 *   - Aprobados: concedidos y aún por disfrutar. Turno ya comprometido.
 *   - Por aprobar: solicitados sin respuesta. Todavía se pueden denegar.
 *   - Restantes: lo que aún puede pedir.
 *
 * El total va en la cabecera, no como una quinta caja: es el marco, no otro
 * estado más.
 */

import { Banknote, CalendarX, Plane } from "lucide-react";
import type { MovimientoVacaciones } from "@/features/rrhh/actions/calendarios-vacaciones-actions";

interface Props {
  anio: number;
  /**
   * Movimientos del año: qué le ha restado días y por qué. Si no se pasan, el
   * desglose se comporta como siempre y no aparece el desplegable.
   */
  movimientos?: MovimientoVacaciones[];
  esPredeterminado?: boolean;
  diasTotales: number;
  diasDisfrutados: number;
  diasAprobadosPendientes: number;
  diasPendientesAprobacion: number;
  diasRestantes: number;
  /** Días cogidos por encima del cupo. Si hay, se avisa en rojo. */
  diasExcedidos?: number;
  /** `sm` para el modal del empleado; `md` para la ficha de RRHH. */
  tamano?: "sm" | "md";
}

export function DesgloseVacaciones({
  anio,
  movimientos,
  esPredeterminado = false,
  diasTotales,
  diasDisfrutados,
  diasAprobadosPendientes,
  diasPendientesAprobacion,
  diasRestantes,
  diasExcedidos = 0,
  tamano = "sm",
}: Props) {
  const numero = tamano === "sm" ? "text-base" : "text-lg";
  const etiqueta = tamano === "sm" ? "text-[11px]" : "text-xs";

  const cajas = [
    { valor: diasDisfrutados, label: "Disfrutados", color: "text-foreground" },
    { valor: diasAprobadosPendientes, label: "Aprobados", color: "text-sky-600" },
    { valor: diasPendientesAprobacion, label: "Por aprobar", color: "text-amber-600" },
    diasExcedidos > 0
      ? { valor: -diasExcedidos, label: "De más", color: "text-rose-600" }
      : { valor: diasRestantes, label: "Restantes", color: "text-emerald-600" },
  ];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <p className={`${etiqueta} text-muted-foreground text-center`}>
        {esPredeterminado ? "Cupo anual" : `Cupo ${anio}`}:{" "}
        <span className="font-semibold text-foreground">{diasTotales}</span> días
      </p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {cajas.map((c) => (
          <div key={c.label}>
            <p className={`${numero} font-semibold ${c.color}`}>{c.valor}</p>
            <p className={`${etiqueta} text-muted-foreground`}>{c.label}</p>
          </div>
        ))}
      </div>
      {diasExcedidos > 0 && (
        <p className={`${etiqueta} text-center text-rose-600`}>
          Ha disfrutado {diasExcedidos} {diasExcedidos === 1 ? "día más" : "días más"} de los que le
          corresponden este año.
        </p>
      )}
      {diasAprobadosPendientes > 0 && (
        <p className={`${etiqueta} text-muted-foreground text-center`}>
          «Aprobados» son días ya concedidos que todavía no se han disfrutado.
        </p>
      )}

      {/* Histórico: por qué el cupo ya no está entero. Plegado por defecto —
          quien mira el desglose quiere el número; el detalle solo si lo pide. */}
      {movimientos && movimientos.length > 0 && (
        <details className="group">
          <summary
            className={`${etiqueta} cursor-pointer list-none text-center text-muted-foreground hover:text-foreground`}
          >
            <span className="underline underline-offset-2">
              Ver los {movimientos.length} movimientos del año
            </span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {movimientos.map((m, i) => (
              <li key={`${m.fecha}-${i}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {m.tipo === "liquidadas" ? (
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                  ) : m.tipo === "caducadas" ? (
                    <CalendarX className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Plane className="h-3.5 w-3.5 text-sky-600" />
                  )}
                </span>
                <span className={`${etiqueta} flex-1 text-muted-foreground`}>{m.detalle}</span>
                <span className={`${etiqueta} shrink-0 font-semibold text-foreground`}>
                  −{m.dias} {m.dias === 1 ? "día" : "días"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
