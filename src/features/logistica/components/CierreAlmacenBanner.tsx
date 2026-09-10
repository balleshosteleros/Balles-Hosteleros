"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/contexts/auth-context";
import {
  getCierreAlmacen,
  reabrirAlmacen,
  type CierreAlmacen,
} from "@/features/logistica/actions/cierre-almacen-actions";

/**
 * "Almacén cerrado hasta el X". Si no hay cierre, no pinta nada.
 *
 * Está en la pantalla de Stock a propósito: es donde una persona se pregunta por qué
 * no le deja corregir algo. El botón de reabrir solo lo ve quien puede editar
 * Logística, y pide un motivo — reabrir un almacén cerrado es una excepción.
 */
export default function CierreAlmacenBanner({ onCambio }: { onCambio?: () => void }) {
  const { puedeEditar } = useAuth();
  const [cierre, setCierre] = useState<CierreAlmacen | null>(null);
  const [dialogo, setDialogo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await getCierreAlmacen();
    setCierre(r.data);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const reabrir = async () => {
    setGuardando(true);
    try {
      const r = await reabrirAlmacen({ motivo });
      if (!r.ok) { toast.error(r.error ?? "No se pudo reabrir."); return; }
      toast.success("Almacén reabierto. Vuelven a poder corregirse los movimientos anteriores.");
      setDialogo(false);
      setMotivo("");
      await cargar();
      onCambio?.();
    } finally {
      setGuardando(false);
    }
  };

  if (!cierre) return null;

  const [a, m, d] = cierre.corteDia.split("-");
  const diaLegible = `${d}/${m}/${a}`;

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">
          <strong>Almacén cerrado hasta el {diaLegible}</strong> (incluido)
          {cierre.cerradoPorNombre ? `, por ${cierre.cerradoPorNombre}` : ""}. No se puede
          apuntar, corregir ni borrar nada anterior a esa fecha.
        </span>
        {puedeEditar("LOGÍSTICA") && (
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" onClick={() => setDialogo(true)}>
            <Unlock className="h-3 w-3" /> Reabrir
          </Button>
        )}
      </div>

      <Dialog open={dialogo} onOpenChange={(o) => { if (!o) setDialogo(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir el almacén</DialogTitle>
            <DialogDescription>
              Volverán a poder corregirse los movimientos anteriores al {diaLegible}. Si el
              recuento de ese cierre ya se dio por bueno, cambiar cosas por detrás hará que
              deje de cuadrar. Queda registrado quién lo reabre y por qué.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-reapertura">¿Por qué hay que reabrirlo?</Label>
            <Textarea
              id="motivo-reapertura"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: faltaba por meter el albarán de Makro del día 6"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={reabrir} disabled={guardando || !motivo.trim()}>
              {guardando ? "Reabriendo…" : "Reabrir almacén"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
