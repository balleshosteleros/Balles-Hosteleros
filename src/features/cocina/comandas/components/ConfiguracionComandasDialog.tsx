"use client";

/**
 * Configuración de Comandas. Hoy, una sola cosa: cuánto dura el apagado de un
 * producto agotado antes de volver solo a la carta y al TPV.
 *
 * Va en el engranaje del propio submódulo y no en Ajustes: es configuración de
 * ESTA pantalla, y se hace una vez. En móvil el engranaje no se pinta (norma:
 * configurar es tarea de escritorio).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { getUmbralesAlarma, saveHorasApagadoProducto } from "../actions/umbrales-actions";
import {
  HORAS_APAGADO_DEFAULT,
  HORAS_APAGADO_MAX,
  HORAS_APAGADO_MIN,
} from "@/features/cocina/apagados/lib/caducidad";

export function ConfiguracionComandasDialog({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [horas, setHoras] = useState(String(HORAS_APAGADO_DEFAULT));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    (async () => {
      const res = await getUmbralesAlarma();
      if (!cancelado && res.ok) setHoras(String(res.data.horasApagadoProducto));
    })();
    return () => {
      cancelado = true;
    };
  }, [abierto]);

  async function guardar() {
    const n = parseInt(horas, 10);
    if (!Number.isFinite(n) || n < HORAS_APAGADO_MIN || n > HORAS_APAGADO_MAX) {
      toast.error(`Pon un número de horas entre ${HORAS_APAGADO_MIN} y ${HORAS_APAGADO_MAX}.`);
      return;
    }
    setGuardando(true);
    const res = await saveHorasApagadoProducto(n);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Configuración guardada");
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Configuración</DialogTitle>
        </DialogHeader>

        <div>
          <Label htmlFor="horas-apagado">Un producto agotado vuelve solo a las</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              id="horas-apagado"
              type="number"
              inputMode="numeric"
              min={HORAS_APAGADO_MIN}
              max={HORAS_APAGADO_MAX}
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">horas</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cuando cocina apaga un producto por agotado, deja de venderse durante estas horas y
            luego vuelve solo, sin que nadie tenga que acordarse de encenderlo. Vale igual para lo
            que se marca desde la carta digital.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" size="lg" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
