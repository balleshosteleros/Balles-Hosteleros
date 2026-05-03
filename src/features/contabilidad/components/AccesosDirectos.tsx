"use client";

import { useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import type { AccesoApp } from "@/features/rrhh/data/accesos-apps";
import { listAccesosApps } from "@/features/rrhh/actions/accesos-apps-actions";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  departamento: string;
  max?: number;
}

export function AccesosDirectos({ departamento, max = 6 }: Props) {
  const { empresaActual } = useEmpresa();
  const [apps, setApps] = useState<AccesoApp[]>([]);

  useEffect(() => {
    let alive = true;
    listAccesosApps(empresaActual.id)
      .then((rows) => {
        if (!alive) return;
        const filtered = rows.filter(
          (a) => a.estado === "Activo" &&
            (a.departamentos.includes(departamento) || a.departamentos.includes("Todos")),
        );
        setApps(filtered.slice(0, max));
      })
      .catch((e) => console.error("[AccesosDirectos] load:", e));
    return () => { alive = false; };
  }, [empresaActual.id, departamento, max]);

  if (apps.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        🔗 Accesos rápidos
      </h3>
      <div className="flex flex-wrap gap-2">
        {apps.map((app) => (
          <Button key={app.id} variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <a href={app.url} target="_blank" rel="noopener noreferrer">
              <span>{app.icono}</span>
              {app.nombre}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
