"use client";

import { useState, useEffect, useTransition } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Rol } from "@/features/ajustes/data/ajustes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, Settings, Users, Cctv, Rocket, Lock } from "lucide-react";
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
const MODULO_CAMARAS = "CÁMARAS";
// Dos permisos independientes en la barra de herramientas:
//  · APLICACIONES (cohete) → enlaces/accesos directos a apps externas.
//  · ACCESOS (candado)     → bóveda de accesos y contraseñas.
const MODULO_APLICACIONES = "HERR_APLICACIONES";
const MODULO_ACCESOS = "HERR_ACCESOS";

function buildPermisosCompletos(overrides: Rol["permisos"] = []): {
  nav: Rol["permisos"];
  ajustes: Rol["permisos"][0];
  camaras: Rol["permisos"][0];
  aplicaciones: Rol["permisos"][0];
  accesos: Rol["permisos"][0];
} {
  const find = (m: string) => overrides.find((p) => p.modulo === m);
  const nav = MODULOS_NAV.map((m) => find(m) ?? { modulo: m, ver: false, editar: false });
  const ajustes = find(MODULO_AJUSTES) ?? { modulo: MODULO_AJUSTES, ver: false, editar: false };
  const camaras = find(MODULO_CAMARAS) ?? { modulo: MODULO_CAMARAS, ver: false, editar: false };
  const aplicaciones = find(MODULO_APLICACIONES) ?? { modulo: MODULO_APLICACIONES, ver: false, editar: false };
  const accesos = find(MODULO_ACCESOS) ?? { modulo: MODULO_ACCESOS, ver: false, editar: false };
  return { nav, ajustes, camaras, aplicaciones, accesos };
}

export function RolesTab() {
  const { ajustes, setAjustes, empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;
  const [expandedRol, setExpandedRol] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [usuariosSupabase, setUsuariosSupabase] = useState<UsuarioRol[]>([]);

  // Cargar roles desde Supabase al montar y al cambiar de empresa.
  // Si la BD no devuelve nada (auth aún cargando, error transitorio, etc.) NO
  // tocamos el state — escribir [] dispararía el fallback a defaults en
  // mergeWithDefaults y mostraríamos permisos en cero falsos.
  useEffect(() => {
    (async () => {
      const rolesRemote = await loadRolesFromSupabase(empresaDbId);
      if (rolesRemote && rolesRemote.length > 0) {
        setAjustes((prev) => ({ ...prev, roles: rolesRemote }));
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



  return (
    <div className="space-y-2">
      {ajustes.roles.map((rol) => {
        const isOpen = expandedRol === rol.id;
        const { nav: permisosNav, ajustes: permisoAjustes, camaras: permisoCamaras, aplicaciones: permisoAplicaciones, accesos: permisoAccesos } = buildPermisosCompletos(rol.permisos);
        const TOTAL_MODULOS = MODULOS_NAV.length + 4; // 11 nav + AJUSTES + CÁMARAS + APLICACIONES + ACCESOS
        const accesosCount = [...permisosNav, permisoAjustes, permisoCamaras, permisoAplicaciones, permisoAccesos].filter((p) => p.ver).length;
        const usuariosConRol = usuariosSupabase.filter(
          (u) => u.rolLabel.toLowerCase() === rol.nombre.trim().toLowerCase()
        );

        return (
          <Card key={rol.id}>
            <CardHeader className="py-2 px-4 cursor-pointer select-none" onClick={() => setExpandedRol(isOpen ? null : rol.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold">{rol.nombre}</span>
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

                {/*
                  Permisos sueltos: no son departamentos del índice lateral,
                  son las llaves de AJUSTES y de las herramientas de la barra.
                  Cada tarjeta lleva SOLO el icono y la palabra con la que se
                  conoce la herramienta (la misma del tooltip de la barra) y su
                  interruptor de acceso. Sin repetir el nombre dos veces.
                */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    { modulo: MODULO_AJUSTES, label: "Ajustes", Icon: Settings, permiso: permisoAjustes },
                    { modulo: MODULO_CAMARAS, label: "Videovigilancia", Icon: Cctv, permiso: permisoCamaras },
                    { modulo: MODULO_APLICACIONES, label: "Aplicaciones", Icon: Rocket, permiso: permisoAplicaciones },
                    { modulo: MODULO_ACCESOS, label: "Accesos y contraseñas", Icon: Lock, permiso: permisoAccesos },
                  ].map(({ modulo, label, Icon, permiso }) => (
                    <div
                      key={modulo}
                      className="flex items-center justify-between gap-3 rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">{label}</span>
                      </div>
                      <Switch
                        checked={permiso.ver}
                        onCheckedChange={() => toggleAcceso(rol.id, modulo)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

    </div>
  );
}
