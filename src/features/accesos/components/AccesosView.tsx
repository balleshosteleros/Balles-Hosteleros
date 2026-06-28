"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { SubmoduleToolbar, coincideBusquedaUniversal } from "@/shared/components/SubmoduleToolbar";
import { listApps, listRolesEmpresa } from "../actions/apps-actions";
import { listCredencialesVisibles } from "../actions/credenciales-actions";
import type { AppExterna, Credencial, RolOption } from "../data/tipos";
import { AppCard } from "./AppCard";
import { AppFormDialog } from "./AppFormDialog";
import { CredencialesDrawer } from "./CredencialesDrawer";
import { VerificacionAccesosProvider } from "./useVerificacionAccesos";
import { useAuth } from "@/features/auth/contexts/auth-context";

const ROLES_MANAGE = ["DIRECCIÓN", "GERENCIA", "DIRECTOR"];

export function AccesosView() {
  const [apps, setApps] = useState<AppExterna[]>([]);
  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppExterna | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appFormOpen, setAppFormOpen] = useState(false);

  const { roles: appRoles, profile } = useAuth();
  const canManage = useMemo(() => {
    if (appRoles.includes("admin") || appRoles.includes("director")) return true;
    const label = profile?.rol_label?.toUpperCase().trim();
    return label ? ROLES_MANAGE.includes(label) : false;
  }, [appRoles, profile]);

  async function refresh() {
    setLoading(true);
    const [appsList, credList, rolesList] = await Promise.all([
      listApps(),
      listCredencialesVisibles(),
      listRolesEmpresa(),
    ]);
    setApps(appsList);
    setCredenciales(credList);
    setRoles(rolesList);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const credsPorApp = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of credenciales) {
      map.set(c.app_id, (map.get(c.app_id) ?? 0) + 1);
    }
    return map;
  }, [credenciales]);

  const appsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return apps;
    return apps.filter((a) =>
      coincideBusquedaUniversal(
        { nombre: a.nombre, categoria: a.categoria, notas: a.notas, url: a.url },
        busqueda,
      ),
    );
  }, [apps, busqueda]);

  function handleAppClick(app: AppExterna) {
    setSelectedApp(app);
    setDrawerOpen(true);
  }

  return (
    <VerificacionAccesosProvider>
    <div className="p-4 sm:p-6 space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar app..."
        onNuevo={canManage ? () => setAppFormOpen(true) : undefined}
        textoNuevo="Nueva app"
        ocultarNuevo={!canManage}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : appsFiltradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {busqueda
              ? "No hay apps que coincidan con tu búsqueda."
              : canManage
                ? "Aún no hay apps. Crea la primera con \"+ Nueva app\"."
                : "No hay apps disponibles."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {appsFiltradas.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              credencialesVisibles={credsPorApp.get(app.id) ?? 0}
              onClick={() => handleAppClick(app)}
            />
          ))}
        </div>
      )}

      <AppFormDialog
        open={appFormOpen}
        onOpenChange={setAppFormOpen}
        app={null}
        onSaved={refresh}
      />

      <CredencialesDrawer
        app={selectedApp}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setSelectedApp(null);
        }}
        canManage={canManage}
        roles={roles}
        onAppChanged={refresh}
      />
    </div>
    </VerificacionAccesosProvider>
  );
}
