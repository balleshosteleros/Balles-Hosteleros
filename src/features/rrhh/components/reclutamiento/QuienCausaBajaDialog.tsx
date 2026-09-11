"use client";

/**
 * Primera pregunta al llevar a alguien a «Baja contrato»: quién causa la baja.
 *
 * La empresa → se tramita aquí mismo (tipo de baja y hechos).
 * El trabajador → la pide él desde su panel, con su preaviso. Salvo que se haya
 * ido sin avisar: entonces la tramita RRHH y queda como baja voluntaria.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, UserMinus } from "lucide-react";

export function QuienCausaBajaDialog({
  open,
  onOpenChange,
  nombre,
  onEmpresa,
  onSinPreaviso,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nombre: string;
  /** La decide la empresa: despido, fin de contrato, no supera la prueba… */
  onEmpresa: () => void;
  /** Se fue sin dar preaviso: la tramita RRHH como baja voluntaria. */
  onSinPreaviso: () => void;
}) {
  const [paso, setPaso] = useState<"quien" | "trabajador">("quien");

  useEffect(() => {
    if (open) setPaso("quien");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baja de {nombre}</DialogTitle>
          <DialogDescription>
            {paso === "quien"
              ? "¿Quién causa la baja?"
              : "Esta baja la pide el propio trabajador."}
          </DialogDescription>
        </DialogHeader>

        {paso === "quien" ? (
          <div className="grid gap-2 py-1">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 py-3 text-left"
              onClick={onEmpresa}
            >
              <Building2 className="h-5 w-5 shrink-0 text-destructive" />
              <span>
                <span className="block font-medium">La empresa</span>
                <span className="block text-xs text-muted-foreground">
                  Despido, fin de contrato o no supera el periodo de prueba.
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 py-3 text-left"
              onClick={() => setPaso("trabajador")}
            >
              <UserMinus className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-medium">El trabajador</span>
                <span className="block text-xs text-muted-foreground">
                  Se va por decisión propia.
                </span>
              </span>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>
              La solicita él desde su panel y, cuando RRHH se la apruebe, su ficha entra sola
              en «Preaviso».
            </p>
            <p className="mt-2">
              Si se ha ido <strong>sin dar preaviso</strong>, la tramitas tú: se registra como{" "}
              <strong>baja voluntaria</strong>.
            </p>
          </div>
        )}

        {paso === "trabajador" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Esperar a que la pida
            </Button>
            <Button variant="destructive" onClick={onSinPreaviso}>
              Se fue sin avisar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
