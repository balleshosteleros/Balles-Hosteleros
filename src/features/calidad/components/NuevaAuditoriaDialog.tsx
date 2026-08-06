"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  getOpcionesNuevaAuditoria,
  crearAuditoria,
  type OpcionesNuevaAuditoria,
} from "@/features/calidad/actions/envios-actions";

/** Fecha de hoy en formato aaaa-mm-dd, sin desfases de huso. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NuevaAuditoriaDialog({
  open,
  onOpenChange,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreada: (envioId: string) => void;
}) {
  const [opciones, setOpciones] = useState<OpcionesNuevaAuditoria | null>(null);
  const [localId, setLocalId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOpciones(null);
    getOpcionesNuevaAuditoria().then((o) => {
      setOpciones(o);
      setFecha(hoyISO());
      if (o.locales.length === 1) setLocalId(o.locales[0].id);
      if (o.auditorPorDefecto) setAuditorId(o.auditorPorDefecto);
    });
  }, [open]);

  async function submit() {
    setCreando(true);
    const res = await crearAuditoria({ localId, auditorEmpleadoId: auditorId, fecha });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onCreada(res.envioId);
  }

  const listo = !!opciones?.plantilla && !!localId && !!auditorId && !!fecha;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva auditoría</DialogTitle>
        </DialogHeader>

        {!opciones ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !opciones.plantilla ? (
          <div className="py-4 text-sm text-muted-foreground">
            No hay ninguna plantilla vigente publicada. Ve a plantillas, publica una y márcala como
            vigente para poder auditar.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Plantilla</Label>
              <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{opciones.plantilla.nombre}</span>
                <Badge variant="outline" className="text-[10px]">v{opciones.plantilla.version}</Badge>
                <Badge className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">Vigente</Badge>
              </div>
            </div>

            <div>
              <Label className="text-xs">Local</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige el local" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.locales.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Auditor</Label>
              <Select value={auditorId} onValueChange={setAuditorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Quién hace la auditoría" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.auditores.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creando}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!listo || creando}>
            {creando ? "Creando…" : "Empezar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
