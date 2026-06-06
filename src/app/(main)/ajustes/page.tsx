"use client";

import { Users, Shield, Layers, Store, AppWindow, Palette, Wrench, UsersRound, Globe } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { UsuariosTab } from "@/features/ajustes/components/UsuariosTab";
import { RolesTab } from "@/features/ajustes/components/RolesTab";
import { DepartamentosTab } from "@/features/ajustes/components/DepartamentosTab";
import { EmpresasTab } from "@/features/ajustes/components/EmpresasTab";
import { AplicacionesTab } from "@/features/ajustes/components/AplicacionesTab";
import { ImagenMarcaTab } from "@/features/ajustes/components/ImagenMarcaTab";
import { HerramientasTab } from "@/features/ajustes/components/HerramientasTab";
import { RrhhConfigTab } from "@/features/ajustes/components/RrhhConfigTab";
import { useHydrateUsuarios } from "@/features/ajustes/hooks/use-hydrate-usuarios";

// scope: "global" = gestiona el grupo entero (catálogo de empresas).
//        "empresa" = configura únicamente la empresa activa del selector.
const tabs = [
  { id: "empresas",       label: "Empresas",        icon: Store,     scope: "global"  },
  { id: "imagen-marca",   label: "Imagen de marca", icon: Palette,   scope: "empresa" },
  { id: "usuarios",       label: "Usuarios",        icon: Users,     scope: "empresa" },
  { id: "roles",          label: "Roles",           icon: Shield,    scope: "empresa" },
  { id: "departamentos",  label: "Departamentos",   icon: Layers,    scope: "empresa" },
  { id: "rrhh",           label: "RRHH",            icon: UsersRound, scope: "empresa" },
  { id: "aplicaciones",   label: "Aplicaciones",    icon: AppWindow, scope: "empresa" },
  { id: "herramientas",   label: "Herramientas",    icon: Wrench,    scope: "empresa" },
] as const;

export default function AjustesPage() {
  useHydrateUsuarios();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { empresaActual } = useEmpresa();
  const tabParam = searchParams.get("tab");
  const activeTab = tabs.some((t) => t.id === tabParam) ? tabParam! : "empresas";
  const activeScope = tabs.find((t) => t.id === activeTab)?.scope ?? "empresa";

  return (
    <div className="p-3 md:p-4 space-y-2">
      <Tabs
        value={activeTab}
        onValueChange={(value) => router.replace(`/ajustes?tab=${value}`, { scroll: false })}
        className="space-y-2"
      >
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

        {/* Barra de contexto: indica el alcance de lo que se está editando */}
        {activeScope === "global" ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0 text-foreground/70" />
            <span>
              <span className="font-medium text-foreground">Catálogo del grupo</span> · gestiona todas las empresas. Los cambios aquí no
              dependen de la empresa seleccionada.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white shrink-0"
              style={{ backgroundColor: empresaActual.color }}
            >
              {empresaActual.iniciales}
            </span>
            <span>
              Estás configurando <span className="font-medium text-foreground">{empresaActual.nombre}</span> · estos ajustes solo afectan a
              esta empresa. Cambia de empresa en el selector para configurar otra.
            </span>
          </div>
        )}

        <TabsContent value="empresas"><EmpresasTab /></TabsContent>
        <TabsContent value="imagen-marca"><ImagenMarcaTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="departamentos"><DepartamentosTab /></TabsContent>
        <TabsContent value="rrhh"><RrhhConfigTab /></TabsContent>
        <TabsContent value="aplicaciones"><AplicacionesTab /></TabsContent>
        <TabsContent value="herramientas"><HerramientasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
