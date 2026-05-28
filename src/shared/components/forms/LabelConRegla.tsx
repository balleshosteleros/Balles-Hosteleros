"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { cn } from "@/lib/utils";

interface LabelConReglaProps {
  /** Módulo del catálogo, ej: "logistica". */
  moduloKey: string;
  /** Submódulo del catálogo, ej: "proveedores". */
  submoduloKey: string;
  /** Key del campo dentro del catálogo, ej: "nombreComercial". */
  campoKey: string;
  /** Texto a mostrar. Si se omite, se usa el label del catálogo. */
  children: React.ReactNode;
  /** htmlFor opcional para conectar con el input. */
  htmlFor?: string;
  className?: string;
}

/**
 * Label de formulario que pinta `*` rojo si el campo está marcado como
 * obligatorio en el catálogo de reglas (modo activo de la empresa).
 *
 * Sincroniza UI con `useReglasSubmodulo(modulo, submodulo).esRequerido(campo)`,
 * por lo que cambiar el preset en Ajustes actualiza los asteriscos sin tocar el form.
 */
export function LabelConRegla({
  moduloKey,
  submoduloKey,
  campoKey,
  children,
  htmlFor,
  className,
}: LabelConReglaProps) {
  const { esRequerido, loading } = useReglasSubmodulo(moduloKey, submoduloKey);
  const requerido = !loading && esRequerido(campoKey);

  return (
    <Label
      htmlFor={htmlFor}
      data-required={requerido || undefined}
      className={cn("flex items-center gap-1", className)}
    >
      <span>{children}</span>
      {requerido && (
        <span aria-hidden="true" className="text-destructive font-semibold">
          *
        </span>
      )}
      {requerido && <span className="sr-only">obligatorio</span>}
    </Label>
  );
}
