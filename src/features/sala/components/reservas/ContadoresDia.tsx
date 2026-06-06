"use client";

import { useEffect, useState } from "react";
import { Users, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { listReglasReservas } from "@/features/sala/reglas/actions/reglas-actions";
import { cupoEfectivoDesdeReglas } from "@/features/sala/lib/reserva-limites";
import type { EmpresaReservasRegla } from "@/features/sala/reglas/data/reglas";
import type { Reserva } from "@/features/sala/data/reservas";
import { ESTADOS_NO_OCUPANTES } from "@/features/sala/data/reservas";

interface Props {
  fecha: string;
  aforo: number;
  reservas: Reserva[];
}

const EXCLUIDOS = new Set<string>(ESTADOS_NO_OCUPANTES);

export function ContadoresDia({ fecha, aforo, reservas }: Props) {
  const [reglas, setReglas] = useState<EmpresaReservasRegla[]>([]);

  useEffect(() => {
    (async () => {
      const r = await listReglasReservas();
      if (r.ok) setReglas(r.data);
    })();
  }, []);

  const reservasDia = reservas.filter((r) => r.fecha === fecha && !EXCLUIDOS.has(r.estado));

  const comida = reservasDia.filter((r) => r.turno === "COMIDA");
  const cena = reservasDia.filter((r) => r.turno === "CENA");

  const stats = {
    comida: {
      personas: comida.reduce((s, r) => s + (r.comensales ?? 0), 0),
      reservas: comida.length,
      cupo: cupoEfectivoDesdeReglas(reglas, fecha, "COMIDA"),
    },
    cena: {
      personas: cena.reduce((s, r) => s + (r.comensales ?? 0), 0),
      reservas: cena.length,
      cupo: cupoEfectivoDesdeReglas(reglas, fecha, "CENA"),
    },
  };

  return (
    <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b bg-card/50">
      <Caja icon="☀️" titulo="Comida" {...stats.comida} aforo={aforo} />
      <Caja icon="🌙" titulo="Cena" {...stats.cena} aforo={aforo} />
    </div>
  );
}

function Caja({
  icon,
  titulo,
  personas,
  reservas,
  cupo,
  aforo,
}: {
  icon: string;
  titulo: string;
  personas: number;
  reservas: number;
  cupo: number | null;
  aforo: number;
}) {
  const ocup = aforo > 0 ? Math.round((personas / aforo) * 100) : 0;
  const saturado = cupo != null && reservas >= cupo;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-1.5 flex items-center gap-3 text-xs",
        saturado && "bg-red-500/10 border-red-500/30",
      )}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span className="text-base leading-none">{icon}</span>
        <span>{titulo}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-semibold">{personas}</span>
          <span className="text-muted-foreground">/ {aforo}</span>
        </span>
        <span className="flex items-center gap-1">
          <Utensils className="h-3.5 w-3.5 text-sky-500" />
          <span className={cn("font-semibold", saturado && "text-red-500")}>{reservas}</span>
          <span className="text-muted-foreground">/ {cupo ?? "—"}</span>
        </span>
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            ocup > 90 ? "text-red-500" : ocup > 70 ? "text-amber-500" : "text-emerald-500",
          )}
        >
          {ocup}%
        </span>
      </div>
    </div>
  );
}
