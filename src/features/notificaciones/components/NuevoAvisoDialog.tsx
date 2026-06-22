"use client";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";
import {
  getOpcionesSegmento,
  contarDestinatarios,
  emitirAvisoManual,
  type OpcionesSegmento,
} from "@/features/notificaciones/actions/aviso-manual-actions";
import type { Segmento } from "@/features/notificaciones/types";

type TipoDest = "empresa" | "departamento" | "rol" | "area" | "empleados";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function NuevoAvisoDialog({
  open,
  onOpenChange,
  onEmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEmitted?: () => void;
}) {
  const [opciones, setOpciones] = useState<OpcionesSegmento>({ departamentos: [], roles: [], empleados: [] });
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [requiereAcuse, setRequiereAcuse] = useState(false);
  const [tipoDest, setTipoDest] = useState<TipoDest>("empresa");
  const [departamentoId, setDepartamentoId] = useState("");
  const [rolLabel, setRolLabel] = useState("");
  const [area, setArea] = useState<"OPERATIVA" | "ADMINISTRATIVA">("OPERATIVA");
  const [empleadoIds, setEmpleadoIds] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cargar opciones al abrir.
  useEffect(() => {
    if (!open) return;
    getOpcionesSegmento().then(setOpciones);
  }, [open]);

  // Reset al cerrar.
  useEffect(() => {
    if (open) return;
    setTitulo("");
    setMensaje("");
    setRequiereAcuse(false);
    setTipoDest("empresa");
    setDepartamentoId("");
    setRolLabel("");
    setArea("OPERATIVA");
    setEmpleadoIds([]);
    setCount(null);
  }, [open]);

  // Construye el segmento actual (o null si incompleto).
  const segmento: Segmento | null = (() => {
    switch (tipoDest) {
      case "empresa":
        return { tipo: "empresa" };
      case "departamento":
        return departamentoId ? { tipo: "departamento", departamentoId } : null;
      case "rol":
        return rolLabel ? { tipo: "rol", rolLabel } : null;
      case "area":
        return { tipo: "area", area };
      case "empleados":
        return empleadoIds.length > 0 ? { tipo: "empleados", empleadoIds } : null;
    }
  })();

  const segKey = JSON.stringify(segmento);

  // Preview de nº de destinatarios.
  useEffect(() => {
    if (!open) return;
    if (!segmento) {
      setCount(null);
      return;
    }
    let on = true;
    setCount(null);
    contarDestinatarios(segmento).then((n) => {
      if (on) setCount(n);
    });
    return () => {
      on = false;
    };
    // segKey serializa el segmento; evita recomputar de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey, open]);

  const toggleEmpleado = (id: string) => {
    setEmpleadoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onEnviar = async () => {
    if (!titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    if (!segmento) {
      toast.error("Elige los destinatarios");
      return;
    }
    setEnviando(true);
    const res = await emitirAvisoManual({ titulo, mensaje, segmento, requiereAcuse });
    setEnviando(false);
    if (!res.ok) {
      toast.error("No se pudo enviar el aviso");
      return;
    }
    if (res.creadas === 0) {
      toast.warning("No había destinatarios para ese segmento");
      return;
    }
    toast.success(`Aviso enviado a ${res.creadas} ${res.creadas === 1 ? "persona" : "personas"}`);
    onOpenChange(false);
    onEmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo aviso</DialogTitle>
          <DialogDescription>
            Envía una notificación a los empleados. Llega a su campana y salta al entrar a la app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="aviso-titulo">Título</Label>
            <Input
              id="aviso-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Reunión de cocina mañana a las 11:00"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aviso-mensaje">Mensaje</Label>
            <Textarea
              id="aviso-mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Detalle del aviso (opcional)"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aviso-tipo">Enviar a</Label>
              <select
                id="aviso-tipo"
                className={SELECT_CLASS}
                value={tipoDest}
                onChange={(e) => setTipoDest(e.target.value as TipoDest)}
              >
                <option value="empresa">Toda la empresa</option>
                <option value="departamento">Un departamento</option>
                <option value="rol">Un rol</option>
                <option value="area">Un área</option>
                <option value="empleados">Empleados concretos</option>
              </select>
            </div>

            <div className="space-y-1.5">
              {tipoDest === "departamento" && (
                <>
                  <Label htmlFor="aviso-depto">Departamento</Label>
                  <select
                    id="aviso-depto"
                    className={SELECT_CLASS}
                    value={departamentoId}
                    onChange={(e) => setDepartamentoId(e.target.value)}
                  >
                    <option value="">Elige…</option>
                    {opciones.departamentos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {tipoDest === "rol" && (
                <>
                  <Label htmlFor="aviso-rol">Rol</Label>
                  <select
                    id="aviso-rol"
                    className={SELECT_CLASS}
                    value={rolLabel}
                    onChange={(e) => setRolLabel(e.target.value)}
                  >
                    <option value="">Elige…</option>
                    {opciones.roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {tipoDest === "area" && (
                <>
                  <Label htmlFor="aviso-area">Área</Label>
                  <select
                    id="aviso-area"
                    className={SELECT_CLASS}
                    value={area}
                    onChange={(e) => setArea(e.target.value as "OPERATIVA" | "ADMINISTRATIVA")}
                  >
                    <option value="OPERATIVA">Operativa</option>
                    <option value="ADMINISTRATIVA">Administrativa</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {tipoDest === "empleados" && (
            <div className="space-y-1.5">
              <Label>Empleados</Label>
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-2 space-y-1">
                  {opciones.empleados.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No hay empleados.</p>
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
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="aviso-acuse" className="text-sm font-medium">
                Requiere acuse
              </Label>
              <p className="text-xs text-muted-foreground">
                El empleado debe confirmar que lo ha leído.
              </p>
            </div>
            <Switch id="aviso-acuse" checked={requiereAcuse} onCheckedChange={setRequiereAcuse} />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {count === null ? (
              <span>Calculando destinatarios…</span>
            ) : (
              <span>
                {count} {count === 1 ? "destinatario" : "destinatarios"}
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={onEnviar} disabled={enviando || !segmento || !count}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar aviso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
