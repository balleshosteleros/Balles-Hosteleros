"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { darDeBajaPorMerma } from "@/features/rrhh/actions/entregas-actions";
import type { Entrega } from "@/features/rrhh/data/entregas";

/**
 * Dar de baja una pieza por deterioro.
 *
 * Una prenda rota no se puede devolver, y sin esto se quedaría como material del
 * trabajador para siempre. Se le manda un acta donde consta el motivo y que se
 * autoriza su retirada; al firmarla, la pieza deja de contar como suya.
 *
 * El motivo es obligatorio: es lo que justifica la baja en el documento firmado,
 * y sin él el acta no dice nada.
 */
export function MermaDialog({
  entrega,
  onOpenChange,
  onHecho,
}: {
  /** La entrega a dar de baja. Null = diálogo cerrado. */
  entrega: Entrega | null;
  onOpenChange: (abierto: boolean) => void;
  onHecho: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Cada vez que se abre para otra entrega, motivo limpio.
  useEffect(() => {
    if (entrega) setMotivo("");
  }, [entrega]);

  async function confirmar() {
    if (!entrega) return;
    if (!motivo.trim()) {
      toast.error("Explica por qué se da de baja");
      return;
    }

    setGuardando(true);
    const res = await darDeBajaPorMerma(entrega.id, motivo);
    setGuardando(false);
    if (!res.ok) { toast.error(res.error); return; }

    toast.success("Le hemos mandado el acta para que firme la baja");
    onOpenChange(false);
    onHecho();
  }

  const pieza = entrega?.item?.tipoNombre ?? "el material";

  return (
    <Dialog open={Boolean(entrega)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar de baja por deterioro</DialogTitle>
          <DialogDescription>
            {entrega
              ? `${pieza} de ${entrega.empleadoNombre} se da de baja por rotura o desgaste, así que no hay que devolverlo.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="merma-motivo">Motivo</Label>
            <Textarea
              id="merma-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por ejemplo: rotura en la costura tras el lavado; desgaste por uso diario…"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Aparecerá en el acta que firma el trabajador.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900">
              Al firmarla, la pieza deja de contar como material suyo y ya no se le
              puede reclamar. La entrega se queda en el listado como Merma.
            </p>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Le llegará un correo para firmar que la pieza está deteriorada.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
