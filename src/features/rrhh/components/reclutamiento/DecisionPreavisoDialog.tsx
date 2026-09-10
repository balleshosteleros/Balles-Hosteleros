"use client";

/**
 * Cierre del PREAVISO. Se abre al mover la tarjeta fuera de esa columna, y no
 * deja pasar sin responder: el preaviso es el momento en que se decide si se
 * pelea por una persona o se la deja ir, y esa decisión tiene que quedar escrita
 * mientras se recuerda, no seis meses después.
 *
 * Dos desenlaces, mismo diálogo:
 *   · `baja`   — se va. Al confirmar se comunica a la gestoría y se le retira el
 *                horario desde su último día.
 *   · `vuelta` — se queda. Al confirmar se anula su baja y se le manda a firmar
 *                la anulación del preaviso; hasta que la firme no puede fichar.
 *
 * De lo que se responde aquí solo se guarda como dato «¿nos interesa que se
 * vaya?»: es lo único que luego se cuenta. El resto va a su ficha como nota.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { AlertTriangle, Loader2, UserCheck, UserMinus } from "lucide-react";
import {
  recuperarDePreaviso,
  tramitarBajaDesdePreaviso,
} from "@/features/rrhh/actions/candidatos-actions";
import { friendlyError } from "@/shared/lib/friendly-errors";

export type ModoDecisionPreaviso = "baja" | "vuelta";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: ModoDecisionPreaviso;
  candidatoId: string;
  nombre: string;
  /** Se llama al terminar bien, para recargar el tablero. */
  onHecho: () => void;
  /** Se llama cuando la baja no la pidió el trabajador (la causa la empresa). */
  onSinSolicitud?: () => void;
}

/** Longitud mínima de la nota: dos líneas de verdad, no un "ok". */
const MIN_NOTAS = 10;

export function DecisionPreavisoDialog({
  open,
  onOpenChange,
  modo,
  candidatoId,
  nombre,
  onHecho,
  onSinSolicitud,
}: Props) {
  const [interesa, setInteresa] = useState<boolean | null>(null);
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cada apertura empieza en blanco: arrastrar por error a otra persona no puede
  // heredar lo que se escribió de la anterior.
  useEffect(() => {
    if (open) {
      setInteresa(null);
      setNotas("");
      setEnviando(false);
    }
  }, [open]);

  const esBaja = modo === "baja";
  const listo = interesa !== null && notas.trim().length >= MIN_NOTAS && !enviando;

  async function confirmar() {
    if (interesa === null) return;
    setEnviando(true);
    try {
      const decision = { interesaQueSeVaya: interesa, notas: notas.trim() };
      const res = esBaja
        ? await tramitarBajaDesdePreaviso(candidatoId, decision)
        : await recuperarDePreaviso(candidatoId, decision);

      if (!res.ok) {
        if (res.error === "SIN_SOLICITUD" || res.error === "SIN_EMPLEADO") {
          onOpenChange(false);
          onSinSolicitud?.();
          return;
        }
        toast.error(
          esBaja ? "No se pudo tramitar la baja" : "No se pudo devolverle al equipo",
          { description: friendlyError(res.error) },
        );
        return;
      }

      if (esBaja && "gestoriaAvisada" in res) {
        toast.success(`Baja de ${nombre} comunicada a la gestoría`, {
          description: res.gestoriaAvisada
            ? `Ficha enviada a ${res.gestoriaDestino ?? "la gestoría"}. Su horario deja de contar a partir de su último día.`
            : `Aviso a la gestoría NO enviado: ${res.gestoriaError ?? "error desconocido"}. Reenvíalo a mano.`,
        });
      } else if (!esBaja && "firmaEnviada" in res) {
        toast.success(`${nombre} sigue en el equipo`, {
          description: res.firmaEnviada
            ? "Le hemos enviado la anulación del preaviso para que la firme. Hasta que no la firme no podrá fichar."
            : `Documento de anulación NO enviado: ${res.firmaError ?? "error desconocido"}.`,
        });
      }

      onOpenChange(false);
      onHecho();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esBaja ? (
              <>
                <UserMinus className="h-5 w-5 text-destructive" /> Dar de baja a {nombre}
              </>
            ) : (
              <>
                <UserCheck className="h-5 w-5 text-emerald-600" /> {nombre} se queda
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {esBaja
              ? "Antes de tramitarla, cuéntanos cómo ha ido el preaviso."
              : "Antes de devolverle al equipo, cuéntanos cómo ha ido el preaviso."}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-lg border p-3 text-sm ${
            esBaja
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {esBaja ? (
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Al confirmar se comunica la baja a <strong>la gestoría</strong> y se le retira el
                horario a partir de su último día.
              </span>
            </p>
          ) : (
            <p>
              Al confirmar, su baja queda anulada y le enviamos la{" "}
              <strong>anulación del preaviso</strong> para que la firme.{" "}
              <strong>Hasta que no la firme no podrá fichar.</strong>
            </p>
          )}
        </div>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>
              ¿Nos interesa que se vaya? <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={interesa === true ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setInteresa(true)}
              >
                Sí, nos conviene
              </Button>
              <Button
                type="button"
                variant={interesa === false ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setInteresa(false)}
              >
                No, queríamos retenerle
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas-preaviso">
              ¿Qué ha pasado en el preaviso? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notas-preaviso"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={
                esBaja
                  ? "Si se habló con él, qué se le propuso y por qué se va."
                  : "Qué se le ha propuesto y en qué habéis quedado."
              }
              className="min-h-20"
            />
            <p className="text-xs text-muted-foreground">
              Queda guardado en su ficha, con tu nombre y la fecha.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant={esBaja ? "destructive" : "default"}
            onClick={confirmar}
            disabled={!listo}
            // Rojo cuando se va, verde cuando se queda: el color dice el
            // desenlace antes de leer el botón.
            className={
              esBaja
                ? "gap-1.5"
                : "gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {esBaja ? "Dar de baja" : "Devolverle al equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
