"use client";

/**
 * Envío de la confirmación a las reservas que se migraron de CoverManager.
 *
 * TEMPORAL: cuando pase la última de esas reservas (27-oct-2026) este panel y
 * su acción se borran. No es una función del producto, es el puente para que
 * los clientes que reservaron en Cover tengan un enlace de cancelación NUESTRO
 * y dejen de cancelar en un sitio del que no nos enteramos.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listarReservasCoverPendientes,
  enviarConfirmacionesCover,
  type ReservaCoverPendiente,
  type ResultadoEnvioCover,
} from "@/features/sala/actions/reservas-cover-envio-actions";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

export function EnvioCoverPanel() {
  // El panel enseña SOLO las reservas de la empresa activa. Sin esto la lista
  // se quedaba con las de la empresa con la que se abrió la pantalla: al
  // cambiar a Habana se seguían viendo las de Bacanal (Iván, 4-sep).
  const { empresaActual, empresaResuelta } = useEmpresa();
  const [filas, setFilas] = useState<ReservaCoverPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<ResultadoEnvioCover[] | null>(null);

  const cargar = useCallback(async (mostrarCarga = true) => {
    if (mostrarCarga) setCargando(true);
    const res = await listarReservasCoverPendientes();
    if (res.ok) {
      setFilas(res.data);
      // Por defecto se marcan las que aún no han recibido nada: es lo que se
      // quiere enviar en el 99% de los casos.
      setSeleccion(new Set(res.data.filter((r) => !r.yaEnviado).map((r) => r.id)));
    } else if (res.error) {
      toast.error(res.error);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // Hasta que la empresa activa no está resuelta, `empresaActual` es la por
    // defecto: consultar ahí devuelve las reservas de otra empresa.
    if (!empresaResuelta) return;
    // Fuera del render: el estado se toca cuando responde el servidor, no de
    // forma síncrona dentro del efecto. Se limpia también el resultado del
    // envío anterior, que es de la empresa que estuviera activa entonces.
    const t = setTimeout(() => {
      setResultados(null);
      void cargar();
    }, 0);
    return () => clearTimeout(t);
    // `empresaActual.id` en las dependencias: cambiar de empresa recarga la
    // lista con las suyas.
  }, [cargar, empresaResuelta, empresaActual.id]);

  const pendientes = filas.filter((r) => !r.yaEnviado);
  const enviados = filas.filter((r) => r.yaEnviado);

  const alternar = (id: string) => {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const enviar = async () => {
    const ids = [...seleccion];
    if (ids.length === 0) return;
    setEnviando(true);
    setResultados(null);
    const res = await enviarConfirmacionesCover(ids);
    setEnviando(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResultados(res.resultados);
    const bien = res.resultados.filter((r) => r.ok).length;
    const mal = res.resultados.length - bien;
    if (mal === 0) toast.success(`${bien} correos enviados`);
    else toast.warning(`${bien} enviados · ${mal} sin enviar`);
    // Sin velo de carga: el resultado del envío sigue en pantalla mientras la
    // lista se refresca por detrás.
    void cargar(false);
  };

  if (cargando) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          Cargando reservas…
        </CardContent>
      </Card>
    );
  }

  if (filas.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Reservas migradas de CoverManager</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          No queda ninguna reserva de CoverManager pendiente. Ya se pueden borrar
          este panel y su acción.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4" />
          Reservas migradas de CoverManager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-foreground">
            Estos clientes reservaron en CoverManager y solo tienen el enlace de
            cancelación de allí: si cancelan, no nos enteramos. Al enviarles la
            confirmación reciben un enlace nuestro y la mesa se libera de verdad.
            A quien ya lo ha recibido no se le reenvía.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{pendientes.length}</strong> sin enviar
            </span>
            {enviados.length > 0 && (
              <span>
                <strong className="text-foreground">{enviados.length}</strong> ya enviados
              </span>
            )}
            <span>
              <strong className="text-foreground">{seleccion.size}</strong> seleccionados
            </span>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={enviando || seleccion.size === 0}
            onClick={enviar}
          >
            {enviando ? "Enviando…" : `Enviar ${seleccion.size} correos`}
          </Button>
        </div>

        <div className="max-h-[380px] overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr>
                <th className="w-9 p-2" />
                <th className="p-2 text-left font-medium">Fecha</th>
                <th className="p-2 text-left font-medium">Cliente</th>
                <th className="p-2 text-left font-medium">Correo</th>
                <th className="p-2 text-center font-medium">Pax</th>
                <th className="p-2 text-left font-medium">Mesa</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={seleccion.has(r.id)}
                      onCheckedChange={() => alternar(r.id)}
                      aria-label={`Enviar a ${r.cliente}`}
                    />
                  </td>
                  <td className="whitespace-nowrap p-2 tabular-nums">
                    {formatearFechaEs(r.fecha)} · {r.hora}
                  </td>
                  <td className="p-2">
                    <span className="font-medium">{r.cliente}</span>
                    {r.yaEnviado && (
                      <Badge variant="outline" className="ml-1.5 text-[9px]">
                        Ya enviado
                      </Badge>
                    )}
                  </td>
                  <td className="max-w-[190px] truncate p-2 text-muted-foreground">
                    {r.email}
                  </td>
                  <td className="p-2 text-center tabular-nums">{r.personas}</td>
                  <td className="whitespace-nowrap p-2 text-muted-foreground">
                    {r.mesa ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {resultados && (
          <div className="space-y-1.5 rounded-md border border-border p-3">
            <p className="text-xs font-semibold">Resultado del envío</p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {resultados.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-xs">
                  {r.ok ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                  )}
                  <span className="min-w-0">
                    <span className="font-medium">{r.cliente}</span>
                    {r.error && (
                      <span className="text-muted-foreground"> · {r.error}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
