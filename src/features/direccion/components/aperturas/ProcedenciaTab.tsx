import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { LineaProcedencia, ORIGENES_CAPITAL, OrigenCapital } from "@/features/direccion/data/aperturas";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const COLORS = ["hsl(210 70% 55%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)", "hsl(340 65% 55%)", "hsl(270 60% 55%)", "hsl(20 80% 55%)", "hsl(180 60% 45%)", "hsl(0 60% 55%)"];

function fmt(n: number) { return n.toLocaleString("es-ES", { maximumFractionDigits: 2 }); }

function emptyLinea(): LineaProcedencia {
  return { id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fecha: new Date().toISOString().split("T")[0], origen: "Fondos propios", entidad: "", destino: "", baseImponible: 0, ivaPct: 0, total: 0, medioPago: "Banco" };
}

interface Props {
  lineas: LineaProcedencia[];
  onChange: (l: LineaProcedencia[]) => void;
  readOnly?: boolean;
}

export function ProcedenciaTab({ lineas, onChange, readOnly = false }: Props) {
  const [editing, setEditing] = useState<LineaProcedencia | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const totalCapital = lineas.reduce((s, l) => s + l.total, 0);

  const porOrigen = ORIGENES_CAPITAL.map(o => ({ name: o, value: lineas.filter(l => l.origen === o).reduce((s, l) => s + l.total, 0) })).filter(d => d.value > 0);

  const openNew = () => { setEditing(emptyLinea()); setIsNew(true); };
  const openEdit = (l: LineaProcedencia) => { setEditing({ ...l }); setIsNew(false); };
  const save = () => {
    if (!editing) return;
    if (isNew) onChange([...lineas, editing]);
    else onChange(lineas.map(l => l.id === editing.id ? editing : l));
    setEditing(null);
  };
  const remove = async (id: string) => {
    const linea = lineas.find(l => l.id === id);
    const detalle = linea ? `${linea.entidad || linea.origen}` : "";
    const ok = await confirmDelete({
      title: "¿Borrar esta línea de procedencia?",
      description: detalle
        ? `Se eliminará "${detalle}". Esta acción no se puede deshacer.`
        : "Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    onChange(lineas.filter(l => l.id !== id));
  };
  const upd = (field: keyof LineaProcedencia, val: unknown) => setEditing(prev => prev ? { ...prev, [field]: val } : null);

  return (
    <div className="space-y-6">
      {confirmDeleteDialog}
      {/* Resumen */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{fmt(totalCapital)}€</p><p className="text-xs text-muted-foreground">Capital total previsto</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{lineas.length}</p><p className="text-xs text-muted-foreground">Líneas registradas</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{porOrigen.length}</p><p className="text-xs text-muted-foreground">Fuentes de capital</p></CardContent></Card>
      </div>

      {/* Gráficas */}
      {porOrigen.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Distribución por origen</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={porOrigen} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {porOrigen.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Capital por origen</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={porOrigen} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                  <Bar dataKey="value" fill="hsl(210 70% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Procedencia del capital</CardTitle>
          {!readOnly && (
            <Button variant="primary" size="sm" onClick={openNew}><Plus className="h-4 w-4" />Nuevo</Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40">
                <th className="text-left p-2.5 font-medium">Fecha</th>
                <th className="text-left p-2.5 font-medium">Origen</th>
                <th className="text-left p-2.5 font-medium">Entidad</th>
                <th className="text-left p-2.5 font-medium">Destino</th>
                <th className="text-right p-2.5 font-medium">Base imp.</th>
                <th className="text-right p-2.5 font-medium">IVA %</th>
                <th className="text-right p-2.5 font-medium">Total</th>
                <th className="text-left p-2.5 font-medium">Medio pago</th>
                <th className="p-2.5 w-20"></th>
              </tr></thead>
              <tbody>
                {lineas.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className="p-2.5">{l.fecha}</td>
                    <td className="p-2.5"><Badge variant="outline" className="text-xs">{l.origen}</Badge></td>
                    <td className="p-2.5">{l.entidad}</td>
                    <td className="p-2.5">{l.destino}</td>
                    <td className="p-2.5 text-right">{l.baseImponible ? `${fmt(l.baseImponible)}€` : "—"}</td>
                    <td className="p-2.5 text-right">{l.ivaPct || "—"}</td>
                    <td className="p-2.5 text-right font-semibold">{fmt(l.total)}€</td>
                    <td className="p-2.5"><Badge variant="secondary" className="text-xs">{l.medioPago}</Badge></td>
                    <td className="p-2.5 flex gap-1">
                      {!readOnly && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sin registros de procedencia</td></tr>}
              </tbody>
              {lineas.length > 0 && (
                <tfoot><tr className="bg-muted/30 font-semibold">
                  <td colSpan={6} className="p-2.5 text-right">TOTAL</td>
                  <td className="p-2.5 text-right">{fmt(totalCapital)}€</td>
                  <td colSpan={2}></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal edición */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isNew ? "Nueva línea de procedencia" : "Editar procedencia"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha</Label><Input type="date" value={editing.fecha} onChange={e => upd("fecha", e.target.value)} /></div>
                <div><Label>Origen</Label>
                  <Select value={editing.origen} onValueChange={v => upd("origen", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ORIGENES_CAPITAL.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Entidad</Label><Input value={editing.entidad} onChange={e => upd("entidad", e.target.value)} /></div>
                <div><Label>Destino</Label><Input value={editing.destino} onChange={e => upd("destino", e.target.value)} /></div>
                <div><Label>Base imponible</Label><Input type="number" value={editing.baseImponible || ""} onChange={e => upd("baseImponible", Number(e.target.value))} /></div>
                <div><Label>IVA %</Label><Input type="number" value={editing.ivaPct || ""} onChange={e => upd("ivaPct", Number(e.target.value))} /></div>
                <div><Label>Total</Label><Input type="number" value={editing.total || ""} onChange={e => upd("total", Number(e.target.value))} /></div>
                <div><Label>Medio de pago</Label><Input value={editing.medioPago} onChange={e => upd("medioPago", e.target.value)} /></div>
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
