import { useEmpresa } from "@/contexts/EmpresaContext";
import { getAccesosAppsPorDepartamento } from "@/data/accesos-apps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  departamento: string;
  max?: number;
}

export function AccesosDirectos({ departamento, max = 6 }: Props) {
  const { empresaActual } = useEmpresa();
  const apps = getAccesosAppsPorDepartamento(empresaActual.id, departamento).slice(0, max);

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
