"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TelefonoConfigPanel } from "@/features/ajustes/components/TelefonoConfigPanel";
import { HoraSecundariaPanel } from "@/features/ajustes/components/HoraSecundariaPanel";
import { ToolNotifPanel } from "@/features/ajustes/components/ToolNotifPanel";
import { NotifAutomaticasPanel } from "@/features/notificaciones/components/NotifAutomaticasPanel";
import { AplicacionesTab } from "@/features/ajustes/components/AplicacionesTab";
import { EmailRedaccionPanel } from "@/features/ajustes/components/EmailRedaccionPanel";
import { AccesosTab } from "@/features/ajustes/components/AccesosTab";
import type { ToolNotifKey } from "@/features/ajustes/data/ajustes";
import { HERRAMIENTAS, toolTextColor } from "@/features/layout/data/herramientas";
import { ArchivosConfigPanel } from "@/features/google-workspace/components/ArchivosConfigPanel";

// Iconos sin contador real → se oculta el toggle del círculo de aviso.
const SIN_BADGE = new Set<ToolNotifKey>(["videovigilancia", "aplicaciones"]);

export function HerramientasTab() {
  // Al volver de Google tras dar el permiso de Drive se abre "Archivos" sola:
  // si no, se aterriza en Ajustes con todo plegado y hay que buscar a mano
  // dónde estabas.
  const [abiertos, setAbiertos] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return new URLSearchParams(window.location.search).get("google") ===
      "vinculada"
      ? ["archivos"]
      : [];
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Herramientas</h2>
        <p className="text-sm text-muted-foreground">
          Configura ajustes globales de permisos y visualización para las
          herramientas del portal. Estos ajustes afectarán a todos los usuarios
          de la empresa.
        </p>
      </div>

      <Accordion
        type="multiple"
        value={abiertos}
        onValueChange={setAbiertos}
        className="rounded-lg border bg-card"
      >
        {HERRAMIENTAS.map(({ id, nombre, descripcion, Icon, colorKey }) => (
          <AccordionItem
            key={id}
            value={id}
            className="border-b last:border-b-0 px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <Icon className={`h-5 w-5 shrink-0 ${toolTextColor(colorKey)}`} />
                <div>
                  <div className="text-sm font-medium text-foreground">{nombre}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {descripcion}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {id === "notificaciones" ? (
                <NotifAutomaticasPanel />
              ) : id === "telefono" ? (
                <div className="space-y-6">
                  <TelefonoConfigPanel />
                  <div className="border-t pt-4">
                    <ToolNotifPanel toolKey="telefono" />
                  </div>
                </div>
              ) : id === "calendario" || id === "reuniones" ? (
                <div className="space-y-6">
                  <HoraSecundariaPanel />
                  <div className="border-t pt-4">
                    <ToolNotifPanel toolKey={id} hasBadge />
                  </div>
                </div>
              ) : id === "aplicaciones" ? (
                <div className="space-y-6">
                  <AplicacionesTab />
                  <div className="border-t pt-4">
                    <ToolNotifPanel toolKey="aplicaciones" hasBadge={false} />
                  </div>
                </div>
              ) : id === "email" ? (
                <div className="space-y-6">
                  <EmailRedaccionPanel />
                  <div className="border-t pt-4">
                    <ToolNotifPanel toolKey="email" hasBadge />
                  </div>
                </div>
              ) : id === "archivos" ? (
                // Sin panel de avisos: Archivos no tiene contador ni hace
                // falta anunciarlo con un pop-up (Iván, 27-ago).
                <ArchivosConfigPanel />
              ) : id === "accesos" ? (
                <AccesosTab />
              ) : (
                <ToolNotifPanel
                  toolKey={id}
                  hasBadge={!SIN_BADGE.has(id)}
                  withDiasAnuncio={id === "agenda"}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
