"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getPagosPorEmpresa, getResumenPagos, type PagoEmpleado } from "@/features/rrhh/data/pagos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Edit2, Banknote, TrendingUp, TrendingDown, PiggyBank, HandCoins, Wallet } from "lucide-react";

const periodos = [
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "anterior", label: "Mes anterior" },
];

export default function RRHHPagosPage() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState("mes");
  const [filtroPagado, setFiltroPagado] = useState<string>("todos");
  const [editando, setEditando] = useState<PagoEmpleado | null>(null);
  const [pagos, setPagos] = useState<PagoEmpleado[]>([]);
  const [initialized, setInitialized] = useState("");

  if (initialized !== empresaActual.id) {
    setPagos(getPagosPorEmpresa(empresaActual.id));
    setInitialized(empresaActual.id);
  }

  const pagosFiltrados = useMemo(() => {
    let resultado = pagos;
    if (busqueda) { const q = busqueda.toLowerCase(); resultado = resultado.filter(p => p.empleadoNombre.toLowerCase().includes(q)); }
    if (filtroPagado === "pagado") resultado = resultado.filter(p => p.pagado);
    if (filtroPagado === "pendiente") resultado = resultado.filter(p => !p.pagado);
    return resultado;
  }, [pagos, busqueda, filtroPagado]);

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

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{periodos.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filtroPagado} onValueChange={setFiltroPagado}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pagado">Pagados</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Control de pagos en efectivo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[180px]">Empleado</TableHead>
                  <TableHead className="text-center w-[60px]">Fijo</TableHead>
                  <TableHead className="text-right">Pago</TableHead><TableHead className="text-right">Nómina</TableHead>
                  <TableHead className="text-right">H.R</TableHead><TableHead className="text-right">H.T</TableHead>
                  <TableHead className="text-right">Propina</TableHead><TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">H.Extras</TableHead><TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Prop. Mant.</TableHead><TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead className="text-center w-[80px]">Pagado</TableHead><TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagosFiltrados.map(p => (
                  <TableRow key={p.id} className={p.pagado ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}>
                    <TableCell className="font-medium">{p.empleadoNombre}</TableCell>
                    <TableCell className="text-center">{p.fijo ? <Badge variant="secondary" className="text-[10px]">FIJO</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.pago)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.nomina)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.horasReales}h</TableCell>
                    <TableCell className="text-right tabular-nums">{p.horasTrabajadas}h</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.propina)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{p.descuento > 0 ? `-${fmt(p.descuento)}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.horasExtras > 0 ? fmt(p.horasExtras) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.bonus > 0 ? fmt(p.bonus) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.propinaMantenimiento > 0 ? fmt(p.propinaMantenimiento) : "—"}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{fmt(p.total)}</TableCell>
                    <TableCell className="text-center"><Checkbox checked={p.pagado} onCheckedChange={() => togglePagado(p.id)} /></TableCell>
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
