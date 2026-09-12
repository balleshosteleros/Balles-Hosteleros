"use client";

/**
 * Devolver a un cliente dinero ya cobrado por la pasarela.
 *
 * Es la única pantalla del software que SACA dinero de la cuenta, así que pide
 * las tres cosas que hacen falta para responder luego por ella: cuánto, por
 * qué, y la contraseña de quien lo hace. El permiso se comprueba otra vez en
 * el servidor: esconder el botón no es seguridad.
 *
 * Avisa de la comisión antes de confirmar. Revolut se queda su parte del cobro
 * y NO la devuelve, así que devolver entero deja al restaurante en negativo, y
 * quien pulsa tiene que saberlo antes, no descubrirlo en el extracto.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  devolverCobroAction,
  getResumenDevolucion,
  type ConceptoDevolucion,
} from "@/features/sala/actions/devolucion-actions";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  reservaId: string;
  concepto: ConceptoDevolucion;
  cliente: string;
  onHecho?: () => void;
}

function eur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function DevolverCobroDialog({
  abierto,
  onCerrar,
  reservaId,
  concepto,
  cliente,
  onHecho,
}: Props) {
  const [disponible, setDisponible] = useState<number | null>(null);
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Lo que queda por devolver se pregunta al abrir, no se supone: puede haber
  // una devolución parcial anterior. El diálogo se monta de cero cada vez que
  // se abre, así que los campos ya nacen vacíos y aquí solo hay que preguntar.
  useEffect(() => {
    let vivo = true;
    getResumenDevolucion(reservaId, concepto).then((r) => {
      if (!vivo) return;
      setDisponible(r.disponible);
      setImporte(r.disponible > 0 ? String(r.disponible) : "");
    });
    return () => {
      vivo = false;
    };
  }, [reservaId, concepto]);

  const importeNum = Number(importe.replace(",", "."));
  const valido =
    motivo.trim().length >= 3 &&
    password.length > 0 &&
    importeNum > 0 &&
    disponible != null &&
    importeNum <= disponible;

  async function devolver() {
    if (!valido) return;
    setEnviando(true);
    const res = await devolverCobroAction({
      reservaId,
      concepto,
      importe: importeNum,
      motivo: motivo.trim(),
      password,
    });
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Devueltos ${eur(res.devuelto)} a ${cliente}`);
    onHecho?.();
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-4 w-4" />
            Devolver el cobro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El dinero vuelve a la tarjeta de <b>{cliente}</b>. Tarda lo que tarde
            su banco, normalmente unos días.
          </p>

          {disponible == null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Comprobando lo cobrado…
            </div>
          ) : disponible <= 0 ? (
            <p className="text-sm">Este cobro ya está devuelto por completo.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="dev-importe">Importe a devolver</Label>
                <Input
                  id="dev-importe"
                  inputMode="decimal"
                  value={importe}
                  onChange={(e) => setImporte(e.target.value)}
                  placeholder={String(disponible)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Se puede devolver {eur(disponible)} como máximo.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dev-motivo">Motivo</Label>
                <Input
                  id="dev-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por qué se le devuelve"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dev-password">Tu contraseña</Label>
                <Input
                  id="dev-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                La pasarela no devuelve su comisión del cobro: al restaurante le
                cuesta algo más de lo que se devuelve.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={devolver} disabled={!valido || enviando}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Devolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
