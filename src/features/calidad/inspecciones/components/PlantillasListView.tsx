"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Pencil, Settings, ClipboardList } from "lucide-react";
import type { InspeccionesTab } from "@/features/calidad/components/CalidadInspeccionesView";
import {
  SubmoduleToolbar,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  coincideBusquedaUniversal,
  ordenarColumnas,
  colVisible,
} from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listPlantillas,
  crearPlantillaVacia,
  setPlantillaActual,
  actualizarPlantilla,
} from "../actions";
import { PlantillaEditor } from "./PlantillaEditor";
import type { PlantillaResumen } from "../actions";

const columnasDef: ToolbarColumna[] = [
  { campo: "version", label: "Versión", bloqueada: true },
  { campo: "nombre", label: "Nombre" },
  { campo: "num_secciones", label: "Secciones" },
  { campo: "num_preguntas", label: "Preguntas" },
  { campo: "num_envios", label: "Inspecciones" },
  { campo: "estado", label: "Estado" },
  { campo: "created_at", label: "Creada" },
  { campo: "acciones", label: "Acciones" },
];

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface PlantillasListViewProps {
  tab: InspeccionesTab;
  onTabChange: (t: InspeccionesTab) => void;
}

export function PlantillasListView({ onTabChange }: PlantillasListViewProps) {
  const [plantillas, setPlantillas] = useState<PlantillaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));
  const [showConfig, setShowConfig] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [editPlantilla, setEditPlantilla] = useState<PlantillaResumen | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listPlantillas().then((d) => {
      setPlantillas(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (selectedId) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); reload(); }}>
          <ArrowLeft className="h-4 w-4" /> Volver a plantillas
        </Button>
        <PlantillaEditor plantillaId={selectedId} />
      </div>
    );
  }

  const filtradas = plantillas.filter((p) => coincideBusquedaUniversal(p, busqueda));
  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTabChange("realizadas")}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a inspecciones
        </Button>
      </div>
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setNuevaOpen(true)}
        textoNuevo="Nuevo"
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button
            size="icon"
            variant={showConfig ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setShowConfig((v) => !v)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="calidad-inspecciones-plantillas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => (
                  <th key={c.campo} className="text-left px-3 py-2 font-medium text-foreground">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && plantillas.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10"><LoadingSpinner /></td></tr>
              ) : !loading && plantillas.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">Aún no hay plantillas. Pulsa <strong>+ Nuevo</strong> para crear la primera.</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">Ninguna plantilla coincide con la búsqueda.</td></tr>
              ) : (
                filtradas.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedId(p.id)}>
                    {columnasRender.map((c) => {
                      const cell = (() => {
                        switch (c.campo) {
                          case "version": return (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              V{p.numero_secuencial ?? "—"}
                            </Badge>
                          );
                          case "nombre": return (
                            <div>
                              <div className={`font-medium ${p.estado === "archivada" ? "text-muted-foreground" : ""}`}>{p.nombre}</div>
                              {p.descripcion && <div className="text-xs text-muted-foreground truncate max-w-md">{p.descripcion}</div>}
                            </div>
                          );
                          case "num_secciones": return <span className="tabular-nums">{p.num_secciones}</span>;
                          case "num_preguntas": return <span className="tabular-nums">{p.num_preguntas}</span>;
                          case "num_envios": return <span className="tabular-nums">{p.num_envios}</span>;
                          case "estado": return p.estado === "actual" ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actual</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Archivada</Badge>
                          );
                          case "created_at": return <span className="text-xs text-muted-foreground">{formatFecha(p.created_at)}</span>;
                          case "acciones": return (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {p.estado !== "actual" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={async () => {
                                    const res = await setPlantillaActual(p.id);
                                    if (res.ok) {
                                      toast.success("Plantilla marcada como Actual — enlace del inspector actualizado");
                                      reload();
                                    } else toast.error(res.error);
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" /> Marcar actual
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar plantilla"
                                onClick={() => setEditPlantilla(p)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                          default: return null;
                        }
                      })();
                      return <td key={c.campo} className="px-3 py-2 align-middle">{cell}</td>;
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <NuevaPlantillaDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        onCreated={(id) => {
          setNuevaOpen(false);
          setSelectedId(id);
        }}
      />

      <EditarPlantillaDialog
        plantilla={editPlantilla}
        onClose={() => setEditPlantilla(null)}
        onSaved={() => { setEditPlantilla(null); reload(); }}
      />
    </div>
  );
}

export function PlantillasNavButton({
  onTabChange,
}: {
  onTabChange: (t: InspeccionesTab) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onTabChange("plantillas")}
      className="gap-1.5"
    >
      <ClipboardList className="h-3.5 w-3.5" /> Plantillas
    </Button>
  );
}

function EditarPlantillaDialog({
  plantilla,
  onClose,
  onSaved,
}: {
  plantilla: PlantillaResumen | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plantilla) {
      setNombre(plantilla.nombre);
      setDescripcion(plantilla.descripcion ?? "");
      setFecha(plantilla.created_at.slice(0, 10));
    }
  }, [plantilla]);

  async function submit() {
    if (!plantilla) return;
    if (!nombre.trim()) {
      toast.error("Pon un nombre");
      return;
    }
    setSaving(true);
    const res = await actualizarPlantilla(plantilla.id, {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      created_at: new Date(fecha + "T12:00:00").toISOString(),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Plantilla actualizada");
    onSaved();
  }

  return (
    <Dialog open={!!plantilla} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar plantilla</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha de creación</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaPlantillaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nombre.trim()) {
      toast.error("Pon un nombre");
      return;
    }
    setSaving(true);
    const res = await crearPlantillaVacia(nombre.trim());
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNombre("");
    onCreated(res.plantillaId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva plantilla</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Inspección estándar 2026" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !nombre.trim()}>{saving ? "Creando…" : "Crear y editar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
