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
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, Settings } from "lucide-react";
import { toast } from "sonner";
import { saveRolesToSupabase, loadRolesFromSupabase } from "@/features/ajustes/actions/roles-actions";

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
  const { ajustes, setAjustes } = useEmpresa();
  const [expandedRol, setExpandedRol] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteRol, setDeleteRol] = useState<Rol | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [isPending, startTransition] = useTransition();

  // Cargar desde Supabase al montar; sincronizar con localStorage como fallback.
  // Además garantiza que cada departamento existente tenga un rol homónimo en empresa_roles.
  useEffect(() => {
    (async () => {
      const rolesRemote = await loadRolesFromSupabase();
      const departamentos = ajustes.departamentos.map((d) => d.nombre).filter(Boolean);
      const existentes = (rolesRemote ?? []).map((r) => r.nombre.toLowerCase());
      const faltantes = departamentos.filter((d) => !existentes.includes(d.toLowerCase()));

      if (faltantes.length > 0) {
        // Crear los roles faltantes en lote (uno por cada departamento sin rol).
        const nuevos: Rol[] = faltantes.map((nombre, i) => ({
          id: `rol-auto-${Date.now()}-${i}`,
          nombre,
          descripcion: `Rol del departamento ${nombre}`,
          permisos: [...MODULOS_NAV, MODULO_AJUSTES].map((m) => ({ modulo: m, ver: false, editar: false })),
        }));
        const todosLosRoles = [...(rolesRemote ?? []), ...nuevos];
        setAjustes((prev) => ({ ...prev, roles: todosLosRoles }));
        startTransition(async () => {
          const { error } = await saveRolesToSupabase(todosLosRoles);
          if (error) toast.error(`Error sincronizando roles con departamentos: ${error}`);
        });
      } else if (rolesRemote && rolesRemote.length > 0) {
        setAjustes((prev) => ({ ...prev, roles: rolesRemote }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistRoles = (roles: Rol[]) => {
    startTransition(async () => {
      const { error } = await saveRolesToSupabase(roles);
      if (error) toast.error(`Error al guardar: ${error}`);
    });
  };

  const togglePermiso = (rolId: string, modulo: string, campo: "ver" | "editar") => {
    setAjustes((prev) => {
      const nextRoles = prev.roles.map((r) => {
        if (r.id !== rolId) return r;
        const existe = r.permisos.some((p) => p.modulo === modulo);
        const newPermisos = existe
          ? r.permisos.map((p) => p.modulo === modulo ? { ...p, [campo]: !p[campo] } : p)
          : [...r.permisos, { modulo, ver: campo === "ver", editar: campo === "editar" }];
        return { ...r, permisos: newPermisos };
      });
      persistRoles(nextRoles);
      return { ...prev, roles: nextRoles };
    });
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
        const editablesCount = [...permisosNav, permisoAjustes].filter((p) => p.editar).length;

        return (
          <Card key={rol.id}>
            <CardHeader className="py-2 px-4 cursor-pointer select-none" onClick={() => setExpandedRol(isOpen ? null : rol.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <RolNombreEditable
                    nombre={rol.nombre}
                    protegido={rol.nombre === "Director"}
                    onSave={(nombre) => renameRol(rol.id, nombre)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{editablesCount}/{TOTAL_MODULOS} editables</span>
                  {rol.nombre !== "Director" && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeleteRol(rol); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="pt-0 px-4 pb-4 space-y-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs font-bold text-muted-foreground">DEPARTAMENTO</th>
                      <th className="text-center py-2 text-xs font-bold text-muted-foreground w-24">VER</th>
                      <th className="text-center py-2 text-xs font-bold text-muted-foreground w-24">EDITAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permisosNav.map((p) => (
                      <tr key={p.modulo} className="border-b last:border-0">
                        <td className="py-2 font-medium">{p.modulo}</td>
                        <td className="py-2 text-center">
                          <Switch checked={p.ver} onCheckedChange={() => togglePermiso(rol.id, p.modulo, "ver")} />
                        </td>
                        <td className="py-2 text-center">
                          <Switch checked={p.editar} onCheckedChange={() => togglePermiso(rol.id, p.modulo, "editar")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* AJUSTES — siempre al final, visualmente diferenciado */}
                <div className="mt-3 rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider">ACCESO AL PANEL DE AJUSTES</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{MODULO_AJUSTES}</span>
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-muted-foreground font-bold">VER</span>
                        <Switch
                          checked={permisoAjustes.ver}
                          onCheckedChange={() => togglePermiso(rol.id, MODULO_AJUSTES, "ver")}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-muted-foreground font-bold">EDITAR</span>
                        <Switch
                          checked={permisoAjustes.editar}
                          onCheckedChange={() => togglePermiso(rol.id, MODULO_AJUSTES, "editar")}
                        />
                      </div>
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

// Componente inline para editar el nombre del rol
function RolNombreEditable({
  nombre,
  protegido,
  onSave,
}: {
  nombre: string;
  protegido: boolean;
  onSave: (nombre: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nombre);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(nombre); }, [nombre]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const confirm = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onSave(value);
    setEditing(false);
  };

  if (protegido) {
    return <span className="text-sm font-semibold">{nombre}</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirm(e); if (e.key === "Escape") { setValue(nombre); setEditing(false); } }}
          className="h-6 text-sm py-0 w-40"
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={confirm}>
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-semibold">{nombre}</span>
      <Button
        variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}
