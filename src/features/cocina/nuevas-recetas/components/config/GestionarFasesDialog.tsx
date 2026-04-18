"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GripVertical, Plus, Pencil, Clock, User } from "lucide-react";
import { toast } from "sonner";

import { listFases, reordenarFases, type FaseConPolicies } from "../../actions/fases-actions";
import { listUsuariosEmpresa } from "../../actions/usuarios-empresa-actions";
import { COLOR_PALETTE, type FaseColor } from "../../types";
import { FaseConfigDialog } from "./FaseConfigDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function GestionarFasesDialog({ open, onOpenChange, onChanged }: Props) {
  const [fases, setFases] = useState<FaseConPolicies[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  const [editFase, setEditFase] = useState<FaseConPolicies | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const draggedId = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [fRes, uRes] = await Promise.all([
      listFases(),
      listUsuariosEmpresa(),
    ]);
    if (fRes.ok) setFases(fRes.data);
    if (uRes.ok) {
      const map: Record<string, string> = {};
      for (const u of uRes.data) map[u.user_id] = u.nombre_completo;
      setUsuarios(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  async function reordenar(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const newOrder = [...fases];
    const draggedIdx = newOrder.findIndex((f) => f.id === draggedId);
    const targetIdx = newOrder.findIndex((f) => f.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [moved] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, moved);

    setFases(newOrder);
    const res = await reordenarFases(newOrder.map((f) => f.id));
    if (!res.ok) {
      toast.error(res.error);
      await cargar();
    } else {
      onChanged();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>Gestionar fases del pipeline</DialogTitle>
              <Button size="sm" onClick={() => setShowNew(true)} disabled={fases.length >= 10}>
                <Plus className="h-4 w-4 mr-1" /> Nueva fase
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Arrastra por el icono para reordenar. Máximo 10 fases, mínimo 2.
            </p>
          </DialogHeader>

          {loading && <p className="text-sm text-muted-foreground py-6 text-center">Cargando...</p>}

          {!loading && (
            <div className="space-y-2">
              {fases.map((fase) => {
                const color = COLOR_PALETTE[fase.color as FaseColor] ?? COLOR_PALETTE.gris;
                return (
                  <Card
                    key={fase.id}
                    draggable
                    onDragStart={() => { draggedId.current = fase.id; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedId.current) reordenar(draggedId.current, fase.id);
                      draggedId.current = null;
                    }}
                    className="cursor-move hover:shadow-sm transition-shadow"
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                      <div
                        className="h-10 w-1.5 rounded-full shrink-0"
                        style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">Fase {fase.orden}</Badge>
                          <span className="font-medium text-sm">{fase.nombre}</span>
                          {fase.es_sistema && (
                            <Badge variant="secondary" className="text-[9px]">Sistema</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                          {fase.sub_estados.length > 0 && (
                            <span>{fase.sub_estados.length} sub-estado{fase.sub_estados.length > 1 ? "s" : ""}</span>
                          )}
                          {fase.plazo_dias && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> {fase.plazo_dias}d
                            </span>
                          )}
                          {fase.responsable_user_id && usuarios[fase.responsable_user_id] && (
                            <span className="inline-flex items-center gap-0.5">
                              <User className="h-3 w-3" /> {usuarios[fase.responsable_user_id]}
                            </span>
                          )}
                          {fase.responsable_departamento && (
                            <span>· {fase.responsable_departamento}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditFase(fase)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FaseConfigDialog
        open={showNew}
        onOpenChange={setShowNew}
        fase={null}
        onSaved={() => { cargar(); onChanged(); }}
      />

      <FaseConfigDialog
        open={!!editFase}
        onOpenChange={(o) => !o && setEditFase(null)}
        fase={editFase}
        onSaved={() => { cargar(); onChanged(); }}
      />
    </>
  );
}
