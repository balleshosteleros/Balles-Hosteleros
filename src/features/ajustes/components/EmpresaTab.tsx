"use client";

import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ConfiguracionTab } from "@/features/ajustes/components/ConfiguracionTab";
import { LocalesEmpresaTab } from "@/features/ajustes/components/locales/LocalesEmpresaTab";

/**
 * Editor de la empresa ACTIVA (la del selector de arriba). Ya no hay selector
 * intermedio: se entra directamente a configurar la empresa en la que estás.
 * El catálogo del grupo (crear/borrar/cambiar de empresa) vive en /empresas.
 */
export function EmpresaTab() {
  const { empresaActual } = useEmpresa();
  return (
    <div className="space-y-4">
      <ConfiguracionTab />
      <LocalesEmpresaTab empresaId={empresaActual.dbId} />
    </div>
  );
}
