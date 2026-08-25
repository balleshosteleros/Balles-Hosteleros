"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getEmpleadosActivos } from "@/features/rrhh/actions/empleados-actions";
import { registrarAusenciaEmpleado } from "@/features/rrhh/actions/calendario-ausencias-actions";
import { SUBTIPO_LABEL } from "@/features/mi-panel/types";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

interface Props {
  /** Tipo a registrar; null cierra el diálogo. */
  subtipo: SolicitudSubtipoAusencia | null;
  onOpenChange: (abierto: boolean) => void;
  onRegistrada: () => void;
}

type EmpleadoOpt = { userId: string; nombre: string };

/**
 * Registro manual de una ausencia desde el calendario de RRHH.
 *
 * Queda APROBADA directamente: RRHH no está pidiendo permiso, está anotando
 * algo que ya ha ocurrido (una baja médica que han comunicado por teléfono).
 */
export function RegistrarAusenciaDialog({ subtipo, onOpenChange, onRegistrada }: Props) {
  const abierto = subtipo !== null;

  const [empleados, setEmpleados] = useState<EmpleadoOpt[]>([]);
  const [cargando, setCargando] = useState(false);
  const [userId, setUserId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setUserId("");
    setFechaInicio("");
    setFechaFin("");
    setMotivo("");
    setCargando(true);
    let activo = true;
    void getEmpleadosActivos().then((r) => {
      if (!activo) return;
      // Solo quien tiene cuenta puede tener solicitudes a su nombre.
      setEmpleados(
        (r.data ?? [])
          .filter((e) => e.userId)
          .map((e) => ({
            userId: e.userId as string,
            nombre: e.nombreCompleto || "Sin nombre",
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [abierto]);

  // La baja médica puede seguir abierta (sin fecha de alta prevista); el resto
  // de ausencias tienen principio y fin conocidos.
  const finOpcional = subtipo === "baja_medica";

  async function guardar() {
    if (!subtipo) return;
    if (!userId) {
      toast.error("Elige a qué empleado se la registras.");
      return;
    }
    if (!fechaInicio) {
      toast.error("Indica la fecha de inicio.");
      return;
    }
    if (!finOpcional && !fechaFin) {
      toast.error("Indica la fecha de fin.");
      return;
    }
    setGuardando(true);
    const res = await registrarAusenciaEmpleado({
      empleadoUserId: userId,
      subtipo,
      fechaInicio,
      fechaFin: fechaFin || null,
      motivo,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo registrar.");
      return;
    }
    toast.success("Ausencia registrada.");
    onRegistrada();
  }

  const etiqueta = subtipo ? SUBTIPO_LABEL[subtipo].toLowerCase() : "";

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar {etiqueta}</DialogTitle>
          <DialogDescription>
            Queda registrada y aprobada al momento, sin pasar por validación:
            aquí se anota lo que ya ha ocurrido.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ra-empleado">Empleado</Label>
            {cargando ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
              </p>
            ) : (
              <select
                id="ra-empleado"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Selecciona un empleado</option>
                {empleados.map((e) => (
                  <option key={e.userId} value={e.userId}>{e.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ra-inicio">Desde</Label>
              <Input
                id="ra-inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ra-fin">Hasta{finOpcional ? " (opcional)" : ""}</Label>
              <Input
                id="ra-fin"
                type="date"
                value={fechaFin}
                min={fechaInicio || undefined}
                onChange={(e) => setFechaFin(e.target.value)}
              />
              {finOpcional && (
                <p className="text-[11px] text-muted-foreground">
                  Déjalo vacío si aún no hay fecha de alta.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ra-motivo">Motivo o detalles</Label>
            <Textarea
              id="ra-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
