"use client";

/**
 * Condiciones de canje de un producto de tipo Ticket.
 *
 * Regla que gobierna toda esta pantalla: lo que se deja vacío NO restringe.
 * Sin días marcados vale cualquier día; sin turnos, cualquier turno. Se dice
 * explícitamente en cada bloque para que nadie tenga que deducirlo.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import {
  DIAS_SEMANA_LABELS,
  DIAS_SEMANA_ORDEN,
  type DiaSemanaKey,
} from "@/features/sala/data/reservas";
import {
  TICKET_TURNO_LABELS,
  type TicketTurno,
} from "@/features/sala/data/ticket-productos";
import { listGruposZonasEmpresa } from "@/features/sala/actions/ticket-productos-actions";

export interface CondicionesState {
  diasSemana: DiaSemanaKey[];
  diasExcluidos: string[];
  turnos: TicketTurno[];
  horaDesde: string;
  horaHasta: string;
  horasExcluidas: string[];
  grupoZonaIds: string[];
}

interface Props {
  value: CondicionesState;
  onChange: (v: CondicionesState) => void;
}

/** "2026-12-24" → "24 dic 2026" */
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}

/** Botón de selección múltiple: pulsado = incluido. */
function Chip({
  activo, onClick, children,
}: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-md border px-2.5 py-1 text-xs transition ${
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

export function TicketCondicionesPanel({ value, onChange }: Props) {
  const [zonas, setZonas] = useState<{ id: string; nombre: string }[]>([]);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await listGruposZonasEmpresa();
      if (!cancelado && r.ok) setZonas(r.data);
    })();
    return () => { cancelado = true; };
  }, []);

  const set = useCallback(
    (parcial: Partial<CondicionesState>) => onChange({ ...value, ...parcial }),
    [value, onChange],
  );

  const alternar = <T,>(lista: T[], item: T): T[] =>
    lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];

  return (
    <div className="space-y-5">
      {/* ── Días de la semana ─────────────────────────────────── */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Días en los que se puede reservar</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {value.diasSemana.length === 0
              ? "Ninguno marcado: vale cualquier día."
              : "Solo se podrá reservar los días marcados."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA_ORDEN.map((d) => (
            <Chip
              key={d}
              activo={value.diasSemana.includes(d)}
              onClick={() => set({ diasSemana: alternar(value.diasSemana, d) })}
            >
              {DIAS_SEMANA_LABELS[d]}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── Turnos ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Turnos permitidos</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {value.turnos.length === 0
              ? "Ninguno marcado: vale cualquier turno."
              : "Solo se podrá reservar en los turnos marcados."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TICKET_TURNO_LABELS) as TicketTurno[]).map((t) => (
            <Chip
              key={t}
              activo={value.turnos.includes(t)}
              onClick={() => set({ turnos: alternar(value.turnos, t) })}
            >
              {TICKET_TURNO_LABELS[t]}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── Franja horaria ────────────────────────────────────── */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Franja horaria</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Vacío: cualquier hora. Puede cruzar la medianoche (por ejemplo, de
            20:00 a 02:00).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={value.horaDesde}
            onChange={(e) => set({ horaDesde: e.target.value })}
            className="h-9 w-32"
            aria-label="Desde"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="time"
            value={value.horaHasta}
            onChange={(e) => set({ horaHasta: e.target.value })}
            className="h-9 w-32"
            aria-label="Hasta"
          />
          {(value.horaDesde || value.horaHasta) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => set({ horaDesde: "", horaHasta: "" })}
            >
              Quitar
            </Button>
          )}
        </div>
      </div>

      {/* ── Horas concretas excluidas ─────────────────────────── */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Horas concretas no permitidas</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Para descartar pases sueltos dentro de la franja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={nuevaHora}
            onChange={(e) => setNuevaHora(e.target.value)}
            className="h-9 w-32"
            aria-label="Hora a excluir"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!nuevaHora || value.horasExcluidas.includes(nuevaHora)}
            onClick={() => {
              set({ horasExcluidas: [...value.horasExcluidas, nuevaHora].sort() });
              setNuevaHora("");
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        {value.horasExcluidas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.horasExcluidas.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
              >
                {h}
                <button
                  type="button"
                  aria-label={`Quitar ${h}`}
                  onClick={() =>
                    set({ horasExcluidas: value.horasExcluidas.filter((x) => x !== h) })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Fechas excluidas ──────────────────────────────────── */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Fechas concretas no permitidas</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Días sueltos en los que el ticket no vale, aunque el día de la semana
            esté permitido (Nochebuena, un privado…).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={nuevaFecha}
            onChange={(e) => setNuevaFecha(e.target.value)}
            className="h-9 w-44"
            aria-label="Fecha a excluir"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!nuevaFecha || value.diasExcluidos.includes(nuevaFecha)}
            onClick={() => {
              set({ diasExcluidos: [...value.diasExcluidos, nuevaFecha].sort() });
              setNuevaFecha("");
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        {value.diasExcluidos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.diasExcluidos.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
              >
                {fechaCorta(f)}
                <button
                  type="button"
                  aria-label={`Quitar ${f}`}
                  onClick={() =>
                    set({ diasExcluidos: value.diasExcluidos.filter((x) => x !== f) })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Zonas ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Zonas permitidas</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {zonas.length === 0
              ? "No hay zonas de cliente configuradas en esta empresa."
              : value.grupoZonaIds.length === 0
                ? "Ninguna marcada: vale cualquier zona."
                : "Solo se podrá reservar en las zonas marcadas."}
          </p>
        </div>
        {zonas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {zonas.map((z) => (
              <Chip
                key={z.id}
                activo={value.grupoZonaIds.includes(z.id)}
                onClick={() => set({ grupoZonaIds: alternar(value.grupoZonaIds, z.id) })}
              >
                {z.nombre}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
