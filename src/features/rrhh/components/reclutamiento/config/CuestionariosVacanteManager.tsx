"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Copy, Trash2, Lock, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listCuestionariosVacante,
  duplicarCuestionarioVacante,
  deleteCuestionarioVacante,
} from "@/features/rrhh/actions/cuestionarios-vacante-actions";
import type { CuestionarioVacante } from "@/features/rrhh/data/cuestionario-vacante";
import { CuestionarioBuilderDialog } from "./CuestionarioBuilderDialog";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

export function CuestionariosVacanteManager() {
  const [cuestionarios, setCuestionarios] = useState<CuestionarioVacante[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDelete();

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listCuestionariosVacante();
    setCuestionarios(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  function abrirNuevo() {
    setEditId(null);
    setBuilderOpen(true);
  }
  function abrirEditar(id: string) {
    setEditId(id);
    setBuilderOpen(true);
  }

  function duplicar(id: string) {
    startTransition(async () => {
      const res = await duplicarCuestionarioVacante(id);
      if (res.ok) {
        toast.success("Cuestionario duplicado");
        await cargar();
        if ("id" in res && res.id) abrirEditar(res.id);
      } else {
        toast.error(("error" in res && res.error) || "No se pudo duplicar");
      }
    });
  }

  async function eliminar(c: CuestionarioVacante) {
    const ok = await confirm({
      title: "¿Eliminar cuestionario?",
      description: `Se eliminará "${c.nombre}". Las vacantes que lo usen quedarán sin cuestionario. Las notas ya registradas se conservan.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteCuestionarioVacante(c.id);
      if (res.ok) {
        toast.success("Cuestionario eliminado");
        await cargar();
      } else {
        toast.error(("error" in res && res.error) || "No se pudo eliminar");
      }
    });
  }

  return (
    <Card>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Cuestionarios</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            El candidato los responde antes de enviar su candidatura. La nota (0–10) aparece en su ficha.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={abrirNuevo}>
          <Plus className="h-3.5 w-3.5" /> Crear cuestionario
        </Button>
      </div>

      <CardContent className="p-0">
        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando…
          </div>
        ) : cuestionarios.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No hay cuestionarios configurados
          </div>
        ) : (
          cuestionarios.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{c.nombre}</span>
                    {c.esDefault && (
                      <Badge variant="secondary" className="text-[10px]">Por defecto</Badge>
                    )}
                    {c.usado && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-200 bg-amber-50 text-amber-700">
                        <Lock className="h-2.5 w-2.5" /> Usado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.preguntas.length} {c.preguntas.length === 1 ? "pregunta" : "preguntas"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(c.id)} title={c.usado ? "Ver" : "Editar"}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicar(c.id)} disabled={pending} title="Duplicar">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                {!c.esDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => eliminar(c)}
                    disabled={pending}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <CuestionarioBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        cuestionarioId={editId}
        onSaved={cargar}
      />
      {dialog}
    </Card>
  );
}
