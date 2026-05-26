"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Star, StarOff, Pencil, Trash2, Settings } from "lucide-react";
import TarifaConfigView from "@/features/logistica/components/tarifas/TarifaConfigView";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { IOActions } from "@/shared/io";
import { tarifasIO } from "@/features/logistica/io/tarifas.io";
import {
  listTarifas,
  createTarifa,
  updateTarifa,
  setTarifaDefault,
  deleteTarifa,
  type Tarifa,
} from "@/features/logistica/actions/tarifas-actions";

export function TarifasView() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Tarifa | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activa, setActiva] = useState(true);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listTarifas();
    if (res.ok) setTarifas(res.data);
    else toast.error(res.error ?? "Error cargando tarifas");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setActiva(true);
    setDlgOpen(true);
  };

  const openEdit = (t: Tarifa) => {
    setEditing(t);
    setNombre(t.nombre);
    setDescripcion(t.descripcion ?? "");
    setActiva(t.activa);
    setDlgOpen(true);
  };

  const handleSave = async () => {
    const n = nombre.trim();
    if (!n) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const desc = descripcion.trim() || null;
    if (editing) {
      const res = await updateTarifa(editing.id, { nombre: n, descripcion: desc, activa });
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar");
        return;
      }
      toast.success("Tarifa actualizada");
    } else {
      const res = await createTarifa({ nombre: n, descripcion: desc, activa });
      if (!res.ok) {
        toast.error(res.error ?? "Error al crear");
        return;
      }
      toast.success("Tarifa creada");
    }
    setDlgOpen(false);
    await load();
  };

  const handleSetDefault = async (t: Tarifa) => {
    if (t.esDefault) return;
    const res = await setTarifaDefault(t.id);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success(`"${t.nombre}" es ahora la tarifa default`);
    await load();
  };

  const handleDelete = async (t: Tarifa) => {
    if (t.esDefault) {
      toast.error("No se puede eliminar la tarifa default");
      return;
    }
    if (!confirm(`¿Eliminar la tarifa "${t.nombre}"? Se borrarán también los precios asociados.`)) {
      return;
    }
    const res = await deleteTarifa(t.id);
    if (!res.ok) {
      toast.error(res.error ?? "Error al eliminar");
      return;
    }
    toast.success("Tarifa eliminada");
    await load();
  };

  const acceso = (t: Tarifa, campo: string): unknown => {
    return (t as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = tarifas.filter((t) => coincideBusquedaUniversal(t, search));
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [tarifas, search, filtros, orden]);

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "descripcion", label: "Descripción" },
    { campo: "esDefault", label: "Default" },
    { campo: "activa", label: "Activa" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (t: Tarifa) => ReactNode }> = {
    nombre: {
      th: (
        <TableColumnHeader
          key="nombre"
          label="Nombre"
          campo="nombre"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (t) => (
        <td key="nombre" className="px-3 py-2.5 font-medium">
          {t.nombre}
        </td>
      ),
    },
    descripcion: {
      th: (
        <TableColumnHeader
          key="descripcion"
          label="Descripción"
          campo="descripcion"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (t) => (
        <td key="descripcion" className="px-3 py-2.5 text-muted-foreground">
          {t.descripcion ?? <span className="text-muted-foreground/50">—</span>}
        </td>
      ),
    },
    esDefault: {
      th: (
        <TableColumnHeader
          key="esDefault"
          label="Default"
          campo="esDefault"
          filtroTipo="booleano"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          align="center"
        />
      ),
      td: (t) => (
        <td key="esDefault" className="px-3 py-2.5 text-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleSetDefault(t)}
            title={t.esDefault ? "Tarifa default" : "Marcar como default"}
          >
            {t.esDefault ? (
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </td>
      ),
    },
    activa: {
      th: (
        <TableColumnHeader
          key="activa"
          label="Activa"
          campo="activa"
          filtroTipo="booleano"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          align="center"
        />
      ),
      td: (t) => (
        <td key="activa" className="px-3 py-2.5 text-center">
          {t.activa ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">
              Activa
            </Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400 border-0 text-[10px]">
              Inactiva
            </Badge>
          )}
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  if (showConfig) {
    return (
      <div className="p-4 md:p-6">
        <TarifaConfigView onBack={() => setShowConfig(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={openNew}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            <IOActions config={tarifasIO} onSuccess={load} />
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
          </>
        }
      />

      <ResizableColumnsProvider storageKey="logistica-tarifas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                <TableColumnHeader label="" />
              </tr>
            </thead>
            <tbody>
              {loading && tarifas.length === 0 && (
                <tr>
                  <td colSpan={20} className="text-center py-10">
                    <LoadingSpinner />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-muted-foreground">
                    {tarifas.length === 0
                      ? "No hay tarifas. Crea la primera para empezar."
                      : "Ninguna tarifa coincide con los filtros."}
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(t))}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(t)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(t)}
                        disabled={t.esDefault}
                        title={t.esDefault ? "No se puede eliminar la default" : "Eliminar"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <div className="text-xs text-muted-foreground text-right">
        {filtered.length} de {tarifas.length} tarifas
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        La tarifa marcada como <strong>default</strong> usa el precio de venta del producto. Las demás
        definen un precio específico desde la ficha de cada producto de venta.
      </p>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Nombre *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="p. ej. Terraza, Happy Hour, Grupos"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Cuándo o a quién se aplica esta tarifa"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="text-xs font-bold">Activa</Label>
                <p className="text-[11px] text-muted-foreground">
                  Las tarifas inactivas no se ofrecen al cobrar
                </p>
              </div>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
