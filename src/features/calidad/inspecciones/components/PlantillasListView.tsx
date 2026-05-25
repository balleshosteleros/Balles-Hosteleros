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
import { ArrowLeft, Settings } from "lucide-react";
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
import { listPlantillas, crearPlantillaVacia } from "../actions";
import { PlantillaEditor } from "./PlantillaEditor";
import type { PlantillaResumen } from "../actions";

const columnasDef: ToolbarColumna[] = [
  { campo: "numero_secuencial", label: "Nº", bloqueada: true },
  { campo: "nombre", label: "Nombre" },
  { campo: "version_vigente", label: "Versión" },
  { campo: "num_secciones", label: "Secciones" },
  { campo: "num_preguntas", label: "Preguntas" },
  { campo: "estado_vigente", label: "Estado" },
  { campo: "created_at", label: "Creada" },
];

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PlantillasListView() {
  const [plantillas, setPlantillas] = useState<PlantillaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));
  const [showConfig, setShowConfig] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);

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
    <div className="space-y-4">
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
                          case "numero_secuencial": return <span className="font-mono text-xs text-muted-foreground">{p.numero_secuencial ?? "—"}</span>;
                          case "nombre": return (
                            <div>
                              <div className={`font-medium ${p.archivada ? "text-muted-foreground line-through" : ""}`}>{p.nombre}</div>
                              {p.descripcion && <div className="text-xs text-muted-foreground truncate max-w-md">{p.descripcion}</div>}
                            </div>
                          );
                          case "version_vigente": return p.version_vigente ? <Badge variant="outline" className="text-[10px]">v{p.version_vigente}</Badge> : <span className="text-muted-foreground">—</span>;
                          case "num_secciones": return <span className="tabular-nums">{p.num_secciones}</span>;
                          case "num_preguntas": return <span className="tabular-nums">{p.num_preguntas}</span>;
                          case "estado_vigente": return p.estado_vigente === "publicada" ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Publicada</Badge>
                          ) : p.estado_vigente === "borrador" ? (
                            <Badge variant="outline" className="text-[10px]">Borrador</Badge>
                          ) : <span className="text-muted-foreground">—</span>;
                          case "created_at": return <span className="text-xs text-muted-foreground">{formatFecha(p.created_at)}</span>;
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
    </div>
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
