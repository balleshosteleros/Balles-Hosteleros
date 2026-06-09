"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacturaContable, EstadoFactura, TipoFactura } from "@/features/contabilidad/data/contabilidad";
import { listFacturas } from "@/features/contabilidad/actions/contabilidad-actions";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
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
import { facturasIO } from "@/features/contabilidad/io/facturas.io";
import { ImportadorIAFacturasDialog } from "@/features/contabilidad/components/ImportadorIAFacturasDialog";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const TABS = [{ id: "TODAS", label: "Todas" }, { id: "VENTA", label: "Ventas" }, { id: "COMPRA", label: "Compras" }];

const estadoStyles: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-300",
  PAGADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  COBRADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  VENCIDO: "bg-red-100 text-red-800 border-red-300",
};

function mapDbToFactura(row: Record<string, unknown>): FacturaContable {
  return {
    id: row.id as string,
    tipo: ((row.tipo as string) ?? "COMPRA") as TipoFactura,
    cliente: (row.contacto_nombre as string) ?? "",
    numeroFactura: (row.numero as string) ?? "",
    tipoFactura: "Ordinaria",
    fechaEmision: (row.fecha as string) ?? "",
    fechaPago: (row.fecha_cobro as string) ?? "",
    estado: ((row.estado as string) ?? "PENDIENTE") as EstadoFactura,
    total: (row.total as number) ?? 0,
    diasTarde: undefined,
  };
}

export function FacturasView() {
  useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [facturas, setFacturas] = useState<FacturaContable[]>([]);
  const [, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);
  const [importadorAbierto, setImportadorAbierto] = useState(false);

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFacturas();
      if (res.ok) {
        setFacturas(res.data.map(mapDbToFactura));
      } else {
        toast.error("Error al cargar facturas");
      }
    } catch {
      toast.error("Error de conexion al cargar facturas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas]);

  const clientesUsados = useMemo(
    () => [...new Set(facturas.map(f => f.cliente).filter(Boolean))].sort(),
    [facturas],
  );

  const acceso = (f: FacturaContable, campo: string): unknown => {
    if (campo === "estado") return f.estado;
    if (campo === "tipo") return f.tipo;
    if (campo === "cliente") return f.cliente;
    if (campo === "total") return f.total;
    if (campo === "fechaEmision") return f.fechaEmision;
    if (campo === "fechaPago") return f.fechaPago;
    if (campo === "numeroFactura") return f.numeroFactura;
    return (f as unknown as Record<string, unknown>)[campo];
  };

  const filtradas = useMemo(() => {
    let lista = facturas.filter(f => {
      if (tab !== "TODAS" && f.tipo !== tab) return false;
      const q = busqueda.toLowerCase();
      return !q || f.cliente.toLowerCase().includes(q) || f.numeroFactura.toLowerCase().includes(q);
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [facturas, tab, busqueda, filtros, orden]);

  const estadoLabel = (f: FacturaContable) => {
    if (f.estado === "VENCIDO" && f.diasTarde) return `⏳ ${f.diasTarde} días tarde`;
    if (f.estado === "PAGADO") return "✓ Pagado";
    if (f.estado === "COBRADO") return "✓ Cobrado";
    return "✗ Pendiente";
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "cliente", label: "Cliente", bloqueada: true },
    { campo: "fechaEmision", label: "Fecha emisión" },
    { campo: "fechaPago", label: "Fecha pago" },
    { campo: "estado", label: "Estado" },
    { campo: "total", label: "Total" },
  ];

  const estadosUsados = useMemo(
    () => [...new Set(facturas.map((f) => f.estado))].sort(),
    [facturas],
  );

  const columnDefs: Record<string, { th: ReactNode; td: (f: FacturaContable) => ReactNode }> = {
    cliente: {
      th: (
        <TableColumnHeader
          key="cliente"
          label="Cliente"
          campo="cliente"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="lista"
          opciones={clientesUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <td key="cliente" className="px-3 py-3">
          <p className="font-semibold">{f.cliente}</p>
          <p className="text-[10px] text-muted-foreground">{f.numeroFactura} · {f.tipoFactura}</p>
        </td>
      ),
    },
    fechaEmision: {
      th: (
        <TableColumnHeader
          key="fechaEmision"
          label="Fecha de emisión"
          campo="fechaEmision"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <td key="fechaEmision" className="px-3 py-3 text-muted-foreground">{f.fechaEmision}</td>
      ),
    },
    fechaPago: {
      th: (
        <TableColumnHeader
          key="fechaPago"
          label="Fecha de pago"
          campo="fechaPago"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <td key="fechaPago" className="px-3 py-3 text-muted-foreground">{f.fechaPago || "—"}</td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="lista"
          opciones={estadosUsados}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <td key="estado" className="px-3 py-3">
          <Badge className={cn("text-[10px]", estadoStyles[f.estado])} variant="outline">{estadoLabel(f)}</Badge>
        </td>
      ),
    },
    total: {
      th: (
        <TableColumnHeader
          key="total"
          label="Total"
          campo="total"
          align="right"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <td key="total" className="px-3 py-3 text-right font-mono font-semibold">
          {f.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Tabs */}
      <div className="border-b px-6 pt-4 flex items-center gap-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("pb-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3">
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar"
          onNuevo={() => { /* nuevo */ }}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          orden={orden}
          onOrdenChange={setOrden}
          columnas={columnasDef}
          columnasVisibles={columnasVisibles}
          onColumnasVisiblesChange={setColumnasVisibles}
          columnasOrden={columnasOrden}
          onColumnasOrdenChange={setColumnasOrden}
          extraDerecha={
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5"
                onClick={() => setImportadorAbierto(true)}
                title="Importar con IA"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Importar IA
              </Button>
              <IOActions config={facturasIO} onSuccess={() => window.location.reload()} />
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
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="text-[10px] text-muted-foreground mb-2">{filtradas.length} resultados</div>
        <ResizableColumnsProvider storageKey="contabilidad-facturas">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-3 py-3 w-8"></th>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(f => (
                  <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3"><FileText className="h-4 w-4 text-muted-foreground" /></td>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(f))}
                    <td className="px-3 py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={columnasRender.length + 2} className="text-center py-12 text-muted-foreground">No se encontraron facturas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ResizableColumnsProvider>
      </div>

      <ImportadorIAFacturasDialog
        open={importadorAbierto}
        onOpenChange={setImportadorAbierto}
        onImportSuccess={loadFacturas}
      />
    </div>
  );
}
