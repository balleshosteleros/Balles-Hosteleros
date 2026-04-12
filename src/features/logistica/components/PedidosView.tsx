"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getPedidosPorEmpresa, getAlbaranesPorEmpresa, calcularTotalesLineas,
  ESTADOS_PEDIDO, PROVEEDORES, PROVEEDOR_EMAILS,
  type Pedido, type Albaran, type EstadoPedido, type EstadoAlbaran,
} from "@/features/logistica/data/pedidos";
import { EstadoPedidoBadge } from "@/features/logistica/components/pedidos/BadgesPedido";
import { DetallePedido } from "@/features/logistica/components/pedidos/DetallePedido";
import { DetalleAlbaran } from "@/features/logistica/components/pedidos/DetalleAlbaran";
import { PedidoModal } from "@/features/logistica/components/pedidos/PedidoModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Copy, Pencil, Trash2, Search, Printer, Download, MoreHorizontal, Archive,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ALL = "__ALL__";

export function PedidosView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const [pedidos, setPedidos] = useState<Pedido[]>(() => getPedidosPorEmpresa(empresaActual.id));
  const [albaranes, setAlbaranes] = useState<Albaran[]>(() => getAlbaranesPorEmpresa(empresaActual.id));

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState(ALL);
  const [showArchived, setShowArchived] = useState(false);
  const [filterProveedor, setFilterProveedor] = useState(ALL);
  const [tab, setTab] = useState<"pedidos" | "albaranes">("pedidos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Pedido | null>(null);
  const [detallePedido, setDetallePedido] = useState<Pedido | null>(null);
  const [detalleAlbaran, setDetalleAlbaran] = useState<Albaran | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useMemo(() => {
    setPedidos(getPedidosPorEmpresa(empresaActual.id));
    setAlbaranes(getAlbaranesPorEmpresa(empresaActual.id));
  }, [empresaActual.id]);

  // Filtered pedidos
  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      if (!showArchived && p.estado === "Archivado") return false;
      if (showArchived && p.estado !== "Archivado") return false;
      if (filterEstado !== ALL && p.estado !== filterEstado) return false;
      if (filterProveedor !== ALL && p.proveedor !== filterProveedor) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.numero.toLowerCase().includes(s) || p.proveedor.toLowerCase().includes(s) || p.docProveedor.toLowerCase().includes(s);
      }
      return true;
    });
  }, [pedidos, search, filterEstado, filterProveedor, showArchived]);

  // Stats
  const statCounts: Record<string, number> = {};
  ESTADOS_PEDIDO.forEach((e) => { statCounts[e] = pedidos.filter((p) => p.estado === e).length; });

  // Handlers
  const handleSave = (item: Pedido) => {
    setPedidos((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [item, ...prev];
    });
  };

  const handleDelete = (id: string) => {
    const ped = pedidos.find((p) => p.id === id);
    if (ped?.albaranId) {
      toast.error("No se puede eliminar un pedido con albarán vinculado");
      return;
    }
    if (ped?.enviadoAt) {
      toast.error("No se puede eliminar un pedido enviado. Puedes archivarlo.");
      return;
    }
    if (ped?.estado === "Enviado" || ped?.estado === "Archivado") {
      toast.error("No se puede eliminar un pedido en estado " + ped.estado);
      return;
    }
    setPedidos((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setDeleteConfirm(null);
    toast.success("Pedido eliminado");
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

  const handleArchivar = (ped: Pedido) => {
    setPedidos((prev) => prev.map((p) => p.id === ped.id ? { ...p, estado: "Archivado" as EstadoPedido } : p));
    setDetallePedido((prev) => prev && prev.id === ped.id ? { ...prev, estado: "Archivado" } : prev);
    toast.success("Pedido archivado");
  };

  const handleCopy = () => {
    if (selected.size !== 1) { toast.info("Selecciona un pedido para copiar"); return; }
    const src = pedidos.find((p) => selected.has(p.id));
    if (!src) return;
    const copy: Pedido = {
      ...structuredClone(src),
      id: `ped-${Date.now()}`,
      numero: `PED-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      estado: "Borrador", albaranId: null, ultimaActualizacion: new Date().toISOString().slice(0, 10),
    };
    setPedidos((prev) => [copy, ...prev]);
    toast.success("Pedido copiado como borrador");
  };

  const handleConfirmarPedido = (ped: Pedido) => {
    const albId = `alb-${Date.now()}`;
    const albNumero = `ALB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const newAlbaran: Albaran = {
      id: albId, numero: albNumero, empresaId: ped.empresaId, empresa: ped.empresa,
      proveedor: ped.proveedor, documento: `ALB-${ped.docProveedor}`, factura: "",
      almacen: ped.almacen, fecha: new Date().toISOString().slice(0, 10), estado: "Pendiente",
      lineas: ped.lineas.map((l) => ({ ...l, docPedido: ped.numero })),
      dtoPct: ped.dtoPct, dtoEur: ped.dtoEur, notas: ped.notas,
      pedidoId: ped.id, creador: ped.creador, ultimaActualizacion: new Date().toISOString().slice(0, 10),
    };
    setPedidos((prev) => prev.map((p) => p.id === ped.id ? { ...p, estado: "Confirmado" as EstadoPedido, albaranId: albId } : p));
    setAlbaranes((prev) => [newAlbaran, ...prev]);
    setDetallePedido((prev) => prev && prev.id === ped.id ? { ...prev, estado: "Confirmado", albaranId: albId } : prev);
    toast.success(`Pedido confirmado. Albarán ${albNumero} creado automáticamente.`);
  };

  const handleConfirmarAlbaran = (alb: Albaran) => {
    setAlbaranes((prev) => prev.map((a) => a.id === alb.id ? { ...a, estado: "Confirmado" as EstadoAlbaran } : a));
    setDetalleAlbaran((prev) => prev && prev.id === alb.id ? { ...prev, estado: "Confirmado" } : prev);
    toast.success("Albarán confirmado");
  };

  const updatePedidoEstado = (id: string, estado: string) => {
    setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, estado: estado as EstadoPedido } : p));
    setDetallePedido((prev) => prev && prev.id === id ? { ...prev, estado: estado as EstadoPedido } : prev);
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
          onArchivar={handleArchivar}
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
        />
      </div>
    );
  }

  // ── Main list view ───
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header removed — title shown in top bar */}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {ESTADOS_PEDIDO.map((e) => (
          <div key={e} className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-black text-foreground">{statCounts[e]}</div>
            <EstadoPedidoBadge value={e} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{pedidos.length}</Badge></TabsTrigger>
          <TabsTrigger value="albaranes">Albaranes <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{albaranes.length}</Badge></TabsTrigger>
        </TabsList>

        {/* PEDIDOS TAB */}
        <TabsContent value="pedidos" className="space-y-4 mt-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-card rounded-lg border p-3">
            <Button size="sm" className="gap-1" onClick={() => { setEditItem(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Nuevo</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={handleCopy}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => {
              if (selected.size !== 1) { toast.info("Selecciona un pedido"); return; }
              const p = pedidos.find((x) => selected.has(x.id));
              if (p) { setEditItem(p); setModalOpen(true); }
            }}><Pencil className="h-4 w-4" /> Editar</Button>
            <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => {
              if (selected.size !== 1) { toast.info("Selecciona un pedido"); return; }
              setDeleteConfirm([...selected][0]);
            }}><Trash2 className="h-4 w-4" /> Eliminar</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toast.info("Función imprimir en desarrollo")}><Printer className="h-4 w-4 mr-2" /> Imprimir</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Función exportar en desarrollo")}><Download className="h-4 w-4 mr-2" /> Exportar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1" />
            <Button size="sm" variant={showArchived ? "default" : "outline"} className="gap-1" onClick={() => setShowArchived(!showArchived)}>
              <Archive className="h-4 w-4" /> Archivados
            </Button>
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar pedidos…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Todos</SelectItem>{ESTADOS_PEDIDO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterProveedor} onValueChange={setFilterProveedor}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Proveedor" /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Todos</SelectItem>{PROVEEDORES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-3 py-3 w-10"><Checkbox checked={selected.size === filteredPedidos.length && filteredPedidos.length > 0} onCheckedChange={toggleAll} /></th>
                {["Nº", "Doc. Prov.", "Fecha", "F. Entrega", "Almacén", "Proveedor", "Estado", "Base (€)", "Total (€)"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredPedidos.map((p) => {
                  const t = calcularTotalesLineas(p.lineas);
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetallePedido(p)}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">{p.numero}</td>
                      <td className="px-3 py-2.5 text-xs">{p.docProveedor || "—"}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.fecha}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.fechaEntrega || "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{p.almacen}</td>
                      <td className="px-3 py-2.5 text-xs font-medium max-w-[200px] truncate">{p.proveedor}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Select value={p.estado} onValueChange={(v) => updatePedidoEstado(p.id, v)}>
                          <SelectTrigger className="h-8 text-xs w-[120px] border-0 p-0"><EstadoPedidoBadge value={p.estado} /></SelectTrigger>
                          <SelectContent>{ESTADOS_PEDIDO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-right">{t.base.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right">{t.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {filteredPedidos.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No se encontraron pedidos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground text-right">{filteredPedidos.length} de {pedidos.length} pedidos</div>
        </TabsContent>

        {/* ALBARANES TAB */}
        <TabsContent value="albaranes" className="space-y-4 mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                {["Nº Albarán", "Proveedor", "Documento", "Almacén", "Fecha", "Estado", "Pedido", "Total (€)"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {albaranes.map((a) => {
                  const t = calcularTotalesLineas(a.lineas);
                  return (
                    <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleAlbaran(a)}>
                      <td className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">{a.numero}</td>
                      <td className="px-3 py-2.5 text-xs font-medium">{a.proveedor}</td>
                      <td className="px-3 py-2.5 text-xs">{a.documento}</td>
                      <td className="px-3 py-2.5 text-xs">{a.almacen}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{a.fecha}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[11px]">{a.estado}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{pedidos.find((p) => p.id === a.pedidoId)?.numero || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right">{t.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {albaranes.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No hay albaranes generados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <PedidoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} empresaId={empresaActual.id} empresaNombre={empresaActual.nombre} />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const ped = pedidos.find((p) => p.id === deleteConfirm);
                if (ped?.albaranId) return "Este pedido tiene un albarán vinculado y no puede eliminarse.";
                if (ped?.enviadoAt || ped?.estado === "Enviado") return "Este pedido fue enviado al proveedor y no puede eliminarse. Puedes archivarlo.";
                if (ped?.estado === "Archivado") return "Este pedido está archivado y no puede eliminarse.";
                return "Esta acción no se puede deshacer.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {(() => { const ped = pedidos.find((p) => p.id === deleteConfirm); const blocked = ped?.albaranId || ped?.enviadoAt || ped?.estado === "Enviado" || ped?.estado === "Archivado"; return blocked ? null : <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Eliminar</AlertDialogAction>; })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
