import { useState, useEffect, useCallback, useMemo } from "react";
import { Departamento, Rol } from "@/features/ajustes/data/ajustes";
import { getEmployees } from "@/actions/admin";
import {
  listDepartamentos,
  createDepartamento,
  updateDepartamento,
  deleteDepartamento,
  type DepartamentoRow,
} from "@/features/ajustes/actions/departamentos-actions";
import { loadRolesFromSupabase } from "@/features/ajustes/actions/roles-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface UsuarioOption {
  id: string;
  nombre: string;
  email: string;
  rolLabel: string;
}

function getNombreFromProfile(p: Record<string, unknown>): string {
  const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim();
  if (nombre) return nombre;
  if (p.full_name) return p.full_name as string;
  return (p.email as string) ?? "—";
}

function rowToDepartamento(r: DepartamentoRow): Departamento {
  return {
    id: r.id,
    nombre: r.nombre,
    responsableId: r.responsable_id ?? "",
    descripcion: r.descripcion,
    estado: r.estado,
  };
}

export function DepartamentosTab() {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  // Departamentos desde Supabase (fuente de verdad).
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDepartamentos = useCallback(async () => {
    setLoading(true);
    const rows = await listDepartamentos(empresaDbId);
    setDepartamentos(rows.map(rowToDepartamento));
    setLoading(false);
  }, [empresaDbId]);

  // Usuarios cargados desde Supabase (misma fuente que UsuariosTab)
  const [usuariosSupabase, setUsuariosSupabase] = useState<UsuarioOption[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);

  const loadUsuarios = useCallback(async () => {
    try {
      const result = await getEmployees();
      const profiles = (result.data ?? []) as Record<string, unknown>[];
      setUsuariosSupabase(
        profiles.map((p) => ({
          id: p.id as string,
          nombre: getNombreFromProfile(p),
          email: (p.email as string) ?? "",
          rolLabel: (p.rol_label as string | null)?.trim() ?? "",
        }))
      );
    } catch {
      // Sin Supabase configurado: dejar lista vacía
    }
  }, []);

  const loadRoles = useCallback(async () => {
    const rolesRemote = await loadRolesFromSupabase(empresaDbId);
    setRoles(rolesRemote ?? []);
  }, [empresaDbId]);

  useEffect(() => {
    loadDepartamentos();
    loadUsuarios();
    loadRoles();
  }, [loadDepartamentos, loadUsuarios, loadRoles]);

  const norm = (s: string) => s.trim().toLowerCase();

  // Por cada departamento, calcular usuarios con acceso (su rol tiene `ver:true` para ese módulo).
  const usuariosPorDept = useMemo(() => {
    const map = new Map<string, UsuarioOption[]>();
    for (const d of departamentos) {
      const deptKey = norm(d.nombre);
      const rolesConAcceso = new Set(
        roles
          .filter((r) => r.permisos.some((p) => norm(p.modulo) === deptKey && p.ver))
          .map((r) => norm(r.nombre))
      );
      const usuarios = usuariosSupabase.filter((u) => u.rolLabel && rolesConAcceso.has(norm(u.rolLabel)));
      map.set(d.id, usuarios);
    }
    return map;
  }, [departamentos, roles, usuariosSupabase]);

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

  const saveDept = async (d: Departamento) => {
    if (editDept) {
      const res = await updateDepartamento(d.id, {
        nombre: d.nombre,
        descripcion: d.descripcion,
        responsableId: d.responsableId || null,
        estado: d.estado,
        empresaId: empresaDbId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDepartamentos((prev) => prev.map((x) => (x.id === d.id ? rowToDepartamento(res.data!) : x)));
      setModalOpen(false);
      toast.success("Departamento actualizado");
    } else {
      const res = await createDepartamento({
        nombre: d.nombre,
        descripcion: d.descripcion,
        responsableId: d.responsableId || null,
        estado: d.estado,
        empresaId: empresaDbId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDepartamentos((prev) => [...prev, rowToDepartamento(res.data!)]);
      setModalOpen(false);
      toast.success(`Departamento creado · rol asociado disponible en pestaña Roles`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDept) return;
    const id = deleteDept.id;
    const nombre = deleteDept.nombre;
    setDeleteDept(null);
    const res = await deleteDepartamento(id, empresaDbId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setDepartamentos((prev) => prev.filter((d) => d.id !== id));
    toast.success(`Departamento "${nombre}" eliminado`);
  };

  const toggleEstado = async (d: Departamento) => {
    const nuevo = d.estado === "Activo" ? "Inactivo" : "Activo";
    setDepartamentos((prev) => prev.map((x) => (x.id === d.id ? { ...x, estado: nuevo } : x)));
    const res = await updateDepartamento(d.id, { estado: nuevo, empresaId: empresaDbId });
    if (res.error) {
      toast.error(res.error);
      // revertir
      setDepartamentos((prev) => prev.map((x) => (x.id === d.id ? { ...x, estado: d.estado } : x)));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["NOMBRE", "RESPONSABLE", "ESTADO", "ACCESOS", "ACCIONES"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {departamentos.map((d) => {
              const usuariosConAcceso = usuariosPorDept.get(d.id) ?? [];
              return (
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
                      onClick={() => toggleEstado(d)}
                    >
                      {d.estado}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          title={`${usuariosConAcceso.length} ${usuariosConAcceso.length === 1 ? "usuario" : "usuarios"} con acceso a este departamento`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-semibold tabular-nums">{usuariosConAcceso.length}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-0">
                        <div className="border-b px-3 py-2">
                          <p className="text-[10px] font-bold tracking-wider text-muted-foreground">USUARIOS CON ACCESO</p>
                          <p className="text-sm font-semibold">{d.nombre} · {usuariosConAcceso.length}</p>
                        </div>
                        {usuariosConAcceso.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                            Ningún usuario tiene acceso a este departamento.
                          </div>
                        ) : (
                          <ul className="max-h-64 overflow-y-auto py-1">
                            {usuariosConAcceso.map((u) => (
                              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-muted/50">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{u.nombre}</p>
                                  {u.email && (
                                    <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                                  )}
                                </div>
                                {u.rolLabel && (
                                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    {u.rolLabel}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </PopoverContent>
                    </Popover>
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
              );
            })}
            {loading && (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Cargando departamentos…</td></tr>
            )}
            {!loading && departamentos.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No hay departamentos. Crea uno con el botón Nuevo.</td></tr>
            )}
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

          <div className="col-span-2">
            <Label className="text-xs font-bold">ESTADO</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
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
