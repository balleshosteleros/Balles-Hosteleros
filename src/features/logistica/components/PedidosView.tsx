"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  calcularTotalesLineas,
  ESTADOS_PEDIDO, PROVEEDORES, PROVEEDOR_EMAILS,
  type Pedido, type Albaran, type EstadoPedido, type EstadoAlbaran,
} from "@/features/logistica/data/pedidos";
import { listPedidos, getPedido, createPedido, updatePedidoEstado as serverUpdatePedidoEstado, deletePedido as serverDeletePedido } from "@/features/logistica/actions/pedidos-actions";
import { listAlbaranes, createAlbaran, updateAlbaranEstado as serverUpdateAlbaranEstado } from "@/features/logistica/actions/albaranes-actions";
import { sumarStockDesdeAlbaran } from "@/features/logistica/actions/stock-actions";
import { EstadoPedidoBadge } from "@/features/logistica/components/pedidos/BadgesPedido";
import { DetallePedido } from "@/features/logistica/components/pedidos/DetallePedido";
import { DetalleAlbaran } from "@/features/logistica/components/pedidos/DetalleAlbaran";
import { PedidoModal } from "@/features/logistica/components/pedidos/PedidoModal";
import { SugerenciasPedidoModal } from "@/features/logistica/components/pedidos/SugerenciasPedidoModal";
import { FacturasTab } from "@/features/logistica/components/facturas/FacturasTab";
import { listFacturas, crearFacturaDesdeAlbaran } from "@/features/logistica/actions/facturas-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy, Pencil, Trash2, Printer, MoreHorizontal, ClipboardList, Truck,
  ChevronDown, Package, Settings, Receipt,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { pedidosIO } from "@/features/logistica/io/pedidos.io";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


function mapDbLinea(l: Record<string, unknown>, idx: number): import("@/features/logistica/data/pedidos").LineaPedido {
  return {
    id: (l.id as string) ?? `lp-${idx}`,
    productoId: (l.producto_id as string) ?? (l.productoId as string) ?? "",
    producto: (l.producto_nombre as string) ?? (l.producto as string) ?? "",
    cantidad: Number(l.cantidad) || 0,
    unidad: (l.unidad as string) ?? "ud",
    servida: Number(l.servida) || 0,
    precioUC: Number(l.precio_unitario ?? l.precioUC) || 0,
    impuesto: Number(l.impuesto ?? l.iva_pct) || 0,
    dtoPct: Number(l.dto_pct ?? l.dtoPct) || 0,
    dtoEur: Number(l.dto_eur ?? l.dtoEur) || 0,
    total: Number(l.total) || 0,
  };
}

function mapDbToPedido(row: Record<string, unknown>): Pedido {
  const rawLineas = Array.isArray(row.lineas) ? row.lineas as Record<string, unknown>[] : [];
  return {
    id: row.id as string,
    numeroSecuencial: typeof row.numero_secuencial === "number" ? row.numero_secuencial : undefined,
    numero: (row.numero as string) ?? (row.id as string)?.slice(0, 8).toUpperCase() ?? "",
    empresaId: (row.empresa_id as string) ?? "",
    empresa: (row.empresa as string) ?? "",
    proveedor: (row.proveedor_nombre as string) ?? (row.proveedor as string) ?? "",
    almacen: (row.almacen as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    fechaEntrega: (row.fecha_entrega as string) ?? "",
    estado: (row.estado as EstadoPedido) ?? "Borrador",
    lineas: rawLineas.map(mapDbLinea),
    dtoPct: (row.dto_pct as number) ?? 0,
    dtoEur: (row.dto_eur as number) ?? 0,
    notas: (row.notas as string) ?? "",
    albaranId: (row.albaran_id as string | null) ?? null,
    creador: (row.creador as string) ?? (row.created_by as string) ?? "",
    ultimaActualizacion: (row.updated_at as string) ?? "",
    enviadoAt: null,
    enviadoEmail: null,
  };
}

export function PedidosView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [tab, setTab] = useState<"pedidos" | "albaranes" | "facturas">("pedidos");
  const [facturasCount, setFacturasCount] = useState(0);
  const [facturaIdToOpen, setFacturaIdToOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Pedido | null>(null);
  const [detallePedido, setDetallePedido] = useState<Pedido | null>(null);
  const [detalleAlbaran, setDetalleAlbaran] = useState<Albaran | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sugerenciasOpen, setSugerenciasOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Estado independiente para la tab ALBARANES (toolbar simétrica con Pedidos/Facturas)
  const [searchAlb, setSearchAlb] = useState("");
  const [filtrosAlb, setFiltrosAlb] = useState<ToolbarFiltroActivo[]>([]);
  const [ordenAlb, setOrdenAlb] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisiblesAlb, setColumnasVisiblesAlb] = useState<ToolbarColumnaVisible>({});
  const [columnasOrdenAlb, setColumnasOrdenAlb] = useState<string[] | undefined>(undefined);
  const [showConfigAlb, setShowConfigAlb] = useState(false);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPedidos();
      if (res.ok) {
        setPedidos(res.data.map(mapDbToPedido));
      } else {
        toast.error("Error al cargar pedidos");
      }
    } catch {
      toast.error("Error de conexion al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlbaranes = useCallback(async () => {
    try {
      const res = await listAlbaranes();
      if (res.ok) {
        const mapped: Albaran[] = (res.data as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          numeroSecuencial: typeof r.numero_secuencial === "number" ? r.numero_secuencial : undefined,
          numero: (r.numero as string) ?? "",
          empresaId: (r.empresa_id as string) ?? "",
          empresa: "",
          proveedor: (r.proveedor_nombre as string) ?? "",
          documento: (r.documento as string) ?? "",
          factura: (r.factura_ref as string) ?? "",
          numeroProveedor: (r.numero_proveedor as string | null) ?? null,
          almacen: (r.almacen as string) ?? "",
          fecha: (r.fecha as string) ?? "",
          estado: (r.estado as Albaran["estado"]) ?? "Pendiente",
          lineas: Array.isArray(r.lineas) ? r.lineas : [],
          dtoPct: (r.dto_pct as number) ?? 0,
          dtoEur: (r.dto_eur as number) ?? 0,
          notas: (r.notas as string) ?? "",
          pedidoId: (r.pedido_id as string) ?? "",
          creador: (r.creador as string) ?? "",
          ultimaActualizacion: (r.updated_at as string) ?? "",
        }));
        setAlbaranes(mapped);
      }
    } catch {
      // Error silencioso — albaranes no es bloqueante
    }
  }, []);

  const loadFacturasCount = useCallback(async () => {
    try {
      const res = await listFacturas();
      if (res.ok) setFacturasCount(res.data.filter((f) => f.estado !== "Anulada").length);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    loadPedidos();
    loadAlbaranes();
    loadFacturasCount();
  }, [loadPedidos, loadAlbaranes, loadFacturasCount]);

  const proveedoresUsados = useMemo(
    () => [...new Set(pedidos.map((p) => p.proveedor).filter(Boolean))].sort(),
    [pedidos],
  );
  const almacenesUsados = useMemo(
    () => [...new Set(pedidos.map((p) => p.almacen).filter(Boolean))].sort(),
    [pedidos],
  );

  const accesoPedido = (p: Pedido, campo: string): unknown => {
    return (p as unknown as Record<string, unknown>)[campo];
  };

  // Filtered pedidos
  const filteredPedidos = useMemo(() => {
    let lista = pedidos.filter(
      (p) => p.estado !== "Archivado" && coincideBusquedaUniversal(p, search),
    );
    lista = aplicarFiltrosToolbar(lista, filtros, accesoPedido);
    lista = aplicarOrdenToolbar(lista, orden, accesoPedido);
    return lista;
  }, [pedidos, search, filtros, orden]);


  // Stats
  const statCounts: Record<string, number> = {};
  ESTADOS_PEDIDO.forEach((e) => { statCounts[e] = pedidos.filter((p) => p.estado === e).length; });

  // Handlers
  const handleSave = async (item: Pedido) => {
    const exists = pedidos.find((p) => p.id === item.id);
    // Optimistic update
    setPedidos((prev) => {
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [item, ...prev];
    });

    if (exists) {
      const res = await serverUpdatePedidoEstado(item.id, item.estado);
      if (!res.ok) { toast.error("Error al actualizar pedido"); loadPedidos(); }
    } else {
      const res = await createPedido({
        proveedorNombre: item.proveedor,
        numero: item.numero || undefined,
        fechaEntrega: item.fechaEntrega || undefined,
        notas: item.notas || undefined,
        lineas: item.lineas.map(l => ({
          productoId: l.productoId,
          productoNombre: l.producto,
          cantidad: l.cantidad,
          unidad: l.unidad,
          precioUnitario: l.precioUC,
        })),
      });
      if (res.ok) { toast.success("Pedido creado"); loadPedidos(); }
      else { toast.error(res.error ?? "Error al crear pedido"); loadPedidos(); }
    }
  };

  const handleDelete = async (id: string) => {
    const ped = pedidos.find((p) => p.id === id);
    if (ped?.albaranId) {
      toast.error("No se puede eliminar un pedido con albaran vinculado");
      return;
    }
    if (ped?.enviadoAt) {
      toast.error("No se puede eliminar un pedido enviado.");
      return;
    }
    if (ped?.estado === "Enviado") {
      toast.error("No se puede eliminar un pedido en estado " + ped.estado);
      return;
    }
    setPedidos((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setDeleteConfirm(null);
    const res = await serverDeletePedido(id);
    if (res.ok) { toast.success("Pedido eliminado"); }
    else { toast.error("Error al eliminar pedido"); loadPedidos(); }
  };

  const handleEnviarProveedor = (ped: Pedido) => {
    const email = PROVEEDOR_EMAILS[ped.proveedor] || "";
    if (!email) {
      toast.error("El proveedor no tiene email configurado. No se puede enviar.");
      return;
    }
    const now = new Date().toISOString();
    setPedidos((prev) => prev.map((p) => p.id === ped.id ? { ...p, estado: "Enviado" as EstadoPedido, enviadoAt: now, enviadoEmail: email, ultimaActualizacion: now.slice(0, 10) } : p));
    setDetallePedido((prev) => prev && prev.id === ped.id ? { ...prev, estado: "Enviado", enviadoAt: now, enviadoEmail: email } : prev);
    toast.success(`Pedido enviado a ${email}`);
  };

  const handleCopy = () => {
    if (selected.size !== 1) { toast.info("Selecciona un pedido para copiar"); return; }
    const src = pedidos.find((p) => selected.has(p.id));
    if (!src) return;
    const copy: Pedido = {
      ...structuredClone(src),
      id: `ped-${Date.now()}`,
      // numero/numero_secuencial los asigna el servidor al guardar el pedido nuevo.
      numero: "",
      numeroSecuencial: undefined,
      estado: "Borrador", albaranId: null, ultimaActualizacion: new Date().toISOString().slice(0, 10),
    };
    setPedidos((prev) => [copy, ...prev]);
    toast.success("Pedido copiado como borrador");
  };

  const handleConfirmarPedido = async (ped: Pedido) => {
    const fecha = new Date().toISOString().slice(0, 10);

    const res = await createAlbaran({
      pedidoId: ped.id,
      proveedorNombre: ped.proveedor,
      almacen: ped.almacen,
      documento: `ALB-${ped.numero}`,
      fecha,
      dtoPct: ped.dtoPct,
      dtoEur: ped.dtoEur,
      notas: ped.notas,
      creador: ped.creador,
      lineas: ped.lineas.map((l) => ({ ...l, docPedido: ped.numero })),
      numeroSecuencial: ped.numeroSecuencial,
    });

    if (!res.ok) {
      toast.error("Error al crear el albarán");
      return;
    }

    const albId = res.id;
    const albNumero = res.numero ?? "";
    const newAlbaran: Albaran = {
      id: albId, numeroSecuencial: res.numeroSecuencial, numero: albNumero, empresaId: ped.empresaId, empresa: ped.empresa,
      proveedor: ped.proveedor, documento: `ALB-${ped.numero}`, factura: "",
      almacen: ped.almacen, fecha, estado: "Pendiente",
      lineas: ped.lineas.map((l) => ({ ...l, docPedido: ped.numero })),
      dtoPct: ped.dtoPct, dtoEur: ped.dtoEur, notas: ped.notas,
      pedidoId: ped.id, creador: ped.creador, ultimaActualizacion: fecha,
    };

    setPedidos((prev) => prev.map((p) => p.id === ped.id ? { ...p, estado: "Confirmado" as EstadoPedido, albaranId: albId } : p));
    setAlbaranes((prev) => [newAlbaran, ...prev]);
    setDetallePedido((prev) => prev && prev.id === ped.id ? { ...prev, estado: "Confirmado", albaranId: albId } : prev);

    await serverUpdatePedidoEstado(ped.id, "Confirmado");
    toast.success(`Pedido confirmado. Albarán ${albNumero} creado.`);
  };

  const handleConfirmarAlbaran = async (alb: Albaran) => {
    // Actualizar estado en BD
    const res = await serverUpdateAlbaranEstado(alb.id, "Confirmado");
    if (!res.ok) { toast.error("Error al confirmar albarán"); return; }

    // Sumar cantidades al stock (usar productoId cuando está disponible)
    const lineasStock = alb.lineas.map((l) => ({
      productoId: l.productoId || undefined,
      productoNombre: l.producto,
      cantidad: l.cantidad,
      unidad: l.unidad,
    }));
    const stockRes = await sumarStockDesdeAlbaran(lineasStock);

    // Actualizar estado local
    setAlbaranes((prev) => prev.map((a) => a.id === alb.id ? { ...a, estado: "Confirmado" as EstadoAlbaran } : a));
    setDetalleAlbaran((prev) => prev && prev.id === alb.id ? { ...prev, estado: "Confirmado" } : prev);

    if (stockRes.ok) toast.success("Albarán confirmado — stock actualizado");
    else toast.warning("Albarán confirmado, pero hubo un error al actualizar el stock");
  };

  const updatePedidoEstado = async (id: string, estado: string) => {
    setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, estado: estado as EstadoPedido } : p));
    setDetallePedido((prev) => prev && prev.id === id ? { ...prev, estado: estado as EstadoPedido } : prev);
    const res = await serverUpdatePedidoEstado(id, estado);
    if (!res.ok) { toast.error("Error al actualizar estado"); loadPedidos(); }
  };

  const updateAlbaranEstado = (id: string, estado: string) => {
    setAlbaranes((prev) => prev.map((a) => a.id === id ? { ...a, estado: estado as EstadoAlbaran } : a));
    setDetalleAlbaran((prev) => prev && prev.id === id ? { ...prev, estado: estado as EstadoAlbaran } : prev);
  };

  const openAlbaran = (albId: string) => {
    const alb = albaranes.find((a) => a.id === albId);
    if (alb) { setDetallePedido(null); setDetalleAlbaran(alb); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleAll = () => {
    if (selected.size === filteredPedidos.length) setSelected(new Set());
    else setSelected(new Set(filteredPedidos.map((p) => p.id)));
  };

  // ── Detail views ───
  if (detallePedido) {
    return (
      <div className="p-4 md:p-6">
        <DetallePedido
          pedido={detallePedido}
          albaran={albaranes.find((a) => a.id === detallePedido.albaranId) || null}
          onBack={() => setDetallePedido(null)}
          onUpdateEstado={updatePedidoEstado}
          onConfirmar={handleConfirmarPedido}
          onOpenAlbaran={openAlbaran}
          onEnviarProveedor={handleEnviarProveedor}
        />
      </div>
    );
  }

  if (detalleAlbaran) {
    return (
      <div className="p-4 md:p-6">
        <DetalleAlbaran
          albaran={detalleAlbaran}
          pedidoOrigen={pedidos.find((p) => p.id === detalleAlbaran.pedidoId) || null}
          onBack={() => setDetalleAlbaran(null)}
          onUpdateEstado={updateAlbaranEstado}
          onConfirmar={handleConfirmarAlbaran}
          onGenerarFactura={async (alb) => {
            const res = await crearFacturaDesdeAlbaran({ albaranId: alb.id });
            if (!res.ok) { toast.error(res.error); return; }
            toast.success(`Factura ${res.data.numero} creada desde ${alb.numero}`);
            await loadFacturasCount();
            setDetalleAlbaran(null);
            setFacturaIdToOpen(res.data.id);
            setTab("facturas");
          }}
        />
      </div>
    );
  }

  // ── Main list view ───
  const columnasDef: ToolbarColumna[] = [
    { campo: "idSecuencial", label: "ID", bloqueada: true },
    { campo: "numero", label: "Nº", bloqueada: true },
    { campo: "fecha", label: "Fecha" },
    { campo: "fechaEntrega", label: "F. Entrega" },
    { campo: "almacen", label: "Almacén" },
    { campo: "proveedor", label: "Proveedor" },
    { campo: "estado", label: "Estado" },
    { campo: "base", label: "Base (€)" },
    { campo: "total", label: "Total (€)" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: Pedido) => ReactNode }> = {
    idSecuencial: {
      th: <TableColumnHeader key="idSecuencial" label="ID" />,
      td: (p) => (
        <td key="idSecuencial" className="px-3 py-2.5 text-xs tabular-nums font-medium text-muted-foreground whitespace-nowrap">
          {p.numeroSecuencial != null ? `PED-${p.numeroSecuencial}` : "—"}
        </td>
      ),
    },
    numero: {
      th: (
        <TableColumnHeader
          key="numero"
          label="Nº"
          campo="numero"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="numero" className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">
          {p.numero}
        </td>
      ),
    },
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
      td: (p) => (
        <td key="fecha" className="px-3 py-2.5 text-xs whitespace-nowrap">
          {p.fecha}
        </td>
      ),
    },
    fechaEntrega: {
      th: (
        <TableColumnHeader
          key="fechaEntrega"
          label="F. Entrega"
          campo="fechaEntrega"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="fechaEntrega" className="px-3 py-2.5 text-xs whitespace-nowrap">
          {p.fechaEntrega || "—"}
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
      td: (p) => (
        <td key="almacen" className="px-3 py-2.5 text-xs">
          {p.almacen}
        </td>
      ),
    },
    proveedor: {
      th: (
        <TableColumnHeader
          key="proveedor"
          label="Proveedor"
          campo="proveedor"
          filtroTipo="lista"
          opciones={proveedoresUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="proveedor" className="px-3 py-2.5 text-xs font-medium max-w-[200px] truncate uppercase">
          {p.proveedor}
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
          opciones={ESTADOS_PEDIDO.filter((e) => e !== "Archivado") as unknown as string[]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="estado" className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Select value={p.estado} onValueChange={(v) => updatePedidoEstado(p.id, v)}>
            <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0"><EstadoPedidoBadge value={p.estado} /></SelectTrigger>
            <SelectContent>{ESTADOS_PEDIDO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </td>
      ),
    },
    base: {
      th: <TableColumnHeader key="base" label="Base (€)" align="right" />,
      td: (p) => {
        const t = calcularTotalesLineas(p.lineas);
        return (
          <td key="base" className="px-3 py-2.5 text-xs font-semibold text-right">
            {t.base.toFixed(2)}
          </td>
        );
      },
    },
    total: {
      th: <TableColumnHeader key="total" label="Total (€)" align="right" />,
      td: (p) => {
        const t = calcularTotalesLineas(p.lineas);
        return (
          <td key="total" className="px-3 py-2.5 text-xs font-bold text-right">
            {t.total.toFixed(2)}
          </td>
        );
      },
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header removed — title shown in top bar */}

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={tab === "pedidos" ? "default" : "outline"}
            className="gap-2"
            onClick={() => setTab("pedidos")}
          >
            <ClipboardList className="h-4 w-4" />
            PEDIDOS
            <Badge variant="secondary" className="text-[10px] ml-1">{pedidos.length}</Badge>
          </Button>
          <Button
            variant={tab === "albaranes" ? "default" : "outline"}
            className="gap-2"
            onClick={() => setTab("albaranes")}
          >
            <Truck className="h-4 w-4" />
            ALBARANES
            <Badge variant="secondary" className="text-[10px] ml-1">{albaranes.length}</Badge>
          </Button>
          <Button
            variant={tab === "facturas" ? "default" : "outline"}
            className="gap-2"
            onClick={() => setTab("facturas")}
          >
            <Receipt className="h-4 w-4" />
            FACTURAS
            <Badge variant="secondary" className="text-[10px] ml-1">{facturasCount}</Badge>
          </Button>
        </div>

        {/* PEDIDOS TAB */}
        {tab === "pedidos" && <div className="space-y-4">
          {/* Toolbar */}
          <SubmoduleToolbar
            busqueda={search}
            onBusquedaChange={setSearch}
            placeholderBusqueda="Buscar"
            onNuevo={() => { setEditItem(null); setModalOpen(true); }}
            filtros={filtros}
            onFiltrosChange={setFiltros}
            columnas={columnasDef}
            columnasVisibles={columnasVisibles}
            onColumnasVisiblesChange={setColumnasVisibles}
            columnasOrden={columnasOrden}
            onColumnasOrdenChange={setColumnasOrden}
            extraIzquierda={
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setSugerenciasOpen(true)}>
                  <Package className="h-4 w-4 text-primary" /> Sugerir pedido
                </Button>
                {selected.size > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <MoreHorizontal className="h-4 w-4" /> Acciones
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel className="text-xs">Seleccionados ({selected.size})</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleCopy}><Copy className="h-4 w-4 mr-2" /> Copiar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        if (selected.size !== 1) { toast.info("Selecciona un pedido"); return; }
                        const p = pedidos.find((x) => selected.has(x.id));
                        if (p) { setEditItem(p); setModalOpen(true); }
                      }}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Imprimir</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => {
                        if (selected.size !== 1) { toast.info("Selecciona un pedido"); return; }
                        setDeleteConfirm([...selected][0]);
                      }}><Trash2 className="h-4 w-4 mr-2" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            }
            extraDerecha={
              <>
                <IOActions config={pedidosIO} onSuccess={() => window.location.reload()} />
                <Button size="icon" variant={showConfig ? "default" : "outline"} className="h-9 w-9" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </>
            }
          />

          {showConfig && (
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Configuración de pedidos — próximamente.</p>
            </div>
          )}

          {/* Table */}
          <ResizableColumnsProvider storageKey="logistica-pedidos">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 w-10"><Checkbox checked={selected.size === filteredPedidos.length && filteredPedidos.length > 0} onCheckedChange={toggleAll} /></th>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={async () => {
                      const res = await getPedido(p.id);
                      setDetallePedido(res.ok && res.data ? mapDbToPedido(res.data as Record<string, unknown>) : p);
                    }}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                  </tr>
                ))}
                {filteredPedidos.length === 0 && !loading && (
                  <tr>
                    <td colSpan={columnasRender.length + 1} className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto opacity-30 mb-2" />
                      <div className="font-medium text-foreground">No hay ningún pedido creado</div>
                      <div className="text-xs mt-1">
                        Crea un pedido nuevo desde el botón <span className="font-semibold">+ Nuevo</span> o usa <span className="font-semibold">Sugerir pedido</span>.
                      </div>
                      <div className="text-[11px] mt-2 opacity-70">
                        Flujo: Pedido → Albarán → Factura
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </ResizableColumnsProvider>
          <div className="text-xs text-muted-foreground text-right">{filteredPedidos.length} de {pedidos.length} pedidos</div>
        </div>}

        {/* ALBARANES TAB */}
        {tab === "albaranes" && (() => {
          const columnasDefAlb: ToolbarColumna[] = [
            { campo: "idSecuencial", label: "ID", bloqueada: true },
            { campo: "numero", label: "Nº", bloqueada: true },
            { campo: "proveedor", label: "Proveedor" },
            { campo: "almacen", label: "Almacén" },
            { campo: "fecha", label: "Fecha" },
            { campo: "estado", label: "Estado" },
            { campo: "pedidoNumero", label: "Pedido" },
            { campo: "total", label: "Total (€)" },
          ];
          const accesoAlb = (a: Albaran, campo: string): unknown => {
            if (campo === "pedidoNumero") return pedidos.find((p) => p.id === a.pedidoId)?.numero ?? "";
            if (campo === "total") return calcularTotalesLineas(a.lineas).total;
            return (a as unknown as Record<string, unknown>)[campo];
          };
          let filteredAlb = albaranes.filter((a) => coincideBusquedaUniversal(a, searchAlb));
          filteredAlb = aplicarFiltrosToolbar(filteredAlb, filtrosAlb, accesoAlb);
          filteredAlb = aplicarOrdenToolbar(filteredAlb, ordenAlb, accesoAlb);
          const colsRenderAlb = ordenarColumnas(columnasDefAlb, columnasOrdenAlb).filter(
            (c) => c.bloqueada || colVisible(columnasVisiblesAlb, c.campo),
          );
          return (
            <div className="space-y-4">
              <SubmoduleToolbar
                busqueda={searchAlb}
                onBusquedaChange={setSearchAlb}
                placeholderBusqueda="Buscar"
                filtros={filtrosAlb}
                onFiltrosChange={setFiltrosAlb}
                columnas={columnasDefAlb}
                columnasVisibles={columnasVisiblesAlb}
                onColumnasVisiblesChange={setColumnasVisiblesAlb}
                columnasOrden={columnasOrdenAlb}
                onColumnasOrdenChange={setColumnasOrdenAlb}
                extraDerecha={
                  <Button
                    size="icon"
                    variant={showConfigAlb ? "default" : "outline"}
                    className="h-9 w-9"
                    onClick={() => setShowConfigAlb((v) => !v)}
                    title="Configuración"
                    aria-label="Configuración"
                  >
                    <Settings className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                }
              />
              {showConfigAlb && (
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Configuración de albaranes — próximamente.</p>
                </div>
              )}

              <ResizableColumnsProvider storageKey="logistica-albaranes">
                <div className="bg-card rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {colsRenderAlb.map((c) => (
                          <TableColumnHeader
                            key={c.campo}
                            label={c.label}
                            campo={c.campo}
                            ordenable
                            orden={ordenAlb}
                            onOrdenChange={setOrdenAlb}
                            align={c.campo === "total" ? "right" : undefined}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlb.map((a) => {
                        const t = calcularTotalesLineas(a.lineas);
                        const pedNum = pedidos.find((p) => p.id === a.pedidoId)?.numero || "—";
                        return (
                          <tr
                            key={a.id}
                            className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setDetalleAlbaran(a)}
                          >
                            {colsRenderAlb.map((c) => {
                              switch (c.campo) {
                                case "idSecuencial":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 text-xs tabular-nums font-medium text-muted-foreground whitespace-nowrap">
                                      {a.numeroSecuencial != null ? `ALB-${a.numeroSecuencial}` : "—"}
                                    </td>
                                  );
                                case "numero":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">
                                      {a.numero}
                                    </td>
                                  );
                                case "proveedor":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 text-xs font-medium uppercase max-w-[200px] truncate">
                                      {a.proveedor}
                                    </td>
                                  );
                                case "almacen":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 text-xs">
                                      {a.almacen}
                                    </td>
                                  );
                                case "fecha":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 text-xs whitespace-nowrap">
                                      {a.fecha}
                                    </td>
                                  );
                                case "estado":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5">
                                      <Badge variant="outline" className="text-[11px]">{a.estado}</Badge>
                                    </td>
                                  );
                                case "pedidoNumero":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 text-xs text-muted-foreground">
                                      {pedNum}
                                    </td>
                                  );
                                case "total":
                                  return (
                                    <td key={c.campo} className="px-3 py-2.5 text-xs font-bold text-right tabular-nums">
                                      {t.total.toFixed(2)}
                                    </td>
                                  );
                                default:
                                  return <td key={c.campo} />;
                              }
                            })}
                          </tr>
                        );
                      })}
                      {filteredAlb.length === 0 && (
                        <tr>
                          <td colSpan={colsRenderAlb.length} className="text-center py-12 text-muted-foreground">
                            <Truck className="h-8 w-8 mx-auto opacity-30 mb-2" />
                            <div className="font-medium text-foreground">Aún no hay albaranes</div>
                            <div className="text-xs mt-1">
                              Los albaranes se generan al confirmar un pedido desde la pestaña <span className="font-semibold">PEDIDOS</span>.
                            </div>
                            <div className="text-[11px] mt-2 opacity-70">
                              Flujo: Pedido → Albarán → Factura
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ResizableColumnsProvider>
              <div className="text-xs text-muted-foreground text-right">
                {filteredAlb.length} de {albaranes.length} albaranes
              </div>
            </div>
          );
        })()}

        {/* FACTURAS TAB */}
        {tab === "facturas" && (
          <FacturasTab
            openFacturaId={facturaIdToOpen}
            onOpened={() => setFacturaIdToOpen(null)}
          />
        )}
      </div>

      {/* Modal */}
      <PedidoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} empresaId={empresaActual.id} empresaNombre={empresaActual.nombre} />

      <SugerenciasPedidoModal
        open={sugerenciasOpen}
        onClose={() => setSugerenciasOpen(false)}
        onOrdersCreated={() => {
          loadPedidos();
          setTab("pedidos");
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const ped = pedidos.find((p) => p.id === deleteConfirm);
                if (ped?.albaranId) return "Este pedido tiene un albarán vinculado y no puede eliminarse.";
                if (ped?.enviadoAt || ped?.estado === "Enviado") return "Este pedido fue enviado al proveedor y no puede eliminarse.";
                if (ped?.estado === "Archivado") return "Este pedido no puede eliminarse.";
                return "Esta acción no se puede deshacer.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {(() => { const ped = pedidos.find((p) => p.id === deleteConfirm); const blocked = ped?.albaranId || ped?.enviadoAt || ped?.estado === "Enviado"; return blocked ? null : <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Eliminar</AlertDialogAction>; })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
