"use client";

/**
 * Panel "Comunicaciones" del menú de configuración de Reservas.
 *
 * El listado va partido en las dos familias que existen, y solo esas dos:
 *
 *   Por estado    → un correo por cada estado real de la reserva. Walk-in no
 *                   aparece: es un ORIGEN, no un estado (el cliente entró sin
 *                   reservar), así que no hay a quién escribirle.
 *   Por política  → procesos que no son un cambio de estado: compra de ticket,
 *                   reserva con ticket, condiciones de cancelación, condiciones
 *                   de garantía, recordatorio y solicitud de valoración.
 *
 * De cada plantilla la empresa edita el asunto, el mensaje y si se envía o no.
 * El marco visual (cabecera con logo y color, tarjeta de datos, pie) viene de
 * fábrica y NO es editable: es lo que hace que los catorce correos se lean como
 * del mismo restaurante.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, RotateCcw, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  RESERVA_EMAIL_ESTADO_TRANSITORIO,
  RESERVA_EMAIL_TIPOS_ESTADO,
  RESERVA_EMAIL_TIPOS_POLITICA,
  RESERVA_EMAIL_TIPO_LABELS,
  RESERVA_EMAIL_TIPO_DESCRIPCION,
  esTipoEstado,
  type ReservaEmailTipo,
} from "@/lib/seeds/reserva-email-plantillas";
import {
  listReservaEmailPlantillas,
  updateReservaEmailPlantilla,
  resetReservaEmailPlantilla,
  previewReservaEmailPlantilla,
  type ReservaEmailPlantilla,
} from "@/features/sala/actions/reserva-email-plantillas-actions";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import type { EmpresaReservasConfig } from "@/features/sala/data/reservas";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { CanalesMensajeriaPanel } from "@/features/mensajeria/components/CanalesMensajeriaPanel";
import { cn } from "@/lib/utils";

const HORAS_RECORDATORIO: number[] = [1, 2, 3, 4, 6, 8, 12, 24, 48];

/**
 * Cuándo pedir la valoración, contado desde la HORA de la reserva.
 *
 * Los valores altos se etiquetan en días porque es como se piensa ("al día
 * siguiente"), no en horas. Por defecto 1 día: la visita sigue reciente y el
 * correo cae a la misma hora a la que vino, sin madrugar al cliente.
 */
const HORAS_VALORACION: { valor: number; etiqueta: string }[] = [
  { valor: 2, etiqueta: "2 h" },
  { valor: 4, etiqueta: "4 h" },
  { valor: 12, etiqueta: "12 h" },
  { valor: 24, etiqueta: "1 día" },
  { valor: 48, etiqueta: "2 días" },
  { valor: 72, etiqueta: "3 días" },
  { valor: 168, etiqueta: "1 semana" },
];

/**
 * Qué puede preguntar la encuesta de valoración. Cada empresa enciende solo lo
 * que valora: HABANA, por ejemplo, nunca ha puntuado la cocina. La nota general
 * no está aquí porque se pregunta siempre.
 */
const VALORACION_CAMPOS = [
  { clave: "valoracionPideCocina",   etiqueta: "Cocina" },
  { clave: "valoracionPideServicio", etiqueta: "Servicio" },
  { clave: "valoracionPideAmbiente", etiqueta: "Ambiente" },
] as const satisfies readonly {
  clave: keyof EmpresaReservasConfig;
  etiqueta: string;
}[];

export function ComunicacionesPanel() {
  const { confirm: confirmReset, dialog: confirmResetDialog } = useConfirmDelete();
  const [plantillas, setPlantillas] = useState<ReservaEmailPlantilla[]>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTipo, setSelectedTipo] = useState<ReservaEmailTipo>("CONFIRMADA");

  // Buffer de edición local (no se guarda hasta pulsar "Guardar").
  const [draftAsunto, setDraftAsunto] = useState("");
  const [draftMensaje, setDraftMensaje] = useState("");
  const [draftActiva, setDraftActiva] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Preview HTML
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [tpls, cfg] = await Promise.all([
      listReservaEmailPlantillas(),
      getReservasConfig(),
    ]);
    if (tpls.ok) setPlantillas(tpls.data);
    if (cfg.ok && cfg.data) setConfig(cfg.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const selected = useMemo(
    () => plantillas.find((p) => p.tipo === selectedTipo),
    [plantillas, selectedTipo],
  );

  // Al cambiar de tipo seleccionado, cargar el buffer.
  useEffect(() => {
    if (!selected) return;
    setDraftAsunto(selected.asuntoPersonalizado ?? "");
    setDraftMensaje(selected.mensajePersonalizado ?? "");
    setDraftActiva(selected.activa);
    setDirty(false);
  }, [selected]);

  // Preview: re-render con debounce cuando cambian draft o tipo.
  useEffect(() => {
    let cancelado = false;
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      const res = await previewReservaEmailPlantilla({
        tipo: selectedTipo,
        asuntoOverride: draftAsunto.trim() === "" ? null : draftAsunto,
        mensajeOverride: draftMensaje.trim() === "" ? null : draftMensaje,
      });
      if (cancelado) return;
      if (res.ok && res.html) setPreviewHtml(res.html);
      setPreviewLoading(false);
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(handle);
    };
  }, [selectedTipo, draftAsunto, draftMensaje]);

  const esRecordatorio = selectedTipo === "RECORDATORIO";
  const esValoracion = selectedTipo === "SOLICITUD_VALORACION";
  // Un estado transitorio se avisa, no se explica: el correo dice que la
  // reserva ha cambiado de estado y poco más. Se advierte aquí para que nadie
  // escriba un texto largo que en ese correo no pinta nada.
  const esTransitorio =
    esTipoEstado(selectedTipo) && RESERVA_EMAIL_ESTADO_TRANSITORIO[selectedTipo];

  async function guardar() {
    if (!selected) return;
    setGuardando(true);
    const res = await updateReservaEmailPlantilla({
      tipo: selectedTipo,
      activa: draftActiva,
      asuntoPersonalizado: draftAsunto.trim() === "" ? null : draftAsunto,
      mensajePersonalizado: draftMensaje.trim() === "" ? null : draftMensaje,
    });
    setGuardando(false);
    if (res.ok) {
      toast.success("Plantilla guardada");
      setDirty(false);
      cargar();
    } else {
      toast.error(res.error ?? "Error al guardar");
    }
  }

  async function restablecer() {
    if (!selected) return;
    const ok = await confirmReset({
      title: "Restablecer al texto de fábrica",
      description: "Se perderá tu personalización.",
      confirmLabel: "Restablecer",
    });
    if (!ok) return;
    const res = await resetReservaEmailPlantilla(selectedTipo);
    if (res.ok) {
      toast.success("Restablecido");
      cargar();
    } else {
      toast.error(res.error ?? "Error");
    }
  }

  async function actualizarRecordatorio(updates: Partial<EmpresaReservasConfig>) {
    const res = await upsertReservasConfig(updates);
    if (res.ok) {
      setConfig((c) => (c ? { ...c, ...updates } : c));
    } else {
      toast.error(res.error ?? "Error");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmResetDialog}

      {/* WhatsApp y SMS van primero: es el canal que el cliente lee de verdad,
          y el correo es el que queda siempre por debajo como red de seguridad. */}
      <CanalesMensajeriaPanel />

      <div>
        <h2 className="text-base font-semibold text-foreground">Plantillas de correo al cliente</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Personaliza el asunto y el mensaje. La cabecera con el logo, los datos
          de la reserva y el pie vienen de fábrica para mantener una imagen coherente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* Listado, partido en las dos familias reales */}
        <Card>
          <CardContent className="p-0">
            {(
              [
                {
                  titulo: "Por estado",
                  ayuda: "Se envían cuando la reserva entra en ese estado.",
                  tipos: RESERVA_EMAIL_TIPOS_ESTADO as readonly ReservaEmailTipo[],
                },
                {
                  titulo: "Por política",
                  ayuda: "No dependen del estado, sino de un proceso o una política.",
                  tipos: RESERVA_EMAIL_TIPOS_POLITICA as readonly ReservaEmailTipo[],
                },
              ] as const
            ).map((seccion) => (
              <div key={seccion.titulo}>
                <div className="px-3 py-2 bg-muted/40 border-y border-border first:border-t-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    {seccion.titulo}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {seccion.ayuda}
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {seccion.tipos.map((tipo) => {
                    const p = plantillas.find((x) => x.tipo === tipo);
                    const personalizada =
                      !!(p?.asuntoPersonalizado || p?.mensajePersonalizado);
                    const activa = p?.activa ?? true;
                    const transitorio =
                      esTipoEstado(tipo) && RESERVA_EMAIL_ESTADO_TRANSITORIO[tipo];
                    return (
                      <li key={tipo}>
                        <button
                          type="button"
                          onClick={() => setSelectedTipo(tipo)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 text-xs hover:bg-muted/40 transition-colors",
                            selectedTipo === tipo && "bg-muted/60",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">
                                {RESERVA_EMAIL_TIPO_LABELS[tipo]}
                              </span>
                            </div>
                            {!activa && (
                              <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                Pausada
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {transitorio && (
                              <Badge variant="secondary" className="text-[9px] h-4">
                                Aviso de cambio
                              </Badge>
                            )}
                            {personalizada && (
                              <Badge variant="default" className="text-[9px] h-4">
                                Personalizada
                              </Badge>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Editor + preview */}
        <Card>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">
              {RESERVA_EMAIL_TIPO_LABELS[selectedTipo]}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {RESERVA_EMAIL_TIPO_DESCRIPCION[selectedTipo]}
            </p>
          </div>
          <CardContent className="p-5 space-y-4">
            {esTransitorio && (
              <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  Este estado es de paso: el cliente no tiene que hacer nada al
                  recibirlo. Mantén el mensaje corto, como un aviso de que su
                  reserva ha cambiado de estado.
                </div>
              </div>
            )}

            {esRecordatorio && config && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Recordatorio automático</Label>
                  <Switch
                    checked={config.recordatorioActivo}
                    onCheckedChange={(v) =>
                      actualizarRecordatorio({ recordatorioActivo: v })
                    }
                  />
                </div>
                {config.recordatorioActivo && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Enviar
                    </Label>
                    <Select
                      value={String(config.recordatorioHorasAntes)}
                      onValueChange={(v) =>
                        actualizarRecordatorio({
                          recordatorioHorasAntes: Number(v),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HORAS_RECORDATORIO.map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {h} h
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label className="text-xs text-muted-foreground">
                      antes de la reserva
                    </Label>
                  </div>
                )}
              </div>
            )}

            {esValoracion && config && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Solicitud de valoración automática</Label>
                  <Switch
                    checked={config.valoracionEmailActivo}
                    onCheckedChange={(v) =>
                      actualizarRecordatorio({ valoracionEmailActivo: v })
                    }
                  />
                </div>
                {config.valoracionEmailActivo && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Enviar
                      </Label>
                      <Select
                        value={String(config.valoracionEmailHorasDespues)}
                        onValueChange={(v) =>
                          actualizarRecordatorio({
                            valoracionEmailHorasDespues: Number(v),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HORAS_VALORACION.map((h) => (
                            <SelectItem key={h.valor} value={String(h.valor)}>
                              {h.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label className="text-xs text-muted-foreground">
                        después de la reserva
                      </Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Este plazo se aplica a todas las reservas de la empresa.
                      Solo se pide valoración a quien vino y dejó su email, una
                      sola vez por reserva.
                    </p>

                    <div className="pt-1 space-y-2 border-t border-border">
                      <Label className="text-xs pt-2 block">
                        Qué se le pregunta al cliente
                      </Label>
                      {VALORACION_CAMPOS.map((campo) => (
                        <div
                          key={campo.clave}
                          className="flex items-center justify-between gap-2"
                        >
                          <Label className="text-xs text-muted-foreground font-normal">
                            {campo.etiqueta}
                          </Label>
                          <Switch
                            checked={config[campo.clave]}
                            onCheckedChange={(v) =>
                              actualizarRecordatorio({ [campo.clave]: v })
                            }
                          />
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Lo que apagues aquí deja de aparecer en la encuesta. La
                        nota general se pregunta siempre.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Asunto del correo</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="(usa el asunto de fábrica)"
                value={draftAsunto}
                onChange={(e) => {
                  setDraftAsunto(e.target.value);
                  setDirty(true);
                }}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Variables: {"{{fecha}}"}, {"{{hora}}"}, {"{{empresa}}"}, {"{{nombre}}"}, {"{{personas}}"}, {"{{zona}}"}.
              </p>
            </div>

            <div>
              <Label className="text-xs">Mensaje al cliente (opcional)</Label>
              <Textarea
                className="text-xs mt-1 min-h-[110px]"
                placeholder={
                  esTransitorio
                    ? "(usa el texto de fábrica: un aviso corto de que la reserva ha cambiado de estado)"
                    : "Añade un mensaje propio: aparecerá destacado bajo los datos de la reserva. Útil para indicaciones de aparcamiento, dress code, etc."
                }
                value={draftMensaje}
                onChange={(e) => {
                  setDraftMensaje(e.target.value);
                  setDirty(true);
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-xs">
                <div className="font-medium">Envío activado</div>
                <div className="text-muted-foreground text-[11px]">
                  Si lo desactivas, no se enviará este correo.
                </div>
              </div>
              <Switch
                checked={draftActiva}
                onCheckedChange={(v) => {
                  setDraftActiva(v);
                  setDirty(true);
                }}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={guardar} disabled={!dirty || guardando}>
                Guardar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={restablecer}
                disabled={
                  !selected?.asuntoPersonalizado &&
                  !selected?.mensajePersonalizado
                }
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restablecer
              </Button>
            </div>

            {/* Preview */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  Vista previa
                </div>
                {previewLoading && (
                  <span className="text-[10px] text-muted-foreground">
                    Actualizando…
                  </span>
                )}
              </div>
              <div className="rounded-md border border-border overflow-hidden bg-[#f1f5f9]">
                <iframe
                  title="Vista previa del correo"
                  srcDoc={previewHtml}
                  className="w-full"
                  style={{ height: 640, border: "none" }}
                  sandbox=""
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
