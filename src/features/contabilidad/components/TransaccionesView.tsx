"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, MoreVertical, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransaccionContable, TipoTransaccion } from "@/features/contabilidad/data/contabilidad";
import { listTransacciones } from "@/features/contabilidad/actions/contabilidad-actions";
import { listMovimientosBancarios } from "@/features/contabilidad/actions/psd2-actions";
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
import { IOActions } from "@/shared/io";
import { transaccionesIO } from "@/features/contabilidad/io/transacciones.io";
import { toast } from "sonner";

const TABS = [{ id: "TODAS", label: "Todas" }, { id: "COBRO", label: "Cobros" }, { id: "PAGO", label: "Pagos" }];

type TransaccionEnriquecida = TransaccionContable & { origen?: "manual" | "psd2" };

function mapDbToTransaccion(row: Record<string, unknown>): TransaccionEnriquecida {
  return {
    id: row.id as string,
    concepto: (row.concepto as string) ?? "",
    banco: (row.banco as string) ?? "",
    fecha: (row.fecha as string) ?? "",
    importe: (row.importe as number) ?? 0,
    tipo: ((row.tipo as string) ?? "PAGO") as TipoTransaccion,
    etiquetas: Array.isArray(row.etiquetas) ? (row.etiquetas as { categoria: string; detalle: string; color: string }[]) : [],
    documentos: (row.documentos as number) ?? 0,
    conciliada: (row.conciliada as boolean) ?? false,
    origen: "manual",
  };
}

function mapBankTxToTransaccion(row: Record<string, unknown>): TransaccionEnriquecida {
  const accounts = row.bank_accounts as
    | {
        nombre?: string | null;
        iban_last4?: string | null;
        bank_connections?: { institution_name?: string | null } | null;
      }
    | null;
  const institutionName =
    accounts?.bank_connections?.institution_name ??
    accounts?.nombre ??
    "Banco";
  const importe = Number(row.amount ?? 0);
  return {
    id: `psd2:${row.id as string}`,
    concepto: (row.descripcion as string) || (row.contraparte as string) || "(Sin descripción)",
    banco: accounts?.iban_last4 ? `${institutionName} · ····${accounts.iban_last4}` : institutionName,
    fecha: (row.booking_date as string) ?? "",
    importe,
    tipo: importe >= 0 ? "COBRO" : "PAGO",
    etiquetas: [],
    documentos: 0,
    conciliada: false,
    origen: "psd2",
  };
}

export function TransaccionesView() {
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [txs, setTxs] = useState<TransaccionEnriquecida[]>([]);
  const [_loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  const loadTransacciones = useCallback(async () => {
    setLoading(true);
    try {
      const [manual, psd2] = await Promise.all([
        listTransacciones().catch(() => ({ ok: false, data: [] as Record<string, unknown>[] })),
        listMovimientosBancarios(),
      ]);
      const lista: TransaccionEnriquecida[] = [];
      if (manual.ok) lista.push(...manual.data.map(mapDbToTransaccion));
      if (psd2.ok) lista.push(...psd2.data.map((r) => mapBankTxToTransaccion(r as Record<string, unknown>)));
      setTxs(lista);
    } catch {
      toast.error("Error de conexión al cargar transacciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransacciones();
  }, [loadTransacciones]);


  const acceso = (t: TransaccionEnriquecida, campo: string): unknown => {
    if (campo === "tipo") return t.tipo;
    if (campo === "banco") return t.banco;
    if (campo === "conciliada") return t.conciliada ? "Conciliada" : "Sin conciliar";
    if (campo === "importe") return t.importe;
    if (campo === "fecha") return t.fecha;
    if (campo === "concepto") return t.concepto;
    return (t as unknown as Record<string, unknown>)[campo];
  };

  const filtradas = useMemo(() => {
    let lista = txs.filter(t => {
      if (tab !== "TODAS" && t.tipo !== tab) return false;
      const q = busqueda.toLowerCase();
      return !q || t.concepto.toLowerCase().includes(q) || t.banco.toLowerCase().includes(q);
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [txs, tab, busqueda, filtros, orden]);

  const columnasDef: ToolbarColumna[] = [
    { campo: "concepto", label: "Concepto" },
    { campo: "etiquetas", label: "Etiquetas" },
    { campo: "fecha", label: "Fecha" },
    { campo: "documentos", label: "Documentos" },
    { campo: "importe", label: "Cantidad" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (t: TransaccionEnriquecida) => ReactNode }> = {
    concepto: {
      th: <th key="concepto" className="px-3 py-3 font-medium">Concepto</th>,
      td: (t) => (
        <td key="concepto" className="px-3 py-3">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{t.concepto}</p>
            {t.origen === "psd2" && (
              <Badge variant="outline" className="text-[9px] border-emerald-300 bg-emerald-50 text-emerald-700">
                Sincronizado
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{t.banco}</p>
        </td>
      ),
    },
    etiquetas: {
      th: <th key="etiquetas" className="px-3 py-3 font-medium">Etiquetas</th>,
      td: (t) => (
        <td key="etiquetas" className="px-3 py-3">
          <div className="flex gap-1 flex-wrap">
            {t.etiquetas.map((e, i) => (
              <Badge key={i} className={cn("text-[9px] border", e.color)} variant="outline">
                {e.categoria}{e.detalle ? ` · ${e.detalle}` : ""}
              </Badge>
            ))}
          </div>
        </td>
      ),
    },
    fecha: {
      th: <th key="fecha" className="px-3 py-3 font-medium">Fecha</th>,
      td: (t) => (
        <td key="fecha" className="px-3 py-3 text-muted-foreground">{t.fecha}</td>
      ),
    },
    documentos: {
      th: <th key="documentos" className="px-3 py-3 font-medium">Documentos</th>,
      td: (t) => (
        <td key="documentos" className="px-3 py-3">
          {t.documentos > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Paperclip className="h-3 w-3" />
              <Badge variant="destructive" className="text-[9px] h-4 w-4 p-0 flex items-center justify-center rounded-full">{t.documentos}</Badge>
            </span>
          )}
        </td>
      ),
    },
    importe: {
      th: <th key="importe" className="px-3 py-3 font-medium text-right">Cantidad</th>,
      td: (t) => (
        <td key="importe" className={cn("px-3 py-3 text-right font-mono font-semibold", t.importe >= 0 ? "text-emerald-600" : "")}>
          {t.importe >= 0 ? "" : "↙ "}{t.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
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
              <IOActions config={transaccionesIO} onSuccess={() => window.location.reload()} />
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
              {filtradas.map(t => (
                <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground text-xs font-mono">℞</td>
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(t))}
                  <td className="px-3 py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No se encontraron transacciones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
