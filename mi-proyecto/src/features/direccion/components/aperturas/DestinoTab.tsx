import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { LineaDestino, CATEGORIAS_DESTINO, CategoriaDestino } from "@/features/direccion/data/aperturas";

const COLORS = ["hsl(210 70% 55%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)", "hsl(340 65% 55%)", "hsl(270 60% 55%)", "hsl(20 80% 55%)", "hsl(180 60% 45%)", "hsl(0 60% 55%)", "hsl(300 50% 50%)", "hsl(60 70% 45%)"];

function fmt(n: number) { return n.toLocaleString("es-ES", { maximumFractionDigits: 2 }); }

function emptyLinea(): LineaDestino {
  return { id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fecha: new Date().toISOString().split("T")[0], tipo: "Otros", traspaso: false, destino: "", pagadoCon: "", concepto: "", declarado: true, factura: true, baseImponible: 0, ivaPct: 21, total: 0 };
}

interface Props {
  lineas: LineaDestino[];
  onChange: (l: LineaDestino[]) => void;
  totalCapital: number;
}

export function DestinoTab({ lineas, onChange, totalCapital }: Props) {
  const [editing, setEditing] = useState<LineaDestino | null>(null);
  const [isNew, setIsNew] = useState(false);

  const totalInversion = lineas.reduce((s, l) => s + l.total, 0);
  const diferencia = totalCapital - totalInversion;

  const porCategoria = CATEGORIAS_DESTINO.map(c => ({ name: c, value: lineas.filter(l => l.tipo === c).reduce((s, l) => s + l.total, 0) })).filter(d => d.value > 0);

  const openNew = () => { setEditing(emptyLinea()); setIsNew(true); };
  const openEdit = (l: LineaDestino) => { setEditing({ ...l }); setIsNew(false); };
  const save = () => {
    if (!editing) return;
    if (isNew) onChange([...lineas, editing]);
    else onChange(lineas.map(l => l.id === editing.id ? editing : l));
    setEditing(null);
  };
  const remove = (id: string) => onChange(lineas.filter(l => l.id !== id));
  const upd = (field: keyof LineaDestino, val: any) => setEditing(prev => prev ? { ...prev, [field]: val } : null);

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(totalCapital)}€</p><p className="text-xs text-muted-foreground">Capital disponible</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(totalInversion)}€</p><p className="text-xs text-muted-foreground">Inversión total</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${diferencia >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(diferencia)}€</p><p className="text-xs text-muted-foreground">Diferencia</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{porCategoria.length}</p><p className="text-xs text-muted-foreground">Categorías de gasto</p></CardContent></Card>
      </div>

      {/* Gráficas */}
      {porCategoria.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Distribución de inversión por categoría</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Capital vs Inversión</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[{ name: "Capital", value: totalCapital }, { name: "Inversión", value: totalInversion }]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="hsl(210 70% 55%)" />
                    <Cell fill="hsl(340 65% 55%)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Destino de la inversión</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Añadir</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40">
                <th className="text-left p-2 font-medium">Fecha</th>
                <th className="text-left p-2 font-medium">Tipo</th>
                <th className="text-left p-2 font-medium">Trasp.</th>
                <th className="text-left p-2 font-medium">Destino</th>
                <th className="text-left p-2 font-medium">Pagado con</th>
                <th className="text-left p-2 font-medium">Concepto</th>
                <th className="text-center p-2 font-medium">Decl.</th>
                <th className="text-center p-2 font-medium">Fact.</th>
                <th className="text-right p-2 font-medium">Base imp.</th>
                <th className="text-right p-2 font-medium">IVA%</th>
                <th className="text-right p-2 font-medium">Total</th>
                <th className="p-2 w-20"></th>
              </tr></thead>
              <tbody>
                {lineas.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap">{l.fecha}</td>
                    <td className="p-2"><Badge variant="outline" className="text-xs">{l.tipo}</Badge></td>
                    <td className="p-2 text-center">{l.traspaso ? "Sí" : "No"}</td>
                    <td className="p-2">{l.destino}</td>
                    <td className="p-2">{l.pagadoCon}</td>
                    <td className="p-2 max-w-[180px] truncate">{l.concepto}</td>
                    <td className="p-2 text-center">{l.declarado ? <Badge variant="secondary" className="text-[10px]">Sí</Badge> : "No"}</td>
                    <td className="p-2 text-center">{l.factura ? <Badge variant="secondary" className="text-[10px]">Sí</Badge> : "No"}</td>
                    <td className="p-2 text-right">{fmt(l.baseImponible)}€</td>
                    <td className="p-2 text-right">{l.ivaPct}%</td>
                    <td className="p-2 text-right font-semibold">{fmt(l.total)}€</td>
                    <td className="p-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Sin registros de destino</td></tr>}
              </tbody>
              {lineas.length > 0 && (
                <tfoot><tr className="bg-muted/30 font-semibold">
                  <td colSpan={10} className="p-2 text-right">TOTAL INVERSIÓN</td>
                  <td className="p-2 text-right">{fmt(totalInversion)}€</td>
                  <td></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isNew ? "Nuevo gasto de inversión" : "Editar gasto"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha</Label><Input type="date" value={editing.fecha} onChange={e => upd("fecha", e.target.value)} /></div>
                <div><Label>Tipo</Label>
                  <Select value={editing.tipo} onValueChange={v => upd("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_DESTINO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Destino</Label><Input value={editing.destino} onChange={e => upd("destino", e.target.value)} /></div>
                <div><Label>Pagado con</Label><Input value={editing.pagadoCon} onChange={e => upd("pagadoCon", e.target.value)} /></div>
                <div className="col-span-2"><Label>Concepto</Label><Input value={editing.concepto} onChange={e => upd("concepto", e.target.value)} /></div>
                <div><Label>Base imponible</Label><Input type="number" value={editing.baseImponible || ""} onChange={e => upd("baseImponible", Number(e.target.value))} /></div>
                <div><Label>IVA %</Label><Input type="number" value={editing.ivaPct || ""} onChange={e => upd("ivaPct", Number(e.target.value))} /></div>
                <div><Label>Total</Label><Input type="number" value={editing.total || ""} onChange={e => upd("total", Number(e.target.value))} /></div>
              </div>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.traspaso} onCheckedChange={v => upd("traspaso", !!v)} />Traspaso</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.declarado} onCheckedChange={v => upd("declarado", !!v)} />Declarado</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.factura} onCheckedChange={v => upd("factura", !!v)} />Factura</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={save}>Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
