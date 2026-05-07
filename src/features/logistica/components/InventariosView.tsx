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
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Settings } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  colVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { IOActions } from "@/shared/io";
import { inventariosIO } from "@/features/logistica/io/inventarios.io";
import { toast } from "sonner";
import InventarioModal from "@/features/logistica/components/inventarios/InventarioModal";
import DetalleInventario from "@/features/logistica/components/inventarios/DetalleInventario";
import InventarioConfigView from "@/features/logistica/components/inventarios/InventarioConfigView";

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
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const almacenesUsados = useMemo(
    () => [...new Set(inventarios.map((i) => i.almacen).filter(Boolean))].sort(),
    [inventarios],
  );
  const motivosUsados = useMemo(
    () => [...new Set(inventarios.map((i) => i.motivo).filter(Boolean))].sort(),
    [inventarios],
  );

  const acceso = (i: Inventario, campo: string): unknown => {
    return (i as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = inventarios.filter((inv) => coincideBusquedaUniversal(inv, search));
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [inventarios, search, filtros, orden]);

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
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={() => setCreateOpen(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={[
          { campo: "fecha", label: "Fecha", bloqueada: true },
          { campo: "almacen", label: "Almacén" },
          { campo: "motivo", label: "Motivo" },
          { campo: "estado", label: "Estado" },
          { campo: "usuario", label: "Usuario" },
          { campo: "conteos", label: "Conteos" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <>
            <IOActions config={inventariosIO} onSuccess={() => window.location.reload()} />
            <Button size="icon" variant={showConfig ? "default" : "outline"} className="h-9 w-9" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      {/* Table */}
      <ResizableColumnsProvider storageKey="logistica-inventarios">
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-3 w-10">
                <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
              </th>
              <TableColumnHeader
                label="Fecha"
                campo="fecha"
                filtroTipo="fecha"
                filtros={filtros}
                onFiltrosChange={setFiltros}
                ordenable
                orden={orden}
                onOrdenChange={setOrden}
              />
              {colVisible(columnasVisibles, "almacen") && (
                <TableColumnHeader
                  label="Almacén"
                  campo="almacen"
                  filtroTipo="lista"
                  opciones={almacenesUsados}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {colVisible(columnasVisibles, "motivo") && (
                <TableColumnHeader
                  label="Motivo"
                  campo="motivo"
                  filtroTipo="lista"
                  opciones={motivosUsados}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {colVisible(columnasVisibles, "estado") && (
                <TableColumnHeader
                  label="Estado"
                  campo="estado"
                  filtroTipo="lista"
                  opciones={["Borrador", "Confirmado"]}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {colVisible(columnasVisibles, "usuario") && <TableColumnHeader label="Usuario" />}
              {colVisible(columnasVisibles, "conteos") && <TableColumnHeader label="Conteos" />}
              <TableColumnHeader label="" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleId(inv.id)}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} />
                </td>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{inv.fecha}</td>
                {colVisible(columnasVisibles, "almacen") && (
                  <td className="px-3 py-2.5 text-xs">{inv.almacen}</td>
                )}
                {colVisible(columnasVisibles, "motivo") && (
                  <td className="px-3 py-2.5 text-xs">
                    {inv.motivo}
                    {inv.plantillaId && <Badge variant="secondary" className="ml-1.5 text-[9px]">Plantilla</Badge>}
                  </td>
                )}
                {colVisible(columnasVisibles, "estado") && (
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={inv.estado === "Confirmado"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px] font-bold"
                      : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 text-[11px] font-bold"}>
                      {inv.estado}
                    </Badge>
                  </td>
                )}
                {colVisible(columnasVisibles, "usuario") && (
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{inv.usuario}</td>
                )}
                {colVisible(columnasVisibles, "conteos") && (
                  <td className="px-3 py-2.5 text-xs font-medium">{inv.conteos.length}</td>
                )}
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetalleId(inv.id)} title="Ver detalle">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">No se encontraron inventarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </ResizableColumnsProvider>
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
