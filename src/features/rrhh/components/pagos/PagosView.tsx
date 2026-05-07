"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getPagosPorEmpresa, getResumenPagos, type PagoEmpleado } from "@/features/rrhh/data/pagos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Edit2, Banknote, TrendingUp, TrendingDown, PiggyBank, HandCoins, Wallet, Settings } from "lucide-react";
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
import { pagosIO } from "@/features/rrhh/io/pagos.io";

export function PagosView() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [editando, setEditando] = useState<PagoEmpleado | null>(null);
  const [pagos, setPagos] = useState<PagoEmpleado[]>([]);
  const [initialized, setInitialized] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  if (initialized !== empresaActual.id) {
    setPagos(getPagosPorEmpresa(empresaActual.id));
    setInitialized(empresaActual.id);
  }

  const acceso = (p: PagoEmpleado, campo: string): unknown => {
    if (campo === "pagado") return p.pagado;
    if (campo === "fijo") return p.fijo;
    if (campo === "total") return p.total;
    if (campo === "nomina") return p.nomina;
    if (campo === "bonus") return p.bonus;
    if (campo === "horasExtras") return p.horasExtras;
    if (campo === "empleado") return p.empleadoNombre;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const pagosFiltrados = useMemo(() => {
    let resultado = pagos.filter((p) => {
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!p.empleadoNombre.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    resultado = aplicarFiltrosToolbar(resultado, filtros, acceso);
    resultado = aplicarOrdenToolbar(resultado, orden, acceso);
    return resultado;
  }, [pagos, busqueda, filtros, orden]);

  const resumen = useMemo(() => getResumenPagos(pagos), [pagos]);

  const togglePagado = (id: string) => {
    setPagos(prev => prev.map(p => p.id === id ? { ...p, pagado: !p.pagado } : p));
  };

  const guardarEdicion = (datos: Partial<PagoEmpleado>) => {
    if (!editando) return;
    setPagos(prev => prev.map(p => {
      if (p.id !== editando.id) return p;
      const updated = { ...p, ...datos };
      updated.total = updated.pago + updated.nomina + updated.propina + updated.horasExtras + updated.bonus + updated.propinaMantenimiento - updated.descuento;
      return updated;
    }));
    setEditando(null);
  };

  const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";

  const kpis = [
    { label: "Total pagos", value: fmt(resumen.totalFinal), icon: Banknote, color: "text-primary" },
    { label: "Positivo", value: fmt(resumen.positivo), icon: TrendingUp, color: "text-emerald-600" },
    { label: "Negativo", value: fmt(resumen.negativo), icon: TrendingDown, color: "text-destructive" },
    { label: "Efectivo ahorro", value: fmt(resumen.efectivoAhorro), icon: PiggyBank, color: "text-amber-600" },
    { label: "Préstamos", value: fmt(resumen.prestamos), icon: HandCoins, color: "text-orange-600" },
    { label: "Propinas acum.", value: fmt(resumen.propinasAcumuladas), icon: Wallet, color: "text-sky-600" },
  ];

  const columnasDef: ToolbarColumna[] = [
    { campo: "fijo", label: "Fijo" },
    { campo: "pago", label: "Pago" },
    { campo: "nomina", label: "Nómina" },
    { campo: "horasReales", label: "H.R" },
    { campo: "horasTrabajadas", label: "H.T" },
    { campo: "propina", label: "Propina" },
    { campo: "descuento", label: "Descuento" },
    { campo: "horasExtras", label: "H.Extras" },
    { campo: "bonus", label: "Bonus" },
    { campo: "propinaMantenimiento", label: "Prop. Mant." },
    { campo: "total", label: "Total" },
    { campo: "pagado", label: "Pagado" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: PagoEmpleado) => ReactNode }> = {
    fijo: {
      th: <TableHead key="fijo" className="text-center w-[60px]">Fijo</TableHead>,
      td: (p) => (
        <TableCell key="fijo" className="text-center">{p.fijo ? <Badge variant="secondary" className="text-[10px]">FIJO</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
      ),
    },
    pago: {
      th: <TableHead key="pago" className="text-right">Pago</TableHead>,
      td: (p) => <TableCell key="pago" className="text-right tabular-nums">{fmt(p.pago)}</TableCell>,
    },
    nomina: {
      th: <TableHead key="nomina" className="text-right">Nómina</TableHead>,
      td: (p) => <TableCell key="nomina" className="text-right tabular-nums">{fmt(p.nomina)}</TableCell>,
    },
    horasReales: {
      th: <TableHead key="horasReales" className="text-right">H.R</TableHead>,
      td: (p) => <TableCell key="horasReales" className="text-right tabular-nums">{p.horasReales}h</TableCell>,
    },
    horasTrabajadas: {
      th: <TableHead key="horasTrabajadas" className="text-right">H.T</TableHead>,
      td: (p) => <TableCell key="horasTrabajadas" className="text-right tabular-nums">{p.horasTrabajadas}h</TableCell>,
    },
    propina: {
      th: <TableHead key="propina" className="text-right">Propina</TableHead>,
      td: (p) => <TableCell key="propina" className="text-right tabular-nums">{fmt(p.propina)}</TableCell>,
    },
    descuento: {
      th: <TableHead key="descuento" className="text-right">Descuento</TableHead>,
      td: (p) => <TableCell key="descuento" className="text-right tabular-nums text-destructive">{p.descuento > 0 ? `-${fmt(p.descuento)}` : "—"}</TableCell>,
    },
    horasExtras: {
      th: <TableHead key="horasExtras" className="text-right">H.Extras</TableHead>,
      td: (p) => <TableCell key="horasExtras" className="text-right tabular-nums">{p.horasExtras > 0 ? fmt(p.horasExtras) : "—"}</TableCell>,
    },
    bonus: {
      th: <TableHead key="bonus" className="text-right">Bonus</TableHead>,
      td: (p) => <TableCell key="bonus" className="text-right tabular-nums">{p.bonus > 0 ? fmt(p.bonus) : "—"}</TableCell>,
    },
    propinaMantenimiento: {
      th: <TableHead key="propinaMantenimiento" className="text-right">Prop. Mant.</TableHead>,
      td: (p) => <TableCell key="propinaMantenimiento" className="text-right tabular-nums">{p.propinaMantenimiento > 0 ? fmt(p.propinaMantenimiento) : "—"}</TableCell>,
    },
    total: {
      th: <TableHead key="total" className="text-right font-bold">Total</TableHead>,
      td: (p) => <TableCell key="total" className="text-right font-bold tabular-nums">{fmt(p.total)}</TableCell>,
    },
    pagado: {
      th: <TableHead key="pagado" className="text-center w-[80px]">Pagado</TableHead>,
      td: (p) => <TableCell key="pagado" className="text-center"><Checkbox checked={p.pagado} onCheckedChange={() => togglePagado(p.id)} /></TableCell>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <span className="text-lg font-bold">{k.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        ocultarNuevo
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
            <IOActions
              config={pagosIO}
              context={{ empresaId: empresaActual.id }}
              onSuccess={() => window.location.reload()}
            />
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

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Control de pagos en efectivo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[180px]">Empleado</TableHead>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagosFiltrados.map(p => (
                  <TableRow key={p.id} className={p.pagado ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}>
                    <TableCell className="font-medium">{p.empleadoNombre}</TableCell>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(p)}><Edit2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/60 font-semibold border-t-2">
                  <TableCell>TOTALES</TableCell><TableCell />
                  <TableCell className="text-right tabular-nums">{fmt(resumen.totalPagos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(resumen.totalNomina)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pagos.reduce((s, p) => s + p.horasReales, 0)}h</TableCell>
                  <TableCell className="text-right tabular-nums">{pagos.reduce((s, p) => s + p.horasTrabajadas, 0)}h</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(resumen.totalPropinas)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">{fmt(resumen.totalDescuentos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(resumen.totalExtras)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(resumen.totalBonus)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(pagos.reduce((s, p) => s + p.propinaMantenimiento, 0))}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{fmt(resumen.totalFinal)}</TableCell>
                  <TableCell className="text-center"><Badge variant={pagos.every(p => p.pagado) ? "default" : "secondary"} className="text-[10px]">{pagos.filter(p => p.pagado).length}/{pagos.length}</Badge></TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={open => !open && setEditando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar pago — {editando?.empleadoNombre}</DialogTitle></DialogHeader>
          {editando && <EditForm pago={editando} onSave={guardarEdicion} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({ pago, onSave }: { pago: PagoEmpleado; onSave: (d: Partial<PagoEmpleado>) => void }) {
  const [form, setForm] = useState({ ...pago });
  const campos: { key: keyof PagoEmpleado; label: string }[] = [
    { key: "pago", label: "Pago" }, { key: "nomina", label: "Nómina" }, { key: "propina", label: "Propina" },
    { key: "descuento", label: "Descuento" }, { key: "horasExtras", label: "H. Extras" },
    { key: "bonus", label: "Bonus" }, { key: "propinaMantenimiento", label: "Propina Mant." },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {campos.map(c => (
          <div key={c.key} className="space-y-1">
            <Label className="text-xs">{c.label}</Label>
            <Input type="number" value={form[c.key] as number} onChange={e => setForm(prev => ({ ...prev, [c.key]: Number(e.target.value) }))} />
          </div>
        ))}
      </div>
      <DialogFooter><Button onClick={() => onSave(form)}>Guardar</Button></DialogFooter>
    </div>
  );
}
