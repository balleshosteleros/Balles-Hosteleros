"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck, 
  Lock,
  Search,
  MoreVertical,
  Edit2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  saveRolesToSupabase, 
  loadRolesFromSupabase,
  deleteRolFromSupabase 
} from "../actions/roles-actions";
import { ConfirmModal } from "@/shared/components/ConfirmModal";

// Definición de tipos para los roles
interface PermisoModulo {
  modulo: string;
  ver: boolean;
  editar: boolean;
}

interface Rol {
  id: string;
  nombre: string;
  descripcion?: string;
  permisos: PermisoModulo[];
  creado_en?: string;
}

const MODULOS_NAV = [
  "DIRECCIÓN", "SALA", "COCINA", "LOGÍSTICA", "GESTIÓN RRHH", 
  "MARKETING", "MANTENIMIENTO", "SOPORTE"
];
const MODULO_AJUSTES = "CONFIGURACIÓN";

function buildPermisosCompletos(overrides: Rol["permisos"] = []): { nav: Rol["permisos"]; ajustes: Rol["permisos"][0] } {
  const find = (m: string) => overrides.find((p) => p.modulo === m);
  const nav = MODULOS_NAV.map((m) => find(m) ?? { modulo: m, ver: false, editar: false });
  const ajustes = find(MODULO_AJUSTES) ?? { modulo: MODULO_AJUSTES, ver: false, editar: false };
  return { nav, ajustes };
}

export default function RolesTab() {
  const [ajustes, setAjustes] = useState<{ roles: Rol[] }>({ roles: [] });
  const [expandedRol, setExpandedRol] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteRol, setDeleteRol] = useState<Rol | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [isPending, startTransition] = useTransition();

  // Cargar desde Supabase al montar
  useEffect(() => {
    loadRolesFromSupabase().then((rolesRemote) => {
      if (rolesRemote && rolesRemote.length > 0) {
        setAjustes((prev) => ({ ...prev, roles: rolesRemote }));
      }
    });
  }, []);

  const persistRoles = async (roles: Rol[]) => {
    const { error } = await saveRolesToSupabase(roles);
    if (error) {
      toast.error(`Error al sincronizar con la nube: ${error}`);
      const remote = await loadRolesFromSupabase();
      if (remote) setAjustes(prev => ({ ...prev, roles: remote }));
    }
  };

  const togglePermiso = (rolId: string, modulo: string, campo: "ver" | "editar") => {
    setAjustes((prev) => {
      const nextRoles = prev.roles.map((r) => {
        if (r.id !== rolId) return r;
        const currentPermisos = [...(r.permisos || [])];
        const index = currentPermisos.findIndex((p) => p.modulo === modulo);
        
        let newPermisos;
        if (index >= 0) {
          newPermisos = currentPermisos.map((p, i) => 
            i === index ? { ...p, [campo]: !p[campo] } : p
          );
        } else {
          newPermisos = [...currentPermisos, { 
            modulo, 
            ver: campo === "ver", 
            editar: campo === "editar" 
          }];
        }
        return { ...r, permisos: newPermisos };
      });
      persistRoles(nextRoles);
      return { ...prev, roles: nextRoles };
    });
  };

  const handleCreateRol = () => {
    if (!nuevoNombre.trim()) return;
    const nuevoRol: Rol = {
      id: `rol-${Date.now()}`,
      nombre: nuevoNombre,
      permisos: []
    };
    const nextRoles = [...ajustes.roles, nuevoRol];
    setAjustes({ roles: nextRoles });
    persistRoles(nextRoles);
    setNuevoNombre("");
    setShowCreateModal(false);
    toast.success("Nuevo rol creado correctamente");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRol) return;
    const nextRoles = ajustes.roles.filter(r => r.id !== deleteRol.id);
    setAjustes({ roles: nextRoles });
    
    startTransition(async () => {
      if (!deleteRol.id.startsWith('rol-')) {
        await deleteRolFromSupabase(deleteRol.id);
      }
      await saveRolesToSupabase(nextRoles);
      setDeleteRol(null);
      toast.success("Rol eliminado con éxito");
    });
  };

  const filteredRoles = ajustes.roles.filter(r => 
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Roles y Permisos</h2>
          <p className="text-slate-500 text-sm">Gestiona el acceso de tus empleados por departamento</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Rol
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Buscar rol..." 
          className="pl-10 bg-white/50 border-slate-200 focus:bg-white transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {filteredRoles.map((rol) => {
          const isExpanded = expandedRol === rol.id;
          const { nav, ajustes: pAjustes } = buildPermisosCompletos(rol.permisos);

          return (
            <div 
              key={rol.id}
              className={`group overflow-hidden rounded-2xl border transition-all duration-300 ${
                isExpanded 
                  ? "bg-white border-blue-200 shadow-xl" 
                  : "bg-white/40 border-slate-100 hover:border-slate-200 shadow-sm"
              }`}
            >
              <div 
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedRol(isExpanded ? null : rol.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl transition-colors ${
                    isExpanded ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                  }`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{rol.nombre}</h3>
                    <p className="text-xs text-slate-500">
                      {rol.permisos?.length || 0} módulos configurados
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteRol(rol);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-6 pt-2 space-y-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="grid gap-6">
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                        Acceso a Módulos
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {nav.map((p) => (
                          <div 
                            key={p.modulo}
                            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-white hover:border-blue-100 transition-all group/item"
                          >
                            <span className="text-sm font-medium text-slate-700">{p.modulo}</span>
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Ver</span>
                                <Switch 
                                  checked={p.ver} 
                                  onCheckedChange={() => togglePermiso(rol.id, p.modulo, "ver")}
                                  className="data-[state=checked]:bg-blue-500"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Editar</span>
                                <Switch 
                                  checked={p.editar} 
                                  onCheckedChange={() => togglePermiso(rol.id, p.modulo, "editar")}
                                  className="data-[state=checked]:bg-blue-600"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                        <div className="flex items-center gap-3">
                          <Lock className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-semibold text-slate-800">Acceso a Configuración</span>
                        </div>
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">Ver Ajustes</span>
                            <Switch 
                              checked={pAjustes.ver} 
                              onCheckedChange={() => togglePermiso(rol.id, MODULO_AJUSTES, "ver")}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">Gestionar</span>
                            <Switch 
                              checked={pAjustes.editar} 
                              onCheckedChange={() => togglePermiso(rol.id, MODULO_AJUSTES, "editar")}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Crear */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Nuevo Rol</h3>
            <p className="text-slate-500 text-sm mb-6">Asigna un nombre descriptivo para el departamento o cargo.</p>
            <Input 
              placeholder="Ej: Encargado de Sala" 
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="mb-6 h-12 text-lg focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={handleCreateRol}>
                Crear Rol
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Borrado */}
      <ConfirmModal 
        isOpen={!!deleteRol}
        onClose={() => setDeleteRol(null)}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar este rol?"
        description={`Estás a punto de borrar el rol "${deleteRol?.nombre}". Esta acción es irreversible y podría afectar los permisos de los empleados asignados.`}
        confirmText="Eliminar permanentemente"
        isLoading={isPending}
      />
    </div>
  );
}
