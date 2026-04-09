import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { LineaAmortizacion, TIPOS_AMORTIZACION, TipoAmortizacion, MESES, TRIMESTRES } from "@/features/direccion/data/aperturas";

function fmt(n: number) { return n.toLocaleString("es-ES", { maximumFractionDigits: 2 }); }

function emptyLinea(): LineaAmortizacion {
  return { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fecha: new Date().toISOString().split("T")[0], ano: new Date().getFullYear(), trimestre: "1T", mes: "Enero", tipo: "Balance", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 };
}

interface Props {
  lineas: LineaAmortizacion[];
  onChange: (l: LineaAmortizacion[]) => void;
}

export function AmortizacionTab({ lineas, onChange }: Props) {
  const [editing, setEditing] = useState<LineaAmortizacion | null>(null);
  const [isNew, setIsNew] = useState(false);

  const totalAmort = lineas.reduce((s, l) => s + l.total, 0);
  const totalIntereses = lineas.reduce((s, l) => s + l.intereses, 0);

  // Agrupar por trimestre para gráfica
  const porTrimestre: Record<string, { balance: number; iva: number }> = {};
  lineas.forEach(l => {
    const key = `${l.ano} ${l.trimestre}`;
    if (!porTrimestre[key]) porTrimestre[key] = { balance: 0, iva: 0 };
    if (l.tipo === "Balance") porTrimestre[key].balance += l.total;
    else porTrimestre[key].iva += l.total;
  });
  const chartData = Object.entries(porTrimestre).map(([name, v]) => ({ name, Balance: v.balance, "IVA Soportado": v.iva }));

  const openNew = () => { setEditing(emptyLinea()); setIsNew(true); };
  const openEdit = (l: LineaAmortizacion) => { setEditing({ ...l }); setIsNew(false); };
  const save = () => {
    if (!editing) return;
    if (isNew) onChange([...lineas, editing]);
    else onChange(lineas.map(l => l.id === editing.id ? editing : l));
    setEditing(null);
  };
  const remove = (id: string) => onChange(lineas.filter(l => l.id !== id));
  const upd = (field: keyof LineaAmortizacion, val: any) => setEditing(prev => prev ? { ...prev, [field]: val } : null);

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(totalAmort)}€</p><p className="text-xs text-muted-foreground">Total amortización</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(totalIntereses)}€</p><p className="text-xs text-muted-foreground">Total intereses</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{lineas.length}</p><p className="text-xs text-muted-foreground">Registros</p></CardContent></Card>
      </div>

      {/* Gráfica */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolución por trimestre</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                <Legend />
                <Bar dataKey="Balance" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="IVA Soportado" fill="hsl(150 60% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Amortización y seguimiento financiero</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Añadir</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40">
                <th className="text-left p-2 font-medium">Fecha</th>
                <th className="text-left p-2 font-medium">Año</th>
                <th className="text-left p-2 font-medium">Trim.</th>
                <th className="text-left p-2 font-medium">Mes</th>
                <th className="text-left p-2 font-medium">Tipo</th>
                <th className="text-right p-2 font-medium">Base imp.</th>
                <th className="text-right p-2 font-medium">IVA%</th>
                <th className="text-right p-2 font-medium">Intereses</th>
                <th className="text-right p-2 font-medium">Total</th>
                <th className="p-2 w-20"></th>
              </tr></thead>
              <tbody>
                {lineas.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap">{l.fecha}</td>
                    <td className="p-2">{l.ano}</td>
                    <td className="p-2"><Badge variant="outline" className="text-xs">{l.trimestre}</Badge></td>
                    <td className="p-2">{l.mes}</td>
                    <td className="p-2"><Badge variant={l.tipo === "Balance" ? "secondary" : "outline"} className="text-xs">{l.tipo}</Badge></td>
                    <td className="p-2 text-right">{l.baseImponible ? `${fmt(l.baseImponible)}€` : "—"}</td>
                    <td className="p-2 text-right">{l.ivaPct || "—"}</td>
                    <td className="p-2 text-right">{l.intereses ? `${fmt(l.intereses)}€` : "—"}</td>
                    <td className="p-2 text-right font-semibold">{fmt(l.total)}€</td>
                    <td className="p-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Sin registros de amortización</td></tr>}
              </tbody>
              {lineas.length > 0 && (
                <tfoot><tr className="bg-muted/30 font-semibold">
                  <td colSpan={8} className="p-2 text-right">TOTAL</td>
                  <td className="p-2 text-right">{fmt(totalAmort)}€</td>
                  <td></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isNew ? "Nuevo registro de amortización" : "Editar registro"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha</Label><Input type="date" value={editing.fecha} onChange={e => upd("fecha", e.target.value)} /></div>
                <div><Label>Año</Label><Input type="number" value={editing.ano} onChange={e => upd("ano", Number(e.target.value))} /></div>
                <div><Label>Trimestre</Label>
                  <Select value={editing.trimestre} onValueChange={v => upd("trimestre", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRIMESTRES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Mes</Label>
                  <Select value={editing.mes} onValueChange={v => upd("mes", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Tipo</Label>
                  <Select value={editing.tipo} onValueChange={v => upd("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_AMORTIZACION.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Base imponible</Label><Input type="number" value={editing.baseImponible || ""} onChange={e => upd("baseImponible", Number(e.target.value))} /></div>
                <div><Label>IVA %</Label><Input type="number" value={editing.ivaPct || ""} onChange={e => upd("ivaPct", Number(e.target.value))} /></div>
                <div><Label>Intereses</Label><Input type="number" value={editing.intereses || ""} onChange={e => upd("intereses", Number(e.target.value))} /></div>
                <div><Label>Total</Label><Input type="number" value={editing.total || ""} onChange={e => upd("total", Number(e.target.value))} /></div>
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
