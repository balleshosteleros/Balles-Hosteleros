"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CANCELACION_HORAS_MAX,
  CANCELACION_HORAS_MIN,
  CANCELACION_IMPORTE_DEFAULT,
  CANCELACION_IMPORTE_MAX,
  CANCELACION_IMPORTE_MIN,
  CANCELACION_TEXTO_FIJO,
  GARANTIA_IMPORTE_DEFAULT,
  GARANTIA_IMPORTE_MAX,
  GARANTIA_IMPORTE_MIN,
  GARANTIA_MODO_LABELS,
  GARANTIA_MODOS,
  GARANTIA_TEXTO_FIJO,
  type EmpresaReservasConfig,
  type GarantiaModo,
} from "@/features/sala/data/reservas";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import {
  CondicionesPoliticaPanel,
  type CondicionesValor,
} from "./CondicionesPoliticaPanel";

const HORAS_OPCIONES = [1, 2, 3, 4, 6, 8, 12, 24, 48, 72] as const;

export function PoliticasCancelacionTab() {
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [importeStr, setImporteStr] = useState("");
  const [garantiaImporteStr, setGarantiaImporteStr] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarConfig = useCallback(async () => {
    const c = await getReservasConfig();
    if (c.ok && c.data) {
      setConfig(c.data);
      setImporteStr(c.data.cancelacionImporteEur.toFixed(2));
      setGarantiaImporteStr(c.data.garantiaImporteEur.toFixed(2));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarConfig();
  }, [cargarConfig]);

  function patchConfig(parche: Partial<EmpresaReservasConfig>) {
    setConfig((prev) => (prev ? ({ ...prev, ...parche } as EmpresaReservasConfig) : prev));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await upsertReservasConfig(parche);
      if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    }, 500);
  }

  /**
   * Valida un importe en euros escrito a mano (acepta coma o punto) y lo
   * persiste si cambió. Sirve a las dos políticas: solo cambian los límites y
   * la clave de config que se guarda.
   */
  function commitImporte(
    raw: string,
    opts: {
      actual: number;
      min: number;
      max: number;
      fallback: number;
      setStr: (v: string) => void;
      guardar: (v: number) => void;
    },
  ) {
    const norm = raw.replace(",", ".").trim();
    const n = Number(norm);
    if (!Number.isFinite(n) || n < opts.min) {
      toast.error(`El importe mínimo es ${opts.min.toFixed(2)} €`);
      opts.setStr((opts.actual || opts.fallback).toFixed(2));
      return;
    }
    if (n > opts.max) {
      toast.error(`El importe máximo es ${opts.max.toFixed(2)} €`);
      opts.setStr(opts.max.toFixed(2));
      opts.guardar(opts.max);
      return;
    }
    const redondeado = Math.round(n * 100) / 100;
    opts.setStr(redondeado.toFixed(2));
    if (redondeado !== opts.actual) opts.guardar(redondeado);
  }

  if (loading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* === Política de cancelación === */}
      <section className="space-y-4">
        <PoliticaCabecera
          titulo="Política de cancelación"
          descripcion={
            'Condiciones que se aplican cuando una reserva se marca con "Política de cancelación". El texto que ve el cliente es el mismo para todas las empresas; solo el importe y las horas son editables.'
          }
          activa={config.cancelacionActiva}
          onToggle={(v) => patchConfig({ cancelacionActiva: v })}
        />

        {config.cancelacionActiva && (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-foreground/90">
              {CANCELACION_TEXTO_FIJO}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs">Tiempo mínimo de cancelación</Label>
                <Select
                  value={String(config.cancelacionHorasAntes)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n)) patchConfig({ cancelacionHorasAntes: n });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORAS_OPCIONES.map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-xs">
                        {h} {h === 1 ? "hora" : "horas"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground md:pt-7">
                Tiempo mínimo en el que el cliente puede cancelar sin que se le aplique
                política de cancelación. Solo horas completas ({CANCELACION_HORAS_MIN}–
                {CANCELACION_HORAS_MAX} h).
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs">Importe a cobrar (€)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Euros"
                  value={importeStr}
                  onChange={(e) => {
                    // Permite escribir libremente; valida al perder foco.
                    const v = e.target.value;
                    if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(v) || v === "") setImporteStr(v);
                  }}
                  onBlur={(e) =>
                    commitImporte(e.target.value, {
                      actual: config.cancelacionImporteEur,
                      min: CANCELACION_IMPORTE_MIN,
                      max: CANCELACION_IMPORTE_MAX,
                      fallback: CANCELACION_IMPORTE_DEFAULT,
                      setStr: setImporteStr,
                      guardar: (v) => patchConfig({ cancelacionImporteEur: v }),
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground md:pt-7">
                Se efectuará un cargo al cliente por esta cantidad si no se presenta o
                cancela a menos de ({config.cancelacionHorasAntes}) horas. Mínimo{" "}
                {CANCELACION_IMPORTE_MIN.toFixed(2)} €, máximo 2 decimales.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="text-xs text-foreground/90 leading-relaxed max-w-[70%]">
                  Personalizar mensaje por defecto al pedir tarjeta de política de
                  cancelación
                </div>
                <SiNoRadio
                  value={config.cancelacionPersonalizarMensaje}
                  onChange={(v) =>
                    patchConfig({
                      cancelacionPersonalizarMensaje: v,
                      // Si lo apaga, no borra el texto: lo conserva por si lo reactivan.
                    })
                  }
                />
              </div>
              {config.cancelacionPersonalizarMensaje && (
                <Textarea
                  placeholder="Texto que se añadirá al correo cuando la reserva tenga política de cancelación."
                  value={config.cancelacionMensajePersonalizado ?? ""}
                  onChange={(e) =>
                    patchConfig({ cancelacionMensajePersonalizado: e.target.value })
                  }
                  className="text-xs min-h-[80px]"
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                El otro caso (mensaje al pedir tarjeta cuando se vende un producto
                directamente) se configura en el apartado de Ticket.
              </p>
            </div>

            <CondicionesPoliticaPanel
              acento="cancelacion"
              valor={condicionesDe(config, "cancelacion")}
              onChange={(parche) => patchConfig(prefijar(parche, "cancelacion"))}
            />
          </>
        )}
      </section>

      <Separator />

      {/* === Política de garantía === */}
      <section className="space-y-4">
        <PoliticaCabecera
          titulo="Política de garantía"
          descripcion={
            'Importe que se retiene al confirmar la reserva y se libera al presentarse el cliente. Se aplica a las reservas marcadas con "Política de garantía".'
          }
          activa={config.garantiaActiva}
          onToggle={(v) => patchConfig({ garantiaActiva: v })}
        />

        {config.garantiaActiva && (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-foreground/90">
              {GARANTIA_TEXTO_FIJO}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs">Importe a retener (€)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Euros"
                  value={garantiaImporteStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(v) || v === "") setGarantiaImporteStr(v);
                  }}
                  onBlur={(e) =>
                    commitImporte(e.target.value, {
                      actual: config.garantiaImporteEur,
                      min: GARANTIA_IMPORTE_MIN,
                      max: GARANTIA_IMPORTE_MAX,
                      fallback: GARANTIA_IMPORTE_DEFAULT,
                      setStr: setGarantiaImporteStr,
                      guardar: (v) => patchConfig({ garantiaImporteEur: v }),
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground md:pt-7">
                Cantidad que se retiene por reserva al introducir la tarjeta. Mínimo{" "}
                {GARANTIA_IMPORTE_MIN.toFixed(2)} €, máximo 2 decimales.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs">Se aplica</Label>
                <Select
                  value={config.garantiaModo}
                  onValueChange={(v) => patchConfig({ garantiaModo: v as GarantiaModo })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GARANTIA_MODOS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {GARANTIA_MODO_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground md:pt-7">
                Si eliges &quot;por comensal&quot;, el importe retenido se multiplica por
                el número de personas de la reserva.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs">Tiempo mínimo de aviso</Label>
                <Select
                  value={String(config.garantiaHorasAntes)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n)) patchConfig({ garantiaHorasAntes: n });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORAS_OPCIONES.map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-xs">
                        {h} {h === 1 ? "hora" : "horas"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground md:pt-7">
                Con cuánta antelación tiene que cancelar el cliente para que no se le
                cobre la garantía. Si cancela más tarde, o no se presenta, se cobra.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="text-xs text-foreground/90 leading-relaxed max-w-[70%]">
                  Personalizar mensaje por defecto al pedir tarjeta de garantía
                </div>
                <SiNoRadio
                  value={config.garantiaPersonalizarMensaje}
                  onChange={(v) => patchConfig({ garantiaPersonalizarMensaje: v })}
                />
              </div>
              {config.garantiaPersonalizarMensaje && (
                <Textarea
                  placeholder="Texto que se añadirá al correo cuando la reserva tenga política de garantía."
                  value={config.garantiaMensajePersonalizado ?? ""}
                  onChange={(e) =>
                    patchConfig({ garantiaMensajePersonalizado: e.target.value })
                  }
                  className="text-xs min-h-[80px]"
                />
              )}
            </div>

            <CondicionesPoliticaPanel
              acento="garantia"
              valor={condicionesDe(config, "garantia")}
              onChange={(parche) => patchConfig(prefijar(parche, "garantia"))}
            />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Las condiciones de las dos políticas viven en `EmpresaReservasConfig` con el
 * nombre de la política como prefijo (`garantiaDesdePax`,
 * `cancelacionDesdePax`…). Estas dos funciones traducen entre ese formato y el
 * que usa el panel, que es igual para ambas.
 */
type Prefijo = "cancelacion" | "garantia";

function condicionesDe(config: EmpresaReservasConfig, p: Prefijo): CondicionesValor {
  const c = config as unknown as Record<string, unknown>;
  return {
    desdePax: Number(c[`${p}DesdePax`] ?? 0),
    diasSemana: (c[`${p}DiasSemana`] as CondicionesValor["diasSemana"]) ?? [],
    fechas: (c[`${p}Fechas`] as string[]) ?? [],
    turnos: (c[`${p}Turnos`] as string[]) ?? [],
    horaDesde: (c[`${p}HoraDesde`] as string | null) ?? null,
    horaHasta: (c[`${p}HoraHasta`] as string | null) ?? null,
    grupoZonaIds: (c[`${p}GrupoZonaIds`] as string[]) ?? [],
    mesaIds: (c[`${p}MesaIds`] as string[]) ?? [],
  };
}

function prefijar(
  parche: Partial<CondicionesValor>,
  p: Prefijo,
): Partial<EmpresaReservasConfig> {
  const out: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(parche)) {
    out[`${p}${clave.charAt(0).toUpperCase()}${clave.slice(1)}`] = valor;
  }
  return out as Partial<EmpresaReservasConfig>;
}

/** Cabecera de una política: título, explicación y el interruptor que la activa. */
function PoliticaCabecera({
  titulo,
  descripcion,
  activa,
  onToggle,
}: {
  titulo: string;
  descripcion: string;
  activa: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h4 className="text-sm font-semibold mb-1">{titulo}</h4>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <span className="text-xs text-muted-foreground">
          {activa ? "Activa" : "Inactiva"}
        </span>
        <Switch checked={activa} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

function SiNoRadio({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 shrink-0">
      <RadioPill label="No" active={!value} onClick={() => onChange(false)} />
      <RadioPill label="Sí" active={value} onClick={() => onChange(true)} />
    </div>
  );
}

function RadioPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs"
    >
      <span
        className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${active ? "border-primary" : "border-muted-foreground/40"}`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {label}
    </button>
  );
}
