"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listJornadas,
  createJornada,
  updateJornada,
  deleteJornada,
  type JornadaRow,
} from "@/features/rrhh/actions/jornadas-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

/**
 * Catálogo de jornadas de la empresa (Ajustes → Departamentos → RRHH → Jornadas).
 * Fuente única para el desplegable obligatorio de "Jornada" en cada vacante y
 * para el buscador del portal público de empleo.
 */
export function JornadasVacantesPanel() {
  const [items, setItems] = useState<JornadaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState("");
  const [pendiente, setPendiente] = useState<{ id: string; nombre: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const recargar = useCallback(() => {
    setCargando(true);
    listJornadas(true).then((res) => {
      setItems(res.ok ? res.data : []);
      setCargando(false);
    });
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const onAdd = useCallback(() => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    startTransition(async () => {
      const res = await createJornada({ nombre });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Jornada "${nombre}" creada`);
      setNuevoNombre("");
      setCreando(false);
      recargar();
    });
  }, [nuevoNombre, recargar]);

  const onRename = useCallback(
    (id: string) => {
      const nombre = editandoValor.trim();
      if (!nombre) return;
      startTransition(async () => {
        const res = await updateJornada(id, { nombre });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Jornada actualizada");
        setEditandoId(null);
        setEditandoValor("");
        recargar();
      });
    },
    [editandoValor, recargar],
  );

  const onDelete = useCallback(
    (id: string, nombre: string) => {
      startTransition(async () => {
        const res = await deleteJornada(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Jornada "${nombre}" borrada`);
        recargar();
      });
    },
    [recargar],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-foreground">Jornadas de vacantes</label>
          <p className="text-[11px] text-muted-foreground">
            Cada vacante elige una de estas jornadas. También filtran el portal de empleo.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreando((v) => !v);
            setNuevoNombre("");
          }}
          className="gap-1 h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva
        </Button>
      </div>

      {creando && (
        <div className="flex gap-2">
          <Input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre de la nueva jornada"
            className="h-8 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              } else if (e.key === "Escape") {
                setCreando(false);
                setNuevoNombre("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={onAdd}
            disabled={!nuevoNombre.trim() || isPending}
            className="gap-1 h-8 shrink-0"
          >
            <Check className="h-3.5 w-3.5" /> Añadir
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCreando(false);
              setNuevoNombre("");
            }}
            className="h-8 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        {cargando ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No hay jornadas. Crea la primera con el botón “Nueva”.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((jor) => (
              <li
                key={jor.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30"
              >
                {editandoId === jor.id ? (
                  <>
                    <Input
                      value={editandoValor}
                      onChange={(e) => setEditandoValor(e.target.value)}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onRename(jor.id);
                        } else if (e.key === "Escape") {
                          setEditandoId(null);
                          setEditandoValor("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onRename(jor.id)}
                      disabled={isPending || !editandoValor.trim()}
                      className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                      title="Guardar"
                      aria-label="Guardar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(null);
                        setEditandoValor("");
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      title="Cancelar"
                      aria-label="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{jor.nombre}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(jor.id);
                        setEditandoValor(jor.nombre);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendiente({ id: jor.id, nombre: jor.nombre })}
                      disabled={isPending}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      title="Borrar"
                      aria-label="Borrar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendiente} onOpenChange={(o) => !o && setPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la jornada “{pendiente?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendiente) onDelete(pendiente.id, pendiente.nombre);
                setPendiente(null);
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
