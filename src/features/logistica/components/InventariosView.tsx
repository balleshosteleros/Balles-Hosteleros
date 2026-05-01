"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import {
  getInventariosPorEmpresa,
  getTiposPorEmpresa,
  getPlantillasPorEmpresa,
  type Inventario,
  type EstadoInventario,
  type TipoInventario,
  type PlantillaInventario,
} from "@/features/logistica/data/inventarios";
import { getStockPorEmpresa, type ProductoStock } from "@/features/logistica/data/stock";
import { listInventarios as listInventariosAction, createInventario as createInventarioAction, updateInventarioEstado as updateInventarioEstadoAction } from "@/features/logistica/actions/inventarios-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Eye, Settings,
} from "lucide-react";
import { ImportExportButton } from "@/features/logistica/components/ImportExportButton";
import { exportToCSV, exportToXLSX } from "@/features/logistica/lib/export-utils";
import { FiltrosAvanzados, type FiltroActivo, type CampoFiltro } from "@/features/logistica/components/FiltrosAvanzados";
import { toast } from "sonner";
import InventarioModal from "@/features/logistica/components/inventarios/InventarioModal";
import DetalleInventario from "@/features/logistica/components/inventarios/DetalleInventario";
import InventarioConfigView from "@/features/logistica/components/inventarios/InventarioConfigView";

const ALL = "__ALL__";
type CampoInventario = "estado" | "almacen" | "motivo" | "fecha";

export function InventariosView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const { profile } = useAuth();

  // Nombre del usuario automático
  const usuarioNombre = profile
    ? `${profile.nombre} ${profile.apellidos}`.trim() || profile.email
    : "Usuario actual";

  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [stock, setStock] = useState<ProductoStock[]>([]);
  const [tipos, setTipos] = useState<TipoInventario[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaInventario[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);

  const loadInventarios = useCallback(async () => {
    setLoadingInv(true);
    try {
      const res = await listInventariosAction();
      if (res.ok) {
        const mapped: Inventario[] = (res.data as Array<Record<string, unknown>>).map((r) => ({
          id: r.id as string,
          fecha: ((r.fecha as string) ?? (r.created_at as string) ?? "").slice(0, 10),
          almacen: (r.almacen as string) ?? (r.tipo as string) ?? "COCINA",
          motivo: (r.motivo as string) ?? (r.nombre as string) ?? "",
          estado: ((r.estado as string)?.toLowerCase() === "confirmado" ? "Confirmado" : "Borrador") as EstadoInventario,
          usuario: (r.usuario as string) || (r.created_by_nombre as string) || "—",
          conteos: [],
          empresaId: empresaActual.id,
        }));
        setInventarios(mapped);
      } else {
        setInventarios([]);
      }
    } catch {
      setInventarios([]);
    } finally {
      setLoadingInv(false);
    }
    setStock(getStockPorEmpresa(empresaActual.id));
    setTipos(getTiposPorEmpresa(empresaActual.id));
    setPlantillas(getPlantillasPorEmpresa(empresaActual.id));
  }, [empresaActual.id]);

  useEffect(() => {
    loadInventarios();
  }, [loadInventarios]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<FiltroActivo<CampoInventario>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const camposFiltro = useMemo((): CampoFiltro<CampoInventario>[] => {
    const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
    return [
      { campo: "estado", label: "Estado", tipo: "lista", opciones: ["Borrador", "Confirmado"] },
      { campo: "almacen", label: "Almacén", tipo: "lista", opciones: uniq(inventarios.map((i) => i.almacen)) },
      { campo: "motivo", label: "Motivo", tipo: "lista", opciones: uniq(inventarios.map((i) => i.motivo)) },
      { campo: "fecha", label: "Fecha", tipo: "fecha" },
    ];
  }, [inventarios]);

  const filtered = useMemo(() => {
    return inventarios.filter((inv) => {
      for (const f of filtros) {
        if (f.campo === "estado" && f.valores?.length && !f.valores.includes(inv.estado)) return false;
        if (f.campo === "almacen" && f.valores?.length && !f.valores.includes(inv.almacen)) return false;
        if (f.campo === "motivo" && f.valores?.length && !f.valores.includes(inv.motivo)) return false;
        if (f.campo === "fecha") {
          if (f.desde && inv.fecha < f.desde) return false;
          if (f.hasta && inv.fecha > f.hasta) return false;
        }
      }
      if (search) {
        const s = search.toLowerCase();
        return inv.almacen.toLowerCase().includes(s) || inv.motivo.toLowerCase().includes(s) || inv.usuario.toLowerCase().includes(s);
      }
      return true;
    });
  }, [inventarios, search, filtros]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  const handleCreate = async (data: { fecha: string; almacen: string; motivo: string; tipoId?: string; plantillaId?: string }) => {
    // Build initial conteos from plantilla if selected
    const plantilla = data.plantillaId ? plantillas.find((p) => p.id === data.plantillaId) : undefined;
    const initialConteos = plantilla
      ? [{
          id: `cnt-${Date.now()}`,
          nombre: `Conteo ${data.almacen.toLowerCase()}`,
          lineas: plantilla.productosIds.map((pid) => {
            const prod = stock.find((p) => p.id === pid);
            return {
              productoId: pid,
              producto: prod?.nombre || pid,
              unidad: prod?.unidad || "ud",
              cantidadReal: 0,
            };
          }),
        }]
      : [];

    const newInv: Inventario = {
      id: `inv-${Date.now()}`,
      fecha: data.fecha,
      almacen: data.almacen,
      motivo: data.motivo,
      estado: "Borrador",
      usuario: usuarioNombre,
      conteos: initialConteos,
      empresaId: empresaActual.id,
      tipoId: data.tipoId,
      plantillaId: data.plantillaId,
    };
    setInventarios((prev) => [newInv, ...prev]);
    setDetalleId(newInv.id);
    const res = await createInventarioAction({
      nombre: `${data.almacen} - ${data.motivo}`,
      fecha: data.fecha,
      almacen: data.almacen,
      motivo: data.motivo,
      plantillaId: data.plantillaId,
      usuario: usuarioNombre,
      tipo: data.tipoId,
    });
    if (res.ok) toast.success("Inventario creado");
    else toast.error(res.error ?? "Error al crear inventario");
  };

  const handleDelete = () => {
    const toDelete = [...selected].filter((id) => {
      const inv = inventarios.find((i) => i.id === id);
      return inv && inv.estado === "Borrador";
    });
    if (toDelete.length === 0) {
      toast.error("Solo se pueden eliminar inventarios en estado Borrador");
      return;
    }
    setInventarios((prev) => prev.filter((i) => !toDelete.includes(i.id)));
    setSelected(new Set());
    toast.success(`${toDelete.length} inventario(s) eliminado(s)`);
  };

  const handleConfirmar = async (inv: Inventario) => {
    const now = new Date().toISOString();
    setInventarios((prev) => prev.map((i) =>
      i.id === inv.id ? { ...i, estado: "Confirmado" as const, confirmadoAt: now, confirmadoPor: usuarioNombre } : i
    ));
    await updateInventarioEstadoAction(inv.id, "Confirmado");

    const realMap: Record<string, number> = {};
    for (const conteo of inv.conteos) {
      for (const linea of conteo.lineas) {
        realMap[linea.productoId] = (realMap[linea.productoId] || 0) + linea.cantidadReal;
      }
    }

    setStock((prev) => prev.map((p) => {
      if (!(p.id in realMap)) return p;
      const stockReal = realMap[p.id];
      const diferencia = stockReal - p.stockActual;
      return {
        ...p,
        stockActual: stockReal,
        ultimoInventario: Math.round(diferencia * 100) / 100,
        ultimoInventarioFecha: inv.fecha,
      };
    }));

    toast.success("Inventario confirmado. Stock actualizado.");
  };

  const handleDeshacerConfirmacion = async (inv: Inventario) => {
    setInventarios((prev) => prev.map((i) =>
      i.id === inv.id ? { ...i, estado: "Borrador" as const, confirmadoAt: undefined, confirmadoPor: undefined } : i
    ));
    await updateInventarioEstadoAction(inv.id, "Borrador");
    toast.info("Confirmacion deshecha. El inventario vuelve a estado Borrador.");
  };

  const handleUpdateInventario = (updated: Inventario) => {
    setInventarios((prev) => prev.map((i) => i.id === updated.id ? updated : i));
  };

  // ── Config view ──
  if (showConfig) {
    return (
      <div className="p-4 md:p-6">
        <InventarioConfigView
          tipos={tipos}
          onTiposChange={setTipos}
          plantillas={plantillas}
          onPlantillasChange={setPlantillas}
          productos={stock}
          empresaId={empresaActual.id}
          onBack={() => setShowConfig(false)}
        />
      </div>
    );
  }

  // ── Detalle view ──
  const detalleInv = detalleId ? inventarios.find((i) => i.id === detalleId) : null;
  if (detalleInv) {
    const plantilla = detalleInv.plantillaId ? plantillas.find((p) => p.id === detalleInv.plantillaId) : undefined;
    return (
      <div className="p-4 md:p-6">
        <DetalleInventario
          inventario={detalleInv}
          productos={stock}
          plantilla={plantilla}
          onBack={() => setDetalleId(null)}
          onUpdate={handleUpdateInventario}
          onConfirmar={handleConfirmar}
          onDeshacerConfirmacion={handleDeshacerConfirmacion}
        />
      </div>
    );
  }

  const borradorCount = inventarios.filter((i) => i.estado === "Borrador").length;
  const confirmadoCount = inventarios.filter((i) => i.estado === "Confirmado").length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
        <Button
          size="sm"
          variant="primary"
          className="gap-1"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
        <div className="flex-1" />
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <FiltrosAvanzados campos={camposFiltro} filtros={filtros} onChange={setFiltros} />
        <ImportExportButton
          onExport={(format) => {
            const ts = new Date().toISOString().slice(0, 10);
            const rows = filtered.map((i) => ({
              Fecha: i.fecha, Almacén: i.almacen, Motivo: i.motivo,
              Estado: i.estado, Usuario: i.usuario, Conteos: i.conteos.length,
            }));
            if (rows.length === 0) { toast.info("No hay datos para exportar."); return; }
            if (format === "csv") exportToCSV(rows, `inventarios-${ts}.csv`);
            else exportToXLSX(rows, `inventarios-${ts}.xlsx`);
            toast.success(`${rows.length} inventarios exportados en ${format.toUpperCase()}`);
          }}
        />
        <Button size="icon" variant={showConfig ? "default" : "ghost"} className="h-8 w-8" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-3 w-10">
                <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
              </th>
              {["Fecha", "Almacén", "Motivo", "Estado", "Usuario", "Conteos", ""].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleId(inv.id)}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} />
                </td>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{inv.fecha}</td>
                <td className="px-3 py-2.5 text-xs">{inv.almacen}</td>
                <td className="px-3 py-2.5 text-xs">
                  {inv.motivo}
                  {inv.plantillaId && <Badge variant="secondary" className="ml-1.5 text-[9px]">Plantilla</Badge>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className={inv.estado === "Confirmado"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px] font-bold"
                    : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 text-[11px] font-bold"}>
                    {inv.estado}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{inv.usuario}</td>
                <td className="px-3 py-2.5 text-xs font-medium">{inv.conteos.length}</td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetalleId(inv.id)} title="Ver detalle">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No se encontraron inventarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground text-right">{filtered.length} de {inventarios.length} inventarios</div>

      {/* Create Modal */}
      <InventarioModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        tipos={tipos}
        plantillas={plantillas}
        usuarioNombre={usuarioNombre}
        onCreate={handleCreate}
      />
    </div>
  );
}
