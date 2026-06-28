"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TelefonoConfigPanel } from "@/features/ajustes/components/TelefonoConfigPanel";
import { HoraSecundariaPanel } from "@/features/ajustes/components/HoraSecundariaPanel";
import { ToolNotifPanel } from "@/features/ajustes/components/ToolNotifPanel";
import { AplicacionesTab } from "@/features/ajustes/components/AplicacionesTab";
import type { ToolNotifKey } from "@/features/ajustes/data/ajustes";
import { HERRAMIENTAS, toolTextColor } from "@/features/layout/data/herramientas";

// Iconos sin contador real → se oculta el toggle del círculo de aviso.
const SIN_BADGE = new Set<ToolNotifKey>(["videovigilancia", "aplicaciones"]);

export function HerramientasTab() {
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

      <Accordion type="multiple" className="rounded-lg border bg-card">
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
                <p className="py-4 text-sm text-muted-foreground">
                  Los avisos del sistema dirigidos al empleado se gestionan
                  automáticamente. Próximamente podrás configurar aquí sus
                  preferencias (silenciar tipos, frecuencia de recordatorio…).
                </p>
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
