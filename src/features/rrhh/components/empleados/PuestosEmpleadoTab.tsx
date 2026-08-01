"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCondicionesVigentesEmpleado,
  getHistorialCondicionesEmpleado,
  type CondicionesActualesEmpleado,
  type CondicionHistorica,
} from "@/features/rrhh/actions/promocion-interna-actions";
import { getPuestosDeEmpleado, type PuestoDeEmpleado } from "@/features/rrhh/actions/empleado-puestos-actions";
import { Briefcase, Loader2, History } from "lucide-react";

/**
 * Pestaña "Puestos" de la ficha del empleado. Solo lectura: muestra el puesto
 * actual con sus condiciones vigentes y el histórico de cambios de puesto.
 *
 * El histórico SOLO se modifica desde el módulo Puestos (alta al contratar o
 * cambio de puesto / promoción interna); esta vista únicamente lo refleja.
 */
export function PuestosEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const [puestos, setPuestos] = useState<PuestoDeEmpleado[]>([]);
  const [actual, setActual] = useState<CondicionesActualesEmpleado | null>(null);
  const [historial, setHistorial] = useState<CondicionHistorica[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    Promise.all([
      getPuestosDeEmpleado(empleadoId),
      getCondicionesVigentesEmpleado(empleadoId),
      getHistorialCondicionesEmpleado(empleadoId),
    ])
      .then(([ps, cond, hist]) => {
        if (!activo) return;
        setPuestos(ps);
        setActual(cond.ok ? cond.data : null);
        setHistorial(hist.ok ? hist.data : []);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [empleadoId]);

  if (cargando) {
    return (
      <Card className="p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  const principal = puestos.find((p) => p.esPrincipal) ?? puestos[0] ?? null;
  const secundarios = puestos.filter((p) => p !== principal);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Puesto actual + condiciones vigentes */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Puesto actual</h2>
        </div>

        {principal ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xl font-medium">{principal.nombre}</span>
              {principal.departamentoNombre && (
                <Badge variant="secondary">{principal.departamentoNombre}</Badge>
              )}
              {actual?.nivel != null && (
                <Badge variant="outline">Nivel {actual.nivel}</Badge>
              )}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              <Campo etiqueta="Salario neto" valor={formatoEuro(actual?.salarioNeto)} />
              <Campo etiqueta="Tipo de contrato" valor={actual?.tipoContrato ?? "—"} />
              <Campo etiqueta="Jornada" valor={actual?.jornada ?? "—"} />
              <Campo
                etiqueta="Horas semanales"
                valor={actual?.horasSemanales != null ? formatoNumero(actual.horasSemanales) : "—"}
              />
            </dl>

            {secundarios.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Otros puestos</p>
                <div className="flex flex-wrap gap-2">
                  {secundarios.map((p) => (
                    <Badge key={p.puestoId || p.nombre} variant="outline">
                      {p.nombre}
                      {p.departamentoNombre ? ` · ${p.departamentoNombre}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este empleado no tiene ningún puesto asignado.
          </p>
        )}
      </Card>

      {/* Histórico de puestos */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Histórico de puestos</h2>
        </div>

        {historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cambios registrados. El histórico se genera al contratar y en cada
            cambio de puesto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">Puesto</th>
                  <th className="py-2 pr-4 font-medium">Nivel</th>
                  <th className="py-2 pr-4 font-medium">Salario neto</th>
                  <th className="py-2 pr-4 font-medium">Jornada</th>
                  <th className="py-2 pr-4 font-medium">Contrato</th>
                  <th className="py-2 pr-4 font-medium">Vigencia</th>
                  <th className="py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-2">
                        {h.puesto ?? "—"}
                        {h.vigente && (
                          <Badge variant="secondary" className="text-xs">
                            Vigente
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{h.nivel ?? "—"}</td>
                    <td className="py-2 pr-4">{formatoEuro(h.salarioNeto)}</td>
                    <td className="py-2 pr-4">{h.jornada ?? "—"}</td>
                    <td className="py-2 pr-4">{h.tipoContrato ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatoFecha(h.vigenteDesde)} – {h.vigenteHasta ? formatoFecha(h.vigenteHasta) : "actualidad"}
                    </td>
                    <td className="py-2">{etiquetaMotivo(h.motivo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="text-sm font-medium mt-0.5">{valor}</dd>
    </div>
  );
}

function etiquetaMotivo(motivo: string | null): string {
  if (motivo === "alta") return "Alta";
  if (motivo === "promocion") return "Cambio de puesto";
  return motivo ?? "—";
}

const nfEuro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});
const nfNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

function formatoEuro(v: number | null | undefined): string {
  return v == null ? "—" : nfEuro.format(v);
}

function formatoNumero(v: number): string {
  return nfNum.format(v);
}

function formatoFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
