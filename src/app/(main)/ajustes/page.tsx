"use client";

import { Settings, Building2, Users, Shield, Layers, Cog, ClipboardList, HelpCircle, Briefcase, Store } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResumenGeneral } from "@/features/ajustes/components/ResumenGeneral";
import { DatosGeneralesTab } from "@/features/ajustes/components/DatosGeneralesTab";
import { UsuariosTab } from "@/features/ajustes/components/UsuariosTab";
import { RolesTab } from "@/features/ajustes/components/RolesTab";
import { DepartamentosTab } from "@/features/ajustes/components/DepartamentosTab";
import { ConfigOperativaTab } from "@/features/ajustes/components/ConfigOperativaTab";
import { AuditoriaTab } from "@/features/ajustes/components/AuditoriaTab";
import { AyudaAdminTab } from "@/features/ajustes/components/AyudaAdminTab";
import { PuestosEmpresaTab } from "@/features/ajustes/components/PuestosEmpresaTab";
import { EmpresasTab } from "@/features/ajustes/components/EmpresasTab";

const tabs = [
  { id: "resumen", label: "Resumen", icon: Building2 },
  { id: "empresas", label: "Empresas", icon: Store },
  { id: "datos", label: "Datos generales", icon: ClipboardList },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "puestos", label: "Puestos de empresa", icon: Briefcase },
  { id: "departamentos", label: "Departamentos", icon: Layers },
  { id: "operativa", label: "Config. operativa", icon: Cog },
  { id: "auditoria", label: "Auditoría", icon: ClipboardList },
  { id: "ayuda", label: "Ayuda", icon: HelpCircle },
];

export default function AjustesPage() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">AJUSTES</h1>
          <p className="text-sm text-muted-foreground">Configuración de la empresa</p>
        </div>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs data-[state=active]:bg-background">
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen"><ResumenGeneral /></TabsContent>
        <TabsContent value="empresas"><EmpresasTab /></TabsContent>
        <TabsContent value="datos"><DatosGeneralesTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="puestos"><PuestosEmpresaTab /></TabsContent>
        <TabsContent value="departamentos"><DepartamentosTab /></TabsContent>
        <TabsContent value="operativa"><ConfigOperativaTab /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab /></TabsContent>
        <TabsContent value="ayuda"><AyudaAdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}
