"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import {
  type DiaIsoDow,
  type ModoVigencia,
  type VigenciaSpec,
  DIA_ISO_DOW_LABELS,
  DIAS_ISO_DOW,
  jsDayToIsoDow,
} from "../data/reglas";

interface Props {
  value: VigenciaSpec;
  onChange: (v: VigenciaSpec) => void;
  /** Si true, oculta el modo "Hoy". Útil para planos donde no tiene sentido. */
  hideHoy?: boolean;
  /** Si true, oculta el modo "Siempre". Útil cuando la regla DEBE tener vigencia. */
  hideSiempre?: boolean;
}

interface ModoOpcion {
  modo: ModoVigencia;
  label: string;
  /** Si retorna texto el modo se renderiza con ese label dinámico. */
  dynamicLabel?: () => string;
}

const TODAY_ISODOW = jsDayToIsoDow(new Date().getDay()) as DiaIsoDow;

/**
 * Selector de vigencia: dos filas — un toggle group con los modos disponibles
 * y, debajo, los inputs específicos según el modo elegido. Sin Popover ni
 * cmdk para evitar conflictos dentro de Dialog.
 */
export function VigenciaSelector({ value, onChange, hideHoy, hideSiempre }: Props) {
  const opciones: ModoOpcion[] = useMemo(() => {
    const arr: ModoOpcion[] = [];
    if (!hideHoy) arr.push({ modo: "hoy", label: "Hoy" });
    arr.push({
      modo: "todos_los_dia",
      label: `Todos los ${DIA_ISO_DOW_LABELS[TODAY_ISODOW].toLowerCase()}`,
    });
    if (!hideSiempre) arr.push({ modo: "todos_los_dias", label: "Todos los días" });
    arr.push({ modo: "rango", label: "Entre dos fechas" });
    arr.push({ modo: "fechas", label: "Días específicos" });
    return arr;
  }, [hideHoy, hideSiempre]);

  function setModo(nuevoModo: ModoVigencia) {
    // Al cambiar de modo se preservan los valores cuando son compatibles, y
    // si no, se inicializan a defaults razonables.
    if (nuevoModo === value.modo) return;
    switch (nuevoModo) {
      case "siempre":
      case "todos_los_dias":
      case "hoy":
        onChange({ modo: nuevoModo });
        return;
      case "todos_los_dia":
        onChange({ modo: nuevoModo, diaSemana: value.diaSemana ?? TODAY_ISODOW });
        return;
      case "rango":
        onChange({
          modo: nuevoModo,
          fechaDesde: value.fechaDesde ?? new Date().toISOString().slice(0, 10),
          fechaHasta:
            value.fechaHasta ??
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        });
        return;
      case "fechas":
        onChange({ modo: nuevoModo, fechas: value.fechas ?? [] });
        return;
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Cuándo aplica</Label>
      <div className="flex flex-wrap gap-1">
        {opciones.map((opt) => {
          const activo = value.modo === opt.modo;
          return (
            <button
              key={opt.modo}
              type="button"
              onClick={() => setModo(opt.modo)}
              className={
                "px-2.5 py-1 text-xs rounded border transition-colors " +
                (activo
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-muted")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Secciones condicionales según el modo */}
      {value.modo === "todos_los_dia" && (
        <SelectorDiaSemana
          value={value.diaSemana ?? TODAY_ISODOW}
          onChange={(d) => onChange({ modo: "todos_los_dia", diaSemana: d })}
        />
      )}

      {value.modo === "rango" && (
        <SelectorRango
          desde={value.fechaDesde ?? ""}
          hasta={value.fechaHasta ?? ""}
          onChange={(desde, hasta) =>
            onChange({ modo: "rango", fechaDesde: desde, fechaHasta: hasta })
          }
        />
      )}

      {value.modo === "fechas" && (
        <SelectorFechas
          fechas={value.fechas ?? []}
          onChange={(f) => onChange({ modo: "fechas", fechas: f })}
        />
      )}
    </div>
  );
}

function SelectorDiaSemana({
  value,
  onChange,
}: {
  value: DiaIsoDow;
  onChange: (d: DiaIsoDow) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">Día de la semana</Label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as DiaIsoDow)}
        className="h-9 text-sm w-full max-w-xs rounded-md border border-input bg-background px-2"
      >
        {DIAS_ISO_DOW.map((d) => (
          <option key={d} value={d}>
            {DIA_ISO_DOW_LABELS[d]}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectorRango({
  desde,
  hasta,
  onChange,
}: {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-w-md">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Desde</Label>
        <Input type="date" value={desde} onChange={(e) => onChange(e.target.value, hasta)} />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Hasta</Label>
        <Input type="date" value={hasta} onChange={(e) => onChange(desde, e.target.value)} />
      </div>
    </div>
  );
}

function SelectorFechas({
  fechas,
  onChange,
}: {
  fechas: string[];
  onChange: (f: string[]) => void;
}) {
  const [nueva, setNueva] = useState<string>(() => new Date().toISOString().slice(0, 10));

  function agregar() {
    if (!nueva) return;
    if (fechas.includes(nueva)) return;
    onChange([...fechas, nueva].sort());
  }
  function quitar(f: string) {
    onChange(fechas.filter((x) => x !== f));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-1 flex-1 max-w-xs">
          <Label className="text-[11px] text-muted-foreground">Fecha</Label>
          <Input type="date" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Añadir
        </Button>
      </div>
      {fechas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fechas.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded"
            >
              {f}
              <button
                type="button"
                onClick={() => quitar(f)}
                className="text-muted-foreground hover:text-destructive"
                title="Quitar"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
