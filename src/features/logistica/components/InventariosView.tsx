"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import {
  type Inventario,
  type EstadoInventario,
  type TipoInventario,
  type PlantillaInventario,
} from "@/features/logistica/data/inventarios";
import { type ProductoStock } from "@/features/logistica/data/stock";
import {
  listInventarios as listInventariosAction,
  createInventario as createInventarioAction,
  updateInventarioEstado as updateInventarioEstadoAction,
  confirmarInventarioKardex,
  revertirInventarioKardex,
  getStockInventario,
  listTiposInventario,
  listPlantillasInventario,
  getConteosInventario,
  guardarConteosInventario,
} from "@/features/logistica/actions/inventarios-actions";
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
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
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
  const [, setLoadingInv] = useState(true);

  const loadInventarios = useCallback(async () => {
    setLoadingInv(true);
    try {
      const [res, stockRes, tiposRes, plantRes] = await Promise.all([
        listInventariosAction(),
        getStockInventario(),
        listTiposInventario(),
        listPlantillasInventario(),
      ]);

      if (res.ok) {
        const mapped: Inventario[] = (res.data as Array<Record<string, unknown>>).map((r) => ({
          id: r.id as string,
          fecha: ((r.fecha as string) ?? (r.created_at as string) ?? "").slice(0, 10),
          almacen: (r.almacen as string) ?? (r.tipo as string) ?? "—",
          motivo: (r.motivo as string) ?? (r.nombre as string) ?? "",
          estado: ((r.estado as string)?.toLowerCase() === "confirmado" ? "Confirmado" : "Borrador") as EstadoInventario,
          usuario: (r.usuario as string) || "—",
          conteos: [],
          conteosCargados: false,
          empresaId: empresaActual.id,
          plantillaId: (r.plantilla_id as string) ?? undefined,
          confirmadoAt: (r.confirmado_at as string) ?? undefined,
          confirmadoPor: (r.confirmado_por as string) ?? undefined,
        }));
        setInventarios(mapped);
      } else {
        setInventarios([]);
      }

      setStock((stockRes.data ?? []) as unknown as ProductoStock[]);
      setTipos(((tiposRes.data ?? []) as Array<Record<string, unknown>>).map((t) => ({
        id: t.id as string,
        nombre: t.nombre as string,
        empresaId: empresaActual.id,
      })));
      setPlantillas(((plantRes.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
        id: p.id as string,
        nombre: p.nombre as string,
        empresaId: empresaActual.id,
        productosIds: Array.isArray(p.productos_ids) ? (p.productos_ids as string[]) : [],
      })));
    } catch {
      setInventarios([]);
    } finally {
      setLoadingInv(false);
    }
  }, [empresaActual.id]);

  useEffect(() => {
    loadInventarios();
  }, [loadInventarios]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
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

    const res = await createInventarioAction({
      nombre: `${data.almacen} - ${data.motivo}`,
      fecha: data.fecha,
      almacen: data.almacen,
      motivo: data.motivo,
      plantillaId: data.plantillaId,
      usuario: usuarioNombre,
      tipo: data.tipoId,
    });
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Error al crear inventario");
      return;
    }
    const realId = (res.data as Record<string, unknown>).id as string;

    const newInv: Inventario = {
      id: realId,
      fecha: data.fecha,
      almacen: data.almacen,
      motivo: data.motivo,
      estado: "Borrador",
      usuario: usuarioNombre,
      conteos: initialConteos,
      conteosCargados: true,
      empresaId: empresaActual.id,
      tipoId: data.tipoId,
      plantillaId: data.plantillaId,
    };
    // Persiste las líneas iniciales de la plantilla (si las hay).
    if (initialConteos.length > 0) {
      await guardarConteosInventario(realId, initialConteos.map((c) => ({
        nombre: c.nombre,
        lineas: c.lineas.map((l) => ({
          productoId: l.productoId,
          producto: l.producto,
          unidad: l.unidad,
          cantidadReal: l.cantidadReal,
          cantidadTeorica: stock.find((p) => p.id === l.productoId)?.stockActual ?? 0,
        })),
      })));
    }
    setInventarios((prev) => [newInv, ...prev]);
    setDetalleId(realId);
    toast.success("Inventario creado");
  };

  // Persiste los conteos del inventario abierto (sólo en Borrador). Devuelve ok.
  const persistirConteos = useCallback(async (inv: Inventario) => {
    return guardarConteosInventario(inv.id, inv.conteos.map((c) => ({
      nombre: c.nombre,
      lineas: c.lineas.map((l) => ({
        productoId: l.productoId,
        producto: l.producto,
        unidad: l.unidad,
        cantidadReal: l.cantidadReal,
        cantidadTeorica: stock.find((p) => p.id === l.productoId)?.stockActual ?? 0,
      })),
    })));
  }, [stock]);

  const handleConfirmar = async (inv: Inventario) => {
    // 1. Persistir las líneas contadas antes de ajustar el stock.
    const guardado = await persistirConteos(inv);
    if (!guardado.ok) { toast.error("No se pudieron guardar los conteos."); return; }
    // 2. Marcar confirmado y ajustar stock real vía kardex (PRP-058).
    const estadoRes = await updateInventarioEstadoAction(inv.id, "Confirmado", usuarioNombre);
    if (!estadoRes.ok) { toast.error(estadoRes.error ?? "No se pudo confirmar."); return; }
    const kardex = await confirmarInventarioKardex(inv.id);
    if (!kardex.ok) { toast.error(kardex.error ?? "No se pudo ajustar el stock."); return; }
    toast.success(`Inventario confirmado. ${kardex.ajustados ?? 0} producto(s) ajustados.`);
    await loadInventarios();
    setDetalleId(null);
  };

  const handleDeshacerConfirmacion = async (inv: Inventario) => {
    const estadoRes = await updateInventarioEstadoAction(inv.id, "Borrador");
    if (!estadoRes.ok) { toast.error("No se pudo deshacer."); return; }
    await revertirInventarioKardex(inv.id);
    toast.info("Confirmación deshecha. El inventario vuelve a Borrador.");
    await loadInventarios();
  };

  const handleUpdateInventario = (updated: Inventario) => {
    setInventarios((prev) => prev.map((i) => i.id === updated.id ? updated : i));
  };

  // ── Carga lazy de conteos al abrir un inventario ──
  useEffect(() => {
    if (!detalleId) return;
    const inv = inventarios.find((i) => i.id === detalleId);
    if (!inv || inv.conteosCargados) return;
    let cancel = false;
    (async () => {
      const res = await getConteosInventario(detalleId);
      if (cancel) return;
      setInventarios((prev) => prev.map((i) =>
        i.id === detalleId ? { ...i, conteos: (res.data as Inventario["conteos"]) ?? [], conteosCargados: true } : i
      ));
    })();
    return () => { cancel = true; };
  }, [detalleId, inventarios]);

  // ── Autosave de conteos (debounce) para el inventario abierto en Borrador ──
  const detalleConteos = detalleId ? inventarios.find((i) => i.id === detalleId)?.conteos : undefined;
  const detalleEstado = detalleId ? inventarios.find((i) => i.id === detalleId)?.estado : undefined;
  const detalleCargado = detalleId ? inventarios.find((i) => i.id === detalleId)?.conteosCargados : undefined;
  useEffect(() => {
    if (!detalleId || detalleEstado !== "Borrador" || !detalleCargado || !detalleConteos) return;
    const t = setTimeout(() => {
      const inv = inventarios.find((i) => i.id === detalleId);
      if (inv) persistirConteos(inv);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalleId, detalleEstado, detalleCargado, JSON.stringify(detalleConteos)]);

  // ── Config view ──
  if (showConfig) {
    return (
      <div className="p-4 md:p-6">
        <InventarioConfigView
          tipos={tipos}
          plantillas={plantillas}
          productos={stock}
          onReload={loadInventarios}
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
          zonaHoraria={empresaActual.zonaHoraria}
          onBack={() => setDetalleId(null)}
          onUpdate={handleUpdateInventario}
          onConfirmar={handleConfirmar}
          onDeshacerConfirmacion={handleDeshacerConfirmacion}
        />
      </div>
    );
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "fecha", label: "Fecha", bloqueada: true },
    { campo: "almacen", label: "Almacén" },
    { campo: "motivo", label: "Motivo" },
    { campo: "estado", label: "Estado" },
    { campo: "usuario", label: "Usuario" },
    { campo: "conteos", label: "Conteos" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (inv: Inventario) => ReactNode }> = {
    fecha: {
      th: (
        <TableColumnHeader
          key="fecha"
          label="Fecha"
          campo="fecha"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (inv) => (
        <td key="fecha" className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">
          {inv.fecha}
        </td>
      ),
    },
    almacen: {
      th: (
        <TableColumnHeader
          key="almacen"
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
      ),
      td: (inv) => (
        <td key="almacen" className="px-3 py-2.5 text-xs">
          {inv.almacen}
        </td>
      ),
    },
    motivo: {
      th: (
        <TableColumnHeader
          key="motivo"
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
      ),
      td: (inv) => (
        <td key="motivo" className="px-3 py-2.5 text-xs">
          {inv.motivo}
          {inv.plantillaId && <Badge variant="secondary" className="ml-1.5 text-[9px]">Plantilla</Badge>}
        </td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
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
      ),
      td: (inv) => (
        <td key="estado" className="px-3 py-2.5">
          <Badge variant="outline" className={inv.estado === "Confirmado"
            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px] font-bold"
            : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 text-[11px] font-bold"}>
            {inv.estado}
          </Badge>
        </td>
      ),
    },
    usuario: {
      th: <TableColumnHeader key="usuario" label="Usuario" />,
      td: (inv) => (
        <td key="usuario" className="px-3 py-2.5 text-xs text-muted-foreground">
          {inv.usuario}
        </td>
      ),
    },
    conteos: {
      th: <TableColumnHeader key="conteos" label="Conteos" />,
      td: (inv) => (
        <td key="conteos" className="px-3 py-2.5 text-xs font-medium">
          {inv.conteos.length}
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

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
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            <IOActions config={inventariosIO} onSuccess={() => loadInventarios()} />
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
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              <TableColumnHeader label="" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleId(inv.id)}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} />
                </td>
                {columnasRender.map((c) => columnDefs[c.campo]?.td(inv))}
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
