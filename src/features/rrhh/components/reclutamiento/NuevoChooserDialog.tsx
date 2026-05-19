"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Briefcase, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (tipo: "vacante" | "candidato") => void;
}

export function NuevoChooserDialog({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué quieres crear?</DialogTitle>
          <DialogDescription>
            Elige si vas a publicar un nuevo puesto o registrar a una persona en la base de candidatos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => onPick("vacante")}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-5 text-center"
          >
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Briefcase className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-sm">Vacante</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Crear una nueva oferta de empleo
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPick("candidato")}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-5 text-center"
          >
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserPlus className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-sm">Candidato</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Añadir una persona a la base de datos
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
