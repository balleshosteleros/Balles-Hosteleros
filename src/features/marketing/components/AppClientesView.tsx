"use client";

/**
 * Vista del submódulo "App clientes" (Marketing → App clientes).
 *
 * Por ahora aloja la configuración de la landing/QR de captación que antes
 * vivía por error en Ajustes → Herramientas. Aquí crecerá la app de clientes
 * completa más adelante.
 */

import { AppClientesConfigPanel } from "@/features/marketing/components/AppClientesConfigPanel";

export function AppClientesView() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <AppClientesConfigPanel />
    </div>
  );
}
