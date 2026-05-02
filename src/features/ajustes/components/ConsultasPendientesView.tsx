"use client";

import { useState, useMemo } from "react";
import { useAyuda } from "@/features/ajustes/contexts/ayuda-context";
import { ArticuloAyuda, MODULOS_AYUDA, ModuloAyuda } from "@/features/ajustes/data/ayuda";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BookPlus, Eye, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";

const ROLES = ["Administrador", "Gerencia", "Contabilidad", "Gestoría", "Jurídico", "Recursos Humanos", "Logística", "Marketing", "Solo lectura"];

export function ConsultasPendientesView() {
  const { consultas, resolverConsulta, articulos, setArticulos } = useAyuda();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [form, setForm] = useState({ titulo: "", respuesta: "", modulo: "Dashboard" as ModuloAyuda, rolesAutorizados: ["Administrador"] as string[], validada: true });

  const pendientes = consultas.filter((c) => c.estado === "pendiente");
  const resueltas = consultas.filter((c) => c.estado === "resuelta");

  const abrirConversion = (id: string) => {
    const c = consultas.find((x) => x.id === id);
    if (!c) return;
    setSelectedId(id);
    setForm({ titulo: c.pregunta, respuesta: "", modulo: "Dashboard", rolesAutorizados: ["Administrador"], validada: true });
    setModalOpen(true);
  };

  const convertir = () => {
    if (!form.titulo.trim() || !form.respuesta.trim()) { toast.error("Completa título y respuesta"); return; }
    const now = new Date().toISOString().slice(0, 16).replace("T", " ");
    const nuevo: ArticuloAyuda = {
      id: `art-${Date.now()}`, titulo: form.titulo, respuesta: form.respuesta,
      modulo: form.modulo, rolesAutorizados: form.rolesAutorizados,
      etiquetas: [], validada: form.validada, creadoEn: now, actualizadoEn: now,
    };
    setArticulos((prev) => [...prev, nuevo]);
    if (selectedId) resolverConsulta(selectedId, nuevo.id);
    toast.success("Duda convertida en conocimiento");
    setModalOpen(false);
  };

  const toggleRol = (rol: string) => {
    setForm((f) => ({
      ...f,
      rolesAutorizados: f.rolesAutorizados.includes(rol)
        ? f.rolesAutorizados.filter((r) => r !== rol)
        : [...f.rolesAutorizados, rol],
    }));
  };

  const selected = detailId ? consultas.find((c) => c.id === detailId) : null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{consultas.length}</p>
            <p className="text-xs text-muted-foreground">Total consultas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{pendientes.length}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{resueltas.length}</p>
            <p className="text-xs text-muted-foreground">Resueltas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consultas registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {consultas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay consultas pendientes registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pregunta</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm max-w-[250px] truncate">{c.pregunta}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.empresaNombre}</Badge></TableCell>
                    <TableCell className="text-xs">{c.rolUsuario}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.fecha}</TableCell>
                    <TableCell>
                      {c.estado === "pendiente"
                        ? <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 gap-1"><Clock className="h-3 w-3" />Pendiente</Badge>
                        : <Badge className="bg-green-100 text-green-700 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Resuelta</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setDetailId(c.id); setDetailOpen(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {c.estado === "pendiente" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => abrirConversion(c.id)}>
                            <BookPlus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de consulta</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Pregunta:</span> {selected.pregunta}</div>
              <div><span className="font-medium">Respuesta mostrada:</span> {selected.respuestaMostrada || "—"}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium">Usuario:</span> {selected.usuario}</div>
                <div><span className="font-medium">Empresa:</span> {selected.empresaNombre}</div>
                <div><span className="font-medium">Rol:</span> {selected.rolUsuario}</div>
                <div><span className="font-medium">Fecha:</span> {selected.fecha}</div>
              </div>
              <div><span className="font-medium">Estado:</span> <Badge variant={selected.estado === "pendiente" ? "outline" : "default"} className="text-[10px] ml-1">{selected.estado}</Badge></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convertir en conocimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título / Pregunta</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Respuesta oficial</Label>
              <Textarea value={form.respuesta} onChange={(e) => setForm((f) => ({ ...f, respuesta: e.target.value }))} rows={5} placeholder="Redacta la respuesta oficial..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Módulo</Label>
                <Select value={form.modulo} onValueChange={(v) => setForm((f) => ({ ...f, modulo: v as ModuloAyuda }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULOS_AYUDA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.validada} onCheckedChange={(v) => setForm((f) => ({ ...f, validada: v }))} />
                  <Label>Validada</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Roles autorizados</Label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.rolesAutorizados.includes(r)} onCheckedChange={() => toggleRol(r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={convertir}>Crear y resolver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
