"use client";

import { ChevronLeft, ChevronRight, Settings, CalendarDays, Download, UserPlus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";

export type Periodo = "semana" | "mes";

interface HorariosToolbarProps {
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onHoy: () => void;
  refDate: Date;
  onSaltarA: (d: Date) => void;
  onNuevo: () => void;
  onAbrirConfig: () => void;
  onDescargarPDF: () => void;
}

export function HorariosToolbar({
  periodo,
  onPeriodoChange,
  label,
  onPrev,
  onNext,
  onHoy,
  refDate,
  onSaltarA,
  onNuevo,
  onAbrirConfig,
  onDescargarPDF,
}: HorariosToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Fila principal — BARRA HORIZONTAL 1 (estándar) */}
      {/* "+ Nuevo" abre la configuración de horarios; "Asignar" abre el panel
          de asignación (turnos/patrones a empleados). El ⚙️ queda inerte de
          momento (reservado para futuros ajustes). */}
      <SubmoduleToolbar
        onNuevo={onAbrirConfig}
        textoNuevo="Nuevo"
        extraIzquierda={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onNuevo}
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            Asignar
          </Button>
        }
        extraDerecha={
          <>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={onDescargarPDF}
              title="Descargar PDF"
              aria-label="Descargar PDF"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      {/* Fila de filtros — navegación de periodo + agrupación (minimalista) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <SegmentedPeriodo
            value={periodo}
            onChange={onPeriodoChange}
            onHoy={onHoy}
          />
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={onPrev}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={onNext}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 font-medium capitalize">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={refDate}
                onSelect={(d) => d && onSaltarA(d)}
                weekStartsOn={1}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

function SegmentedPeriodo({
  value,
  onChange,
  onHoy,
}: {
  value: Periodo;
  onChange: (p: Periodo) => void;
  onHoy: () => void;
}) {
  return (
    <div className="flex items-center gap-0 rounded-lg border bg-muted/40 p-0.5">
      <button
        type="button"
        onClick={onHoy}
        className="h-7 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Hoy
      </button>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as Periodo)}
        className="gap-0"
      >
        <ToggleGroupItem
          value="semana"
          className="h-7 rounded-md px-3 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm text-muted-foreground"
        >
          Semana
        </ToggleGroupItem>
        <ToggleGroupItem
          value="mes"
          className="h-7 rounded-md px-3 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm text-muted-foreground"
        >
          Mes
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
