"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CalendarOff } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  createCalendarioVacaciones,
  updateCalendarioVacaciones,
  type BloqueoInput,
} from "@/features/rrhh/actions/calendarios-vacaciones-actions";
import type { CalendarioVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  /** null = crear nuevo. */
  calendario: CalendarioVacaciones | null;
  onSaved: () => void;
};

type BloqueoForm = BloqueoInput & { key: string };

let bloqueoSeq = 0;
function nuevaKey() {
  bloqueoSeq += 1;
  return `b-${bloqueoSeq}`;
}

export function CalendarioVacacionesDialog({
  open,
  onOpenChange,
  empresaId,
  calendario,
  onSaved,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [esPredeterminado, setEsPredeterminado] = useState(true);
  const [anio, setAnio] = useState<string>(String(new Date().getFullYear()));
  const [diasTotales, setDiasTotales] = useState<string>("30");
  const [bloqueos, setBloqueos] = useState<BloqueoForm[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (calendario) {
      setNombre(calendario.nombre);
      setDescripcion(calendario.descripcion ?? "");
      setEsPredeterminado(calendario.anio == null);
      setAnio(String(calendario.anio ?? new Date().getFullYear()));
      setDiasTotales(String(calendario.diasTotales));
      setBloqueos(
        calendario.bloqueos.map((b) => ({
          key: nuevaKey(),
          fechaInicio: b.fechaInicio,
          fechaFin: b.fechaFin,
          motivo: b.motivo,
        })),
      );
    } else {
      setNombre("");
      setDescripcion("");
      setEsPredeterminado(true);
      setAnio(String(new Date().getFullYear()));
      setDiasTotales("30");
      setBloqueos([]);
    }
  }, [open, calendario]);

  function addBloqueo() {
    setBloqueos((prev) => [
      ...prev,
      { key: nuevaKey(), fechaInicio: "", fechaFin: "", motivo: "" },
    ]);
  }
  function updateBloqueo(key: string, patch: Partial<BloqueoInput>) {
    setBloqueos((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    );
  }
  function removeBloqueo(key: string) {
    setBloqueos((prev) => prev.filter((b) => b.key !== key));
  }

  async function guardar() {
    const nombreT = nombre.trim();
    if (!nombreT) {
      toast.error("Ponle un nombre al calendario");
      return;
    }
    const anioN = esPredeterminado ? null : Number(anio);
    const diasN = Number(diasTotales);
    if (anioN !== null && (!Number.isInteger(anioN) || anioN < 2000 || anioN > 2100)) {
      toast.error("El año no es válido");
      return;
    }
    if (!Number.isFinite(diasN) || diasN < 0 || diasN > 366) {
      toast.error("Los días totales deben estar entre 0 y 366");
      return;
    }
    for (const b of bloqueos) {
      if (!b.fechaInicio || !b.fechaFin) {
        toast.error("Cada periodo bloqueado necesita fecha de inicio y fin");
        return;
      }
      if (b.fechaFin < b.fechaInicio) {
        toast.error("En un periodo bloqueado, el fin no puede ser anterior al inicio");
        return;
      }
    }

    const input = {
      nombre: nombreT,
      descripcion: descripcion.trim() || null,
      anio: anioN,
      diasTotales: Math.round(diasN),
      // anioN ya es null cuando es predeterminado.
      bloqueos: bloqueos.map((b) => ({
        fechaInicio: b.fechaInicio,
        fechaFin: b.fechaFin,
        motivo: b.motivo,
      })),
    };

    setGuardando(true);
    const res = calendario
      ? await updateCalendarioVacaciones(calendario.id, input)
      : await createCalendarioVacaciones(empresaId, input);
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar el calendario");
      return;
    }
    toast.success(calendario ? "Calendario actualizado" : "Calendario creado");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {calendario ? "Editar calendario de vacaciones" : "Nuevo calendario de vacaciones"}
          </DialogTitle>
          <DialogDescription>
            Define el total de días del año y los periodos en los que no se pueden
            pedir vacaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cal-nombre">Nombre</Label>
            <Input
              id="cal-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Calendario general 2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cal-dias">Días de vacaciones</Label>
            <Input
              id="cal-dias"
              type="number"
              value={diasTotales}
              onChange={(e) => setDiasTotales(e.target.value)}
              min={0}
              max={366}
              className="max-w-[180px]"
            />
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor="cal-predeterminado">Calendario predeterminado</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se usa como referencia todos los años. Los días y los periodos
                  bloqueados se aplican cada año automáticamente.
                </p>
              </div>
              <Switch
                id="cal-predeterminado"
                checked={esPredeterminado}
                onCheckedChange={setEsPredeterminado}
              />
            </div>
            {!esPredeterminado && (
              <div className="space-y-1.5">
                <Label htmlFor="cal-anio">Año específico</Label>
                <Input
                  id="cal-anio"
                  type="number"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  min={2000}
                  max={2100}
                  className="max-w-[180px]"
                />
                <p className="text-xs text-muted-foreground">
                  Este calendario solo aplicará al año {anio || "indicado"}.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cal-desc">Descripción (opcional)</Label>
            <Textarea
              id="cal-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Para quién es este calendario, condiciones, etc."
            />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarOff className="h-4 w-4 text-rose-500" />
                Periodos bloqueados
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addBloqueo}>
                <Plus className="h-3.5 w-3.5" />
                Añadir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              En estas fechas los empleados no podrán solicitar vacaciones.
              {esPredeterminado &&
                " Al ser predeterminado, solo cuentan el día y el mes: se repiten cada año."}
            </p>

            {bloqueos.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Sin periodos bloqueados. Se puede pedir cualquier día del año.
              </p>
            ) : (
              <div className="space-y-2">
                {bloqueos.map((b) => (
                  <div key={b.key} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Desde</Label>
                        <Input
                          type="date"
                          value={b.fechaInicio}
                          onChange={(e) => updateBloqueo(b.key, { fechaInicio: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hasta</Label>
                        <Input
                          type="date"
                          value={b.fechaFin}
                          min={b.fechaInicio || undefined}
                          onChange={(e) => updateBloqueo(b.key, { fechaFin: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Motivo (opcional)</Label>
                        <Input
                          value={b.motivo ?? ""}
                          onChange={(e) => updateBloqueo(b.key, { motivo: e.target.value })}
                          placeholder="Ej. Temporada alta, Navidad…"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-rose-600 hover:text-rose-700"
                        onClick={() => removeBloqueo(b.key)}
                        aria-label="Quitar periodo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando} className="gap-2">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {calendario ? "Guardar cambios" : "Crear calendario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
