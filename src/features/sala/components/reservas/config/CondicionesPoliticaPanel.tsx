"use client";

/**
 * Condiciones de una política de tarjeta (PRP-082 §5.1).
 *
 * Las dos políticas —cancelación y garantía— usan este mismo panel: solo
 * cambian las claves de configuración que lee y escribe. Cada eje vacío no
 * restringe, y todos se cumplen a la vez.
 */

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listGruposZonas } from "@/features/sala/planos/actions/grupos-zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import {
  DIAS_SEMANA_LABELS,
  DIAS_SEMANA_ORDEN,
  POLITICA_DESDE_PAX_OPCIONES,
  type DiaSemanaKey,
} from "@/features/sala/data/reservas";

/** Turnos tal y como se guardan en `reservas.turno`. */
const TURNOS = [
  { valor: "COMIDA", label: "Comida" },
  { valor: "CENA", label: "Cena" },
] as const;

const PAX_OPCIONES = POLITICA_DESDE_PAX_OPCIONES;

export interface CondicionesValor {
  desdePax: number;
  diasSemana: DiaSemanaKey[];
  fechas: string[];
  turnos: string[];
  horaDesde: string | null;
  horaHasta: string | null;
  grupoZonaIds: string[];
  mesaIds: string[];
}

export function CondicionesPoliticaPanel({
  valor,
  onChange,
  acento,
}: {
  valor: CondicionesValor;
  onChange: (parche: Partial<CondicionesValor>) => void;
  /** Color del resumen, para distinguir las dos políticas de un vistazo. */
  acento: "cancelacion" | "garantia";
}) {
  const [grupos, setGrupos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [mesas, setMesas] = useState<Array<{ id: string; codigo: string }>>([]);
  const [nuevaFecha, setNuevaFecha] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const locales = await listLocalesEmpresa();
      if (!locales.ok || locales.data.length === 0) return;
      // Las condiciones son de empresa, así que se ofrecen las zonas y mesas
      // de todos sus locales.
      const porLocal = await Promise.all(
        locales.data.map(async (l) => {
          const [g, m] = await Promise.all([listGruposZonas(l.id), listMesas(l.id)]);
          return {
            grupos: g.ok ? g.data.filter((x) => x.activa) : [],
            mesas: m.ok ? m.data : [],
          };
        }),
      );
      if (!vivo) return;
      setGrupos(porLocal.flatMap((p) => p.grupos.map((g) => ({ id: g.id, nombre: g.nombre }))));
      setMesas(porLocal.flatMap((p) => p.mesas.map((m) => ({ id: m.id, codigo: m.codigo }))));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  function alternar<T extends string>(lista: T[], v: T): T[] {
    return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
  }

  function anadirFecha() {
    const f = nuevaFecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
    if (valor.fechas.includes(f)) {
      setNuevaFecha("");
      return;
    }
    onChange({ fechas: [...valor.fechas, f].sort() });
    setNuevaFecha("");
  }

  const resumen = describirCondiciones(valor);
  const colorResumen =
    acento === "garantia"
      ? "text-sky-700 dark:text-sky-400 border-sky-500/40 bg-sky-500/10"
      : "text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10";

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <div>
        <h5 className="text-xs font-semibold mb-1">Cuándo se pide</h5>
        <p className="text-[11px] text-muted-foreground">
          Cada condición que dejes vacía no restringe. Las que rellenes se cumplen a
          la vez.
        </p>
      </div>

      {/* Comensales */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-start">
        <div className="space-y-1.5">
          <Label className="text-xs">A partir de</Label>
          <Select
            value={String(valor.desdePax)}
            onValueChange={(v) => {
              const n = Number(v);
              if (Number.isFinite(n)) onChange({ desdePax: n });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAX_OPCIONES.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n === 0 ? "Todas las reservas" : `${n} comensales`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground md:pt-7">
          Número de comensales a partir del cual se pide tarjeta. Por debajo, la
          reserva no la lleva.
        </p>
      </div>

      {/* Días de la semana */}
      <div className="space-y-1.5">
        <Label className="text-xs">Días de la semana</Label>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA_ORDEN.map((d) => {
            const activo = valor.diasSemana.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ diasSemana: alternar(valor.diasSemana, d) })}
                className={`h-7 px-2.5 rounded-md border text-xs transition-colors ${
                  activo
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                {DIAS_SEMANA_LABELS[d]}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sin ninguno marcado, aplica todos los días.
        </p>
      </div>

      {/* Turnos */}
      <div className="space-y-1.5">
        <Label className="text-xs">Turnos</Label>
        <div className="flex flex-wrap gap-1.5">
          {TURNOS.map((t) => {
            const activo = valor.turnos.includes(t.valor);
            return (
              <button
                key={t.valor}
                type="button"
                onClick={() => onChange({ turnos: alternar(valor.turnos, t.valor) })}
                className={`h-7 px-2.5 rounded-md border text-xs transition-colors ${
                  activo
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sin ninguno marcado, aplica en los dos turnos.
        </p>
      </div>

      {/* Franja horaria */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-start">
        <div className="space-y-1.5">
          <Label className="text-xs">Franja horaria</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={valor.horaDesde ?? ""}
              onChange={(e) => onChange({ horaDesde: e.target.value || null })}
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="time"
              value={valor.horaHasta ?? ""}
              onChange={(e) => onChange({ horaHasta: e.target.value || null })}
              className="h-8 text-xs"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground md:pt-7">
          Solo las reservas dentro de esa franja. Vacío = a cualquier hora.
        </p>
      </div>

      {/* Fechas concretas */}
      <div className="space-y-1.5">
        <Label className="text-xs">Fechas concretas</Label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={nuevaFecha}
            onChange={(e) => setNuevaFecha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                anadirFecha();
              }
            }}
            className="h-8 text-xs max-w-[180px]"
          />
          <button
            type="button"
            onClick={anadirFecha}
            disabled={!nuevaFecha}
            className="h-8 px-2.5 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-muted disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir
          </button>
        </div>
        {valor.fechas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {valor.fechas.map((f) => (
              <Badge key={f} variant="outline" className="text-[11px] font-normal gap-1 pr-1">
                {formatearFecha(f)}
                <button
                  type="button"
                  onClick={() => onChange({ fechas: valor.fechas.filter((x) => x !== f) })}
                  className="rounded-sm hover:bg-muted p-0.5"
                  aria-label={`Quitar ${f}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Días señalados (Nochevieja, San Valentín…). Piden tarjeta aunque no encajen
          con el resto de condiciones de calendario.
        </p>
      </div>

      {/* Zonas */}
      {grupos.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Zonas</Label>
          <div className="flex flex-wrap gap-1.5">
            {grupos.map((g) => {
              const activo = valor.grupoZonaIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onChange({ grupoZonaIds: alternar(valor.grupoZonaIds, g.id) })}
                  className={`h-7 px-2.5 rounded-md border text-xs transition-colors ${
                    activo
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {g.nombre}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sin ninguna marcada, aplica en todas las zonas.
          </p>
        </div>
      )}

      {/* Mesas */}
      {mesas.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Mesas concretas</Label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {mesas.map((m) => {
              const activo = valor.mesaIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ mesaIds: alternar(valor.mesaIds, m.id) })}
                  className={`h-7 px-2.5 rounded-md border text-xs transition-colors ${
                    activo
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m.codigo}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Para reservados o mesas especiales. Sin ninguna marcada, aplica en todas.
          </p>
        </div>
      )}

      {/* Resumen en una frase: lo que de verdad va a pasar */}
      <div className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${colorResumen}`}>
        {resumen}
      </div>
    </div>
  );
}

/** "2026-12-31" → "31 dic 2026" */
function formatearFecha(f: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return f;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Traduce las condiciones a una frase. Es la única forma de que quien
 * configura vea si ha montado lo que quería sin tener que probarlo.
 */
function describirCondiciones(v: CondicionesValor): string {
  const partes: string[] = [];

  partes.push(
    v.desdePax > 0 ? `reservas de ${v.desdePax} comensales o más` : "todas las reservas",
  );

  if (v.diasSemana.length > 0) {
    const dias = DIAS_SEMANA_ORDEN.filter((d) => v.diasSemana.includes(d)).map(
      (d) => DIAS_SEMANA_LABELS[d],
    );
    partes.push(`los ${dias.join(", ")}`);
  }
  if (v.turnos.length === 1) {
    partes.push(`solo en ${v.turnos[0] === "COMIDA" ? "comidas" : "cenas"}`);
  }
  if (v.horaDesde && v.horaHasta) partes.push(`entre las ${v.horaDesde} y las ${v.horaHasta}`);
  else if (v.horaDesde) partes.push(`a partir de las ${v.horaDesde}`);
  else if (v.horaHasta) partes.push(`hasta las ${v.horaHasta}`);

  if (v.grupoZonaIds.length > 0) {
    partes.push(`en ${v.grupoZonaIds.length} ${v.grupoZonaIds.length === 1 ? "zona" : "zonas"}`);
  }
  if (v.mesaIds.length > 0) {
    partes.push(`en ${v.mesaIds.length} ${v.mesaIds.length === 1 ? "mesa" : "mesas"}`);
  }

  let frase = `Se pide tarjeta en ${partes.join(", ")}.`;
  if (v.fechas.length > 0) {
    frase += ` Y siempre en ${v.fechas.length} ${
      v.fechas.length === 1 ? "fecha señalada" : "fechas señaladas"
    }.`;
  }
  return frase;
}
