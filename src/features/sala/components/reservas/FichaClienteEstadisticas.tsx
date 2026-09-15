"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/shared/components/ui/hover-card";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { formatNumero } from "@/shared/lib/numero";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  ESTADO_RESERVA_LABELS,
  type ClienteInsightReserva,
  type ClienteInsightValoracion,
  type ClienteInsights,
} from "@/features/sala/data/reservas";

/**
 * Las cifras del cliente en su ficha: cuántas veces ha reservado, cuántas ha
 * venido, cuántas falló y qué ha puntuado.
 *
 * Cada cifra ABRE un desplegable al pasar el ratón con el detalle que hay
 * detrás: las reservas concretas (día, hora y personas) o, en valoraciones,
 * cuándo la dejó y con qué nota media. Un número suelto no dice si el cliente
 * canceló hace dos años o la semana pasada, y eso es justo lo que decide en
 * el momento si se le guarda la mesa.
 */
export function FichaClienteEstadisticas({
  insights,
  zonaHoraria,
}: {
  insights: ClienteInsights | null;
  zonaHoraria: string | null | undefined;
}) {
  const d = insights?.detalle;

  const celdas: Array<{
    label: string;
    valor: string;
    /** Filas del desplegable. Vacío = no hay nada que enseñar. */
    filas: ClienteInsightReserva[];
    valoraciones?: ClienteInsightValoracion[];
    vacio: string;
  }> = [
    // "Reservas" va primero: es el total del que salen las demás cifras.
    // Visitas son las que cumplió; no-shows y canceladas, las que no.
    {
      label: "Reservas",
      valor: String(insights?.reservasTotal ?? 0),
      filas: d?.reservas ?? [],
      vacio: "Todavía no ha reservado.",
    },
    {
      label: "Visitas",
      valor: String(insights?.visitasTotal ?? 0),
      filas: d?.visitas ?? [],
      vacio: "Todavía no ha venido.",
    },
    {
      label: "No shows",
      valor: String(insights?.noShows ?? 0),
      filas: d?.noShows ?? [],
      vacio: "No ha faltado nunca.",
    },
    {
      label: "Canceladas",
      valor: String(insights?.canceladas ?? 0),
      filas: d?.canceladas ?? [],
      vacio: "No ha cancelado nunca.",
    },
    {
      label: "Valoraciones",
      valor: String(insights?.visitasConValoracion ?? 0),
      filas: [],
      valoraciones: d?.valoraciones ?? [],
      vacio: "Todavía no ha valorado.",
    },
  ];

  return (
    // Mide lo justo: esta tira va enfrentada al desplegable de Estado de la
    // otra columna, y cuando abultaba más que él las dos fichas dejaban de ir
    // renglón con renglón y el nombre del cliente caía por debajo de la fecha.
    <div className="grid grid-cols-5 gap-1 rounded-md border bg-muted/30 px-1.5 py-1">
      {celdas.map((c) => (
        <HoverCard key={c.label} openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>
            <div className="cursor-default rounded-sm px-0.5 py-0.5 text-center transition-colors hover:bg-muted">
              <div className="text-sm font-semibold leading-none">{c.valor}</div>
              <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{c.label}</div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent align="center" className="w-64 p-2.5">
            <div className="mb-1.5 text-[11px] font-semibold">{c.label}</div>
            {c.valoraciones ? (
              <ListaValoraciones filas={c.valoraciones} vacio={c.vacio} zonaHoraria={zonaHoraria} />
            ) : (
              <ListaReservas filas={c.filas} vacio={c.vacio} />
            )}
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  );
}

/** Día, hora y personas de cada reserva. Lo mínimo para reconocerla. */
function ListaReservas({
  filas,
  vacio,
}: {
  filas: ClienteInsightReserva[];
  vacio: string;
}) {
  if (filas.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{vacio}</p>;
  }
  return (
    <ul className="space-y-1">
      {filas.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="tabular-nums">
            {formatearFechaEs(r.fecha)}
            {r.hora ? ` · ${r.hora}` : ""}
          </span>
          <span className="text-muted-foreground">
            {r.personas} p · {ESTADO_RESERVA_LABELS[r.estado] ?? r.estado}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Cuándo valoró y con qué nota media (media de comida, servicio y ambiente). */
function ListaValoraciones({
  filas,
  vacio,
  zonaHoraria,
}: {
  filas: ClienteInsightValoracion[];
  vacio: string;
  zonaHoraria: string | null | undefined;
}) {
  if (filas.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{vacio}</p>;
  }
  return (
    <ul className="space-y-1">
      {filas.map((v) => (
        <li key={v.id} className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="tabular-nums">
            {/* Instante (`timestamptz`): se pasa por la zona de la empresa, no
                se recorta el ISO, que tomaría el día en UTC. */}
            {formatFechaEnZona(v.fecha, zonaHoraria) || "Sin fecha"}
          </span>
          <span className="font-medium tabular-nums">
            {v.nota === null ? "Sin nota" : `${formatNumero(v.nota, { max: 1 })} / 5`}
          </span>
        </li>
      ))}
    </ul>
  );
}
