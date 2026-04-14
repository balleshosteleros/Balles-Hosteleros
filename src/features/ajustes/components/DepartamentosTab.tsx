import { useState, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Departamento } from "@/features/ajustes/data/ajustes";
import { getEmployees } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface UsuarioOption {
  id: string;
  nombre: string;
}

function getNombreFromProfile(p: Record<string, unknown>): string {
  const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim();
  if (nombre) return nombre;
  if (p.full_name) return p.full_name as string;
  return (p.email as string) ?? "—";
}

export function DepartamentosTab() {
  const { ajustes, setAjustes } = useEmpresa();

  // Usuarios cargados desde Supabase (misma fuente que UsuariosTab)
  const [usuariosSupabase, setUsuariosSupabase] = useState<UsuarioOption[]>([]);

  const loadUsuarios = useCallback(async () => {
    try {
      const result = await getEmployees();
      const profiles = (result.data ?? []) as Record<string, unknown>[];
      setUsuariosSupabase(
        profiles.map((p) => ({ id: p.id as string, nombre: getNombreFromProfile(p) }))
      );
    } catch {
      // Sin Supabase configurado: dejar lista vacía
    }
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  const getNombreResponsable = (id: string) => {
    if (!id) return "—";
    const u = usuariosSupabase.find((u) => u.id === id);
    return u ? u.nombre : "—";
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editDept, setEditDept] = useState<Departamento | null>(null);
  const [deleteDept, setDeleteDept] = useState<Departamento | null>(null);

  const openNew = () => { setEditDept(null); setModalOpen(true); };
  const openEdit = (d: Departamento) => { setEditDept(d); setModalOpen(true); };

  const saveDept = (d: Departamento) => {
    setAjustes((prev) => {
      const exists = prev.departamentos.find((x) => x.id === d.id);
      const departamentos = exists
        ? prev.departamentos.map((x) => (x.id === d.id ? d : x))
        : [...prev.departamentos, d];
      return { ...prev, departamentos };
    });
    setModalOpen(false);
    toast.success(editDept ? "Departamento actualizado" : "Departamento creado");
  };

  const confirmDelete = () => {
    if (!deleteDept) return;
    setAjustes((prev) => ({
      ...prev,
      departamentos: prev.departamentos.filter((d) => d.id !== deleteDept.id),
    }));
    toast.success("Departamento eliminado");
    setDeleteDept(null);
  };

  const toggleEstado = (id: string) => {
    setAjustes((prev) => ({
      ...prev,
      departamentos: prev.departamentos.map((d) =>
        d.id === id
          ? { ...d, estado: d.estado === "Activo" ? "Inactivo" : "Activo" } as Departamento
          : d
      ),
    }));
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["NOMBRE", "RESPONSABLE", "ESTADO", "ACCIONES"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ajustes.departamentos.map((d) => (
              <tr key={d.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">{d.nombre}</td>
                <td className="px-3 py-2 text-muted-foreground">{getNombreResponsable(d.responsableId)}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] cursor-pointer ${
                      d.estado === "Activo"
                        ? "bg-green-500/10 text-green-600 border-green-500/30"
                        : "bg-red-500/10 text-red-600 border-red-500/30"
                    }`}
                    onClick={() => toggleEstado(d.id)}
                  >
                    {d.estado}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteDept(d)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveDept}
        dept={editDept}
        usuarios={usuariosSupabase}
      />

      <AlertDialog open={!!deleteDept} onOpenChange={(o) => !o && setDeleteDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteDept?.nombre}</strong> permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCELAR</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={confirmDelete}
            >
              ELIMINAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeptModal({
  open, onClose, onSave, dept, usuarios,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: Departamento) => void;
  dept: Departamento | null;
  usuarios: UsuarioOption[];
}) {
  const blank = (): Departamento => ({
    id: crypto.randomUUID(),
    nombre: "",
    responsableId: "",
    descripcion: "",
    estado: "Activo",
  });

  const [form, setForm] = useState<Departamento>(blank);

  useEffect(() => {
    if (open) setForm(dept ?? blank());
  }, [open, dept]);

  const set = (k: keyof Departamento, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dept ? "EDITAR DEPARTAMENTO" : "NUEVO DEPARTAMENTO"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2">
            <Label className="text-xs font-bold">NOMBRE</Label>
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label className="text-xs font-bold">RESPONSABLE</Label>
            <Select
              value={form.responsableId || "__none__"}
              onValueChange={(v) => set("responsableId", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin responsable</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usuarios.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay usuarios registrados.</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-bold">ESTADO</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label className="text-xs font-bold">DESCRIPCIÓN</Label>
            <Textarea value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>CANCELAR</Button>
          <Button onClick={() => onSave(form)}>{dept ? "GUARDAR" : "CREAR"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
