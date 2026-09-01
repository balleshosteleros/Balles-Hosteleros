"use client";

/**
 * Ajustes de WhatsApp y SMS dentro de "Comunicaciones".
 *
 * Responde a tres preguntas, en este orden: si la conexión está viva, qué
 * avisos salen por WhatsApp, y hasta cuánto se puede gastar al mes.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { NumberInput } from "@/shared/components/NumberInput";
import {
  getMensajeriaConfig,
  guardarMensajeriaConfig,
  TIPOS_AVISO,
  TIPO_AVISO_LABEL,
  TIPO_AVISO_DESCRIPCION,
  type MensajeriaConfigVista,
  type EstadoAlta,
} from "@/features/mensajeria/actions/config-actions";
import { formatearImporte } from "@/features/mensajeria/data/monedero";

const ESTADO_TEXTO: Record<EstadoAlta, { etiqueta: string; explicacion: string }> = {
  SIN_CONECTAR: {
    etiqueta: "Sin conectar",
    explicacion:
      "Todavía no hay un número de WhatsApp conectado. Sin él, los avisos solo pueden salir por correo.",
  },
  PENDIENTE_VERIFICACION: {
    etiqueta: "Verificación en curso",
    explicacion:
      "Ya se puede enviar, pero con un límite bajo de mensajes al día hasta que se complete la verificación.",
  },
  ACTIVO: {
    etiqueta: "Conectado",
    explicacion: "El WhatsApp está funcionando con normalidad.",
  },
  SUSPENDIDO: {
    etiqueta: "Suspendido",
    explicacion:
      "La conexión está parada y no sale ningún mensaje. Los avisos siguen saliendo por correo.",
  },
};

export function CanalesMensajeriaPanel() {
  const [config, setConfig] = useState<MensajeriaConfigVista | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setConfig(await getMensajeriaConfig());
    setLoading(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardar(cambio: Parameters<typeof guardarMensajeriaConfig>[0]) {
    if (!config) return;
    setGuardando(true);
    const res = await guardarMensajeriaConfig(cambio);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    void cargar();
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!config) return null;

  const estado = ESTADO_TEXTO[config.estadoAlta];
  const conectado = config.estadoAlta === "ACTIVO" || config.estadoAlta === "PENDIENTE_VERIFICACION";

  return (
    <div className="space-y-4">
      {/* ── Estado de la conexión ────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">WhatsApp y SMS</h3>
                <Badge variant={conectado ? "default" : "secondary"} className="text-[10px]">
                  {estado.etiqueta}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{estado.explicacion}</p>

              {config.whatsappNumero && (
                <p className="mt-2 text-xs">
                  <span className="text-muted-foreground">Número: </span>
                  <span className="font-medium tabular-nums">{config.whatsappNumero}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!conectado ? (
        <Card>
          <CardContent className="flex items-start gap-2 pt-6 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Conecta un número de WhatsApp para poder activar estos avisos.
              Mientras tanto, todo sigue saliendo por correo con normalidad.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Canales ──────────────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-sm">Enviar por WhatsApp</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Es el canal principal: cuesta la mitad que un SMS y se lee mucho más.
                  </p>
                </div>
                <Switch
                  checked={config.whatsappActivo}
                  disabled={guardando}
                  onCheckedChange={(v) => guardar({ whatsappActivo: v })}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-sm">Enviar por SMS</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Llega a cualquier móvil, tenga WhatsApp o no.
                  </p>
                </div>
                <Switch
                  checked={config.smsActivo}
                  disabled={guardando}
                  onCheckedChange={(v) => guardar({ smsActivo: v })}
                />
              </div>

              {config.whatsappActivo && config.smsActivo && (
                <div className="flex items-center justify-between gap-4 border-t pt-4">
                  <div className="min-w-0">
                    <Label className="text-sm">Usar el SMS solo si falla el WhatsApp</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Recomendado: así solo se paga el SMS cuando el cliente no
                      tiene WhatsApp. Si lo apagas, cada aviso sale por los dos.
                    </p>
                  </div>
                  <Switch
                    checked={config.smsRespaldoActivo}
                    disabled={guardando}
                    onCheckedChange={(v) => guardar({ smsRespaldoActivo: v })}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Qué avisos salen ─────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-1 text-sm font-medium">Qué avisos se envían</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Todos llevan el enlace para que el cliente pueda cancelar.
              </p>

              <div className="space-y-4">
                {TIPOS_AVISO.map((tipo) => (
                  <div key={tipo} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Label className="text-sm">{TIPO_AVISO_LABEL[tipo]}</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TIPO_AVISO_DESCRIPCION[tipo]}
                      </p>
                    </div>
                    <Switch
                      checked={config.avisosActivos[tipo] === true}
                      disabled={guardando}
                      onCheckedChange={(v) =>
                        guardar({
                          avisosActivos: { ...config.avisosActivos, [tipo]: v },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                La petición de valoración se envía solo por correo: por WhatsApp
                molesta y hace que la gente bloquee el número.
              </p>
            </CardContent>
          </Card>

          {/* ── Tope de gasto ────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-1 text-sm font-medium">Tope de gasto al mes</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Cuando se alcanza, deja de enviarse por WhatsApp y SMS hasta el
                mes siguiente. Los avisos siguen saliendo por correo. Déjalo
                vacío para no poner tope.
              </p>

              <div className="flex flex-wrap items-end gap-4">
                <div className="w-40">
                  <Label htmlFor="tope" className="text-xs">
                    Tope en euros
                  </Label>
                  <NumberInput
                    id="tope"
                    value={
                      config.topeMensualCents != null
                        ? config.topeMensualCents / 100
                        : null
                    }
                    // `emptyValue={0}`: vaciar el campo son cero euros, que aquí
                    // significa "sin tope" y no "no dejes enviar nada".
                    emptyValue={0}
                    onValueChange={(v) =>
                      guardar({
                        topeMensualCents: v <= 0 ? null : Math.round(v * 100),
                      })
                    }
                    min={0}
                    max={10000}
                    className="mt-1.5"
                  />
                </div>

                <p className="pb-2 text-xs text-muted-foreground">
                  Llevas gastado{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatearImporte(config.gastoMesCents)}
                  </span>{" "}
                  este mes.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
