"use client";

/**
 * LlamarMobileView — pantalla "Llamar" de la app móvil.
 *
 * Dos secciones tipo "WhatsApp interno":
 *  - Compañeros: llamadas internas gratis empleado↔empleado por internet (WebRTC, PRP-054).
 *  - Contactos:  agenda de la empresa; marca con el teléfono del móvil (tel:).
 *
 * La pestaña Contactos EXIGE el permiso AGENDA del rol (Ajustes → Roles): dentro
 * están los teléfonos y correos personales de los empleados. Sin ese permiso solo
 * quedan los compañeros, a los que se llama por la app sin ver ningún dato suyo.
 *
 * El receptor de llamadas (LlamadasProvider) es global, así que iniciar una
 * llamada aquí muestra la UI de llamada en curso en cualquier pantalla.
 */

import { useState } from "react";
import { Users, BookUser } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { DirectorioEmpleados } from "@/features/llamadas-internas/components/DirectorioEmpleados";
import { AgendaMobile } from "@/features/agenda/mobile/AgendaMobile";
import { useAuth } from "@/features/auth/contexts/auth-context";

const TAB_COMPANEROS = { key: "companeros" as const, label: "Compañeros", icon: Users };
const TAB_CONTACTOS = { key: "contactos" as const, label: "Contactos", icon: BookUser };

export function LlamarMobileView() {
  const { puedeVer } = useAuth();
  const verAgenda = puedeVer("HERR_AGENDA");
  const tabs = verAgenda ? [TAB_COMPANEROS, TAB_CONTACTOS] : [TAB_COMPANEROS];
  const [tab, setTab] = useState<"companeros" | "contactos">("companeros");
  const tabActiva = verAgenda ? tab : "companeros";

  return (
    <div className="flex flex-col gap-4">
      {verAgenda && (
      <div className="flex gap-1.5 rounded-full bg-muted p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors",
                tabActiva === t.key
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      )}

      {tabActiva === "companeros" ? (
        <div>
          <p className="mb-3 text-xs text-muted-foreground">
            Llamada gratis por internet a tus compañeros conectados.
          </p>
          <DirectorioEmpleados />
        </div>
      ) : (
        <AgendaMobile />
      )}
    </div>
  );
}
