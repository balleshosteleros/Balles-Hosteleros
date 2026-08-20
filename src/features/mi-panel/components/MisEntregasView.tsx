"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PackageCheck, Shirt, Package, Loader2, AlertTriangle } from "lucide-react";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import { listMisEntregas } from "@/features/rrhh/actions/entregas-actions";
import {
  ESTADO_LABEL,
  ESTADO_COLOR,
  resumirMaterial,
  type Entrega,
} from "@/features/rrhh/data/entregas";

/**
 * Portal del trabajador: el uniforme y el material que tiene, y el histórico
 * de lo que le han ido entregando.
 */
export function MisEntregasView() {
  const { empresaActual } = useEmpresa();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);

  useEffect(() => {
    let cancel = false;
    void listMisEntregas().then((data) => {
      if (cancel) return;
      setEntregas(data);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, []);

  const fmt = (s: string | null): string => {
    if (!s) return "—";
    return formatFechaEnZona(s, empresaActual.zonaHoraria) || s;
  };

  const resumen = useMemo(() => resumirMaterial(entregas), [entregas]);
  const hayPendienteDevolucion = resumen.some((r) => r.pendienteDevolucion > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 pb-28">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" />
          Mis entregas
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          El uniforme y el material que la empresa te ha entregado.
        </p>
      </div>

      {resumen.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Tienes ahora mismo</p>
            <div className="flex flex-wrap gap-2">
              {resumen.map((r) => (
                <div
                  key={`${r.categoria}-${r.tipoNombre}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5"
                >
                  {r.categoria === "uniforme" ? (
                    <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm text-foreground">
                    {r.cantidad > 1 && `${r.cantidad}× `}
                    {r.tipoNombre}
                    {r.tallas.length > 0 && ` · talla ${r.tallas.join(", ")}`}
                  </span>
                  {r.pendienteDevolucion > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      Hay que devolverlo
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {hayPendienteDevolucion && (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Lo marcado hay que devolverlo cuando dejes la empresa.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {entregas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Todavía no tienes ninguna entrega registrada.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Histórico</p>
          {entregas.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{fmt(e.fecha)}</span>
                  <Badge variant="outline" className={ESTADO_COLOR[e.estado]}>
                    {ESTADO_LABEL[e.estado]}
                  </Badge>
                </div>

                <div className="space-y-1">
                  {e.items.map((i) => (
                    <div key={i.id} className="flex items-center gap-2 text-sm">
                      {i.categoria === "uniforme" ? (
                        <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className={i.devueltoEn ? "text-muted-foreground line-through" : ""}>
                        {i.cantidad > 1 && `${i.cantidad}× `}
                        {i.tipoNombre}
                        {i.talla && ` · talla ${i.talla}`}
                      </span>
                      {i.devueltoEn && (
                        <span className="text-xs text-muted-foreground">
                          devuelto el {fmt(i.devueltoEn)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {e.nota && <p className="text-xs text-muted-foreground italic">{e.nota}</p>}

                {e.entregadoPorNombre && (
                  <p className="text-xs text-muted-foreground">
                    Entregado por {e.entregadoPorNombre}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
