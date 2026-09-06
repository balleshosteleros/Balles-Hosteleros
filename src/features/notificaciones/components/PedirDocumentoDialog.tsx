"use client";

/**
 * Petición de documentación identificativa a empleados concretos.
 *
 * Cada uno recibe SU enlace: notificación con botón "Subir mi documento" y el
 * mismo enlace por correo. Nadie va en copia y nadie ve lo de nadie — el
 * 4-sep-2026 se pidió con los nueve en copia y, al responder en cadena, cada
 * empleado acabó viendo el IBAN de los anteriores.
 *
 * El empleado solo sube el archivo: los datos de la ficha los graba RRHH.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";
import { getOpcionesSegmento, type OpcionesSegmento } from "@/features/notificaciones/actions/aviso-manual-actions";
import { pedirDocumentacionAEmpleados } from "@/features/rrhh/actions/pedir-doc-empleado-actions";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Mismo orden y nombres que la ficha del empleado. */
const TIPOS = [
  { valor: "iban", label: "Certificado bancario" },
  { valor: "dni_anverso", label: "DNI/NIE — anverso" },
  { valor: "dni_reverso", label: "DNI/NIE — reverso" },
  { valor: "ss", label: "Documento de la Seguridad Social" },
] as const;

export function PedirDocumentoDialog({
  open,
  onOpenChange,
  onEmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEmitted?: () => void;
}) {
  const [opciones, setOpciones] = useState<OpcionesSegmento>({
    departamentos: [],
    roles: [],
    empleados: [],
  });
  const [tipoDoc, setTipoDoc] = useState<string>("iban");
  const [empleadoIds, setEmpleadoIds] = useState<string[]>([]);
  const [recordatorio, setRecordatorio] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    getOpcionesSegmento().then(setOpciones);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setTipoDoc("iban");
    setEmpleadoIds([]);
    setRecordatorio(false);
  }, [open]);

  const toggleEmpleado = (id: string) => {
    setEmpleadoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onEnviar = async () => {
    if (empleadoIds.length === 0) {
      toast.error("Elige a quién se lo pides");
      return;
    }
    setEnviando(true);
    const res = await pedirDocumentacionAEmpleados({ empleadoIds, tipoDoc, recordatorio });
    setEnviando(false);

    if (res.enviados.length > 0) {
      toast.success(
        res.enviados.length === 1
          ? `Pedido a ${res.enviados[0].empleado}`
          : `Pedido a ${res.enviados.length} empleados`,
      );
    }
    // Los fallos se dicen uno a uno: si a alguien no le llegó, hay que saber a quién.
    for (const e of res.errores) toast.error(`${e.empleado}: ${e.error}`);

    if (res.enviados.length > 0) {
      onEmitted?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedir documentación</DialogTitle>
          <DialogDescription>
            A cada uno le llega su propio enlace, por notificación y por correo. Nadie va en copia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-tipo">Documento</Label>
            <select
              id="doc-tipo"
              className={SELECT_CLASS}
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value)}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>A quién</Label>
            <ScrollArea className="h-56 rounded-md border">
              <div className="p-2">
                {opciones.empleados.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay empleados.</p>
                ) : (
                  opciones.empleados.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={empleadoIds.includes(e.id)}
                        onCheckedChange={() => toggleEmpleado(e.id)}
                      />
                      {e.nombre}
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="doc-recordatorio" className="text-sm font-medium">
                Es un recordatorio
              </Label>
              <p className="text-xs text-muted-foreground">
                Ya se le pidió antes. Cambia el tono del aviso.
              </p>
            </div>
            <Switch
              id="doc-recordatorio"
              checked={recordatorio}
              onCheckedChange={setRecordatorio}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {empleadoIds.length} {empleadoIds.length === 1 ? "empleado" : "empleados"}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={onEnviar} disabled={enviando || empleadoIds.length === 0}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pedir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
