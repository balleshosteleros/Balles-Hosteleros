"use client";

import { Users, Shield, Layers, Store, Rocket, Palette, Mail, Calendar as CalendarIcon, Video, MessageCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuariosTab } from "@/features/ajustes/components/UsuariosTab";
import { RolesTab } from "@/features/ajustes/components/RolesTab";
import { DepartamentosTab } from "@/features/ajustes/components/DepartamentosTab";
import { EmpresaTab } from "@/features/ajustes/components/EmpresaTab";
import { AplicacionesTab } from "@/features/ajustes/components/AplicacionesTab";
import { ImagenMarcaTab } from "@/features/ajustes/components/ImagenMarcaTab";
import { HerramientasTab } from "@/features/ajustes/components/HerramientasTab";
import { useHydrateUsuarios } from "@/features/ajustes/hooks/use-hydrate-usuarios";

// Mini-icono compuesto: rejilla 2×2 con 4 iconos de herramientas reales
// (Correo, Calendario, Meet y Comunicación interna).
function HerramientasIcon({ className }: { className?: string }) {
  return (
    <span className={cn("grid grid-cols-2 grid-rows-2 gap-px", className)}>
      <Mail className="h-full w-full" />
      <CalendarIcon className="h-full w-full" />
      <Video className="h-full w-full" />
      <MessageCircle className="h-full w-full" />
    </span>
  );
}

// Todas las pestañas configuran ÚNICAMENTE la empresa activa del selector.
// El catálogo del grupo (crear/borrar/cambiar de empresa) vive en /empresas.
const tabs = [
  { id: "empresa",        label: "Empresa",         icon: Store      },
  { id: "imagen-marca",   label: "Imagen de marca", icon: Palette    },
  { id: "usuarios",       label: "Usuarios",        icon: Users      },
  { id: "roles",          label: "Roles",           icon: Shield     },
  { id: "departamentos",  label: "Departamentos",   icon: Layers     },
  { id: "herramientas",   label: "Herramientas",    icon: HerramientasIcon },
  { id: "aplicaciones",   label: "Aplicaciones",    icon: Rocket           },
] as const;

export default function AjustesPage() {
  useHydrateUsuarios();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabs.some((t) => t.id === tabParam) ? tabParam! : "empresa";

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

        <TabsContent value="empresa"><EmpresaTab /></TabsContent>
        <TabsContent value="imagen-marca"><ImagenMarcaTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="departamentos"><DepartamentosTab /></TabsContent>
        <TabsContent value="aplicaciones"><AplicacionesTab /></TabsContent>
        <TabsContent value="herramientas"><HerramientasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
