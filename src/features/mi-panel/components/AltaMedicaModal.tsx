"use client";

/**
 * El trabajador comunica su ALTA médica.
 *
 * Mientras tenga una baja abierta, este botón sustituye al de pedir cosas: lo
 * que le toca no es solicitar nada más, es decir que ya está bien. Se le pide el
 * día del parte de alta y el sistema calcula, con su horario real, el primer día
 * que le toca turno — que casi nunca es el mismo del alta.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, HeartPulse, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { comunicarMiAltaMedica } from "@/features/mi-panel/actions/comunicaciones-actions";

/** dd/mm/aaaa, el formato de fecha de toda la casa. */
function fechaEs(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitudId: string;
  fechaInicioBaja: string;
  onComunicada?: () => void;
}

export function AltaMedicaModal({
  open,
  onOpenChange,
  solicitudId,
  fechaInicioBaja,
  onComunicada,
}: Props) {
  const [fechaAlta, setFechaAlta] = useState<string>("");
  const hoyIso = new Date().toISOString().slice(0, 10);
  const [enviando, setEnviando] = useState(false);

  const cerrar = (v: boolean) => {
    if (!v) setFechaAlta("");
    onOpenChange(v);
  };

  async function enviar() {
    if (!fechaAlta) {
      toast.error("Indica el día en que te han dado el alta");
      return;
    }
    setEnviando(true);
    const res = await comunicarMiAltaMedica(solicitudId, fechaAlta);
    setEnviando(false);

    if (!res.ok) {
      toast.error(res.error || "No se pudo comunicar el alta");
      return;
    }
    // Lo que de verdad quiere saber: cuándo vuelve.
    toast.success(
      res.reincorporacion
        ? `Alta comunicada. Te incorporas el ${fechaEs(res.reincorporacion)}.`
        : "Alta comunicada. Recursos Humanos te dirá qué día te incorporas.",
      { duration: 8000 },
    );
    onComunicada?.();
    cerrar(false);
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-rose-600" />
            Comunicar mi alta médica
          </DialogTitle>
          <DialogDescription>
            Estás de baja desde el {fechaEs(fechaInicioBaja)}. Dinos qué día te han dado
            el alta y avisamos a Recursos Humanos y a la gestoría.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="fecha-alta">Día del alta</Label>
          <Input
            id="fecha-alta"
            type="date"
            value={fechaAlta}
            // Como pronto hoy: la baja termina ayer y se vuelve hoy. Días atrás
            // dejarían un hueco sin baja y sin fichar.
            min={hoyIso}
            onChange={(e) => setFechaAlta(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            El que pone tu parte de alta. Si te lo dieron hace días, pon hoy. Te diremos el
            primer día que te toca turno, que no tiene por qué ser ese mismo.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Hasta que no comuniques el alta no podrás fichar. Al hacerlo, los días de baja
            que te quedaban desaparecen de tu calendario y vuelven tus turnos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando || !fechaAlta}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Comunicar alta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
