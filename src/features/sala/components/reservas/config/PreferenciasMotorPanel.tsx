"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DURACION_RESERVA_DEFAULT_MINUTOS,
  DURACION_RESERVA_MAX_MINUTOS,
  DURACION_RESERVA_MIN_MINUTOS,
  INTERVALOS_RESERVA,
  MAX_PERSONAS_HORA_MODOS,
  MAX_PERSONAS_HORA_MODO_LABELS,
  type EmpresaReservasConfig,
  type IntervaloReservaMin,
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
    <div className="flex items-start justify-between gap-4">
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

export function PreferenciasMotorPanelButton({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8"
      >
        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
        Preferencias del motor
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Preferencias del motor</SheetTitle>
            <SheetDescription>
              Comportamiento general de las reservas y del motor web. Los cambios
              se guardan automáticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <BloqueCerrarMotor   config={config} onChange={onChange} />
            <Separator />
            <BloqueMaxPersonas   config={config} onChange={onChange} />
            <Separator />
            <BloqueParpadeo      config={config} onChange={onChange} />
            <Separator />
            <BloqueDuracionMesa  config={config} onChange={onChange} />
            <Separator />
            <BloqueIntervalo     config={config} onChange={onChange} />
            <Separator />
            <BloqueOcultarCanceladas config={config} onChange={onChange} />
          </div>
        </SheetContent>
      </Sheet>
    </>
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
        <h5 className="text-sm font-semibold">Cierre del motor web</h5>
        <p className="text-[11px] text-muted-foreground">
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
        <div className="grid grid-cols-2 gap-3 max-w-md pl-1">
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
        <h5 className="text-sm font-semibold">Tope de personas en la misma hora</h5>
        <p className="text-[11px] text-muted-foreground">
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
        <div className="space-y-3 pl-1">
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
              <Input
                type="number"
                min={0}
                step={1}
                value={config.maxPersonasHoraGlobal ?? 0}
                onChange={(e) => {
                  const n = Math.max(0, Math.round(Number(e.target.value) || 0));
                  onChange({ maxPersonasHoraGlobal: n });
                }}
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
                  <Input
                    type="number"
                    min={0}
                    value={draft.max}
                    onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) || 0 })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Desde</Label>
                  <Input
                    type="time"
                    value={draft.inicio}
                    onChange={(e) => setDraft({ ...draft, inicio: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Hasta</Label>
                  <Input
                    type="time"
                    value={draft.fin}
                    onChange={(e) => setDraft({ ...draft, fin: e.target.value })}
                    className="h-8 text-xs"
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
        <h5 className="text-sm font-semibold">Parpadeo de reservas</h5>
        <p className="text-[11px] text-muted-foreground">
          Resalta visualmente las reservas que requieren atención en la vista de servicio.
        </p>
      </div>
      <div className="space-y-2.5 pl-1">
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

// ─────────────────────────────────────────────────────────────────────
// Bloque: duración por defecto (tiempo medio de servicio por mesa)
// ─────────────────────────────────────────────────────────────────────
function BloqueDuracionMesa({ config, onChange }: Props) {
  const [valor, setValor] = useState(config.duracionReservaMin);
  useEffect(() => setValor(config.duracionReservaMin), [config.duracionReservaMin]);
  return (
    <section className="space-y-3">
      <div>
        <h5 className="text-sm font-semibold">Duración por mesa</h5>
        <p className="text-[11px] text-muted-foreground">
          Tiempo medio que una mesa queda ocupada por cada reserva. Es el valor por defecto: en
          cada reserva concreta puedes ajustarlo manualmente y ese override prevalece.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md pl-1">
        <div className="space-y-1.5">
          <Label className="text-xs">Duración por defecto (minutos)</Label>
          <Input
            type="number"
            min={DURACION_RESERVA_MIN_MINUTOS}
            max={DURACION_RESERVA_MAX_MINUTOS}
            step={5}
            value={valor}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const n = Number.isFinite(raw)
                ? Math.min(DURACION_RESERVA_MAX_MINUTOS, Math.max(DURACION_RESERVA_MIN_MINUTOS, Math.round(raw)))
                : DURACION_RESERVA_DEFAULT_MINUTOS;
              setValor(n);
              onChange({ duracionReservaMin: n });
            }}
            className="h-8"
          />
          <p className="text-[10px] text-muted-foreground">
            Mín {DURACION_RESERVA_MIN_MINUTOS} · máx {DURACION_RESERVA_MAX_MINUTOS} (6 h) · default {DURACION_RESERVA_DEFAULT_MINUTOS}.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bloque: intervalo entre slots ofrecidos por el motor web
// ─────────────────────────────────────────────────────────────────────
function BloqueIntervalo({ config, onChange }: Props) {
  return (
    <section className="space-y-3">
      <div>
        <h5 className="text-sm font-semibold">Intervalos de reserva</h5>
        <p className="text-[11px] text-muted-foreground">
          Granularidad de los huecos ofrecidos al cliente en el motor web.
        </p>
      </div>
      <div className="space-y-1.5 max-w-md pl-1">
        <Label className="text-xs">Cada</Label>
        <Select
          value={String(config.intervaloReservaMin)}
          onValueChange={(v) => onChange({ intervaloReservaMin: Number(v) as IntervaloReservaMin })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVALOS_RESERVA.map((m) => (
              <SelectItem key={m} value={String(m)} className="text-xs">
                {m} minutos
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bloque: ocultar reservas canceladas
// ─────────────────────────────────────────────────────────────────────
function BloqueOcultarCanceladas({ config, onChange }: Props) {
  return (
    <section className="space-y-3">
      <YesNo
        value={config.ocultarCanceladas}
        onChange={(v) => onChange({ ocultarCanceladas: v })}
        label="Ocultar reservas canceladas"
        description="No mostrarlas en la vista de reservas por defecto. Puedes mostrarlas con un filtro."
      />
    </section>
  );
}
