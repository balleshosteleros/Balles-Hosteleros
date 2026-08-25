"use client";

/**
 * Devolver las nóminas del mes a la gestoría.
 *
 * RRHH escribe aquí las anomalías que ha encontrado. El texto NO es opcional:
 * es literalmente el mensaje que recibe la gestoría, y sin él no sabrían qué
 * corregir. Por eso el botón está desactivado hasta que hay contenido suficiente.
 *
 * Se avisa por delante de lo que va a pasar (se borra TODO lo subido) porque es
 * irreversible: la gestoría tendrá que volver a subir la entrega completa.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Undo2 } from "lucide-react";
import { MOTIVO_MIN_CARACTERES } from "@/features/rrhh/lib/nominas-rechazo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** "julio 2026" */
  mesLabel: string;
  /** Nº de nóminas que se van a eliminar al devolver. */
  nominasEnMes: number;
  enviando: boolean;
  onConfirmar: (motivo: string) => void;
}

/** Ejemplos para que RRHH no se quede en blanco ante el cuadro vacío. */
const PLACEHOLDER = `Ejemplo:
- El neto de Marta Ruiz no coincide con su contrato (aparece 1.180 € y debería ser 1.320 €).
- Falta la nómina de Javier Soto, que se incorporó el día 3.
- El TC1 no cuadra con la suma de las nóminas: hay 214,50 € de diferencia.`;

export function RechazarNominasDialog({
  open,
  onOpenChange,
  mesLabel,
  nominasEnMes,
  enviando,
  onConfirmar,
}: Props) {
  const [motivo, setMotivo] = useState("");

  const limpio = motivo.trim();
  const faltan = MOTIVO_MIN_CARACTERES - limpio.length;
  const valido = limpio.length >= MOTIVO_MIN_CARACTERES;

  const cerrar = (v: boolean) => {
    if (enviando) return;
    if (!v) setMotivo("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Devolver las nóminas de {mesLabel} a la gestoría</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-amber-900 dark:text-amber-200 space-y-1">
              <p>
                Se eliminarán las <b>{nominasEnMes} nómina{nominasEnMes === 1 ? "" : "s"}</b> de este
                mes y su TC1, y la gestoría recibirá un correo con tus anomalías y un enlace para
                subirlo <b>todo de nuevo</b>.
              </p>
              <p>Nada de esto llega al empleado: las nóminas solo se publican al confirmarlas.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-rechazo">
              Anomalías detectadas <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="motivo-rechazo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={8}
              disabled={enviando}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {valido
                ? "Este texto se enviará literalmente a la gestoría."
                : `Explica qué está mal para que puedan corregirlo (faltan ${faltan} caracteres).`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            disabled={!valido || enviando}
            onClick={() => onConfirmar(limpio)}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Devolver a la gestoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
