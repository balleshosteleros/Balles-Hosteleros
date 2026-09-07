"use client";

/**
 * Los embudos, con sus pasos EN ORDEN (PRP-088).
 *
 * En la lista de páginas los pasos salen sueltos y ordenados por fecha, que es
 * justo como no se entiende un embudo: lo que importa es por dónde entra la
 * gente y en qué orden avanza.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Eye, Filter, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarEmbudos, type EmbudoConPasos } from "../../actions/embudos-actions";

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  ARCHIVADA: "Archivada",
};

export function EmbudosPanel({ recargar }: { recargar?: number }) {
  const [embudos, setEmbudos] = useState<EmbudoConPasos[]>([]);

  const cargar = useCallback(async () => {
    const res = await listarEmbudos();
    if (res.ok) setEmbudos(res.data);
    else toast.error(res.error);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, recargar]);

  if (embudos.length === 0) return null;

  return (
    <div className="space-y-3">
      {embudos.map((embudo) => (
        <Card key={embudo.id} className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{embudo.nombre}</h2>
            <span className="text-xs text-muted-foreground">
              {embudo.pasos.length} {embudo.pasos.length === 1 ? "paso" : "pasos"}
            </span>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
            {embudo.pasos.map((paso, i) => (
              <div key={paso.id} className="flex items-center gap-2 lg:flex-1">
                <div className="min-w-0 flex-1 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={paso.nombre}>
                        {paso.nombre}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        /{paso.slug_interno}
                      </p>
                    </div>
                    <Badge
                      variant={paso.estado === "PUBLICADA" ? "secondary" : "outline"}
                      className="shrink-0 font-normal"
                    >
                      {ESTADO_LABEL[paso.estado] ?? paso.estado}
                    </Badge>
                  </div>

                  <div className="mt-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Ver la página"
                      onClick={() =>
                        window.open(`/pagina-web-preview/${paso.id}`, "_blank", "noopener,noreferrer")
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Link href={`/marketing/pagina-web/${paso.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    {paso.replica_origen_url && (
                      <span className="ml-auto text-[10px] text-muted-foreground">Copia</span>
                    )}
                  </div>
                </div>

                {i < embudo.pasos.length - 1 && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
