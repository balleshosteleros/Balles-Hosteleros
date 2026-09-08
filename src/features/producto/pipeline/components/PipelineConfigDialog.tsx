"use client";

/**
 * Configuración del pipeline: cómo se llama el embudo y qué columnas tiene.
 *
 * Vive en el engranaje de la barra del submódulo (configuración base), no en
 * Ajustes: aquí se decide cómo se trabaja en esta pantalla, no quién entra ni
 * qué se integra por fuera.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  borrarFase,
  guardarFase,
  guardarPipeline,
} from "../actions/pipeline-actions";
import type { Pipeline, PipelineFase } from "../types";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  pipeline: Pipeline;
  fases: PipelineFase[];
  /** Cuántas tarjetas hay en cada fase: una fase con tarjetas no se puede borrar. */
  conteoPorFase: Map<string, number>;
  onCambios: () => void;
}

export function PipelineConfigDialog({
  abierto,
  onCerrar,
  pipeline,
  fases,
  conteoPorFase,
  onCambios,
}: Props) {
  const { confirm, dialog } = useConfirmDelete();
  const [nombre, setNombre] = useState(pipeline.nombre);
  const [guardando, setGuardando] = useState(false);
  const [nuevaFase, setNuevaFase] = useState("");

  useEffect(() => {
    if (abierto) setNombre(pipeline.nombre);
  }, [abierto, pipeline.nombre]);

  const onGuardarNombre = async () => {
    setGuardando(true);
    const res = await guardarPipeline({ id: pipeline.id, nombre: nombre.trim(), activo: pipeline.activo });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Guardado");
    onCambios();
  };

  const onAnadirFase = async () => {
    const texto = nuevaFase.trim();
    if (!texto) return;
    const res = await guardarFase({
      pipeline_id: pipeline.id,
      nombre: texto,
      icono: null,
      color: null,
      orden: fases.length,
      activa: true,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNuevaFase("");
    toast.success("Fase añadida");
    onCambios();
  };

  const onRenombrarFase = async (fase: PipelineFase, texto: string) => {
    if (!texto.trim() || texto.trim() === fase.nombre) return;
    const res = await guardarFase({
      id: fase.id,
      pipeline_id: fase.pipeline_id,
      nombre: texto.trim(),
      icono: fase.icono,
      color: fase.color,
      orden: fase.orden,
      activa: fase.activa,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onCambios();
  };

  const onBorrarFase = async (fase: PipelineFase) => {
    const dentro = conteoPorFase.get(fase.id) ?? 0;
    if (dentro > 0) {
      toast.error(`La fase tiene ${dentro} oportunidades. Muévelas antes de borrarla.`);
      return;
    }
    const ok = await confirm({
      title: "Borrar la fase",
      description: `Se quita la columna "${fase.nombre}" del tablero.`,
    });
    if (!ok) return;
    const res = await borrarFase(fase.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Borrada");
    onCambios();
  };

  return (
    <>
      <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración del pipeline</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pl-nombre">Nombre</Label>
              <Input
                id="pl-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <Label>Fases</Label>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Son las columnas del tablero, de izquierda a derecha.
              </p>
              <div className="space-y-1.5">
                {fases.map((fase) => (
                  <div key={fase.id} className="flex items-center gap-2">
                    <span className="w-6 text-center text-sm" aria-hidden>
                      {fase.icono ?? ""}
                    </span>
                    <Input
                      defaultValue={fase.nombre}
                      onBlur={(e) => onRenombrarFase(fase, e.target.value)}
                      className="h-8 flex-1"
                      autoComplete="off"
                    />
                    <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {conteoPorFase.get(fase.id) ?? 0}
                    </span>
                    <Switch
                      checked={fase.activa}
                      onCheckedChange={(v) =>
                        void guardarFase({
                          id: fase.id,
                          pipeline_id: fase.pipeline_id,
                          nombre: fase.nombre,
                          icono: fase.icono,
                          color: fase.color,
                          orden: fase.orden,
                          activa: v,
                        }).then((r) => (r.ok ? onCambios() : toast.error(r.error)))
                      }
                      aria-label={fase.activa ? "Fase activa" : "Fase inactiva"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => void onBorrarFase(fase)}
                      title="Borrar la fase"
                      aria-label="Borrar la fase"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex gap-2">
                <Input
                  value={nuevaFase}
                  onChange={(e) => setNuevaFase(e.target.value)}
                  placeholder="Nueva fase"
                  className="h-8"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => void onAnadirFase()}
                  disabled={!nuevaFase.trim()}
                  title="Añadir la fase"
                  aria-label="Añadir la fase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => void onGuardarNombre()}
              disabled={guardando || !nombre.trim()}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
