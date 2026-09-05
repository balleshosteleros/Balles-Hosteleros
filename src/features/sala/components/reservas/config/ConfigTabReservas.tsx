"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DURACION_RESERVA_DEFAULT_MINUTOS,
  DURACION_RESERVA_OPCIONES,
  formatearDuracionReserva,
  RECONFIRMACION_DIAS_MAX,
  RECONFIRMACION_DIAS_MIN,
  type EmpresaReservasConfig,
} from "@/features/sala/data/reservas";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import { LimitesReglas, type PanelPendienteHandle } from "./LimitesReglas";
import { HorariosAperturaPanel } from "./HorariosAperturaPanel";
import { MotorWebPanel } from "./MotorWebPanel";
import { ReglasIntervaloPanel } from "./ReglasIntervaloPanel";

interface ConfigTabReservasProps {
  /** Avisa al contenedor de si quedan cambios sin guardar, para poder frenar
   *  la salida antes de perderlos. */
  onDirtyChange?: (hayCambios: boolean) => void;
}

export function ConfigTabReservas({ onDirtyChange }: ConfigTabReservasProps = {}) {
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  /** Solo los campos tocados desde el último guardado: se envían únicamente esos. */
  const [pendiente, setPendiente] = useState<Partial<EmpresaReservasConfig>>({});
  const [loading, setLoading] = useState(true);
  /** La configuración no llegó: se avisa y se ofrece reintentar. */
  const [falloCarga, setFalloCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Los numéricos se editan como texto: si el estado fuera el número, borrar el
  // contenido lo repondría a 0 y al teclear saldría "015" en vez de "15".
  const [antelacionMin, setAntelacionMin] = useState("0");
  const [antelacionMax, setAntelacionMax] = useState("90");

  // Los paneles de listas (horarios, aforo, intervalo) llevan sus propios
  // pendientes: viven en tablas aparte y no caben en el parche de campos. Cada
  // uno expone si tiene cambios y cómo volcarlos.
  const horariosRef = useRef<PanelPendienteHandle | null>(null);
  const aforoRef = useRef<PanelPendienteHandle | null>(null);
  const intervaloRef = useRef<PanelPendienteHandle | null>(null);
  // Los paneles avisan cuando cambian; esto solo fuerza el repintado para que
  // el botón Guardar se entere.
  const [, setTickPaneles] = useState(0);
  const avisarPanelSucio = useCallback(() => setTickPaneles((n) => n + 1), []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setFalloCarga(false);
    try {
      const c = await getReservasConfig();
      if (c.ok && c.data) {
        setConfig(c.data);
        setPendiente({});
        setAntelacionMin(String(c.data.antelacionMinMinutos));
        setAntelacionMax(String(c.data.antelacionMaxDias));
      } else {
        // Sin esto la pantalla se quedaba en los recuadros grises PARA SIEMPRE,
        // sin decir nada: `config` seguía a null y el `if` de abajo no salía
        // nunca. Parecía que el software se habia colgado.
        setFalloCarga(true);
      }
    } catch {
      setFalloCarga(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Nada se escribe al vuelo: se acumula y espera al botón Guardar.
  function handleConfigChange(parche: Partial<EmpresaReservasConfig>) {
    setConfig((prev) => (prev ? ({ ...prev, ...parche } as EmpresaReservasConfig) : prev));
    setPendiente((prev) => ({ ...prev, ...parche }));
  }

  const hayCamposPendientes = Object.keys(pendiente).length > 0;
  const paneles = [horariosRef, aforoRef, intervaloRef];
  const hayCambios =
    hayCamposPendientes || paneles.some((p) => p.current?.hayCambios === true);

  // El contenedor necesita saberlo para poder frenar la salida.
  useEffect(() => {
    onDirtyChange?.(hayCambios);
  }, [hayCambios, onDirtyChange]);

  // Al desmontar deja de haber nada pendiente que proteger.
  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  async function handleGuardar() {
    if (!hayCambios) return;
    setGuardando(true);
    try {
      // Algún panel puede tener campos de config en borrador (p. ej. la hora de
      // apertura que se ve arriba sin haber pulsado "Aplicar al día"). Se piden
      // ANTES de escribir: la config va en un solo upsert, así que lo que
      // llegase después se perdería.
      let parche = { ...pendiente };
      for (const panel of paneles) {
        const suyo = panel.current?.parcheConfigPendiente?.();
        if (suyo === null) return; // borrador inválido; el panel ya ha avisado
        if (suyo) parche = { ...parche, ...suyo };
      }

      if (Object.keys(parche).length > 0) {
        const res = await upsertReservasConfig(parche);
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar");
          return;
        }
        setConfig((prev) => (prev ? ({ ...prev, ...parche } as EmpresaReservasConfig) : prev));
        setPendiente({});
      }
      // Cada panel vuelca lo suyo. Si uno falla, se para: ya ha avisado del
      // motivo y lo que quede pendiente sigue en pantalla para reintentarlo.
      for (const panel of paneles) {
        if (!panel.current?.hayCambios) continue;
        const ok = await panel.current.guardar();
        if (!ok) return;
      }
      toast.success("Configuración guardada");
    } finally {
      setGuardando(false);
    }
  }

  if (!loading && (falloCarga || !config)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No se ha podido cargar la configuración de reservas.
        </p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Botón de guardar, pegado arriba para tenerlo a mano en una pestaña
          tan larga. Sin franja ni textos: la barra anterior explicaba en cada
          carga algo que ya se entiende con ver el botón, y su fondo de color
          partía la pantalla en dos. Solo se avisa cuando hay algo que perder. */}
      <div className="sticky top-0 z-20 -mx-1 flex items-center justify-end gap-3 bg-background/95 px-1 py-2 backdrop-blur">
        {hayCambios && (
          <span className="text-xs text-muted-foreground">Cambios sin guardar</span>
        )}
        <Button size="sm" onClick={handleGuardar} disabled={!hayCambios || guardando}>
          Guardar
        </Button>
      </div>

      <HorariosAperturaPanel
        config={config}
        onChange={handleConfigChange}
        handleRef={horariosRef}
        onDirtyChange={avisarPanelSucio}
      />

      <Separator />

      <LimitesReglas handleRef={aforoRef} onDirtyChange={avisarPanelSucio} />

      <Separator />

      <ReglasIntervaloPanel handleRef={intervaloRef} onDirtyChange={avisarPanelSucio} />

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Duración de la reserva</h4>
        <p className="text-xs text-muted-foreground -mt-2">
          Tiempo que una mesa queda ocupada por cada reserva. Aplica a todos los planos y a todas las reservas: el sistema no aceptará una reserva nueva en una mesa que ya tenga otra dentro de esta ventana.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs">Duración por reserva</Label>
            <Select
              value={String(config.duracionReservaMin)}
              onValueChange={(v) =>
                handleConfigChange({ duracionReservaMin: Number(v) })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURACION_RESERVA_OPCIONES.map((o) => (
                  <SelectItem key={o.minutos} value={String(o.minutos)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              De 15 minutos a 6 horas, en tramos de 15. Por defecto {formatearDuracionReserva(DURACION_RESERVA_DEFAULT_MINUTOS)}.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Antelación para reservar online</h4>
        <p className="text-xs text-muted-foreground -mt-2">
          Con cuánto tiempo puede el cliente reservar desde el portal de reservas
          por internet. Solo afecta al canal online: el personal puede crear una
          reserva desde sala a cualquier hora, sin estos límites. Valor general
          (no se diferencia por día).
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs">Antelación mínima (minutos)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              value={antelacionMin}
              onChange={(e) => {
                // Se deja escribir libre (incluido vacío) y se acota al salir:
                // acotar en cada tecla hace que un 0 previo se pegue delante y
                // salga "015" al teclear.
                const txt = e.target.value;
                setAntelacionMin(txt);
                const n = Number(txt);
                if (txt !== "" && Number.isFinite(n)) {
                  handleConfigChange({
                    antelacionMinMinutos: Math.min(1440, Math.max(0, n)),
                  });
                }
              }}
              onBlur={() => {
                const n = Math.min(1440, Math.max(0, Number(antelacionMin) || 0));
                setAntelacionMin(String(n));
                handleConfigChange({ antelacionMinMinutos: n });
              }}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Tiempo mínimo antes de la hora de la reserva. Ej.: con 60, a las
              20:00 la primera hora reservable online son las 21:00. Con 0, hasta
              última hora. Máximo 1.440 min (24 h).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Antelación máxima (días)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={antelacionMax}
              onChange={(e) => {
                const txt = e.target.value;
                setAntelacionMax(txt);
                const n = Number(txt);
                if (txt !== "" && Number.isFinite(n)) {
                  handleConfigChange({
                    antelacionMaxDias: Math.min(365, Math.max(1, n)),
                  });
                }
              }}
              onBlur={() => {
                const n = Math.min(365, Math.max(1, Number(antelacionMax) || 90));
                setAntelacionMax(String(n));
                handleConfigChange({ antelacionMaxDias: n });
              }}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Con cuántos días de adelanto como mucho se puede reservar online.
              Máximo 365 días (1 año).
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Reconfirmación</h4>
        <p className="text-xs text-muted-foreground -mt-2">
          Correo automático para que el cliente reconfirme su asistencia antes
          del servicio.
        </p>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3 max-w-md">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium" htmlFor="reconf-activa">
              Reconfirmación activa
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Si está apagado, no se envía ningún correo de reconfirmación.
            </p>
          </div>
          <Switch
            id="reconf-activa"
            checked={config.reconfirmacionActiva}
            onCheckedChange={(v) =>
              handleConfigChange({ reconfirmacionActiva: Boolean(v) })
            }
          />
        </div>

        {config.reconfirmacionActiva && (
          <>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1.5">
                <Label className="text-xs">Enviar reconfirmación</Label>
                <Select
                  value={String(config.reconfirmacionDiasAntes)}
                  onValueChange={(v) => {
                    const n = Math.min(
                      RECONFIRMACION_DIAS_MAX,
                      Math.max(RECONFIRMACION_DIAS_MIN, Number(v) || 0),
                    );
                    handleConfigChange({ reconfirmacionDiasAntes: n });
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: RECONFIRMACION_DIAS_MAX - RECONFIRMACION_DIAS_MIN + 1 },
                      (_, i) => i + RECONFIRMACION_DIAS_MIN,
                    ).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d === 0
                          ? "El mismo día"
                          : d === 1
                            ? "1 día antes"
                            : `${d} días antes`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Con «El mismo día», cada mañana a la hora elegida se pide la
                  reconfirmación de los servicios de ese día.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="reconf-hora-envio">
                  A qué hora
                </Label>
                <Select
                  value={config.reconfirmacionHoraEnvio}
                  onValueChange={(v) =>
                    handleConfigChange({ reconfirmacionHoraEnvio: v })
                  }
                >
                  <SelectTrigger className="h-8" id="reconf-hora-envio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => {
                      const hh = `${String(h).padStart(2, "0")}:00`;
                      return (
                        <SelectItem key={hh} value={hh}>
                          {hh}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Hora del restaurante. Se respeta todo el año: el cambio de
                  hora de octubre y marzo no la mueve.
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border p-3 max-w-md">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium" htmlFor="reconf-envio-inmediato">
                  Reconfirmar al instante si la reserva entra cuando su envío
                  ya ha pasado
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Ej.: con «El mismo día» a las 10:00, quien reserva hoy a las
                  18:00 para esta noche ya no llega a ese envío. Si está
                  activo, recibe la reconfirmación a la vez que la
                  confirmación; si está apagado, no la recibe. A las demás les
                  llega siempre a la hora elegida.
                </p>
              </div>
              <Switch
                id="reconf-envio-inmediato"
                checked={config.reconfirmacionEnvioInmediato}
                onCheckedChange={(v) =>
                  handleConfigChange({ reconfirmacionEnvioInmediato: Boolean(v) })
                }
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      <MotorWebPanel config={config} onChange={handleConfigChange} />
    </div>
  );
}
