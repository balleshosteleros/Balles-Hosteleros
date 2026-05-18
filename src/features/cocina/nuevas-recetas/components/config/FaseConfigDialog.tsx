"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { FaseConPolicies } from "../../actions/fases-actions";
import { updateFase, deleteFase, createFase,
  createSubEstado, updateSubEstado, deleteSubEstado,
} from "../../actions/fases-actions";
import { listUsuariosEmpresa, type UsuarioEmpresa } from "../../actions/usuarios-empresa-actions";
import { COLOR_PALETTE, type FaseColor } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fase: FaseConPolicies | null;  // null = crear nueva
  onSaved: () => void;
}

const COLOR_KEYS = Object.keys(COLOR_PALETTE) as FaseColor[];

export function FaseConfigDialog({ open, onOpenChange, fase, onSaved }: Props) {
  const esNueva = !fase;
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<FaseColor>("gris");
  const [plazo, setPlazo] = useState("");
  const [responsable, setResponsable] = useState<string>("");
  const [departamento, setDepartamento] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [subEstados, setSubEstados] = useState<Array<{ id?: string; nombre: string; orden: number }>>([]);
  const [nuevoSub, setNuevoSub] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const r = await listUsuariosEmpresa();
      if (r.ok) setUsuarios(r.data);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (fase) {
      setNombre(fase.nombre);
      setColor(fase.color as FaseColor);
      setPlazo(fase.plazo_dias?.toString() ?? "");
      setResponsable(fase.responsable_user_id ?? "");
      setDepartamento(fase.responsable_departamento ?? "");
      setSubEstados(
        (fase.sub_estados ?? []).map((s) => ({
          id: s.id,
          nombre: s.nombre,
          orden: s.orden,
        })),
      );
    } else {
      setNombre(""); setColor("gris"); setPlazo(""); setResponsable("");
      setDepartamento(""); setSubEstados([]);
    }
    setNuevoSub("");
  }, [open, fase]);

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("Falta el nombre de la fase");
      return;
    }
    setSaving(true);
    try {
      let faseId = fase?.id;

      if (esNueva) {
        const res = await createFase({
          nombre: nombre.trim(),
          color,
          plazo_dias: plazo ? parseInt(plazo, 10) : null,
          responsable_departamento: departamento || null,
          responsable_user_id: responsable || null,
        });
        if (!res.ok) { toast.error(res.error); return; }
        faseId = res.data.id;
      } else {
        const res = await updateFase(fase!.id, {
          nombre: nombre.trim(),
          color,
          plazo_dias: plazo ? parseInt(plazo, 10) : null,
          responsable_departamento: departamento || null,
          responsable_user_id: responsable || null,
        });
        if (!res.ok) { toast.error(res.error); return; }
      }

      // Sincronizar sub-estados
      if (faseId) {
        const originales = fase?.sub_estados ?? [];
        const actuales = subEstados;

        // Borrar los que ya no están
        for (const o of originales) {
          if (!actuales.find((a) => a.id === o.id)) {
            await deleteSubEstado(o.id);
          }
        }
        // Crear/actualizar
        for (let i = 0; i < actuales.length; i++) {
          const a = actuales[i];
          if (!a.id) {
            await createSubEstado(faseId, a.nombre);
          } else if (originales.find((o) => o.id === a.id)?.nombre !== a.nombre) {
            await updateSubEstado(a.id, { nombre: a.nombre, orden: i + 1 });
          }
        }
      }

      toast.success(esNueva ? "Fase creada" : "Fase actualizada");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function borrar() {
    if (!fase) return;
    setConfirmarBorrado(false);
    const res = await deleteFase(fase.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Fase borrada");
    onSaved();
    onOpenChange(false);
  }

  function addSubEstado() {
    if (!nuevoSub.trim()) return;
    if (subEstados.length >= 6) {
      toast.error("Máximo 6 sub-estados por fase");
      return;
    }
    setSubEstados([...subEstados, { nombre: nuevoSub.trim(), orden: subEstados.length + 1 }]);
    setNuevoSub("");
  }

  function removeSubEstado(idx: number) {
    setSubEstados(subEstados.filter((_, i) => i !== idx));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{esNueva ? "Nueva fase" : `Editar fase "${fase?.nombre}"`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {COLOR_KEYS.map((c) => {
                  const p = COLOR_PALETTE[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        color === c ? "border-foreground scale-110" : "border-transparent",
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                      }}
                      title={c}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plazo (días)</Label>
                <Input
                  type="number"
                  value={plazo}
                  onChange={(e) => setPlazo(e.target.value)}
                  placeholder="Ej: 7"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Verde si dentro, rojo si pasado</p>
              </div>

              <div>
                <Label>Departamento</Label>
                <Input
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  placeholder="Cocina, Compras, Marketing..."
                />
              </div>
            </div>

            <div>
              <Label>Responsable (usuario asignado)</Label>
              <Select value={responsable || "ninguno"} onValueChange={(v) => setResponsable(v === "ninguno" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin responsable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin responsable</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.nombre_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Recibirá una tarea automática al mover una receta a esta fase (si se activa &quot;Comunicar&quot;)
              </p>
            </div>

            <div>
              <Label>Sub-estados ({subEstados.length}/6)</Label>
              <div className="space-y-1 mt-1">
                {subEstados.map((s, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <Badge variant="outline" className="text-[10px]">{idx + 1}</Badge>
                    <Input
                      value={s.nombre}
                      onChange={(e) => setSubEstados(subEstados.map((x, i) => i === idx ? { ...x, nombre: e.target.value } : x))}
                      className="h-8 text-sm flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeSubEstado(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              {subEstados.length < 6 && (
                <div className="flex gap-1.5 mt-2">
                  <Input
                    placeholder="Nombre del sub-estado"
                    value={nuevoSub}
                    onChange={(e) => setNuevoSub(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubEstado())}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={addSubEstado}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 mt-3">
            {!esNueva && !fase?.es_sistema && (
              <Button
                variant="outline"
                className="text-destructive mr-auto"
                onClick={() => setConfirmarBorrado(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Borrar fase
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={guardar} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar fase &quot;{fase?.nombre}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Si hay recetas en esta fase el borrado se bloqueará.
              Muévelas a otra fase antes de borrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar} className="bg-destructive hover:bg-destructive/90">
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
