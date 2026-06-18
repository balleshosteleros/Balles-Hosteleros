"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt, Settings, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  colVisible,
  ordenarColumnas,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";

import { listFacturas } from "@/features/logistica/actions/facturas-actions";
import type { Factura } from "@/features/logistica/types/facturas";
import { FacturaDialog } from "./FacturaDialog";

interface Props {
  /** id que abrir al montar (útil cuando vienes desde "Generar factura" en un albarán). */
  openFacturaId?: string | null;
  onOpened?: () => void;
}

const ESTADO_COLOR: Record<string, string> = {
  Borrador: "bg-zinc-100 text-zinc-800 border-zinc-200",
  Analizada: "bg-emerald-50 text-emerald-900 border-emerald-200",
  ConDiscrepancias: "bg-amber-50 text-amber-900 border-amber-200",
  Validada: "bg-sky-50 text-sky-900 border-sky-200",
  Anulada: "bg-rose-50 text-rose-900 border-rose-200",
};

export function FacturasTab({ openFacturaId, onOpened }: Props) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFacturas();
      if (res.ok) setFacturas(res.data);
      else toast.error(res.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Cuando llega un openFacturaId externo (desde albarán), abrir el dialog
  useEffect(() => {
    if (openFacturaId) {
      setSelectedId(openFacturaId);
      setDialogOpen(true);
      onOpened?.();
    }
  }, [openFacturaId, onOpened]);

  const acceso = (f: Factura, campo: string): unknown =>
    (f as unknown as Record<string, unknown>)[campo];

  const filtradas = useMemo(() => {
    let lista = facturas.filter(
      (f) => f.estado !== "Anulada" && coincideBusquedaUniversal(f, search),
    );
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [facturas, search, filtros, orden]);

  const columnasDef: ToolbarColumna[] = [
    { campo: "idSecuencial", label: "ID", bloqueada: true },
    { campo: "numero", label: "Nº", bloqueada: true },
    { campo: "albaran", label: "Albarán" },
    { campo: "proveedorNombre", label: "Proveedor" },
    { campo: "fechaFactura", label: "Fecha" },
    { campo: "estado", label: "Estado" },
    { campo: "baseImponible", label: "Base (€)" },
    { campo: "ivaTotal", label: "IVA (€)" },
    { campo: "total", label: "Total (€)" },
    { campo: "discrepancias", label: "Discrep." },
  ];

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  const renderCelda = (f: Factura, campo: string) => {
    switch (campo) {
      case "idSecuencial":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs tabular-nums font-medium text-muted-foreground whitespace-nowrap">
            FAC-{f.numeroSecuencial}
          </td>
        );
      case "numero":
        return (
          <td key={campo} className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">
            {f.numero}
          </td>
        );
      case "albaran":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs text-muted-foreground">
            {f.albaranId ? "Vinculado" : "Huérfana"}
          </td>
        );
      case "proveedorNombre":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs font-medium uppercase max-w-[200px] truncate">
            {f.proveedorNombre}
          </td>
        );
      case "fechaFactura":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs whitespace-nowrap">
            {f.fechaFactura ?? f.fechaRecepcion}
          </td>
        );
      case "estado":
        return (
          <td key={campo} className="px-3 py-2.5">
            <Badge variant="outline" className={`text-[11px] ${ESTADO_COLOR[f.estado] ?? ""}`}>
              {f.estado}
            </Badge>
          </td>
        );
      case "baseImponible":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs font-semibold text-right tabular-nums">
            {f.baseImponible.toFixed(2)}
          </td>
        );
      case "ivaTotal":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs text-right tabular-nums">
            {f.ivaTotal.toFixed(2)}
          </td>
        );
      case "total":
        return (
          <td key={campo} className="px-3 py-2.5 text-xs font-bold text-right tabular-nums">
            {f.total.toFixed(2)}
          </td>
        );
      case "discrepancias": {
        const pendientes = f.lineas.filter(
          (l) => l.discrepanciaTipo !== null && l.discrepanciaResolucion === null,
        ).length;
        return (
          <td key={campo} className="px-3 py-2.5 text-xs text-right">
            {pendientes > 0 ? (
              <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                {pendientes}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </td>
        );
      }
      default:
        return <td key={campo} />;
    }
  };

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        filtros={filtros}
        onFiltrosChange={setFiltros}
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

      {showConfig && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(false)}
            className="gap-1 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <p className="text-sm text-muted-foreground">Configuración de facturas — próximamente.</p>
        </div>
      )}

      <ResizableColumnsProvider storageKey="logistica-facturas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => (
                  <TableColumnHeader
                    key={c.campo}
                    label={c.label}
                    align={["baseImponible", "ivaTotal", "total", "discrepancias"].includes(c.campo) ? "right" : undefined}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => (
                <tr
                  key={f.id}
                  className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedId(f.id);
                    setDialogOpen(true);
                  }}
                >
                  {columnasRender.map((c) => renderCelda(f, c.campo))}
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-8 w-8 mx-auto opacity-30 mb-2" />
                    <div className="font-medium text-foreground">Aún no hay facturas</div>
                    <div className="text-xs mt-1">
                      Las facturas se generan desde la pestaña <span className="font-semibold">ALBARANES</span> al confirmar un albarán.
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
        {filtradas.length} de {facturas.length} facturas
      </div>

      <FacturaDialog
        open={dialogOpen}
        facturaId={selectedId}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setSelectedId(null);
        }}
        onChanged={load}
      />
    </div>
  );
}
