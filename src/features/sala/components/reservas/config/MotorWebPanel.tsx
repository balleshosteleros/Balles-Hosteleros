"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectorHoraCuartos } from "@/features/sala/components/reservas/SelectorHoraCuartos";
import { NumberInput } from "@/shared/components/NumberInput";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_PERSONAS_HORA_MODOS,
  MAX_PERSONAS_HORA_MODO_LABELS,
  type EmpresaReservasConfig,
  type MaxPersonasHoraModo,
  type MaxPersonasReglaTramo,
} from "@/features/sala/data/reservas";

interface Props {
  config: EmpresaReservasConfig;
  onChange: (parche: Partial<EmpresaReservasConfig>) => void;
}

/**
 * Toggle Sí/No inline, mismo lenguaje visual que el resto del módulo.
 * No usa shadcn/Switch para mantener consistencia con los demás Sí/No del SaaS.
 */
function YesNo({
  value,
  onChange,
  label,
  description,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-w-2xl">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      <div className="inline-flex rounded-md border bg-background p-0.5 shrink-0">
        {[
          { v: false, label: "No" },
          { v: true,  label: "Sí" },
        ].map(({ v, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "px-3 h-7 rounded text-xs font-medium transition-colors",
              value === v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Comportamiento del motor web y avisos de servicio. Va al final de la pestaña
 * "Configuración" de Reservas: no tiene visual propia (ni botón, ni panel
 * lateral) — se guarda con el botón Guardar de la pestaña.
 */
export function MotorWebPanel({ config, onChange }: Props) {
  return (
    <div className="space-y-6">
      <BloqueCerrarMotor config={config} onChange={onChange} />
      <Separator />
      <BloqueMaxPersonas config={config} onChange={onChange} />
      <Separator />
      <BloqueParpadeo    config={config} onChange={onChange} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bloque: cerrar motor web a partir de la hora señalada (día actual)
// ─────────────────────────────────────────────────────────────────────
function BloqueCerrarMotor({ config, onChange }: Props) {
  const activo = config.cerrarMotorWebActivo;
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Cierre del motor web</h4>
        <p className="text-xs text-muted-foreground -mt-0.5">
          Detiene la entrada de reservas online a partir de la hora indicada del día actual,
          separado para comida y cena.
        </p>
      </div>
      <YesNo
        value={activo}
        onChange={(v) => onChange({ cerrarMotorWebActivo: v })}
        label="Activar cierre del motor web (comida y cena por separado)"
      />
      {activo && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs">Comida — hora de cierre</Label>
            <Input
              type="time"
              value={config.cerrarMotorWebComida ?? ""}
              onChange={(e) => onChange({ cerrarMotorWebComida: e.target.value || null })}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cena — hora de cierre</Label>
            <Input
              type="time"
              value={config.cerrarMotorWebCena ?? ""}
              onChange={(e) => onChange({ cerrarMotorWebCena: e.target.value || null })}
              className="h-8"
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bloque: número máximo de personas en misma hora
// ─────────────────────────────────────────────────────────────────────
function BloqueMaxPersonas({ config, onChange }: Props) {
  const activo = config.maxPersonasHoraActivo;
  const modo = config.maxPersonasHoraModo;
  const reglas = config.maxPersonasHoraReglas ?? [];

  const [draft, setDraft] = useState<MaxPersonasReglaTramo>({ inicio: "00:00", fin: "23:45", max: 0 });

  // Si el modo es "mismo", solo necesitamos el valor global
  function pushRegla() {
    if (!draft.inicio || !draft.fin) return;
    const next: MaxPersonasReglaTramo[] = [
      ...reglas,
      { inicio: draft.inicio, fin: draft.fin, max: Math.max(0, Math.round(draft.max || 0)) },
    ];
    onChange({ maxPersonasHoraReglas: next });
    setDraft({ inicio: draft.fin, fin: "23:45", max: 0 });
  }

  function removeRegla(idx: number) {
    const next = reglas.filter((_, i) => i !== idx);
    onChange({ maxPersonasHoraReglas: next });
  }

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Tope de personas en la misma hora</h4>
        <p className="text-xs text-muted-foreground -mt-0.5">
          Limita cuántos comensales pueden reservar en una misma franja. Útil para no saturar la
          cocina al inicio de turno.
        </p>
      </div>
      <YesNo
        value={activo}
        onChange={(v) => onChange({ maxPersonasHoraActivo: v })}
        label="Activar tope de personas en misma hora"
      />
      {activo && (
        <div className="space-y-3">
          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs">Modo</Label>
            <Select
              value={modo}
              onValueChange={(v) => onChange({ maxPersonasHoraModo: v as MaxPersonasHoraModo })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_PERSONAS_HORA_MODOS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {MAX_PERSONAS_HORA_MODO_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modo === "mismo" && (
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Personas como máximo</Label>
              <NumberInput
                min={0}
                decimales={false}
                value={config.maxPersonasHoraGlobal ?? 0}
                onValueChange={(n) => onChange({ maxPersonasHoraGlobal: Math.round(n) })}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground">
                Aplica a todas las horas por igual. 0 = sin tope.
              </p>
            </div>
          )}

          {(modo === "diferente_hora" || modo === "diferente_tramo") && (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 max-w-2xl">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Personas</Label>
                  <NumberInput
                    min={0}
                    decimales={false}
                    value={draft.max}
                    onValueChange={(n) => setDraft({ ...draft, max: n })}
                    className="h-8 text-xs"
                  />
                </div>
                {/* Cuartos: el tramo se compara con la hora de cada reserva,
                    así que sus extremos tienen que caer en la misma cuadrícula
                    para no dejar horas sin tope aplicable. */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Desde</Label>
                  <SelectorHoraCuartos
                    value={draft.inicio}
                    onChange={(h) => setDraft({ ...draft, inicio: h })}
                    requerido
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Hasta</Label>
                  <SelectorHoraCuartos
                    value={draft.fin}
                    onChange={(h) => setDraft({ ...draft, fin: h })}
                    requerido
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={pushRegla} className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
                </Button>
              </div>

              {reglas.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Sin reglas aún. Añade tramos por encima.
                </p>
              ) : (
                <ul className="divide-y rounded border max-w-2xl">
                  {reglas.map((r, i) => (
                    <li key={`${r.inicio}-${r.fin}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="w-16 font-medium tabular-nums">{r.max} pax</span>
                      <span className="flex-1 tabular-nums">{r.inicio} → {r.fin}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeRegla(i)}
                        aria-label="Borrar regla"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bloque: parpadeo de reservas (alertas visuales en timeline)
// ─────────────────────────────────────────────────────────────────────
function BloqueParpadeo({ config, onChange }: Props) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Parpadeo de reservas</h4>
        <p className="text-xs text-muted-foreground -mt-0.5">
          Resalta visualmente las reservas que requieren atención en la vista de servicio.
        </p>
      </div>
      <div className="space-y-2.5">
        <YesNo
          value={config.parpadeoPasadoDuracion}
          onChange={(v) => onChange({ parpadeoPasadoDuracion: v })}
          label="Pasado el tiempo de duración"
          description="La reserva ha superado la duración prevista de mesa."
        />
        <YesNo
          value={config.parpadeo0a15}
          onChange={(v) => onChange({ parpadeo0a15: v })}
          label="De los 0 a los 15 minutos"
          description="Próximos a llegar o recién llegados."
        />
        <YesNo
          value={config.parpadeo15a30}
          onChange={(v) => onChange({ parpadeo15a30: v })}
          label="De los 15 a los 30 minutos"
          description="Reservas a 15–30 min de su hora prevista."
        />
      </div>
    </section>
  );
}
