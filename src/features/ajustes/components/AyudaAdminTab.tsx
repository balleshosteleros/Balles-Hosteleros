import { useState } from "react";
import { useAyuda } from "@/features/ajustes/contexts/ayuda-context";
import { ArticuloAyuda, MODULOS_AYUDA, ModuloAyuda } from "@/features/ajustes/data/ayuda";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, BookOpen, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["Administrador", "Gerencia", "Contabilidad", "Gestoría", "Jurídico", "Recursos Humanos", "Logística", "Marketing", "Solo lectura"];

const emptyArticulo: Omit<ArticuloAyuda, "id" | "creadoEn" | "actualizadoEn"> = {
  titulo: "", respuesta: "", modulo: "Dashboard", rolesAutorizados: ["Administrador"], etiquetas: [], validada: false,
};

export function AyudaAdminTab() {
  const { articulos, setArticulos } = useAyuda();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<ArticuloAyuda | null>(null);
  const [form, setForm] = useState(emptyArticulo);
  const [etiquetaInput, setEtiquetaInput] = useState("");

  const abrir = (art?: ArticuloAyuda) => {
    if (art) {
      setEditando(art);
      setForm({ titulo: art.titulo, respuesta: art.respuesta, modulo: art.modulo, rolesAutorizados: [...art.rolesAutorizados], etiquetas: [...art.etiquetas], validada: art.validada });
    } else {
      setEditando(null);
      setForm({ ...emptyArticulo, rolesAutorizados: ["Administrador"], etiquetas: [] });
    }
    setEtiquetaInput("");
    setModalOpen(true);
  };

  const guardar = () => {
    if (!form.titulo.trim() || !form.respuesta.trim()) { toast.error("Completa título y respuesta"); return; }
    const now = new Date().toISOString().slice(0, 16).replace("T", " ");
    if (editando) {
      setArticulos((prev) => prev.map((a) => a.id === editando.id ? { ...a, ...form, actualizadoEn: now } : a));
      toast.success("Artículo actualizado");
    } else {
      const nuevo: ArticuloAyuda = { ...form, id: `art-${Date.now()}`, creadoEn: now, actualizadoEn: now };
      setArticulos((prev) => [...prev, nuevo]);
      toast.success("Artículo creado");
    }
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

  const addEtiqueta = () => {
    const tag = etiquetaInput.trim().toLowerCase();
    if (tag && !form.etiquetas.includes(tag)) {
      setForm((f) => ({ ...f, etiquetas: [...f.etiquetas, tag] }));
    }
    setEtiquetaInput("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Base de conocimiento
          </CardTitle>
          <Button size="sm" className="gap-1" onClick={() => abrir()}>
            <Plus className="h-4 w-4" /> Nuevo artículo
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {articulos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-sm max-w-[250px] truncate">{a.titulo}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{a.modulo}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-0.5">
                      {a.rolesAutorizados.slice(0, 2).map((r) => (
                        <Badge key={r} variant="secondary" className="text-[9px]">{r}</Badge>
                      ))}
                      {a.rolesAutorizados.length > 2 && (
                        <Badge variant="secondary" className="text-[9px]">+{a.rolesAutorizados.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.validada
                      ? <Badge className="bg-green-100 text-green-700 text-[10px] gap-1"><CheckCircle className="h-3 w-3" />Validada</Badge>
                      : <Badge variant="outline" className="text-[10px] gap-1"><Clock className="h-3 w-3" />Borrador</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.actualizadoEn}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrir(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Matriz módulo-rol */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Matriz de acceso por módulo y rol</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Artículos</TableHead>
                <TableHead>Roles con acceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULOS_AYUDA.map((mod) => {
                const arts = articulos.filter((a) => a.modulo === mod);
                const roles = [...new Set(arts.flatMap((a) => a.rolesAutorizados))];
                return (
                  <TableRow key={mod}>
                    <TableCell className="font-medium text-sm">{mod}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{arts.length}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {roles.length > 0 ? roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[9px]">{r}</Badge>
                        )) : <span className="text-xs text-muted-foreground">Sin artículos</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar artículo" : "Nuevo artículo de ayuda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título / Pregunta</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ej: ¿Cómo crear una incidencia?" />
            </div>
            <div className="space-y-1.5">
              <Label>Respuesta completa</Label>
              <Textarea value={form.respuesta} onChange={(e) => setForm((f) => ({ ...f, respuesta: e.target.value }))} rows={5} placeholder="Respuesta detallada..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Módulo</Label>
                <Select value={form.modulo} onValueChange={(v) => setForm((f) => ({ ...f, modulo: v as ModuloAyuda }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULOS_AYUDA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-end gap-3">
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
            <div className="space-y-1.5">
              <Label>Etiquetas</Label>
              <div className="flex gap-2">
                <Input value={etiquetaInput} onChange={(e) => setEtiquetaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEtiqueta(); } }}
                  placeholder="Añadir etiqueta..." className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addEtiqueta}>Añadir</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {form.etiquetas.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs cursor-pointer"
                    onClick={() => setForm((f) => ({ ...f, etiquetas: f.etiquetas.filter((e) => e !== t) }))}>
                    {t} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>{editando ? "Guardar cambios" : "Crear artículo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
