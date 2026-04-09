import { useState, useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getEmpleadosPorEmpresa } from "@/data/rrhh";
import {
  AccesoPortal, EstadoAcceso, ROLES_PORTAL,
  getAccesosPorEmpresa, crearAccesoDesdeEmpleado, permisosDesdeRol,
} from "@/data/accesos-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, ShieldCheck, ShieldOff, KeyRound, Pencil, UserCog,
  Power, PowerOff, Lock, Eye, PenLine, Users,
} from "lucide-react";
import { toast } from "sonner";

const ESTADO_STYLES: Record<EstadoAcceso, string> = {
  Activo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Inactivo: "bg-muted text-muted-foreground border-muted-foreground/30",
  Bloqueado: "bg-destructive/10 text-destructive border-destructive/30",
  Pendiente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

function EstadoBadge({ estado }: { estado: EstadoAcceso }) {
  return <Badge variant="outline" className={`text-[10px] ${ESTADO_STYLES[estado]}`}>{estado}</Badge>;
}

export function UsuariosTab() {
  const { empresaActual } = useEmpresa();
  const empleados = useMemo(() => getEmpleadosPorEmpresa(empresaActual.id), [empresaActual.id]);

  const [accesos, setAccesos] = useState<AccesoPortal[]>(() => getAccesosPorEmpresa(empresaActual.id));
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [editModal, setEditModal] = useState<AccesoPortal | null>(null);
  const [permisosModal, setPermisosModal] = useState<AccesoPortal | null>(null);

  // Refresh when company changes
  const [lastEmpresa, setLastEmpresa] = useState(empresaActual.id);
  if (lastEmpresa !== empresaActual.id) {
    setLastEmpresa(empresaActual.id);
    setAccesos(getAccesosPorEmpresa(empresaActual.id));
  }

  const filtrados = useMemo(() => {
    return accesos.filter((a) => {
      const texto = `${a.nombreEmpleado} ${a.emailUsuario} ${a.rol}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      if (filtroEstado !== "todos" && a.estadoAcceso !== filtroEstado) return false;
      return true;
    });
  }, [accesos, busqueda, filtroEstado]);

  // Employees without access
  const sinAcceso = useMemo(() => {
    const idsConAcceso = new Set(accesos.map((a) => a.empleadoId));
    return empleados.filter((e) => !idsConAcceso.has(e.id));
  }, [empleados, accesos]);

  const activar = (id: string) => {
    setAccesos((prev) => prev.map((a) => a.id === id ? { ...a, estadoAcceso: "Activo" as EstadoAcceso } : a));
    toast.success("Acceso activado");
  };
  const desactivar = (id: string) => {
    setAccesos((prev) => prev.map((a) => a.id === id ? { ...a, estadoAcceso: "Inactivo" as EstadoAcceso } : a));
    toast.success("Acceso desactivado");
  };
  const bloquear = (id: string) => {
    setAccesos((prev) => prev.map((a) => a.id === id ? { ...a, estadoAcceso: "Bloqueado" as EstadoAcceso } : a));
    toast.success("Acceso bloqueado");
  };
  const resetPassword = (nombre: string) => {
    toast.success(`Contraseña reseteada para ${nombre}`);
  };
  const darAcceso = (empId: string) => {
    const emp = empleados.find((e) => e.id === empId);
    if (!emp) return;
    const nuevo = crearAccesoDesdeEmpleado(
      emp.id, `${emp.nombre} ${emp.apellidos}`, emp.emailEmpresa,
      empresaActual.nombre, empresaActual.id,
    );
    setAccesos((prev) => [...prev, nuevo]);
    toast.success(`Acceso creado para ${emp.nombre} ${emp.apellidos}`);
  };

  const guardarEdicion = (updated: AccesoPortal) => {
    setAccesos((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setEditModal(null);
    toast.success("Usuario actualizado");
  };

  const guardarPermisos = (updated: AccesoPortal) => {
    setAccesos((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setPermisosModal(null);
    toast.success("Permisos actualizados");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold text-foreground">USUARIOS Y ACCESOS AL PORTAL</h3>
            <p className="text-xs text-muted-foreground">{accesos.length} usuarios · {accesos.filter((a) => a.estadoAcceso === "Activo").length} activos · {sinAcceso.length} sin acceso</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
            <SelectItem value="Bloqueado">Bloqueado</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["EMPLEADO", "USUARIO", "ROL", "ESTADO", "ÚLTIMA CONEXIÓN", "PERMISOS", "ACCIONES"].map((h) => (
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
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <UserCog className="h-3 w-3" />{acc.rol}
                  </Badge>
                </td>
                <td className="px-3 py-2.5"><EstadoBadge estado={acc.estadoAcceso} /></td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{acc.ultimaConexion}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {acc.permisos.filter((p) => p.ver).length} ver · {acc.permisos.filter((p) => p.editar).length} editar
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {acc.estadoAcceso !== "Activo" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Activar" onClick={() => activar(acc.id)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {acc.estadoAcceso === "Activo" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Desactivar" onClick={() => desactivar(acc.id)}>
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {acc.estadoAcceso !== "Bloqueado" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Bloquear" onClick={() => bloquear(acc.id)}>
                        <Lock className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Resetear contraseña" onClick={() => resetPassword(acc.nombreEmpleado)}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => setEditModal(acc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Permisos" onClick={() => setPermisosModal(acc)}>
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Employees without access */}
      {sinAcceso.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
            EMPLEADOS SIN ACCESO AL PORTAL ({sinAcceso.length})
          </h4>
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
                  <tr key={emp.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-foreground">{emp.nombre} {emp.apellidos}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{emp.departamento}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{emp.emailEmpresa}</td>
                    <td className="px-3 py-2.5">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => darAcceso(emp.id)}>
                        <ShieldCheck className="h-3 w-3" /> Dar acceso
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
          onClose={() => setEditModal(null)}
          onSave={guardarEdicion}
        />
      )}

      {/* Permissions modal */}
      {permisosModal && (
        <PermisosModal
          acceso={permisosModal}
          onClose={() => setPermisosModal(null)}
          onSave={guardarPermisos}
        />
      )}
    </div>
  );
}

/* ─── EDIT MODAL ─── */
function EditarUsuarioModal({ acceso, onClose, onSave }: { acceso: AccesoPortal; onClose: () => void; onSave: (a: AccesoPortal) => void }) {
  const [form, setForm] = useState({ ...acceso });

  const cambiarRol = (rol: string) => {
    setForm((p) => ({ ...p, rol, permisos: permisosDesdeRol(rol) }));
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
            <Select value={form.rol} onValueChange={cambiarRol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES_PORTAL.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold">ESTADO</Label>
            <Select value={form.estadoAcceso} onValueChange={(v) => setForm((p) => ({ ...p, estadoAcceso: v as EstadoAcceso }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
                <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>CANCELAR</Button>
          <Button onClick={() => onSave(form)}>GUARDAR</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── PERMISSIONS MODAL ─── */
function PermisosModal({ acceso, onClose, onSave }: { acceso: AccesoPortal; onClose: () => void; onSave: (a: AccesoPortal) => void }) {
  const [permisos, setPermisos] = useState([...acceso.permisos]);

  const toggle = (idx: number, field: "ver" | "editar") => {
    setPermisos((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      if (field === "editar") return { ...p, editar: !p.editar, ver: !p.editar ? true : p.ver };
      return { ...p, ver: !p.ver, editar: !p.ver ? p.editar : false };
    }));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>PERMISOS — {acceso.nombreEmpleado}</DialogTitle>
          <p className="text-xs text-muted-foreground">Rol base: {acceso.rol}. Ajusta permisos individuales.</p>
        </DialogHeader>
        <div className="bg-card rounded-lg border mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">MÓDULO</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center justify-center gap-1"><Eye className="h-3 w-3" /> VER</span>
                </th>
                <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center justify-center gap-1"><PenLine className="h-3 w-3" /> EDITAR</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {permisos.map((p, i) => (
                <tr key={p.modulo} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{p.modulo}</td>
                  <td className="text-center px-3 py-2">
                    <div className="flex justify-center"><Switch checked={p.ver} onCheckedChange={() => toggle(i, "ver")} /></div>
                  </td>
                  <td className="text-center px-3 py-2">
                    <div className="flex justify-center"><Switch checked={p.editar} onCheckedChange={() => toggle(i, "editar")} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>CANCELAR</Button>
          <Button onClick={() => onSave({ ...acceso, permisos })}>GUARDAR PERMISOS</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
