"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Building2 } from "lucide-react";

export type SelectorAccion = "crear" | "editar" | "eliminar";

const ACCION_LABEL: Record<SelectorAccion, { titulo: string; descripcion: string; cta: string }> = {
  crear: {
    titulo: "¿En qué empresas crear esta tarea?",
    descripcion: "Por defecto se crea en todas las empresas del grupo. Desmarca las que quieras excluir.",
    cta: "Crear",
  },
  editar: {
    titulo: "¿En qué empresas aplicar los cambios?",
    descripcion: "Por defecto los cambios se replican en todas las empresas del grupo. Desmarca las que quieras dejar como están.",
    cta: "Guardar",
  },
  eliminar: {
    titulo: "¿En qué empresas eliminar?",
    descripcion: "Por defecto se elimina en todas las empresas del grupo. Desmarca las que quieras conservar.",
    cta: "Eliminar",
  },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accion: SelectorAccion;
  onConfirm: (empresaDbIds: string[]) => Promise<void> | void;
  /** Lista opcional para preseleccionar solo algunas empresas (por defecto todas). */
  defaultSelectedDbIds?: string[];
}

export function SelectorEmpresasDialog({
  open, onOpenChange, accion, onConfirm, defaultSelectedDbIds,
}: Props) {
  const { empresas } = useEmpresa();
  const empresasConDbId = useMemo(
    () => empresas.filter((e) => !!e.dbId),
    [empresas],
  );
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = defaultSelectedDbIds ?? empresasConDbId.map((e) => e.dbId!);
    setSeleccionadas(new Set(base));
  }, [open, defaultSelectedDbIds, empresasConDbId]);

  const toggle = (dbId: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  const todasMarcadas = seleccionadas.size === empresasConDbId.length;
  const ningunaMarcada = seleccionadas.size === 0;

  const toggleTodas = () => {
    setSeleccionadas(
      todasMarcadas ? new Set() : new Set(empresasConDbId.map((e) => e.dbId!)),
    );
  };

  const handleConfirm = async () => {
    if (ningunaMarcada) return;
    setSubmitting(true);
    try {
      await onConfirm(Array.from(seleccionadas));
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const labels = ACCION_LABEL[accion];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {labels.titulo}
          </DialogTitle>
          <DialogDescription>{labels.descripcion}</DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-1">
          <button
            type="button"
            onClick={toggleTodas}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline mb-2"
          >
            {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
          </button>

          <div className="border rounded-lg divide-y">
            {empresasConDbId.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No hay empresas creadas en Ajustes.
              </div>
            ) : (
              empresasConDbId.map((empresa) => {
                const checked = seleccionadas.has(empresa.dbId!);
                return (
                  <Label
                    key={empresa.dbId}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(empresa.dbId!)}
                    />
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: empresa.color }}
                    >
                      {empresa.iniciales}
                    </span>
                    <span className="text-sm font-medium flex-1">{empresa.nombre}</span>
                  </Label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={ningunaMarcada || submitting}
            variant={accion === "eliminar" ? "destructive" : "default"}
          >
            {submitting
              ? "Guardando…"
              : `${labels.cta}${seleccionadas.size > 0 ? ` en ${seleccionadas.size} empresa${seleccionadas.size > 1 ? "s" : ""}` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper: si solo hay 1 empresa en el grupo, devuelve su dbId sin abrir diálogo.
 * Si hay varias, devuelve null y el caller debe abrir el diálogo.
 */
export function useEmpresasParaSelector(): { todasIds: string[]; soloUna: string | null } {
  const { empresas } = useEmpresa();
  const todasIds = empresas.filter((e) => !!e.dbId).map((e) => e.dbId!);
  return {
    todasIds,
    soloUna: todasIds.length === 1 ? todasIds[0] : null,
  };
}
