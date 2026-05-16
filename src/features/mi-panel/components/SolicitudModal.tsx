"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { crearSolicitudPersonal } from "@/features/mi-panel/actions/mi-panel-actions";
import type {
  SolicitudSubtipo,
  SolicitudSubtipoAusencia,
  SolicitudSubtipoTrabajo,
  SolicitudTipo,
} from "@/features/mi-panel/types";
import { DiaTrabajadoAvisoDialog } from "@/features/mi-panel/components/DiaTrabajadoAvisoDialog";

interface SolicitudModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Paso = "tipo" | "subtipo" | "detalle";

export function SolicitudModal({ open, onOpenChange, onCreated }: SolicitudModalProps) {
  const [paso, setPaso] = useState<Paso>("tipo");
  const [tipo, setTipo] = useState<SolicitudTipo | null>(null);
  const [subtipo, setSubtipo] = useState<SolicitudSubtipo | null>(null);

  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [horas, setHoras] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  const [avisoOpen, setAvisoOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function reset() {
    setPaso("tipo");
    setTipo(null);
    setSubtipo(null);
    setFechaInicio("");
    setFechaFin("");
    setHoras("");
    setMotivo("");
    setAvisoOpen(false);
    setEnviando(false);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function elegirTipo(t: SolicitudTipo) {
    setTipo(t);
    setSubtipo(null);
    setPaso("subtipo");
  }

  function elegirSubtipo(s: SolicitudSubtipo) {
    if (s === "dia_trabajado") {
      setSubtipo(s);
      setAvisoOpen(true);
      return;
    }
    setSubtipo(s);
    setPaso("detalle");
  }

  function aceptarAvisoDia() {
    setAvisoOpen(false);
    setPaso("detalle");
  }
  function cancelarAvisoDia() {
    setAvisoOpen(false);
    setSubtipo(null);
  }

  async function enviar() {
    if (!tipo || !subtipo) return;
    if (!fechaInicio) {
      toast.error("Indica una fecha de inicio");
      return;
    }
    if (subtipo === "horas_extras") {
      const h = Number(horas);
      if (!h || h <= 0) {
        toast.error("Indica cuántas horas extras quieres registrar");
        return;
      }
    }
    setEnviando(true);
    const res = await crearSolicitudPersonal({
      tipo,
      subtipo,
      fechaInicio,
      fechaFin: fechaFin || null,
      horas: subtipo === "horas_extras" ? Number(horas) : null,
      motivo: motivo.trim(),
    });
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error || "No se pudo enviar la solicitud");
      return;
    }
    toast.success("Solicitud enviada");
    onCreated?.();
    handleClose(false);
  }

  // Etiquetas dinámicas
  const tipoLabel = tipo === "ausencia" ? "Ausencia" : "Trabajo realizado";
  const subtipoLabel: Record<SolicitudSubtipo, string> = {
    baja_medica: "Baja médica",
    vacaciones: "Vacaciones",
    permiso: "Permiso",
    horas_extras: "Horas extras",
    dia_trabajado: "Día trabajado",
  };

  const opcionesAusencia: { value: SolicitudSubtipoAusencia; label: string; desc: string }[] = [
    { value: "baja_medica", label: "Baja médica", desc: "Indisposición o enfermedad con parte médico" },
    { value: "vacaciones", label: "Vacaciones", desc: "Días de vacaciones del año en curso" },
    { value: "permiso", label: "Permiso", desc: "Permiso retribuido o asunto propio" },
  ];

  const opcionesTrabajo: { value: SolicitudSubtipoTrabajo; label: string; desc: string }[] = [
    { value: "horas_extras", label: "Horas extras", desc: "Horas trabajadas fuera de tu jornada habitual" },
    { value: "dia_trabajado", label: "Día trabajado", desc: "Día de trabajo no fichado (excepcional)" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paso !== "tipo" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (paso === "detalle") {
                      setPaso("subtipo");
                    } else if (paso === "subtipo") {
                      setPaso("tipo");
                      setTipo(null);
                    }
                  }}
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              Nueva solicitud
            </DialogTitle>
            <DialogDescription>
              {paso === "tipo" && "¿Qué tipo de solicitud quieres enviar?"}
              {paso === "subtipo" && tipo === "ausencia" && "Selecciona el tipo de ausencia."}
              {paso === "subtipo" && tipo === "trabajo" && "Selecciona qué quieres registrar."}
              {paso === "detalle" && tipo && subtipo && (
                <>
                  {tipoLabel} · <span className="font-medium text-foreground">{subtipoLabel[subtipo]}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* PASO 1: TIPO */}
          {paso === "tipo" && (
            <div className="grid gap-3 py-2">
              <button
                type="button"
                onClick={() => elegirTipo("ausencia")}
                className="text-left p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="font-semibold">Ausencia</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Solicitar una baja, vacaciones o permiso.
                </div>
              </button>
              <button
                type="button"
                onClick={() => elegirTipo("trabajo")}
                className="text-left p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="font-semibold">Trabajo realizado</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Solicitar registrar horas o un día trabajado.
                </div>
              </button>
            </div>
          )}

          {/* PASO 2: SUBTIPO */}
          {paso === "subtipo" && tipo === "ausencia" && (
            <div className="grid gap-2 py-2">
              {opcionesAusencia.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => elegirSubtipo(o.value)}
                  className="text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          )}
          {paso === "subtipo" && tipo === "trabajo" && (
            <div className="grid gap-2 py-2">
              {opcionesTrabajo.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => elegirSubtipo(o.value)}
                  className="text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* PASO 3: DETALLE */}
          {paso === "detalle" && subtipo && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fechaInicio">
                    {subtipo === "horas_extras" || subtipo === "dia_trabajado"
                      ? "Fecha"
                      : "Desde"}
                  </Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                {subtipo !== "horas_extras" && subtipo !== "dia_trabajado" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fechaFin">Hasta</Label>
                    <Input
                      id="fechaFin"
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      min={fechaInicio || undefined}
                    />
                  </div>
                )}
                {subtipo === "horas_extras" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="horas">Horas</Label>
                    <Input
                      id="horas"
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={horas}
                      onChange={(e) => setHoras(e.target.value)}
                      placeholder="2"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motivo">Motivo o detalles</Label>
                <Textarea
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder={
                    subtipo === "baja_medica"
                      ? "Adjunta el parte si lo tienes…"
                      : subtipo === "horas_extras"
                        ? "¿Por qué? ¿En qué tarea?"
                        : "Detalles para tu responsable"
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            {paso === "detalle" && (
              <Button onClick={enviar} disabled={enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar solicitud
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiaTrabajadoAvisoDialog
        open={avisoOpen}
        onAceptar={aceptarAvisoDia}
        onCancelar={cancelarAvisoDia}
      />
    </>
  );
}
