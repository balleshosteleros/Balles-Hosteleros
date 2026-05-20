"use client";

import Link from "next/link";
import { Construction, ExternalLink } from "lucide-react";
import type { EmpleadoUI } from "@/features/rrhh/components/empleados/empleado-ui";

/**
 * Placeholder uniforme para los submódulos de RRHH dentro de la ficha de
 * empleado. La pestaña correspondiente debe enseñar la misma vista que
 * `/rrhh/<modulo>` pero filtrada al empleado actual; mientras esa
 * integración se hace por submódulo, aquí se muestra una pista clara
 * con un atajo a la vista global.
 */
export function SubmoduloPorEmpleadoPlaceholder({
  modulo,
  path,
  empleado,
}: {
  modulo: string;
  path: string;
  empleado: EmpleadoUI;
}) {
  const nombreCompleto = `${empleado.nombre} ${empleado.apellidos}`.trim();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-xl mx-auto">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Construction className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {modulo} de {nombreCompleto}
      </h3>
      <p className="text-sm text-muted-foreground mt-2">
        Aquí aparecerá la vista del submódulo <span className="font-medium">{modulo}</span>{" "}
        filtrada solo a este empleado, con el mismo formato que en el módulo
        general.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Pendiente de integrar la vista filtrada por <code>empleado_id</code>.
      </p>
      <Link
        href={path}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        Ver el módulo {modulo} completo
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
