"use client";

/**
 * Panel "Comunicaciones" del menú de configuración de Reservas.
 *
 * Listado de las 6 plantillas de email (confirmación, reconfirmación,
 * recordatorio, cancelación, política, cupón) con editor master-detail y
 * preview HTML en vivo. La empresa puede editar:
 *   · Asunto (sólo en tipos que envían correo aparte)
 *   · Mensaje libre (texto que se inyecta en el bloque destacado)
 *   · Estado activa/inactiva
 *
 * El resto (cabecera con logo + color, datos de la reserva, footer) viene de
 * fábrica y NO es editable, para garantizar coherencia visual entre empresas.
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
  RESERVA_EMAIL_TIPOS,
  RESERVA_EMAIL_TIPO_LABELS,
  RESERVA_EMAIL_TIPO_DESCRIPCION,
  RESERVA_EMAIL_TIPO_ES_BLOQUE,
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
import { cn } from "@/lib/utils";

const HORAS_RECORDATORIO: number[] = [1, 2, 3, 4, 6, 8, 12, 24, 48];

export function ComunicacionesPanel() {
  const { confirm: confirmReset, dialog: confirmResetDialog } = useConfirmDelete();
  const [plantillas, setPlantillas] = useState<ReservaEmailPlantilla[]>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTipo, setSelectedTipo] = useState<ReservaEmailTipo>("CONFIRMACION");

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

  const esBloque = RESERVA_EMAIL_TIPO_ES_BLOQUE[selectedTipo];
  const esRecordatorio = selectedTipo === "RECORDATORIO";

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
    <div className="space-y-4">
      {confirmResetDialog}
      <div>
        <h2 className="text-base font-semibold text-foreground">Plantillas de correo al cliente</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Personaliza el asunto y el mensaje. La cabecera con el logo, los datos
          de la reserva y el pie vienen de fábrica para mantener una imagen coherente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* Listado de plantillas */}
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {RESERVA_EMAIL_TIPOS.map((tipo) => {
                const p = plantillas.find((x) => x.tipo === tipo);
                const personalizada =
                  !!(p?.asuntoPersonalizado || p?.mensajePersonalizado);
                const activa = p?.activa ?? true;
                const esBloqueRow = RESERVA_EMAIL_TIPO_ES_BLOQUE[tipo];
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
                        {esBloqueRow && (
                          <Badge variant="secondary" className="text-[9px] h-4">
                            Bloque en confirmación
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
            {esBloque && (
              <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  Este tipo no envía un correo aparte. El texto que escribas aquí
                  se añade al correo de confirmación cuando la reserva lo necesita.
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

            {!esBloque && (
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
                  Variables: {"{{fecha}}"}, {"{{hora}}"}, {"{{empresa}}"}, {"{{nombre}}"}, {"{{personas}}"}, {"{{mesa}}"}, {"{{zona}}"}.
                </p>
              </div>
            )}

            <div>
              <Label className="text-xs">
                {esBloque ? "Texto del bloque" : "Mensaje al cliente (opcional)"}
              </Label>
              <Textarea
                className="text-xs mt-1 min-h-[110px]"
                placeholder={
                  esBloque
                    ? "(usa el texto de fábrica)"
                    : "Añade un mensaje propio: aparecerá destacado bajo los datos de la reserva. Útil para indicaciones de aparcamiento, dress code, etc."
                }
                value={draftMensaje}
                onChange={(e) => {
                  setDraftMensaje(e.target.value);
                  setDirty(true);
                }}
              />
            </div>

            {!esBloque && (
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
            )}

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
