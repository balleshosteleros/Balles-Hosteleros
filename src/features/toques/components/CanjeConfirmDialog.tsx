"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Coins, Loader2 } from "lucide-react";
import type { Recompensa } from "@/features/toques/types/toques.types";
import { canjearRecompensa } from "@/features/toques/actions/toques-actions";

interface Props {
  recompensa: Recompensa;
  saldoDisponible: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCanjeado: () => void;
}

export function CanjeConfirmDialog({
  recompensa,
  saldoDisponible,
  open,
  onOpenChange,
  onCanjeado,
}: Props) {
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insuficiente = saldoDisponible < recompensa.costeToques;
  const restante = saldoDisponible - recompensa.costeToques;

  const handleCanjear = async () => {
    setError(null);
    setEnviando(true);
    const res = await canjearRecompensa({ recompensaId: recompensa.id, notas });
    setEnviando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotas("");
    onCanjeado();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Canjear recompensa</DialogTitle>
          <DialogDescription>
            Tu solicitud quedará pendiente de aprobación de RRHH. Los points se descontarán al
            aprobar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wider text-amber-700 mb-1">Recompensa</div>
            <div className="font-semibold text-base">{recompensa.nombre}</div>
            {recompensa.descripcion && (
              <p className="text-xs text-muted-foreground mt-1">{recompensa.descripcion}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</div>
              <div className="text-lg font-bold tabular-nums flex items-center justify-center gap-1">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                {saldoDisponible}
              </div>
            </div>
            <div className="p-3 rounded border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Coste</div>
              <div className="text-lg font-bold tabular-nums text-rose-600">
                −{recompensa.costeToques}
              </div>
            </div>
            <div className={`p-3 rounded border ${insuficiente ? "bg-rose-50 border-rose-200" : ""}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Restante
              </div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  insuficiente ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {restante}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notas-canje" className="text-xs">
              Notas (opcional)
            </Label>
            <Textarea
              id="notas-canje"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: preferencia de fecha, contexto…"
              maxLength={500}
              rows={2}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2.5">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleCanjear} disabled={insuficiente || enviando}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Enviando…
              </>
            ) : (
              "Solicitar canje"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
