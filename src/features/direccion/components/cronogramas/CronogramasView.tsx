"use client";

import { useMemo, useState, Fragment, useRef } from "react";
import {
  useCronogramasOperativos,
  CronogramaOperativo,
  Frecuencia,
} from "../../hooks/useCronogramasOperativos";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, CalendarDays, Edit2, ChevronDown, ChevronRight, Video, Upload, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  uploadCronogramaVideo, deleteCronogramaVideo, updateCronogramaResumen,
} from "../../actions/cronograma-video-actions";

const ORDERED_FREQUENCIES: Frecuencia[] = [
  "DIARIO", "SEMANAL", "MENSUAL", "TRIMESTRAL", "ANUAL", "POR NECESIDAD",
];

interface Grupo {
  main: CronogramaOperativo;
  subs: CronogramaOperativo[];
}

export function CronogramasView() {
  const { data, isLoading, addTarea, updateTarea, deleteTarea, refresh } = useCronogramasOperativos();
  const [selectedRol, setSelectedRol] = useState<string>("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newRolName, setNewRolName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [detalle, setDetalle] = useState<CronogramaOperativo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Fila pendiente (nueva tarea aún no guardada en DB)
  const [pendingNew, setPendingNew] = useState<{
    parentId: string | null;
    parentIdVisible: string | null;
    subCount: number;
    nextOrden: number;
    text: string;
  } | null>(null);

  const rolesDisponibles = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.rol))).filter(Boolean).sort();
  }, [data]);

  const rolActivo = selectedRol || (rolesDisponibles.length > 0 ? rolesDisponibles[0] : "");
  const tareasDeRol = useMemo(() => data.filter((d) => d.rol === rolActivo), [data, rolActivo]);

  // Construir jerarquía: main = sin parent_id, subs = con parent_id
  const grupos = useMemo<Grupo[]>(() => {
    const mains = tareasDeRol.filter((t) => !t.parent_id);
    const subsByParent = new Map<string, CronogramaOperativo[]>();
    for (const t of tareasDeRol) {
      if (t.parent_id) {
        const arr = subsByParent.get(t.parent_id) ?? [];
        arr.push(t);
        subsByParent.set(t.parent_id, arr);
      }
    }
    return mains.map((m) => ({
      main: m,
      subs: (subsByParent.get(m.id) ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    }));
  }, [tareasDeRol]);

  const toggleGroup = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGroups((p) => ({ ...p, [id]: p[id] === undefined ? false : !p[id] }));
  };

  const handleAddMain = () => {
    if (!rolActivo) return;
    const nextOrden = Math.max(0, ...tareasDeRol.map((t) => t.orden ?? 0)) + 1;
    setPendingNew({
      parentId: null,
      parentIdVisible: null,
      subCount: 0,
      nextOrden,
      text: "",
    });
  };

  const handleAddSub = (parent: CronogramaOperativo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!rolActivo) return;
    const grupo = grupos.find((g) => g.main.id === parent.id);
    const subCount = grupo?.subs.length ?? 0;
    const nextOrden = (parent.orden ?? 0) * 1000 + subCount + 1;
    setExpandedGroups((p) => ({ ...p, [parent.id]: true }));
    setPendingNew({
      parentId: parent.id,
      parentIdVisible: parent.id_visible ?? null,
      subCount,
      nextOrden,
      text: "",
    });
  };

  const commitPending = async () => {
    if (!pendingNew) return;
    const text = pendingNew.text.trim();
    if (!text) { setPendingNew(null); return; } // vacío → descartar
    const { parentId, parentIdVisible, subCount, nextOrden } = pendingNew;
    const nextIdVis = parentId
      ? `${parentIdVisible ?? ""}.${subCount + 1}`
      : String(grupos.length + 1);
    await addTarea({
      rol: rolActivo,
      tarea: text,
      frecuencia: "OTRO",
      tiempo_requerido: "",
      id_visible: nextIdVis,
      orden: nextOrden,
      parent_id: parentId,
    });
    setPendingNew(null);
  };

  const handleSaveText = async (id: string) => {
    const item = tareasDeRol.find((t) => t.id === id);
    if (!item) return;
    if (editValue.trim() && editValue.trim() !== item.tarea) {
      await updateTarea(id, { tarea: editValue.trim() });
    }
    setEditingId(null);
    setEditValue("");
  };

  const renderPendingRow = (isSub: boolean) => {
    if (!pendingNew) return null;
    const idVis = pendingNew.parentId
      ? `${pendingNew.parentIdVisible ?? ""}.${pendingNew.subCount + 1}`
      : String(grupos.length + 1);
    return (
      <tr className={`group transition-colors ${isSub ? "bg-muted/5" : "bg-primary/5 border-b border-primary/20"}`}>
        <td className="px-3 py-3 text-center text-xs font-mono text-muted-foreground border-r align-middle whitespace-nowrap">
          {idVis}
        </td>
        <td className={`px-4 py-3 border-r align-middle ${isSub ? "pl-10" : ""}`}>
          <div className="flex items-center gap-2">
            {isSub && <span className="w-3 h-px bg-border/80" />}
            <Input
              autoFocus
              value={pendingNew.text}
              onChange={(e) => setPendingNew((p) => p ? { ...p, text: e.target.value } : p)}
              onBlur={commitPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitPending(); }
                if (e.key === "Escape") setPendingNew(null);
              }}
              placeholder={isSub ? "Escribe la subtarea…" : "Escribe la tarea…"}
              className="text-sm h-8 bg-background border-primary flex-1"
            />
          </div>
        </td>
        {ORDERED_FREQUENCIES.map((freq) => (
          <td key={freq} className="px-2 py-3 border-r border-border/40 text-center align-middle">
            <span className="text-muted-foreground/30">—</span>
          </td>
        ))}
        <td className="px-2 py-3 text-center align-middle bg-muted/20 border-l-2 border-border">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
            onClick={() => setPendingNew(null)}
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    );
  };

  const renderRow = (item: CronogramaOperativo, isSub: boolean, hasSubs: boolean) => {
    const isExpanded = expandedGroups[item.id] !== false;
    return (
      <tr
        key={item.id}
        className={`group transition-colors ${isSub ? "bg-muted/5 hover:bg-muted/10" : "hover:bg-muted/10 border-b border-border"}`}
      >
        {/* ID */}
        <td className="px-3 py-3 text-center text-xs font-mono text-muted-foreground border-r align-middle whitespace-nowrap">
          {item.id_visible || "—"}
        </td>

        {/* TAREA */}
        <td
          className={`px-4 py-3 border-r align-middle cursor-pointer ${isSub ? "pl-10 text-muted-foreground" : ""}`}
          onClick={() => setDetalle(item)}
        >
          <div className="flex items-center gap-2">
            {!isSub && hasSubs ? (
              <button
                className="p-1 hover:bg-muted rounded text-muted-foreground"
                onClick={(e) => toggleGroup(item.id, e)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6" /> // espacio sin chevron
            )}
            {isSub && <span className="w-3 h-px bg-border/80" />}
            {editingId === item.id ? (
              <Textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSaveText(item.id)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSaveText(item.id))}
                onClick={(e) => e.stopPropagation()}
                className="text-sm bg-background border-primary h-12 resize-none w-full"
              />
            ) : (
              <span className={`flex-1 ${!isSub ? "font-medium text-foreground" : ""}`}>
                {item.tarea}
                {item.video_url && <Video className="inline-block ml-2 h-3.5 w-3.5 text-emerald-600" />}
              </span>
            )}
          </div>
        </td>

        {/* FRECUENCIAS */}
        {ORDERED_FREQUENCIES.map((freq) => {
          const isActive = item.frecuencia === freq;
          return (
            <td key={freq} className={`px-2 py-3 border-r border-border/40 text-center align-middle ${isActive ? "bg-primary/5" : ""}`}>
              {isActive ? (
                <span className="font-bold text-primary text-[11px] tracking-wider">
                  {item.tiempo_requerido || "✓"}
                </span>
              ) : (
                <span className="text-muted-foreground/30">—</span>
              )}
            </td>
          );
        })}

        {/* ACCIONES — panel lateral derecho */}
        <td className="px-2 py-3 text-center align-middle bg-muted/20 border-l-2 border-border">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditValue(item.tarea); }}
              title="Editar tarea"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar "${item.tarea}"?`)) deleteTarea(item.id);
              }}
              title="Eliminar tarea"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {!isSub && (
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={(e) => handleAddSub(item, e)}
                title="Añadir subtarea"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-4 border-b bg-card">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-1 group">
            <Select
              value={rolActivo}
              onValueChange={setSelectedRol}
              disabled={isLoading || rolesDisponibles.length === 0}
            >
              <SelectTrigger className="w-[300px] bg-background">
                <SelectValue placeholder={isLoading ? "Cargando..." : "Selecciona Departamento"} />
              </SelectTrigger>
              <SelectContent>
                {rolesDisponibles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {rolActivo && (
              <Button
                type="button" variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                onClick={async () => {
                  if (confirm(`¿Eliminar TODO el cronograma de ${rolActivo}?`)) {
                    for (const t of tareasDeRol) await deleteTarea(t.id);
                    setSelectedRol("");
                  }
                }}
                title={`Eliminar cronograma ${rolActivo}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowNewDialog(true)} className="md:ml-2">
            <Plus className="h-4 w-4 mr-2" />
            AÑADIR CRONOGRAMA
          </Button>

          {rolActivo && (
            <Button type="button" size="sm" onClick={handleAddMain} className="shadow-sm" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-1.5" />
              Añadir Tarea
            </Button>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div id="table-scroll-container" className="flex-1 p-6 overflow-auto">
        {!rolActivo ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 opacity-20 mb-4" />
            <p className="mb-2">No hay ningún departamento disponible.</p>
          </div>
        ) : (
          <div className="bg-card w-full max-w-7xl mx-auto rounded-xl border shadow-md overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[1100px] border-collapse bg-card text-sm">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground uppercase text-xs tracking-wider border-b font-semibold">
                    <th className="py-4 px-3 w-[6%] text-center border-r">ID</th>
                    <th className="py-4 px-4 text-left w-[36%] border-r">Tarea a ejecutar</th>
                    {ORDERED_FREQUENCIES.map((f) => (
                      <th key={f} className="py-4 px-2 text-center w-[10%] border-r border-border/50">{f}</th>
                    ))}
                    <th className="py-4 px-3 w-[10%] text-center bg-muted/60 border-l border-border text-card-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        Sin tareas. Pulsa "Añadir Tarea".
                      </td>
                    </tr>
                  ) : (
                    <>
                      {grupos.map((g) => {
                        const isExpanded = expandedGroups[g.main.id] !== false;
                        const hasSubs = g.subs.length > 0;
                        const isPendingParent = pendingNew?.parentId === g.main.id;
                        return (
                          <Fragment key={g.main.id}>
                            {renderRow(g.main, false, hasSubs || isPendingParent)}
                            {isExpanded && (
                              <>
                                {hasSubs && g.subs.map((sub) => renderRow(sub, true, false))}
                                {isPendingParent && renderPendingRow(true)}
                              </>
                            )}
                          </Fragment>
                        );
                      })}
                      {pendingNew && !pendingNew.parentId && renderPendingRow(false)}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DIALOG NUEVO CRONOGRAMA */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear un nuevo cronograma</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Departamento/Rol</Label>
            <Input
              value={newRolName}
              onChange={(e) => setNewRolName(e.target.value.toUpperCase())}
              className="mt-2"
              placeholder="Ej. GERENCIA DE BARRA"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (newRolName) {
                addTarea({
                  rol: newRolName,
                  tarea: "Añadir misión de " + newRolName,
                  frecuencia: "OTRO",
                  tiempo_requerido: "",
                  id_visible: "1",
                  orden: 1,
                  parent_id: null,
                });
                setSelectedRol(newRolName);
                setShowNewDialog(false);
                setNewRolName("");
              }
            }}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DETALLE TAREA */}
      {detalle && (
        <DetalleTareaDialog
          tarea={detalle}
          onClose={() => setDetalle(null)}
          onSaved={() => { refresh(); }}
        />
      )}
    </div>
  );
}

/* ───────────── DETALLE DE TAREA (dialog con resumen + video) ───────────── */

function DetalleTareaDialog({
  tarea, onClose, onSaved,
}: {
  tarea: CronogramaOperativo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [resumen, setResumen] = useState(tarea.resumen ?? "");
  const [videoUrl, setVideoUrl] = useState(tarea.video_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleSaveResumen = async () => {
    const res = await updateCronogramaResumen(tarea.id, resumen);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Resumen guardado");
    onSaved();
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const res = await uploadCronogramaVideo(tarea.id, file.name, base64, file.type);
      if (!res.ok) { toast.error(res.error); return; }
      setVideoUrl(res.url);
      toast.success("Video subido");
      onSaved();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoUrl) return;
    if (!confirm("¿Eliminar el video?")) return;
    const res = await deleteCronogramaVideo(tarea.id, videoUrl);
    if (!res.ok) { toast.error(res.error); return; }
    setVideoUrl("");
    toast.success("Video eliminado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {tarea.id_visible && (
              <Badge variant="outline" className="font-mono text-xs px-2 py-1 mt-1">
                ID {tarea.id_visible}
              </Badge>
            )}
            <DialogTitle className="text-lg leading-tight">{tarea.tarea}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Metadatos */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">Departamento</span>
              <span className="font-medium">{tarea.rol}</span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">Frecuencia</span>
              <span className="font-medium">{tarea.frecuencia}</span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">Tiempo</span>
              <span className="font-medium">{tarea.tiempo_requerido || "—"}</span>
            </div>
          </div>

          {/* Resumen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-bold">Resumen</Label>
              <Button size="sm" variant="outline" onClick={handleSaveResumen}>
                Guardar resumen
              </Button>
            </div>
            <Textarea
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder="Describe brevemente esta tarea: qué hacer, cuándo, qué considerar…"
              rows={5}
            />
          </div>

          {/* Video */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Video className="h-4 w-4" /> Video formativo
              </Label>
              {videoUrl && (
                <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={handleDeleteVideo}>
                  <X className="h-3.5 w-3.5" /> Quitar
                </Button>
              )}
            </div>

            <div className="rounded-lg border bg-black/5 dark:bg-black/30 aspect-video flex items-center justify-center overflow-hidden">
              {videoUrl ? (
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-3">No hay video todavía.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Subiendo…" : "Subir video"}
                  </Button>
                </div>
              )}
            </div>

            {videoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Reemplazar
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
