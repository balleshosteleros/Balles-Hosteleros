"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { marcarNoDevuelta } from "@/features/rrhh/actions/entregas-actions";
import { nombrePieza } from "@/features/rrhh/data/material-stock";
import type { Entrega } from "@/features/rrhh/data/entregas";

/**
 * Dar una pieza por perdida: el trabajador se marchó y nunca la devolvió.
 *
 * Es la única baja del módulo que no se firma, y no puede serlo: el trabajador
 * ya no está. Por eso el motivo es obligatorio — es lo único que quedará
 * explicando dónde acabó la pieza.
 *
 * A diferencia de la devolución, la pieza NO vuelve al almacén: la empresa tiene
 * una menos de verdad, y así se refleja en el total.
 */
export function NoDevueltaDialog({
  entrega,
  onOpenChange,
  onHecho,
}: {
  /** La entrega que se da por perdida. Null = diálogo cerrado. */
  entrega: Entrega | null;
  onOpenChange: (abierto: boolean) => void;
  onHecho: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (entrega) setMotivo("");
  }, [entrega]);

  async function confirmar() {
    if (!entrega) return;
    if (!motivo.trim()) {
      toast.error("Explica por qué no ha vuelto la pieza");
      return;
    }

    setGuardando(true);
    const res = await marcarNoDevuelta(entrega.id, motivo);
    setGuardando(false);
    if (!res.ok) { toast.error(res.error); return; }

    toast.success("La pieza queda como no devuelta");
    onOpenChange(false);
    onHecho();
  }

  const pieza = entrega?.item
    ? nombrePieza(entrega.item.tipoNombre, entrega.item.talla)
    : "el material";

  return (
    <Dialog open={Boolean(entrega)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar por no devuelta</DialogTitle>
          <DialogDescription>
            {entrega
              ? `${pieza} de ${entrega.empleadoNombre} no ha vuelto y se da por perdida.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="no-devuelta-motivo">Motivo</Label>
            <Textarea
              id="no-devuelta-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por ejemplo: se marchó sin avisar y no devolvió el uniforme; se le reclamó dos veces sin respuesta…"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Nadie firma esta baja, así que el motivo es lo único que quedará
              explicando dónde acabó la pieza.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <AlertTriangle className="h-4 w-4 text-rose-700 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-900">
              La pieza deja de contar como material suyo y no vuelve al almacén:
              el total de la empresa baja una unidad. Queda en su histórico con el
              motivo y la fecha.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
