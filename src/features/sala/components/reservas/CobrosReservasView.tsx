"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListadoReservasPanel } from "@/features/sala/components/ListadoReservasPanel";

/**
 * Vista de dinero de Reservas: políticas de cancelación, garantías y tickets.
 *
 * Es la misma tabla del listado de Analítica, pero abierta por el dinero: llega
 * con las columnas de cobro desplegadas y con las compras de ticket sin canjear
 * ya incluidas, porque son dinero cobrado que todavía nadie ha consumido.
 *
 * No inventa datos ni cobra nada: enseña lo que el sistema de cobros (PRP-082)
 * ya ha ido dejando en cada reserva. Cobrar o perdonar se sigue haciendo desde
 * la ficha de la reserva, donde está el contexto para decidir.
 */

/** Periodos que se pueden mirar. El rango se calcula al vuelo, no se guarda. */
type Periodo = "mes" | "trimestre" | "anio" | "anioAnterior" | "todo";

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: "mes", label: "Este mes" },
  { valor: "trimestre", label: "Últimos 3 meses" },
  { valor: "anio", label: "Este año" },
  { valor: "anioAnterior", label: "Año pasado" },
  { valor: "todo", label: "Todo" },
];

/** Fecha local a ISO (YYYY-MM-DD), sin pasar por UTC. */
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/**
 * Rango del periodo elegido.
 *
 * "Todo" arranca en 2020: antes de esa fecha no hay reservas en el sistema, y
 * poner un tope concreto evita pedirle a la base de datos un rango infinito.
 */
function rangoDe(periodo: Periodo): { desde: string; hasta: string; label: string } {
  const hoy = new Date();
  const anio = hoy.getFullYear();

  switch (periodo) {
    case "mes": {
      const desde = new Date(anio, hoy.getMonth(), 1);
      const hasta = new Date(anio, hoy.getMonth() + 1, 0);
      return { desde: iso(desde), hasta: iso(hasta), label: "Este mes" };
    }
    case "trimestre": {
      const desde = new Date(anio, hoy.getMonth() - 2, 1);
      const hasta = new Date(anio, hoy.getMonth() + 1, 0);
      return { desde: iso(desde), hasta: iso(hasta), label: "Últimos 3 meses" };
    }
    case "anioAnterior":
      return {
        desde: `${anio - 1}-01-01`,
        hasta: `${anio - 1}-12-31`,
        label: `Año ${anio - 1}`,
      };
    case "todo":
      return { desde: "2020-01-01", hasta: `${anio + 1}-12-31`, label: "Todo el histórico" };
    case "anio":
    default:
      return { desde: `${anio}-01-01`, hasta: `${anio}-12-31`, label: `Año ${anio}` };
  }
}

interface Props {
  onBack: () => void;
}

export function CobrosReservasView({ onBack }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("anio");
  /**
   * Contra qué fecha se recorta el periodo.
   *
   * Por día reservado responde a "qué se cobra de la gente que viene"; por
   * fecha de cobro (el día en que se creó la reserva y se pidió la tarjeta)
   * responde a "cuánto dinero entró". Son dos preguntas distintas y el usuario
   * elige cuál está haciendo.
   */
  const [campoFecha, setCampoFecha] = useState<"fecha" | "created_at">("fecha");

  const rango = useMemo(() => rangoDe(periodo), [periodo]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-base font-semibold">Cobros, garantías y tickets</h1>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Periodo: botones a la vista en vez de un desplegable. Son cinco y
              se cambia de uno a otro constantemente al revisar cobros. */}
          <div className="flex items-center gap-1">
            {PERIODOS.map((p) => (
              <Button
                key={p.valor}
                variant={periodo === p.valor ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPeriodo(p.valor)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l pl-1.5">
            <Button
              variant={campoFecha === "fecha" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCampoFecha("fecha")}
              title="Recortar el periodo por el día en que come el cliente"
            >
              Por día reservado
            </Button>
            <Button
              variant={campoFecha === "created_at" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCampoFecha("created_at")}
              title="Recortar el periodo por el día en que se hizo la reserva y se cobró"
            >
              Por día de cobro
            </Button>
          </div>
        </div>
      </div>

      {/* `pb-28` para que la última fila no quede debajo de la barra del chat. */}
      <div className={cn("min-h-0 flex-1 overflow-auto px-4 py-4 pb-28")}>
        <ListadoReservasPanel
          desde={rango.desde}
          hasta={rango.hasta}
          campoFecha={campoFecha}
          enfoque="cobros"
          comprasTicketPorDefecto
          periodoLabel={`${rango.label} · ${campoFecha === "fecha" ? "por día reservado" : "por día de cobro"}`}
        />
      </div>
    </div>
  );
}
