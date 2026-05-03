"use client";

import { Users, Shield, Layers, Settings, Store, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfiguracionTab } from "@/features/ajustes/components/ConfiguracionTab";
import { UsuariosTab } from "@/features/ajustes/components/UsuariosTab";
import { RolesTab } from "@/features/ajustes/components/RolesTab";
import { DepartamentosTab } from "@/features/ajustes/components/DepartamentosTab";
import { EmpresasTab } from "@/features/ajustes/components/EmpresasTab";
import { ToquesAdminTab } from "@/features/toques/components/admin/ToquesAdminTab";

const tabs = [
  { id: "empresas",       label: "Empresas",        icon: Store,    isConfig: false },
  { id: "usuarios",       label: "Usuarios",        icon: Users,    isConfig: false },
  { id: "roles",          label: "Roles",           icon: Shield,   isConfig: false },
  { id: "departamentos",  label: "Departamentos",   icon: Layers,   isConfig: false },
  { id: "toques",         label: "Toques",          icon: Trophy,   isConfig: false },
  { id: "configuracion",  label: "Configuración",   icon: Settings, isConfig: true  },
];

export default function AjustesPage() {
  return (
    <div className="p-3 md:p-4 space-y-2">
      <Tabs defaultValue="empresas" className="space-y-2">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              aria-label={t.label}
              className={`gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm ${t.isConfig ? "ml-auto" : ""}`}
            >
              <t.icon className="h-3.5 w-3.5" strokeWidth={t.isConfig ? 1.75 : undefined} />
              {!t.isConfig && <span className="hidden sm:inline">{t.label}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="empresas"><EmpresasTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="departamentos"><DepartamentosTab /></TabsContent>
        <TabsContent value="toques"><ToquesAdminTab /></TabsContent>
        <TabsContent value="configuracion"><ConfiguracionTab /></TabsContent>
      </Tabs>
    </div>
  );
}
