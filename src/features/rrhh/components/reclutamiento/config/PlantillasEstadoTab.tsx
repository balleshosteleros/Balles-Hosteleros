"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Loader2, Star, GripVertical, X, ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  listPlantillasEstado,
  createPlantillaEstado,
  updatePlantillaEstado,
  deletePlantillaEstado,
  type PlantillaEstadoRow,
  type PlantillaEstadoItem,
} from "@/features/rrhh/actions/plantillas-reclutamiento-actions";
import {
  listReclutamientoEmailPlantillas,
  type ReclutamientoEmailPlantilla,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import {
  RECLUTAMIENTO_PLANTILLA_ESTADOS_SEED,
  FASES_PLANTILLA_ESTADO,
  type FasePlantillaEstado,
} from "@/lib/seeds/reclutamiento-plantilla-estados";

const FASES_ORDER: FasePlantillaEstado[] = ["seleccion", "formacion", "contratacion", "prueba", "empleado", "descartado"];
const SIN_EMAIL = "__no_email__";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `estado_${Math.floor(Math.random() * 1e6)}`;
}

/** Normaliza la lista de estados: agrupa por fase en orden y reasigna `orden` 1..n. */
function normalizarEstados(estados: PlantillaEstadoItem[]): PlantillaEstadoItem[] {
  const out: PlantillaEstadoItem[] = [];
  let orden = 1;
  for (const fase of FASES_ORDER) {
    for (const e of estados.filter((x) => x.fase === fase)) {
      out.push({ ...e, orden: orden++ });
    }
  }
  return out;
}

// ─── Vista previa del pipeline (3 fases con sus estados en orden) ───────────
function PipelinePreview({ estados }: { estados: PlantillaEstadoItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {FASES_ORDER.map((fase) => {
        const cfg = FASES_PLANTILLA_ESTADO[fase];
        const items = estados.filter((e) => e.fase === fase).sort((a, b) => a.orden - b.orden);
        return (
          <div key={fase} className="rounded-lg border border-border overflow-hidden">
            <div
              className="px-3 py-2 flex items-center gap-2 border-b border-border"
              style={{ background: `${cfg.color}14` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-1 py-2">Sin estados</p>
              ) : (
                items.map((e) => (
                  <div
                    key={e.key}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                    style={{ background: `${e.color}10` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="truncate text-foreground">{e.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Editor de plantilla de estados ─────────────────────────────────────────
function EstadoEditorDialog({
  plantilla,
  emailPlantillas,
  open,
  onOpenChange,
  onSaved,
}: {
  plantilla: PlantillaEstadoRow | null;
  emailPlantillas: ReclutamientoEmailPlantilla[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [estados, setEstados] = useState<PlantillaEstadoItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (plantilla) {
      setNombre(plantilla.nombre);
      setEstados(normalizarEstados(plantilla.estados ?? []));
    } else {
      // Nueva → parte de la consecución estándar; resuelve el email por defecto
      // de cada estado a su id en esta empresa.
      const seed = RECLUTAMIENTO_PLANTILLA_ESTADOS_SEED;
      const items: PlantillaEstadoItem[] = seed.estados.map((e) => {
        const { defaultEmailNombre, ...resto } = e;
        const emailId = defaultEmailNombre
          ? emailPlantillas.find((ep) => ep.nombre === defaultEmailNombre)?.id ?? null
          : null;
        return { ...resto, email_plantilla_id: emailId };
      });
      setNombre("");
      setEstados(normalizarEstados(items));
    }
  }, [open, plantilla, emailPlantillas]);

  const addEstado = (fase: FasePlantillaEstado) => {
    const cfg = FASES_PLANTILLA_ESTADO[fase];
    setEstados((prev) =>
      normalizarEstados([
        ...prev,
        { key: `nuevo_${Date.now()}`, label: "Nuevo estado", color: cfg.color, fase, orden: 999, email_plantilla_id: null },
      ]),
    );
  };

  const renameEstado = (key: string, label: string) => {
    setEstados((prev) => prev.map((e) => (e.key === key ? { ...e, label } : e)));
  };

  const setEstadoEmail = (key: string, emailId: string | null) => {
    setEstados((prev) => prev.map((e) => (e.key === key ? { ...e, email_plantilla_id: emailId } : e)));
  };

  const removeEstado = (key: string) => {
    setEstados((prev) => normalizarEstados(prev.filter((e) => e.key !== key)));
  };

  const handleSave = () => {
    if (!nombre.trim()) {
      toast.error("Pon un nombre a la plantilla");
      return;
    }
    // Consolida keys legibles a partir del label para estados nuevos.
    const keysUsadas = new Set<string>();
    const finales = normalizarEstados(estados).map((e) => {
      let key = e.key.startsWith("nuevo_") ? slugify(e.label) : e.key;
      while (keysUsadas.has(key)) key = `${key}_${keysUsadas.size}`;
      keysUsadas.add(key);
      return { ...e, key, label: e.label.trim() || "Estado" };
    });
    if (finales.length === 0) {
      toast.error("Añade al menos un estado");
      return;
    }
    startTransition(async () => {
      const res = plantilla
        ? await updatePlantillaEstado(plantilla.id, { nombre: nombre.trim(), estados: finales })
        : await createPlantillaEstado({ nombre: nombre.trim(), estados: finales });
      if (res.ok) {
        toast.success(plantilla ? "Plantilla actualizada" : "Plantilla creada");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(("error" in res && res.error) || "Error al guardar");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-base">
            {plantilla ? "Editar plantilla de estados" : "Nueva plantilla de estados"}
          </DialogTitle>
          <DialogDescription>
            Define la consecución de estados del proceso y, para cada uno, qué email se envía por defecto. Cada vacante elige una de estas plantillas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-190px)]">
          <div className="px-6 py-5 space-y-5">
            <div className="space-y-1.5 sm:max-w-sm">
              <Label className="text-xs">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Proceso express" />
            </div>

            <div className="space-y-3">
              {FASES_ORDER.map((fase) => {
                const cfg = FASES_PLANTILLA_ESTADO[fase];
                const items = estados.filter((e) => e.fase === fase).sort((a, b) => a.orden - b.orden);
                return (
                  <div key={fase} className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 flex items-center justify-between border-b border-border" style={{ background: `${cfg.color}14` }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span className="text-xs font-semibold text-foreground">Fase: {cfg.label}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => addEstado(fase)}>
                        <Plus className="h-3.5 w-3.5" /> Añadir estado
                      </Button>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {items.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground px-1 py-1.5">Sin estados en esta fase</p>
                      ) : (
                        items.map((e) => (
                          <div key={e.key} className="flex items-center gap-2">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                            <Input
                              value={e.label}
                              onChange={(ev) => renameEstado(e.key, ev.target.value)}
                              className="h-8 text-sm flex-1 min-w-0"
                            />
                            <div className="flex items-center gap-1 shrink-0 w-44">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Select
                                value={e.email_plantilla_id ?? SIN_EMAIL}
                                onValueChange={(v) => setEstadoEmail(e.key, v === SIN_EMAIL ? null : v)}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Email…" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SIN_EMAIL}>Sin email</SelectItem>
                                  {emailPlantillas.map((ep) => (
                                    <SelectItem key={ep.id} value={ep.id}>
                                      {ep.nombre}{ep.activa ? "" : " (inactiva)"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => removeEstado(e.key)}
                              title="Quitar estado"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {plantilla ? "Guardar" : "Crear plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab principal ──────────────────────────────────────────────────────────
export function PlantillasEstadoTab() {
  const [plantillas, setPlantillas] = useState<PlantillaEstadoRow[]>([]);
  const [emailPlantillas, setEmailPlantillas] = useState<ReclutamientoEmailPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlantillaEstadoRow | null>(null);
  const [creando, setCreando] = useState(false);
  const { confirm, dialog } = useConfirmDelete();

  const reload = useCallback(async () => {
    const [res, emails] = await Promise.all([
      listPlantillasEstado(),
      listReclutamientoEmailPlantillas(),
    ]);
    setPlantillas(res.data);
    setEmailPlantillas(emails);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDelete = async (p: PlantillaEstadoRow) => {
    if (p.es_predeterminada) {
      toast.error("No se puede eliminar la plantilla predeterminada");
      return;
    }
    const ok = await confirm({
      title: "¿Eliminar plantilla de estados?",
      description: `Se eliminará «${p.nombre}». Las vacantes que la usaban conservarán su pipeline.`,
    });
    if (!ok) return;
    const res = await deletePlantillaEstado(p.id);
    if (res.ok) {
      toast.success("Plantilla eliminada");
      void reload();
    } else {
      toast.error(("error" in res && res.error) || "Error al eliminar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Plantillas de estados</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            La consecución de estados del pipeline. Al crear una vacante se elige una de estas plantillas.
          </p>
        </div>
        <Button onClick={() => setCreando(true)} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando plantillas…
        </div>
      ) : plantillas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No hay plantillas de estados todavía.</div>
      ) : (
        plantillas.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold text-foreground text-sm truncate">{p.nombre}</h3>
                {p.es_predeterminada && (
                  <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-700">
                    <Star className="h-3 w-3" /> Predeterminada
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] gap-1">
                  {p.estados.length} estados <ArrowRight className="h-3 w-3" />
                </Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(p)} title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-40"
                  onClick={() => handleDelete(p)}
                  disabled={p.es_predeterminada}
                  title={p.es_predeterminada ? "No se puede eliminar la predeterminada" : "Eliminar"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <PipelinePreview estados={p.estados} />
            </CardContent>
          </Card>
        ))
      )}

      <EstadoEditorDialog
        plantilla={editing}
        emailPlantillas={emailPlantillas}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={reload}
      />
      <EstadoEditorDialog
        plantilla={null}
        emailPlantillas={emailPlantillas}
        open={creando}
        onOpenChange={setCreando}
        onSaved={reload}
      />
      {dialog}
    </div>
  );
}
