import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Departamento } from "@/features/ajustes/data/ajustes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export function DepartamentosTab() {
  const { ajustes, setAjustes } = useEmpresa();
  const [modalOpen, setModalOpen] = useState(false);
  const [editDept, setEditDept] = useState<Departamento | null>(null);

  const openNew = () => { setEditDept(null); setModalOpen(true); };
  const openEdit = (d: Departamento) => { setEditDept(d); setModalOpen(true); };

  const saveDept = (d: Departamento) => {
    setAjustes((prev) => {
      const exists = prev.departamentos.find((x) => x.id === d.id);
      const departamentos = exists ? prev.departamentos.map((x) => (x.id === d.id ? d : x)) : [...prev.departamentos, d];
      return { ...prev, departamentos };
    });
    setModalOpen(false);
    toast.success(editDept ? "Departamento actualizado" : "Departamento creado");
  };

  const toggleEstado = (id: string) => {
    setAjustes((prev) => ({
      ...prev,
      departamentos: prev.departamentos.map((d) => d.id === id ? { ...d, estado: d.estado === "Activo" ? "Inactivo" : "Activo" } as Departamento : d),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">DEPARTAMENTOS ({ajustes.departamentos.length})</h3>
        <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" /> CREAR DEPARTAMENTO</Button>
      </div>
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["NOMBRE", "RESPONSABLE", "CORREO", "TELÉFONO", "ESTADO", "ACCIONES"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ajustes.departamentos.map((d) => (
              <tr key={d.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">{d.nombre}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.responsable || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.correo || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.telefono || "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={`text-[10px] cursor-pointer ${d.estado === "Activo" ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-red-500/10 text-red-600 border-red-500/30"}`} onClick={() => toggleEstado(d.id)}>
                    {d.estado}
                  </Badge>
                </td>
                <td className="px-3 py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeptModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={saveDept} dept={editDept} />
    </div>
  );
}

function DeptModal({ open, onClose, onSave, dept }: { open: boolean; onClose: () => void; onSave: (d: Departamento) => void; dept: Departamento | null }) {
  const blank: Departamento = { id: crypto.randomUUID(), nombre: "", responsable: "", correo: "", telefono: "", descripcion: "", estado: "Activo" };
  const [form, setForm] = useState<Departamento>(dept ?? blank);
  if (dept && form.id !== dept.id) setForm(dept);

  const set = (k: keyof Departamento, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{dept ? "EDITAR DEPARTAMENTO" : "NUEVO DEPARTAMENTO"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2"><Label className="text-xs font-bold">NOMBRE</Label><Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
          <div><Label className="text-xs font-bold">RESPONSABLE</Label><Input value={form.responsable} onChange={(e) => set("responsable", e.target.value)} /></div>
          <div><Label className="text-xs font-bold">CORREO</Label><Input type="email" value={form.correo} onChange={(e) => set("correo", e.target.value)} /></div>
          <div><Label className="text-xs font-bold">TELÉFONO</Label><Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
          <div>
            <Label className="text-xs font-bold">ESTADO</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Activo">Activo</SelectItem><SelectItem value="Inactivo">Inactivo</SelectItem></SelectContent></Select>
          </div>
          <div className="col-span-2"><Label className="text-xs font-bold">DESCRIPCIÓN</Label><Textarea value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>CANCELAR</Button>
          <Button onClick={() => onSave(form)}>{dept ? "GUARDAR" : "CREAR"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
