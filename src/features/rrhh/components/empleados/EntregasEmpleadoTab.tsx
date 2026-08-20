"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PackageCheck, Shirt, Package, Loader2, AlertTriangle,
} from "lucide-react";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import { listEntregasPorEmpleado } from "@/features/rrhh/actions/entregas-actions";
import {
  ESTADO_LABEL,
  ESTADO_COLOR,
  resumirMaterial,
  type Entrega,
} from "@/features/rrhh/data/entregas";

/**
 * Pestaña "Entregas" de la ficha del empleado.
 *
 * SOLO LECTURA: la ficha consulta, nunca da de alta ni edita. Registrar una
 * entrega o marcar una devolución se hace únicamente desde el módulo Entregas,
 * que es la fuente única; aquí solo se enlaza a él.
 *
 * Arriba, lo que el trabajador TIENE ahora mismo (resumen de lo firmado).
 * Debajo, el histórico de cada entrega con su nota.
 */
export function EntregasEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const { empresaActual } = useEmpresa();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await listEntregasPorEmpleado(empleadoId);
    setEntregas(data);
    setLoading(false);
  }, [empleadoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const fmt = (s: string | null): string => {
    if (!s) return "—";
    return formatFechaEnZona(s, empresaActual.zonaHoraria) || s;
  };

  const resumen = useMemo(() => resumirMaterial(entregas), [entregas]);
  const sinDevolver = useMemo(
    () => resumen.filter((r) => r.pendienteDevolucion > 0),
    [resumen],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Uniforme y material
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entregas.length === 0
              ? "Sin entregas registradas"
              : `${entregas.length} ${entregas.length === 1 ? "entrega" : "entregas"}`}
            {sinDevolver.length > 0 && ` · ${sinDevolver.length} sin devolver`}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/rrhh/entregas">Ir al módulo</a>
        </Button>
      </div>

      {/* Lo que tiene ahora mismo */}
      {resumen.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Tiene ahora mismo</p>
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
                      Sin devolver
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {sinDevolver.length > 0 && (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Al darle de baja hay que confirmar que devuelve lo marcado.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {entregas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Todavía no se le ha entregado nada.
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

                <div className="flex items-center gap-2 text-sm">
                  {e.item?.categoria === "uniforme" ? (
                    <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={e.devueltaEn ? "text-muted-foreground line-through" : ""}>
                    {e.item?.tipoNombre ?? "—"}
                    {e.item?.talla && ` · talla ${e.item.talla}`}
                  </span>
                  {e.devueltaEn && (
                    <span className="text-xs text-muted-foreground">
                      devuelto el {fmt(e.devueltaEn)}
                    </span>
                  )}
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
