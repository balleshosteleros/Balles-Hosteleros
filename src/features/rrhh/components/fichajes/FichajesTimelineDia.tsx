"use client";

/**
 * Timeline de fichajes por DÍA (estilo Sesame). Regla horaria 0–24h arriba y una
 * fila por empleado: avatar + nombre · fichado/previsto · línea gris (horario) +
 * barras de color (verde=normal, azul=por solicitud, rojo=horas extras).
 * Fuente de datos: loadTimelineDia.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { loadTimelineDia, type TimelineFichajeRow } from "@/features/rrhh/actions/horas-actions";
import {
  ReglaHoras,
  TimelineBarra,
  LeyendaTimeline,
  fmtHM,
} from "@/features/rrhh/components/fichajes/timeline-shared";
import { ToolTooltip } from "@/components/ui/tool-tooltip";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_SEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * El día se mueve como TEXTO "AAAA-MM-DD", nunca como `Date` del navegador.
 * Quien abre esta pantalla desde otro huso (o de madrugada) veía el día del
 * reloj de su portátil, que puede ir uno por delante del de la empresa.
 */
function sumarDias(fechaISO: string, delta: number): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + delta)).toISOString().slice(0, 10);
}

function labelDia(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_SEM[diaSemana]}, ${d} de ${MESES[m - 1]}`;
}

export function FichajesTimelineDia() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();
  const tz = empresaActual.zonaHoraria;
  // El día se resuelve YA MONTADO, con el reloj de la empresa: en el servidor
  // no se sabe todavía cuál es "hoy" para este local, y adivinarlo desde el
  // navegador es justamente lo que descuadraba la pantalla fuera de España.
  const [fechaISO, setFechaISO] = useState("");
  const [hoyISO, setHoyISO] = useState("");
  const [rows, setRows] = useState<TimelineFichajeRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const hoy = hoyEnZona(tz);
    setHoyISO(hoy);
    setFechaISO((prev) => prev || hoy);
  }, [tz]);

  useEffect(() => {
    if (!fechaISO) return;
    let vivo = true;
    setCargando(true);
    void loadTimelineDia(fechaISO).then((r) => {
      if (!vivo) return;
      setRows(r.ok ? r.data : []);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [fechaISO, empresaActual.id]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? rows.filter((r) => r.nombre.toLowerCase().includes(q)) : rows;
  }, [rows, busqueda]);

  const cambiarDia = (delta: number) => {
    setFechaISO((prev) => (prev ? sumarDias(prev, delta) : prev));
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empleado"
            className="h-9 w-52 rounded-md border bg-background px-3 text-sm"
          />
          <div className="ml-auto">
            <CalendarRangeNav
              label={fechaISO ? labelDia(fechaISO) : ""}
              onPrev={() => cambiarDia(-1)}
              onNext={() => cambiarDia(1)}
              onToday={() => setFechaISO(hoyEnZona(tz))}
              isToday={fechaISO === hoyISO}
            />
          </div>
        </div>

        {/* Rejilla timeline */}
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[900px]">
            {/* Cabecera: Empleado | Horas | regla 0-24 */}
            <div className="flex items-center border-b bg-muted/40 text-[11px] text-muted-foreground">
              <div className="w-48 shrink-0 px-4 py-2 font-medium">Empleado</div>
              <div className="w-36 shrink-0 px-2 py-2 font-medium">Horas</div>
              <ReglaHoras />
            </div>

            {/* Filas */}
            {cargando ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
            ) : filas.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay empleados en este día.
              </div>
            ) : (
              filas.map((r) => (
                <div key={r.empleadoId} className="flex items-center border-b last:border-b-0 hover:bg-muted/20">
                  {/* Empleado (clic → su ficha con todos sus fichajes) */}
                  <ToolTooltip label="Ver la ficha y todos sus fichajes">
                    <button
                      type="button"
                      onClick={() => router.push(`/rrhh/empleados/${r.empleadoId}`)}
                      className="flex w-48 shrink-0 items-center gap-2 px-4 py-3 text-left hover:underline" aria-label="Ver la ficha y todos sus fichajes">
                      <Avatar className="h-8 w-8">
                        {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt={r.nombre} /> : null}
                        <AvatarFallback className="text-[10px]">{iniciales(r.nombre)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{r.nombre}</span>
                    </button>
                  </ToolTooltip>
                  {/* Horas fichado / previsto */}
                  <div className="w-36 shrink-0 whitespace-nowrap px-2 py-3 text-xs">
                    <span className="font-semibold tabular-nums">{fmtHM(r.horasFichadas)}</span>
                    <span className="text-muted-foreground tabular-nums"> / {fmtHM(r.horasPrevistas)}</span>
                  </div>
                  {/* Barra */}
                  <div className="relative flex-1 px-0 py-3">
                    <TimelineBarra previsto={r.previsto} fichado={r.fichado} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <LeyendaTimeline />
      </div>
    </TooltipProvider>
  );
}
