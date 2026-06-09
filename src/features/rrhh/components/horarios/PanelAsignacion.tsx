"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { X, GripVertical, Clock, Layers } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { pillStyleDepartamento, DIAS_SEMANA } from "@/features/rrhh/data/horarios";
import type {
  PlanTurno,
  PlanPatron,
} from "@/features/rrhh/actions/planificacion-actions";

export interface DragData {
  kind: "turno" | "patron";
  id: string;
  etiqueta: string;
}

interface PanelAsignacionProps {
  turnos: PlanTurno[];
  patrones: PlanPatron[];
  turnoById: Map<string, PlanTurno>;
  onClose: () => void;
}

type Tab = "turnos" | "patrones";

export function PanelAsignacion({
  turnos,
  patrones,
  turnoById,
  onClose,
}: PanelAsignacionProps) {
  const [tab, setTab] = useState<Tab>("turnos");
  const [depto, setDepto] = useState<string>("__todos__");

  // Departamentos distintos presentes en la pestaña activa (sentence case, orden
  // alfa). Tanto turnos como patrones se filtran por su departamento asignado.
  const fuente = tab === "turnos" ? turnos : patrones;
  const departamentos = Array.from(
    new Set(
      fuente
        .map((x) => x.departamento?.trim())
        .filter((d): d is string => !!d),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const turnosOrden = [...turnos]
    .filter((t) => depto === "__todos__" || t.departamento?.trim() === depto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const patronesOrden = [...patrones]
    .filter((p) => depto === "__todos__" || p.departamento?.trim() === depto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <aside className="flex w-72 shrink-0 flex-col rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <p className="text-sm font-semibold">Asignar arrastrando</p>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-0 border-b p-1">
        <TabBtn
          activo={tab === "turnos"}
          onClick={() => {
            setTab("turnos");
            setDepto("__todos__");
          }}
        >
          <Clock className="h-3.5 w-3.5" />
          Turnos
        </TabBtn>
        <TabBtn
          activo={tab === "patrones"}
          onClick={() => {
            setTab("patrones");
            setDepto("__todos__");
          }}
        >
          <Layers className="h-3.5 w-3.5" />
          Patrones
        </TabBtn>
      </div>

      {departamentos.length > 0 && (
        <div className="border-b px-2 py-2">
          <select
            value={depto}
            onChange={(e) => setDepto(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            aria-label={`Filtrar ${tab} por departamento`}
          >
            <option value="__todos__">Todos los departamentos</option>
            {departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          Arrastra una tarjeta a un día de un empleado o departamento.
        </p>
        {tab === "turnos" ? (
          turnosOrden.length === 0 ? (
            <Vacio>
              {depto === "__todos__"
                ? "No hay turnos configurados."
                : "No hay turnos en este departamento."}
            </Vacio>
          ) : (
            turnosOrden.map((t) => <TurnoCard key={t.id} turno={t} />)
          )
        ) : patronesOrden.length === 0 ? (
          <Vacio>
            {depto === "__todos__"
              ? "No hay patrones configurados."
              : "No hay patrones en este departamento."}
          </Vacio>
        ) : (
          patronesOrden.map((p) => (
            <PatronCard key={p.id} patron={p} turnoById={turnoById} />
          ))
        )}
      </div>
    </aside>
  );
}

function TabBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
        activo
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>
  );
}

function TurnoCard({ turno }: { turno: PlanTurno }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `turno:${turno.id}`,
    data: { kind: "turno", id: turno.id, etiqueta: turno.codigo } as DragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border bg-background p-2 active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span
        className="inline-flex h-6 min-w-[42px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide"
        style={pillStyleDepartamento(turno.colorHex)}
      >
        {turno.codigo}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{turno.nombre}</p>
        {turno.tramos[0] && (
          <p className="truncate text-[11px] tabular-nums text-muted-foreground">
            {turno.tramos.map((tr) => `${tr.inicio}–${tr.fin}`).join(" / ")}
          </p>
        )}
      </div>
    </div>
  );
}

function PatronCard({
  patron,
  turnoById,
}: {
  patron: PlanPatron;
  turnoById: Map<string, PlanTurno>;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `patron:${patron.id}`,
    data: { kind: "patron", id: patron.id, etiqueta: patron.nombre } as DragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-lg border bg-background p-2 active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {patron.nombre}
        </p>
      </div>
      {/* Mini-preview de los 7 días del patrón. */}
      <div className="mt-1.5 grid grid-cols-7 gap-0.5 pl-6">
        {DIAS_SEMANA.map((dia, i) => {
          const turnoId = patron.diasSemana1[i] ?? null;
          const turno = turnoId ? turnoById.get(turnoId) : null;
          return (
            <div key={dia} className="text-center">
              <div className="text-[8px] text-muted-foreground">{dia}</div>
              <div
                className={cn(
                  "mt-0.5 flex h-4 items-center justify-center rounded text-[8px] font-semibold",
                  !turno && "bg-muted text-muted-foreground/40",
                )}
                style={turno ? pillStyleDepartamento(turno.colorHex) : undefined}
              >
                {turno?.codigo?.slice(0, 3) ?? "·"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
