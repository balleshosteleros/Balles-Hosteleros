import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Search, Plus, Users, Star, UserCheck, UserX } from "lucide-react";
import { SAMPLE_CLIENTES, Cliente, ClasificacionCliente } from "@/data/clientes";

const clasificacionBadge: Record<ClasificacionCliente, string> = {
  "VIP": "bg-amber-100 text-amber-800 border-amber-300",
  "FRECUENTE": "bg-green-100 text-green-800 border-green-300",
  "REGULAR": "bg-blue-100 text-blue-800 border-blue-300",
  "NUEVO": "bg-purple-100 text-purple-800 border-purple-300",
  "INACTIVO": "bg-muted text-muted-foreground",
};

export default function SalaClientes() {
  const { empresaActual } = useEmpresa();
  const [clientes] = useState<Cliente[]>(SAMPLE_CLIENTES);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const filtrados = clientes.filter(c => {
    const matchBusqueda = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.telefono.includes(busqueda) || c.email.toLowerCase().includes(busqueda.toLowerCase());
    const matchFiltro = filtro === "TODOS" || c.clasificacion === filtro;
    return matchBusqueda && matchFiltro;
  });

  const vips = clientes.filter(c => c.clasificacion === "VIP").length;
  const frecuentes = clientes.filter(c => c.clasificacion === "FRECUENTE").length;
  const inactivos = clientes.filter(c => c.clasificacion === "INACTIVO").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CLIENTES</h1>
          <p className="text-muted-foreground text-sm">{empresaActual.nombre} — Base de datos de clientes</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" />Nuevo cliente</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{clientes.length}</p><p className="text-xs text-muted-foreground">Total clientes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><Star className="h-4 w-4 text-amber-500" /><p className="text-2xl font-bold">{vips}</p></div><p className="text-xs text-muted-foreground">VIP</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><UserCheck className="h-4 w-4 text-green-500" /><p className="text-2xl font-bold">{frecuentes}</p></div><p className="text-xs text-muted-foreground">Frecuentes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><UserX className="h-4 w-4 text-muted-foreground" /><p className="text-2xl font-bold">{inactivos}</p></div><p className="text-xs text-muted-foreground">Inactivos</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, teléfono o email..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas</SelectItem>
            {(["VIP", "FRECUENTE", "REGULAR", "NUEVO", "INACTIVO"] as ClasificacionCliente[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Teléfono</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Clasificación</th>
              <th className="text-left p-3 font-medium">Visitas</th>
              <th className="text-left p-3 font-medium">Última visita</th>
              <th className="text-left p-3 font-medium">Observaciones</th>
            </tr></thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCliente(c)}>
                  <td className="p-3 font-medium">{c.nombre}</td>
                  <td className="p-3">{c.telefono}</td>
                  <td className="p-3">{c.email || "—"}</td>
                  <td className="p-3"><Badge className={clasificacionBadge[c.clasificacion]} variant="outline">{c.clasificacion}</Badge></td>
                  <td className="p-3">{c.visitas}</td>
                  <td className="p-3">{c.ultimaVisita}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[200px]">{c.observaciones || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ficha de cliente</DialogTitle></DialogHeader>
          {selectedCliente && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Nombre</Label><p className="font-medium">{selectedCliente.nombre}</p></div>
                <div><Label className="text-muted-foreground">Clasificación</Label><Badge className={`ml-1 ${clasificacionBadge[selectedCliente.clasificacion]}`} variant="outline">{selectedCliente.clasificacion}</Badge></div>
                <div><Label className="text-muted-foreground">Teléfono</Label><p>{selectedCliente.telefono}</p></div>
                <div><Label className="text-muted-foreground">Email</Label><p>{selectedCliente.email || "—"}</p></div>
                <div><Label className="text-muted-foreground">Visitas</Label><p>{selectedCliente.visitas}</p></div>
                <div><Label className="text-muted-foreground">Última visita</Label><p>{selectedCliente.ultimaVisita}</p></div>
              </div>
              {selectedCliente.observaciones && <div><Label className="text-muted-foreground">Observaciones</Label><p>{selectedCliente.observaciones}</p></div>}
              {selectedCliente.preferencias && <div><Label className="text-muted-foreground">Preferencias</Label><p>{selectedCliente.preferencias}</p></div>}
              {selectedCliente.notasInternas && <div><Label className="text-muted-foreground">Notas internas</Label><p>{selectedCliente.notasInternas}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
