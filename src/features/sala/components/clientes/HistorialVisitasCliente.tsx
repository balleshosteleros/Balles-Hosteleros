"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumero } from "@/shared/lib/numero";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  getClienteVisitas,
  type ClienteVisita,
  type ClienteResumenVisitas,
} from "@/features/sala/actions/cliente-visitas-actions";

/**
 * Historial de reservas de un cliente dentro de su ficha.
 *
 * Responde de un vistazo a lo único que se pregunta antes de sentar a alguien:
 * cuántas veces ha venido, cuántas se largó sin avisar y cuándo fue la última.
 */

/** Cuántas visitas se ven sin desplegar. Un cliente puede tener 237. */
const VISIBLES = 12;

/**
 * Cómo se pinta cada estado.
 *
 * Verde = vino y se sentó. Rojo = no apareció (lo que de verdad duele).
 * Ámbar = canceló, que es un aviso pero no un plantón. Gris = el resto.
 */
function estiloEstado(estado: string | null): string {
  const e = (estado ?? "").trim().toLowerCase();
  if (["sentada", "llegada", "cuenta solicitada", "postre", "limpiar"].includes(e)) {
    return "border-emerald-600/40 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400";
  }
  if (e === "no show") {
    return "border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400";
  }
  if (e.startsWith("cancelad")) {
    return "border-amber-600/40 bg-amber-600/15 text-amber-700 dark:text-amber-400";
  }
  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

/** Una cifra del resumen. */
function Cifra({
  titulo,
  valor,
  tono = "neutro",
}: {
  titulo: string;
  valor: string;
  tono?: "neutro" | "bien" | "mal" | "aviso";
}) {
  const tonos = {
    neutro: "text-foreground",
    bien: "text-emerald-600 dark:text-emerald-400",
    mal: "text-red-600 dark:text-red-400",
    aviso: "text-amber-600 dark:text-amber-400",
  } as const;
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tonos[tono])}>
        {valor}
      </p>
    </div>
  );
}

export function HistorialVisitasCliente({
  clienteId,
  zonaHoraria,
}: {
  clienteId: string;
  /** Zona de la empresa: las fechas se pintan con ella, no con la del navegador. */
  zonaHoraria: string;
}) {
  const [visitas, setVisitas] = useState<ClienteVisita[]>([]);
  const [resumen, setResumen] = useState<ClienteResumenVisitas | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setVerTodas(false);
    startTransition(async () => {
      const res = await getClienteVisitas(clienteId);
      if (!res.ok) return;
      setVisitas(res.visitas);
      setResumen(res.resumen);
    });
  }, [clienteId]);

  if (pending && visitas.length === 0) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!resumen || resumen.total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no ha reservado ninguna vez.
      </p>
    );
  }

  const mostradas = verTodas ? visitas : visitas.slice(0, VISIBLES);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra titulo="Reservas" valor={formatNumero(resumen.total)} />
        <Cifra titulo="Vino" valor={formatNumero(resumen.sentadas)} tono="bien" />
        <Cifra
          titulo="No apareció"
          valor={formatNumero(resumen.noShows)}
          tono={resumen.noShows > 0 ? "mal" : "neutro"}
        />
        <Cifra
          titulo="Canceló"
          valor={formatNumero(resumen.cancelaciones)}
          tono={resumen.cancelaciones > 0 ? "aviso" : "neutro"}
        />
      </div>

      {resumen.primeraVisita && (
        <p className="text-xs text-muted-foreground">
          Cliente desde {formatFechaEnZona(resumen.primeraVisita, zonaHoraria)}
          {resumen.ultimaVisita && (
            <> · última reserva {formatFechaEnZona(resumen.ultimaVisita, zonaHoraria)}</>
          )}
        </p>
      )}

      <ul className="space-y-1">
        {mostradas.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-1.5 text-sm"
          >
            <span className="font-medium tabular-nums">
              {formatFechaEnZona(v.fecha, zonaHoraria)}
            </span>
            {v.hora && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {v.hora.slice(0, 5)}
              </span>
            )}
            {v.personas != null && (
              <span className="text-xs text-muted-foreground">
                {formatNumero(v.personas)} pax
              </span>
            )}
            {v.estado && (
              <Badge
                variant="outline"
                className={cn("font-normal", estiloEstado(v.estado))}
              >
                {v.estado}
              </Badge>
            )}
            {v.zona && (
              <span className="text-xs text-muted-foreground">{v.zona}</span>
            )}
            {/* El local importa cuando la empresa tiene más de uno: dice a
                cuál de ellos fue esta visita. */}
            {v.local && (
              <span className="ml-auto text-xs text-muted-foreground">{v.local}</span>
            )}
          </li>
        ))}
      </ul>

      {visitas.length > VISIBLES && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setVerTodas((v) => !v)}
        >
          {verTodas
            ? "Ver menos"
            : `Ver las ${formatNumero(visitas.length)} reservas`}
        </Button>
      )}
    </div>
  );
}
