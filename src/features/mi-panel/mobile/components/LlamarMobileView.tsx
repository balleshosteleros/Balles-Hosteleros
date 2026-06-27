"use client";

/**
 * LlamarMobileView — pantalla "Llamar" de la app móvil.
 *
 * Dos secciones tipo "WhatsApp interno":
 *  - Compañeros: llamadas internas gratis empleado↔empleado por internet (WebRTC, PRP-054).
 *  - Contactos:  agenda de la empresa; marca con el teléfono del móvil (tel:).
 *
 * El receptor de llamadas (LlamadasProvider) es global, así que iniciar una
 * llamada aquí muestra la UI de llamada en curso en cualquier pantalla.
 */

import { useState } from "react";
import { Users, BookUser } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { DirectorioEmpleados } from "@/features/llamadas-internas/components/DirectorioEmpleados";
import { AgendaMobile } from "@/features/agenda/mobile/AgendaMobile";

const TABS = [
  { key: "companeros" as const, label: "Compañeros", icon: Users },
  { key: "contactos" as const, label: "Contactos", icon: BookUser },
];

export function LlamarMobileView() {
  const [tab, setTab] = useState<"companeros" | "contactos">("companeros");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 rounded-full bg-muted p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors",
                tab === t.key
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

      {tab === "companeros" ? (
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
