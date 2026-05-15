"use client";

import { useEffect, useState } from "react";
import {
  getEmpresasAccesibles,
  type EmpresaAccesible,
} from "@/features/empresa/actions/empresas-accesibles-actions";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Copy } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// Selector multi-empresa para replicar la creación en otras empresas a las
// que el usuario tiene acceso. Si solo tiene 1 empresa accesible no se
// renderiza nada.
//
// La empresa actual (empresaActualId) viene siempre seleccionada y NO se
// puede deseleccionar (es la mínima donde se crea).
export function SelectorReplicarEmpresas({
  empresaActualId,
  seleccionadas,
  onChange,
  className,
}: {
  empresaActualId: string;
  seleccionadas: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [empresas, setEmpresas] = useState<EmpresaAccesible[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    getEmpresasAccesibles().then((res) => {
      if (cancelado) return;
      setCargado(true);
      if (res.ok) {
        setEmpresas(res.data);
        if (
          seleccionadas.length === 0 &&
          res.data.some((e) => matches(e, empresaActualId))
        ) {
          onChange([empresaActualId]);
        }
      }
    });
    return () => {
      cancelado = true;
    };
  }, [empresaActualId, onChange, seleccionadas.length]);

  if (!cargado || empresas.length <= 1) return null;

  const toggle = (e: EmpresaAccesible) => {
    if (matches(e, empresaActualId)) return; // no permitir desmarcar la actual
    const key = e.slug ?? e.id;
    const yaEsta = seleccionadas.includes(key);
    if (yaEsta) onChange(seleccionadas.filter((x) => x !== key));
    else onChange([...seleccionadas, key]);
  };

  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/30 p-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Copy className="h-4 w-4 text-primary" />
        <span>Replicar en otras empresas</span>
      </div>
      <div className="space-y-1.5">
        {empresas.map((e) => {
          const isActual = matches(e, empresaActualId);
          const key = e.slug ?? e.id;
          const checked = seleccionadas.includes(key) || isActual;
          return (
            <label
              key={e.id}
              className={cn(
                "flex items-center gap-2 text-sm cursor-pointer",
                isActual && "opacity-70 cursor-default",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={isActual}
                onCheckedChange={() => toggle(e)}
              />
              <span className="font-medium">{e.nombre}</span>
              {isActual && (
                <span className="text-xs text-muted-foreground">(actual)</span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Se creará una copia independiente en cada empresa marcada.
      </p>
    </div>
  );
}

function matches(e: EmpresaAccesible, idOrSlug: string) {
  return e.id === idOrSlug || e.slug === idOrSlug;
}
