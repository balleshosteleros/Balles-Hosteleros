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

interface Props {
  anio: number;
  esPredeterminado?: boolean;
  diasTotales: number;
  diasDisfrutados: number;
  diasAprobadosPendientes: number;
  diasPendientesAprobacion: number;
  diasRestantes: number;
  /** `sm` para el modal del empleado; `md` para la ficha de RRHH. */
  tamano?: "sm" | "md";
}

export function DesgloseVacaciones({
  anio,
  esPredeterminado = false,
  diasTotales,
  diasDisfrutados,
  diasAprobadosPendientes,
  diasPendientesAprobacion,
  diasRestantes,
  tamano = "sm",
}: Props) {
  const numero = tamano === "sm" ? "text-base" : "text-lg";
  const etiqueta = tamano === "sm" ? "text-[11px]" : "text-xs";

  const cajas = [
    { valor: diasDisfrutados, label: "Disfrutados", color: "text-foreground" },
    { valor: diasAprobadosPendientes, label: "Aprobados", color: "text-sky-600" },
    { valor: diasPendientesAprobacion, label: "Por aprobar", color: "text-amber-600" },
    { valor: diasRestantes, label: "Restantes", color: "text-emerald-600" },
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
      {diasAprobadosPendientes > 0 && (
        <p className={`${etiqueta} text-muted-foreground text-center`}>
          «Aprobados» son días ya concedidos que todavía no se han disfrutado.
        </p>
      )}
    </div>
  );
}
