"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Pencil, Archive, ArchiveRestore, MoreVertical, ArrowLeft, ClipboardList } from "lucide-react";
import type { AuditoriasTab } from "./CalidadAuditoriasView";
import { toast } from "sonner";
import {
  listPlantillas,
  crearPlantilla,
  clonarPlantilla,
  archivarPlantilla,
  type PlantillaResumen,
} from "@/features/calidad/actions/plantillas-actions";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const columnasDef: ToolbarColumna[] = [
  { campo: "numero_secuencial", label: "Nº", bloqueada: true },
  { campo: "nombre", label: "Nombre" },
  { campo: "version_vigente", label: "Versión" },
  { campo: "num_secciones", label: "Secciones" },
  { campo: "num_preguntas", label: "Preguntas" },
  { campo: "estado_vigente", label: "Estado" },
  { campo: "created_at", label: "Creada" },
  { campo: "acciones", label: "", bloqueada: true },
];

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface PlantillasListViewProps {
  tab: AuditoriasTab;
  onTabChange: (t: AuditoriasTab) => void;
}

export function PlantillasListView({ onTabChange }: PlantillasListViewProps) {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState<PlantillaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    listPlantillas().then((d) => {
      setPlantillas(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtradas = plantillas
    .filter((p) => showArchivadas ? true : !p.archivada)
    .filter((p) => coincideBusquedaUniversal(p, busqueda));

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar plantilla"
        onNuevo={() => setNuevaOpen(true)}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraIzquierda={
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTabChange("envios")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Auditorías realizadas
          </Button>
        }
        extraDerecha={
          <Button
            size="sm"
            variant={showArchivadas ? "default" : "outline"}
            onClick={() => setShowArchivadas((v) => !v)}
            title="Mostrar archivadas"
          >
            {showArchivadas ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="calidad-auditorias-plantillas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => (
                  <th key={c.campo} className="text-left px-3 py-2 font-medium text-foreground">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && plantillas.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10"><LoadingSpinner /></td></tr>
              ) : !loading && plantillas.length === 0 ? (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">
                    Aún no hay plantillas. Pulsa <strong>+ Nuevo</strong> para crear la primera.
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">
                    Ninguna plantilla coincide con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtradas.map((p) => (
                  <FilaPlantilla
                    key={p.id}
                    p={p}
                    columnas={columnasRender}
                    onOpen={() => router.push(`/calidad/auditorias/plantillas/${p.id}`)}
                    onClonar={async () => {
                      const res = await clonarPlantilla(p.id);
                      if (res.ok) {
                        toast.success("Plantilla duplicada");
                        reload();
                      } else {
                        toast.error(res.error);
                      }
                    }}
                    onArchivar={async () => {
                      const res = await archivarPlantilla(p.id, !p.archivada);
                      if (res.ok) {
                        toast.success(p.archivada ? "Plantilla restaurada" : "Plantilla archivada");
                        reload();
                      } else {
                        toast.error(res.error);
                      }
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>
      <div className="text-xs text-muted-foreground text-right">
        {filtradas.length} de {plantillas.length} plantillas
      </div>

      <NuevaPlantillaDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        onCreated={(id) => {
          setNuevaOpen(false);
          router.push(`/calidad/auditorias/plantillas/${id}`);
        }}
      />
    </div>
  );
}

function FilaPlantilla({
  p,
  columnas,
  onOpen,
  onClonar,
  onArchivar,
}: {
  p: PlantillaResumen;
  columnas: ToolbarColumna[];
  onOpen: () => void;
  onClonar: () => void;
  onArchivar: () => void;
}) {
  const cells: Record<string, React.ReactNode> = {
    numero_secuencial: <span className="font-mono text-xs text-muted-foreground">{p.numero_secuencial}</span>,
    nombre: (
      <div>
        <div className={`font-medium ${p.archivada ? "text-muted-foreground line-through" : "text-foreground"}`}>{p.nombre}</div>
        {p.descripcion && <div className="text-xs text-muted-foreground truncate max-w-md">{p.descripcion}</div>}
      </div>
    ),
    version_vigente: p.version_vigente ? <Badge variant="outline" className="text-[10px]">v{p.version_vigente}</Badge> : <span className="text-muted-foreground">—</span>,
    num_secciones: <span className="tabular-nums">{p.num_secciones}</span>,
    num_preguntas: <span className="tabular-nums">{p.num_preguntas}</span>,
    estado_vigente: p.estado_vigente === "publicada" ? (
      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Publicada</Badge>
    ) : p.estado_vigente === "borrador" ? (
      <Badge variant="outline" className="text-[10px]">Borrador</Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    ),
    created_at: <span className="text-xs text-muted-foreground">{formatFecha(p.created_at)}</span>,
    acciones: (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClonar(); }}>
            <Copy className="h-4 w-4 mr-2" /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchivar(); }}>
            {p.archivada ? (<><ArchiveRestore className="h-4 w-4 mr-2" /> Restaurar</>) : (<><Archive className="h-4 w-4 mr-2" /> Archivar</>)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  return (
    <tr className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={onOpen}>
      {columnas.map((c) => (
        <td key={c.campo} className="px-3 py-2 align-middle">
          {cells[c.campo] ?? null}
        </td>
      ))}
    </tr>
  );
}

export function PlantillasNavButtonAuditorias({
  onTabChange,
}: {
  onTabChange: (t: AuditoriasTab) => void;
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

function NuevaPlantillaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (plantillaId: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nombre.trim()) {
      toast.error("Pon un nombre");
      return;
    }
    setSaving(true);
    const res = await crearPlantilla({ nombre: nombre.trim(), descripcion: descripcion.trim() || null });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNombre("");
    setDescripcion("");
    onCreated(res.plantillaId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva plantilla</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Auditoría Interna 2026"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Para qué sirve, alcance, qué evalúa…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !nombre.trim()}>
            {saving ? "Creando…" : "Crear y editar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
