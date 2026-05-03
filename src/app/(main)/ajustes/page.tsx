"use client";

import { Users, Shield, Layers, Store, AppWindow } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuariosTab } from "@/features/ajustes/components/UsuariosTab";
import { RolesTab } from "@/features/ajustes/components/RolesTab";
import { DepartamentosTab } from "@/features/ajustes/components/DepartamentosTab";
import { EmpresasTab } from "@/features/ajustes/components/EmpresasTab";
import { AplicacionesTab } from "@/features/ajustes/components/AplicacionesTab";
import { useHydrateUsuarios } from "@/features/ajustes/hooks/use-hydrate-usuarios";

const tabs = [
  { id: "empresas",       label: "Empresas",        icon: Store     },
  { id: "usuarios",       label: "Usuarios",        icon: Users     },
  { id: "roles",          label: "Roles",           icon: Shield    },
  { id: "departamentos",  label: "Departamentos",   icon: Layers    },
  { id: "aplicaciones",   label: "Aplicaciones",    icon: AppWindow },
];

export default function AjustesPage() {
  useHydrateUsuarios();
  return (
    <div className="p-3 md:p-4 space-y-2">
      <Tabs defaultValue="empresas" className="space-y-2">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              aria-label={t.label}
              className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="empresas"><EmpresasTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="departamentos"><DepartamentosTab /></TabsContent>
        <TabsContent value="aplicaciones"><AplicacionesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
