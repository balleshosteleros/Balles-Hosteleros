"use client";

/**
 * Diálogo para corregir el emparejado de un ingrediente.
 * Combobox (Command) DENTRO de Dialog — regla de UI del proyecto.
 * PRP-071, Fase 3.
 */

import { useMemo, useState } from "react";
import type {
  Candidato,
  PreviewLinea,
} from "@/features/cocina/services/import-fichas/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  linea: PreviewLinea;
  /** Catálogo completo de candidatos (compra + elaboración). */
  candidatos?: Candidato[];
  onClose: () => void;
  /** esElaboracion = el candidato elegido es tipo 'elaboracion' (sub-ficha). */
  onElegir: (cand: Candidato, esElaboracion: boolean) => void;
}

export function CorregirMatchDialog({
  open,
  linea,
  candidatos = [],
  onClose,
  onElegir,
}: Props) {
  const [busqueda, setBusqueda] = useState("");

  // Orden: el sugerido primero, luego por nombre.
  const ordenados = useMemo(() => {
    const sug = linea.match.candidato?.id;
    return [...candidatos].sort((a, b) => {
      if (a.id === sug) return -1;
      if (b.id === sug) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [candidatos, linea.match.candidato]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Corregir: <span className="font-normal">{linea.ingrediente}</span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Elige el producto de compra o la elaboración que corresponde a este
          ingrediente del Excel.
        </p>

        <Command>
          <CommandInput
            placeholder="Buscar producto o elaboración…"
            value={busqueda}
            onValueChange={setBusqueda}
          />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {ordenados.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.nombre} ${c.tipo}`}
                  onSelect={() => onElegir(c, c.tipo === "elaboracion")}
                >
                  <span className="flex-1">{c.nombre}</span>
                  <Badge
                    variant="outline"
                    className={
                      c.tipo === "elaboracion"
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }
                  >
                    {c.tipo === "elaboracion" ? "Elaboración" : "Compra"}
                  </Badge>
                  {c.id === linea.match.candidato?.id && (
                    <span className="ml-2 text-xs text-emerald-600">Sugerido</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
