import { Settings, Building2, Users, Shield, Layers, Mail, Cog, ClipboardList, HelpCircle, Briefcase, Store } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResumenGeneral } from "@/components/ajustes/ResumenGeneral";
import { DatosGeneralesTab } from "@/components/ajustes/DatosGeneralesTab";
import { UsuariosTab } from "@/components/ajustes/UsuariosTab";
import { RolesTab } from "@/components/ajustes/RolesTab";
import { DepartamentosTab } from "@/components/ajustes/DepartamentosTab";
import { ContactosTab } from "@/components/ajustes/ContactosTab";
import { ConfigOperativaTab } from "@/components/ajustes/ConfigOperativaTab";
import { AuditoriaTab } from "@/components/ajustes/AuditoriaTab";
import { AyudaAdminTab } from "@/components/ajustes/AyudaAdminTab";
import { PuestosEmpresaTab } from "@/components/ajustes/PuestosEmpresaTab";
import { EmpresasTab } from "@/components/ajustes/EmpresasTab";

const tabs = [
  { id: "resumen", label: "Resumen", icon: Building2 },
  { id: "empresas", label: "Empresas", icon: Store },
  { id: "datos", label: "Datos generales", icon: ClipboardList },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "puestos", label: "Puestos de empresa", icon: Briefcase },
  { id: "departamentos", label: "Departamentos", icon: Layers },
  { id: "contactos", label: "Contactos", icon: Mail },
  { id: "operativa", label: "Config. operativa", icon: Cog },
  { id: "auditoria", label: "Auditoría", icon: ClipboardList },
  { id: "ayuda", label: "Ayuda", icon: HelpCircle },
];

export default function Ajustes() {
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
        <TabsContent value="contactos"><ContactosTab /></TabsContent>
        <TabsContent value="operativa"><ConfigOperativaTab /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab /></TabsContent>
        <TabsContent value="ayuda"><AyudaAdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}