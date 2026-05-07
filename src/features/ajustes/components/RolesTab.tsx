"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Rol } from "@/features/ajustes/data/ajustes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { saveRolesToSupabase, loadRolesFromSupabase } from "@/features/ajustes/actions/roles-actions";
import { getEmployees } from "@/actions/admin";

type UsuarioRol = {
  id: string;
  nombre: string;
  email: string;
  estado: "Activo" | "Inactivo" | "Pendiente";
  rolLabel: string;
};

// Módulos que coinciden exactamente con el índice lateral (sidebar)
const MODULOS_NAV = [
  "DIRECCIÓN",
  "SALA",
  "COCINA",
  "GERENCIA",
  "CALIDAD",
  "RECURSOS HUMANOS",
  "MARKETING",
  "LOGÍSTICA",
  "CONTABILIDAD",
  "GESTORÍA",
  "JURÍDICO",
];
const MODULO_AJUSTES = "AJUSTES";

function buildPermisosCompletos(overrides: Rol["permisos"] = []): { nav: Rol["permisos"]; ajustes: Rol["permisos"][0] } {
  const find = (m: string) => overrides.find((p) => p.modulo === m);
  const nav = MODULOS_NAV.map((m) => find(m) ?? { modulo: m, ver: false, editar: false });
  const ajustes = find(MODULO_AJUSTES) ?? { modulo: MODULO_AJUSTES, ver: false, editar: false };
  return { nav, ajustes };
}

function mergePermisos(nav: Rol["permisos"], ajustes: Rol["permisos"][0]): Rol["permisos"] {
  return [...nav, ajustes];
}

export function RolesTab() {
  const { ajustes, setAjustes, empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;
  const [expandedRol, setExpandedRol] = useState<string | null>(null);
  const [editingRolId, setEditingRolId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteRol, setDeleteRol] = useState<Rol | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [isPending, startTransition] = useTransition();
  const [usuariosSupabase, setUsuariosSupabase] = useState<UsuarioRol[]>([]);

  // Cargar roles desde Supabase al montar y al cambiar de empresa.
  useEffect(() => {
    (async () => {
      const rolesRemote = await loadRolesFromSupabase(empresaDbId);
      if (rolesRemote && rolesRemote.length > 0) {
        setAjustes((prev) => ({ ...prev, roles: rolesRemote }));
      } else {
        setAjustes((prev) => ({ ...prev, roles: [] }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaDbId]);

  // Cargar usuarios reales desde Supabase para que los contadores y popovers
  // de cada rol coincidan con la pestaña Usuarios (misma fuente de verdad).
  useEffect(() => {
    (async () => {
      const res = await getEmployees();
      const profiles = (res.data ?? []) as Array<{
        id: string;
        email: string;
        full_name: string | null;
        nombre: string | null;
        apellidos: string | null;
        rol_label?: string | null;
        estado_acceso?: string | null;
      }>;
      const validEstados = ["Activo", "Inactivo", "Pendiente"] as const;
      const mapped: UsuarioRol[] = profiles.map((p) => {
        const fullName =
          [p.nombre, p.apellidos].filter(Boolean).join(" ").trim() ||
          p.full_name ||
          p.email;
        const estado = validEstados.includes(p.estado_acceso as (typeof validEstados)[number])
          ? (p.estado_acceso as (typeof validEstados)[number])
          : "Activo";
        return {
          id: p.id,
          nombre: fullName,
          email: p.email,
          estado,
          rolLabel: (p.rol_label ?? "").trim(),
        };
      });
      setUsuariosSupabase(mapped);
    })();
  }, []);

  const persistRoles = (roles: Rol[]) => {
    startTransition(async () => {
      const { error } = await saveRolesToSupabase(roles, empresaDbId);
      if (error) toast.error(`Error al guardar: ${error}`);
    });
  };

  const toggleAcceso = (rolId: string, modulo: string) => {
    let nextRoles: Rol[] = [];
    setAjustes((prev) => {
      nextRoles = prev.roles.map((r) => {
        if (r.id !== rolId) return r;
        const existing = r.permisos.find((p) => p.modulo === modulo);
        const nuevoAcceso = !(existing?.ver ?? false);
        const newPermisos = existing
          ? r.permisos.map((p) => p.modulo === modulo ? { ...p, ver: nuevoAcceso, editar: nuevoAcceso } : p)
          : [...r.permisos, { modulo, ver: nuevoAcceso, editar: nuevoAcceso }];
        return { ...r, permisos: newPermisos };
      });
      return { ...prev, roles: nextRoles };
    });
    persistRoles(nextRoles);
  };

  // Activa o desactiva de golpe los 11 departamentos de navegación (sin tocar AJUSTES).
  const toggleTodosDepartamentos = (rolId: string, valor: boolean) => {
    let nextRoles: Rol[] = [];
    setAjustes((prev) => {
      nextRoles = prev.roles.map((r) => {
        if (r.id !== rolId) return r;
        const restantes = r.permisos.filter((p) => !MODULOS_NAV.includes(p.modulo));
        const navPermisos = MODULOS_NAV.map((m) => ({ modulo: m, ver: valor, editar: valor }));
        return { ...r, permisos: [...navPermisos, ...restantes] };
      });
      return { ...prev, roles: nextRoles };
    });
    persistRoles(nextRoles);
  };

  const renameRol = (rolId: string, nombre: string) => {
    if (!nombre.trim()) return;
    setAjustes((prev) => {
      const nextRoles = prev.roles.map((r) =>
        r.id === rolId ? { ...r, nombre: nombre.trim() } : r
      );
      persistRoles(nextRoles);
      return { ...prev, roles: nextRoles };
    });
    toast.success("Nombre actualizado");
  };

  const crearRol = () => {
    if (!nuevoNombre.trim()) return;
    const permisos = [...MODULOS_NAV, MODULO_AJUSTES].map((m) => ({ modulo: m, ver: false, editar: false }));
    const nuevoRol: Rol = {
      id: `rol-${Date.now()}`,
      nombre: nuevoNombre.trim(),
      descripcion: "",
      permisos,
    };
    setAjustes((prev) => {
      const nextRoles = [...prev.roles, nuevoRol];
      persistRoles(nextRoles);
      return { ...prev, roles: nextRoles };
    });
    setNuevoNombre("");
    setShowCreateModal(false);
    setExpandedRol(nuevoRol.id);
    toast.success(`Rol "${nuevoRol.nombre}" creado`);
  };

  const confirmarEliminar = () => {
    if (!deleteRol) return;
    setAjustes((prev) => {
      const nextRoles = prev.roles.filter((r) => r.id !== deleteRol.id);
      persistRoles(nextRoles);
      return { ...prev, roles: nextRoles };
    });
    toast.success(`Rol "${deleteRol.nombre}" eliminado`);
    setDeleteRol(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreateModal(true)} disabled={isPending}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      {ajustes.roles.map((rol) => {
        const isOpen = expandedRol === rol.id;
        const { nav: permisosNav, ajustes: permisoAjustes } = buildPermisosCompletos(rol.permisos);
        const TOTAL_MODULOS = MODULOS_NAV.length + 1; // siempre fijo: 11 nav + AJUSTES
        const accesosCount = [...permisosNav, permisoAjustes].filter((p) => p.ver).length;
        const usuariosConRol = usuariosSupabase.filter(
          (u) => u.rolLabel.toLowerCase() === rol.nombre.trim().toLowerCase()
        );

        return (
          <Card key={rol.id}>
            <CardHeader className="py-2 px-4 cursor-pointer select-none" onClick={() => setExpandedRol(isOpen ? null : rol.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <RolNombreEditable
                    nombre={rol.nombre}
                    protegido={rol.nombre === "Director"}
                    editing={editingRolId === rol.id}
                    onCancel={() => setEditingRolId(null)}
                    onSave={(nombre) => { renameRol(rol.id, nombre); setEditingRolId(null); }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{accesosCount}/{TOTAL_MODULOS} con acceso</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title={`${usuariosConRol.length} ${usuariosConRol.length === 1 ? "usuario" : "usuarios"} con este rol`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-semibold tabular-nums">{usuariosConRol.length}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-64 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="border-b px-3 py-2">
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground">USUARIOS CON ESTE ROL</p>
                        <p className="text-sm font-semibold">{rol.nombre} · {usuariosConRol.length}</p>
                      </div>
                      {usuariosConRol.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                          Ningún usuario tiene este rol asignado.
                        </div>
                      ) : (
                        <ul className="max-h-64 overflow-y-auto py-1">
                          {usuariosConRol.map((u) => (
                            <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-muted/50">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{u.nombre}</p>
                                {u.email && (
                                  <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                                )}
                              </div>
                              <span
                                className={
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                                  (u.estado === "Activo"
                                    ? "bg-green-100 text-green-700"
                                    : u.estado === "Pendiente"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-amber-100 text-amber-700")
                                }
                              >
                                {u.estado}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </PopoverContent>
                  </Popover>
                  {rol.nombre !== "Director" && (
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setEditingRolId(rol.id); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); setDeleteRol(rol); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="pt-0 px-4 pb-4 space-y-1">
                {(() => {
                  const todosActivos = permisosNav.every((p) => p.ver);
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-xs font-bold text-muted-foreground">DEPARTAMENTO</th>
                          <th className="text-right py-2 text-xs font-bold text-muted-foreground w-24">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => toggleTodosDepartamentos(rol.id, !todosActivos)}
                                className="text-[10px] font-medium text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline transition-colors"
                              >
                                {todosActivos ? "Desactivar todos" : "Activar todos"}
                              </button>
                              <span>ACCESO</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {permisosNav.map((p) => (
                          <tr key={p.modulo} className="border-b last:border-0">
                            <td className="py-2 font-medium">{p.modulo}</td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end pr-1">
                                <Switch checked={p.ver} onCheckedChange={() => toggleAcceso(rol.id, p.modulo)} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* AJUSTES — siempre al final, visualmente diferenciado */}
                <div className="mt-3 rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider">ACCESO AL PANEL DE AJUSTES</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{MODULO_AJUSTES}</span>
                    <div className="flex flex-col items-center gap-0.5 w-24">
                      <span className="text-[10px] text-muted-foreground font-bold">ACCESO</span>
                      <Switch
                        checked={permisoAjustes.ver}
                        onCheckedChange={() => toggleAcceso(rol.id, MODULO_AJUSTES)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Modal crear rol */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>NUEVO ROL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">NOMBRE DEL ROL</Label>
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crearRol()}
                placeholder="Ej: Encargado de sala"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El rol se creará sin permisos. Configúralos después expandiendo el rol.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>CANCELAR</Button>
              <Button onClick={crearRol} disabled={!nuevoNombre.trim()}>CREAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar */}
      <AlertDialog open={!!deleteRol} onOpenChange={(o) => !o && setDeleteRol(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el rol <strong>{deleteRol?.nombre}</strong> permanentemente. Los usuarios asignados a este rol perderán sus permisos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCELAR</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={confirmarEliminar}>
              ELIMINAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Componente inline para editar el nombre del rol (controlado por el padre)
function RolNombreEditable({
  nombre,
  protegido,
  editing,
  onSave,
  onCancel,
}: {
  nombre: string;
  protegido: boolean;
  editing: boolean;
  onSave: (nombre: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(nombre);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(nombre); }, [nombre, editing]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const confirm = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onSave(value);
  };

  if (protegido || !editing) {
    return <span className="text-sm font-semibold">{nombre}</span>;
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") confirm(e); if (e.key === "Escape") { setValue(nombre); onCancel(); } }}
        className="h-6 text-sm py-0 w-40"
      />
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={confirm}>
        <Check className="h-3.5 w-3.5 text-green-600" />
      </Button>
    </div>
  );
}
