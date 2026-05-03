import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  AccesoPortal, EstadoAcceso,
  permisosDesdeRol,
} from "@/features/rrhh/data/accesos-portal";
import { loadRolesFromSupabase } from "@/features/ajustes/actions/roles-actions";
import type { Rol } from "@/features/ajustes/data/ajustes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Search, KeyRound, Pencil, UserCog,
  Power, PowerOff, UserPlus, Plus, UserCheck, Trash2, Mail,
} from "lucide-react";
import { toast } from "sonner";
import {
  createEmployee, resetEmployeePassword, getEmployees, updateEmployeeStatus,
  getEmpleadosSinAcceso, updateEmployeeProfile, deleteEmployee,
  sendPasswordResetEmail,
} from "@/actions/admin";
import {
  listEmpresasDeUsuario,
  setEmpresasDeUsuario,
} from "@/features/empresa/actions/user-empresas-actions";
import { Checkbox } from "@/components/ui/checkbox";

const ESTADO_STYLES: Record<EstadoAcceso, string> = {
  Activo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Inactivo: "bg-muted text-muted-foreground border-muted-foreground/30",
  Pendiente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

function EstadoBadge({ estado }: { estado: EstadoAcceso }) {
  return <Badge variant="outline" className={`text-[10px] ${ESTADO_STYLES[estado]}`}>{estado}</Badge>;
}

type EmpleadoSinAcceso = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email_personal: string | null;
  email_empresa: string | null;
  departamentos: { nombre: string } | null;
};

// ─── Tipo del row real de Supabase (tabla profiles + role joineado de user_roles) ───
type SupabaseProfile = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  nombre: string | null;
  apellidos: string | null;
  avatar_url: string | null;
  empresa_id: string | null;
  departamento: string | null;
  role?: string;
  rol_label?: string | null;
  estado_acceso?: string;
  created_at: string;
  updated_at: string;
};

function profileToAcceso(p: SupabaseProfile, empresa: { id: string; nombre: string }): AccesoPortal {
  // El rol UI viene SIEMPRE del nombre custom guardado en empresa_roles (rol_label).
  // Si un perfil legado no lo tiene, mostramos vacío — no inventamos roles que no
  // existan en empresa_roles, para que el dropdown sea coherente con la BD.
  const rolUI = (p.rol_label && p.rol_label.trim()) ? p.rol_label.trim() : "";
  const fullName = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim() || p.full_name || p.email;
  const validEstados: EstadoAcceso[] = ["Activo", "Inactivo", "Pendiente"];
  const estadoAcceso: EstadoAcceso = validEstados.includes(p.estado_acceso as EstadoAcceso)
    ? (p.estado_acceso as EstadoAcceso)
    : "Activo";
  return {
    id: `sup-${p.id}`,
    empleadoId: p.id,
    userId: p.user_id,
    nombreEmpleado: fullName,
    emailUsuario: p.email,
    empresa: empresa.nombre,
    empresaId: empresa.id,
    rol: rolUI,
    departamento: p.departamento ?? "",
    estadoAcceso,
    ultimaConexion: "—",
    fechaCreacion: p.created_at?.slice(0, 10) ?? "",
    permisos: permisosDesdeRol(rolUI),
  };
}

export function UsuariosTab() {
  const { empresaActual, empresas } = useEmpresa();

  const [accesos, setAccesos] = useState<AccesoPortal[]>([]);
  const [sinAcceso, setSinAcceso] = useState<EmpleadoSinAcceso[]>([]);
  const [rolesData, setRolesData] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [editModal, setEditModal] = useState<AccesoPortal | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ nombre: string; apellidos: string; email: string } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{ id: string; nombre: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carga real desde Supabase
  const loadAccesos = useCallback(async () => {
    setLoading(true);
    try {
      const [empResult, sinResult] = await Promise.all([
        getEmployees(),
        getEmpleadosSinAcceso(),
      ]);
      if (empResult.error) {
        toast.error(empResult.error);
        setAccesos([]);
      } else {
        const profiles = (empResult.data ?? []) as SupabaseProfile[];
        setAccesos(profiles.map((p) => profileToAcceso(p, empresaActual)));
      }
      setSinAcceso((sinResult.data ?? []) as EmpleadoSinAcceso[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando usuarios");
      setAccesos([]);
    } finally {
      setLoading(false);
    }
  }, [empresaActual]);

  useEffect(() => {
    loadAccesos();
  }, [loadAccesos]);

  // Roles vienen de empresa_roles (misma fuente que la pestaña Roles).
  // Cargamos el rol completo (incluyendo `permisos`) para poder derivar los
  // departamentos accesibles desde los módulos con `ver: true`.
  const loadRoles = useCallback(async () => {
    const roles = await loadRolesFromSupabase(empresaActual.dbId);
    setRolesData(roles ?? []);
  }, [empresaActual.dbId]);
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const rolesEmpresa = useMemo(() => rolesData.map((r) => r.nombre), [rolesData]);

  // Mapa rol → lista de departamentos visibles (módulos con `ver: true`,
  // excluyendo "AJUSTES" que es el panel de configuración, no un departamento).
  const departamentosPorRol = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of rolesData) {
      const deps = r.permisos
        .filter((p) => p.ver && p.modulo.toUpperCase() !== "AJUSTES")
        .map((p) => p.modulo);
      map.set(r.nombre.trim().toLowerCase(), deps);
    }
    return map;
  }, [rolesData]);

  // Mapa rol → permisos reales guardados en empresa_roles. Es la fuente de
  // verdad para la celda PERMISOS de la tabla; no usar `permisosDesdeRol`
  // (helper hardcodeado por nombre que ignora la config real).
  const permisosPorRol = useMemo(() => {
    const map = new Map<string, { ver: number; editar: number }>();
    for (const r of rolesData) {
      const ver = r.permisos.filter((p) => p.ver).length;
      const editar = r.permisos.filter((p) => p.editar).length;
      map.set(r.nombre.trim().toLowerCase(), { ver, editar });
    }
    return map;
  }, [rolesData]);

  const filtrados = useMemo(() => {
    return accesos.filter((a) => {
      const texto = `${a.nombreEmpleado} ${a.emailUsuario} ${a.rol} ${a.departamento}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      if (filtroEstado !== "todos" && a.estadoAcceso !== filtroEstado) return false;
      return true;
    });
  }, [accesos, busqueda, filtroEstado]);

  const activar = async (acc: AccesoPortal) => {
    setAccesos((prev) => prev.map((a) => a.id === acc.id ? { ...a, estadoAcceso: "Activo" as EstadoAcceso } : a));
    const result = await updateEmployeeStatus(acc.empleadoId, "Activo");
    if (result?.error) {
      toast.error(result.error);
      setAccesos((prev) => prev.map((a) => a.id === acc.id ? { ...a, estadoAcceso: acc.estadoAcceso } : a));
    } else {
      toast.success("Acceso activado");
    }
  };
  const desactivar = async (acc: AccesoPortal) => {
    setAccesos((prev) => prev.map((a) => a.id === acc.id ? { ...a, estadoAcceso: "Inactivo" as EstadoAcceso } : a));
    const result = await updateEmployeeStatus(acc.empleadoId, "Inactivo");
    if (result?.error) {
      toast.error(result.error);
      setAccesos((prev) => prev.map((a) => a.id === acc.id ? { ...a, estadoAcceso: acc.estadoAcceso } : a));
    } else {
      toast.success("Acceso desactivado");
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    const result = await deleteEmployee(deleteModal.id);
    if (result?.error) {
      toast.error(result.error);
      setDeleteLoading(false);
    } else {
      toast.success(`Usuario ${deleteModal.nombre} eliminado`);
      setDeleteModal(null);
      setDeleteLoading(false);
      await loadAccesos();
    }
  };

  const handleResetPassword = async (formData: FormData) => {
    if (!resetModal) return;
    setResetLoading(true);
    const newPassword = formData.get("new_password") as string;
    const result = await resetEmployeePassword(resetModal.id, newPassword);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Contraseña actualizada para ${resetModal.nombre}`);
      setResetModal(null);
    }
    setResetLoading(false);
  };

  const handleSendResetEmail = async () => {
    if (!resetModal) return;
    setResetLoading(true);
    const result = await sendPasswordResetEmail(resetModal.id);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Correo de recuperación enviado${result.email ? ` a ${result.email}` : ""}`
      );
      setResetModal(null);
    }
    setResetLoading(false);
  };

  const guardarEdicion = async (updated: AccesoPortal) => {
    // Enviamos el nombre custom del rol; el server action lo guarda en rol_label
    // y deriva el app_role para user_roles.
    const res = await updateEmployeeProfile(updated.empleadoId, {
      role: updated.rol,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setAccesos((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setEditModal(null);
    toast.success("Usuario actualizado");
  };

  const handleCreateUser = async (formData: FormData) => {
    setCreateLoading(true);
    setCreateError(null);
    const result = await createEmployee(formData);
    if (result?.error) {
      setCreateError(result.error);
      setCreateLoading(false);
    } else {
      toast.success("Usuario creado correctamente en Supabase");
      setShowCreateModal(false);
      setCreatePrefill(null);
      setCreateLoading(false);
      await loadAccesos();
    }
  };

  const darAcceso = (emp: EmpleadoSinAcceso) => {
    setCreatePrefill({
      nombre: emp.nombre,
      apellidos: emp.apellidos ?? "",
      email: emp.email_empresa ?? emp.email_personal ?? "",
    });
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 -mt-10">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, email o rol..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="Activo">Activo</SelectItem>
            <SelectItem value="Inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users table — todos los usuarios de Supabase en una única tabla */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["EMPLEADO", "USUARIO", "DEPARTAMENTO", "ROL", "ESTADO", "ÚLTIMA CONEXIÓN", "PERMISOS", "ACCIONES"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((acc) => (
              <tr key={acc.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{acc.nombreEmpleado}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{acc.emailUsuario}</td>
                <td className="px-3 py-2.5">
                  <DepartamentosCell
                    departamentos={departamentosPorRol.get(acc.rol.trim().toLowerCase()) ?? []}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <UserCog className="h-3 w-3" />{acc.rol}
                  </Badge>
                </td>
                <td className="px-3 py-2.5"><EstadoBadge estado={acc.estadoAcceso} /></td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{acc.ultimaConexion}</td>
                <td className="px-3 py-2.5">
                  {(() => {
                    const k = acc.rol.trim().toLowerCase();
                    const p = permisosPorRol.get(k) ?? { ver: 0, editar: 0 };
                    return (
                      <span className="text-[10px] text-muted-foreground">
                        {p.ver} ver · {p.editar} editar
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {acc.estadoAcceso !== "Activo" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Activar" onClick={() => activar(acc)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {acc.estadoAcceso === "Activo" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Desactivar" onClick={() => desactivar(acc)}>
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Resetear contraseña" onClick={() => setResetModal({ id: acc.empleadoId, nombre: acc.nombreEmpleado })}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => setEditModal(acc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Borrar usuario"
                      onClick={() => setDeleteModal({ id: acc.empleadoId, nombre: acc.nombreEmpleado })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Cargando usuarios desde Supabase…</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No se encontraron usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Empleados sin acceso al portal */}
      {!loading && sinAcceso.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">
              EMPLEADOS SIN ACCESO AL PORTAL ({sinAcceso.length})
            </span>
          </div>
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["EMPLEADO", "DEPARTAMENTO", "EMAIL", "ACCIÓN"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sinAcceso.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                      {[emp.nombre, emp.apellidos].filter(Boolean).join(" ")}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      {emp.departamentos?.nombre ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      {emp.email_empresa ?? emp.email_personal ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => darAcceso(emp)}>
                        <UserPlus className="h-3.5 w-3.5" /> Dar acceso
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <EditarUsuarioModal
          acceso={editModal}
          roles={rolesEmpresa}
          empresasDisponibles={empresas.map((e) => ({
            dbId: e.dbId,
            nombre: e.nombre,
          })).filter((e): e is { dbId: string; nombre: string } => Boolean(e.dbId))}
          onClose={() => setEditModal(null)}
          onSave={guardarEdicion}
        />
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteModal} onOpenChange={(o) => !o && !deleteLoading && setDeleteModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Borrar usuario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              ¿Seguro que quieres borrar a <span className="font-bold">{deleteModal?.nombre}</span>?
            </p>
            <p className="text-xs text-muted-foreground">
              Esta acción elimina el acceso al portal y no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDeleteModal(null)} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteLoading ? "Borrando..." : "Borrar usuario"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password modal (Supabase) */}
      <Dialog open={!!resetModal} onOpenChange={(o) => !o && setResetModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Resetear contraseña — {resetModal?.nombre}
            </DialogTitle>
          </DialogHeader>

          {/* Opción A — Enviar correo de recuperación (recomendado) */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Enviar enlace por correo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El usuario recibirá un email con un enlace seguro para definir él mismo
                  su nueva contraseña. El remitente es el SMTP configurado en Supabase
                  (sandbox por defecto, o el correo de la empresa si lo has configurado).
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={resetLoading}
                onClick={handleSendResetEmail}
              >
                <Mail className="h-3.5 w-3.5" />
                {resetLoading ? "Enviando..." : "Enviar correo"}
              </Button>
            </div>
          </div>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground">o cambiarla ahora mismo</span></div>
          </div>

          {/* Opción B — Cambiar manualmente */}
          <form action={handleResetPassword} className="space-y-2">
            <div>
              <Label className="text-xs font-bold">Nueva contraseña</Label>
              <Input name="new_password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetModal(null)}>Cancelar</Button>
              <Button type="submit" variant="outline" disabled={resetLoading}>
                {resetLoading ? "Actualizando..." : "Cambiar manualmente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create user modal (Supabase) */}
      <Dialog open={showCreateModal} onOpenChange={(o) => { setShowCreateModal(o); if (!o) setCreatePrefill(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Nuevo usuario
            </DialogTitle>
          </DialogHeader>
          <form action={handleCreateUser} className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Nombre</Label>
                <Input name="nombre" required defaultValue={createPrefill?.nombre ?? ""} />
              </div>
              <div>
                <Label className="text-xs font-bold">Apellidos</Label>
                <Input name="apellidos" required defaultValue={createPrefill?.apellidos ?? ""} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Email</Label>
              <Input name="email" type="email" required defaultValue={createPrefill?.email ?? ""} />
            </div>
            <div>
              <Label className="text-xs font-bold">Contraseña</Label>
              <Input name="password" type="password" required minLength={6} />
            </div>
            <div>
              <Label className="text-xs font-bold">Rol *</Label>
              <Select name="role" defaultValue={rolesEmpresa[0] ?? ""}>
                <SelectTrigger><SelectValue placeholder="Selecciona rol" /></SelectTrigger>
                <SelectContent>
                  {rolesEmpresa.length === 0
                    ? <SelectItem value="__none__" disabled>No hay roles definidos</SelectItem>
                    : rolesEmpresa.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                El rol determina los departamentos accesibles y los permisos. Configúralo en la pestaña Roles.
              </p>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreateModal(false); setCreatePrefill(null); }}>Cancelar</Button>
              <Button type="submit" disabled={createLoading}>
                {createLoading ? "Creando..." : "Crear usuario"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── EDIT MODAL ─── */
function EditarUsuarioModal({
  acceso, roles, empresasDisponibles, onClose, onSave,
}: {
  acceso: AccesoPortal;
  roles: string[];
  empresasDisponibles: Array<{ dbId: string; nombre: string }>;
  onClose: () => void;
  onSave: (a: AccesoPortal) => void;
}) {
  const [form, setForm] = useState({ ...acceso });

  // Empresas a las que el usuario tiene acceso (UUIDs). Carga + estado local.
  const [empresasIds, setEmpresasIds] = useState<string[]>([]);
  const [empresasLoading, setEmpresasLoading] = useState(true);
  const [empresasSaving, setEmpresasSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!acceso.userId) {
      setEmpresasLoading(false);
      return;
    }
    listEmpresasDeUsuario(acceso.userId)
      .then((ids) => { if (alive) setEmpresasIds(ids); })
      .catch((e) => console.error(e))
      .finally(() => { if (alive) setEmpresasLoading(false); });
    return () => { alive = false; };
  }, [acceso.userId]);

  const toggleEmpresa = (dbId: string) => {
    setEmpresasIds((prev) =>
      prev.includes(dbId) ? prev.filter((id) => id !== dbId) : [...prev, dbId],
    );
  };

  const cambiarRol = (rol: string) => {
    setForm((p) => ({ ...p, rol, permisos: permisosDesdeRol(rol) }));
  };

  const rolValue = roles.includes(form.rol) ? form.rol : "";

  const handleGuardar = async () => {
    if (acceso.userId) {
      setEmpresasSaving(true);
      const res = await setEmpresasDeUsuario({
        userId: acceso.userId,
        empresaIds: empresasIds,
      });
      setEmpresasSaving(false);
      if (!res.ok) {
        toast.error(res.error ?? "Error guardando accesos a empresas");
        return;
      }
    }
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>EDITAR USUARIO — {acceso.nombreEmpleado}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2">
            <Label className="text-xs font-bold">EMAIL / USUARIO</Label>
            <Input value={form.emailUsuario} onChange={(e) => setForm((p) => ({ ...p, emailUsuario: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs font-bold">ROL</Label>
            <Select value={rolValue} onValueChange={cambiarRol}>
              <SelectTrigger><SelectValue placeholder="Selecciona rol" /></SelectTrigger>
              <SelectContent>
                {roles.length === 0
                  ? <SelectItem value="__none__" disabled>No hay roles definidos en pestaña Roles</SelectItem>
                  : roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)
                }
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Los departamentos y permisos se configuran en cada rol.
            </p>
          </div>
          <div>
            <Label className="text-xs font-bold">ESTADO</Label>
            <Select value={form.estadoAcceso} onValueChange={(v) => setForm((p) => ({ ...p, estadoAcceso: v as EstadoAcceso }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-bold">EMPRESAS A LAS QUE TIENE ACCESO</Label>
            {!acceso.userId ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                Este usuario no está vinculado a una cuenta de Supabase, no se pueden asignar accesos.
              </p>
            ) : empresasLoading ? (
              <p className="text-[11px] text-muted-foreground mt-1">Cargando accesos…</p>
            ) : empresasDisponibles.length === 0 ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                No hay empresas en la base de datos.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5 rounded-md border bg-muted/30 p-2 max-h-40 overflow-y-auto">
                {empresasDisponibles.map((emp) => (
                  <label
                    key={emp.dbId}
                    className="flex items-center gap-2 cursor-pointer hover:bg-background/60 rounded px-1.5 py-1"
                  >
                    <Checkbox
                      checked={empresasIds.includes(emp.dbId)}
                      onCheckedChange={() => toggleEmpresa(emp.dbId)}
                    />
                    <span className="text-sm">{emp.nombre}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Marca las empresas a las que este usuario podrá entrar y operar.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={empresasSaving}>CANCELAR</Button>
          <Button onClick={handleGuardar} disabled={empresasSaving}>
            {empresasSaving ? "GUARDANDO…" : "GUARDAR"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── DEPARTAMENTOS CELL ─── */
// Muestra el primer departamento como badge; si hay más, un badge "+N" abre un
// Popover con la lista completa. Los departamentos se derivan de los módulos
// donde el rol tiene `ver: true` en la pestaña Roles.
function DepartamentosCell({ departamentos }: { departamentos: string[] }) {
  if (departamentos.length === 0) {
    return (
      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
        Sin departamento
      </Badge>
    );
  }

  const [primero, ...resto] = departamentos;

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className="text-[10px]">{primero}</Badge>
      {resto.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title={`${departamentos.length} departamentos`}
            >
              +{resto.length}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-0">
            <div className="border-b px-3 py-2">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground">DEPARTAMENTOS</p>
              <p className="text-xs text-muted-foreground">{departamentos.length} con acceso</p>
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {departamentos.map((d) => (
                <li key={d} className="px-3 py-1.5 text-sm hover:bg-muted/50">
                  {d}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
