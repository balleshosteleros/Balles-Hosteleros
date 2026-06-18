"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Circle,
  CircleDot,
  ListChecks,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import {
  getCampanaDetalle,
  sincronizarEmpleados,
  cerrarCampana,
} from "@/features/calidad/cuestionarios/actions";
import type { CampanaDetalle, EnvioFila } from "@/features/calidad/cuestionarios/types";
import { EmpleadoPanelLateral } from "./EmpleadoPanelLateral";
import { PuntosTimelineDialog } from "./PuntosTimelineDialog";
import { Input } from "@/components/ui/input";

interface Props {
  campanaId: string;
}

export function CampanaDetalleView({ campanaId }: Props) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<CampanaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [envioAbierto, setEnvioAbierto] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } =
    useConfirmDelete();
  const [, startTransition] = useTransition();

  function refresh() {
    setLoading(true);
    getCampanaDetalle(campanaId).then((d) => {
      setDetalle(d);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, [campanaId]);

  const filtrados = useMemo(() => {
    if (!detalle) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return detalle.envios;
    return detalle.envios.filter((e) =>
      e.empleadoNombre.toLowerCase().includes(q),
    );
  }, [detalle, busqueda]);

  async function onSincronizar() {
    const res = await sincronizarEmpleados(campanaId);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      res.nuevos === 0
        ? "Sin empleados nuevos"
        : `Añadidos ${res.nuevos} empleados`,
    );
    startTransition(refresh);
  }

  async function onCerrar() {
    const ok = await confirmDelete({
      title: "Cerrar la campaña",
      description:
        "Podrás seguir editando reuniones pero quedará marcada como cerrada.",
      confirmLabel: "Cerrar",
    });
    if (!ok) return;
    const res = await cerrarCampana(campanaId);
    if (!res.ok) return toast.error(res.error);
    toast.success("Campaña cerrada");
    startTransition(refresh);
  }

  if (loading && !detalle) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Campaña no encontrada.{" "}
        <Button variant="link" onClick={() => router.push("/calidad/cuestionarios")}>
          Volver
        </Button>
      </div>
    );
  }

  const { campana, envios } = detalle;
  const pctRespondidos =
    campana.totalEnvios > 0
      ? Math.round((campana.envioRespondidos / campana.totalEnvios) * 100)
      : 0;
  const pctReuniones =
    campana.totalEnvios > 0
      ? Math.round((campana.envioReunionesHechas / campana.totalEnvios) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Header con info de campaña + barras */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/calidad/cuestionarios")}
              className="gap-2 -ml-2 mb-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a Cuestionarios
            </Button>
            <h2 className="text-lg font-semibold">{campana.plantillaNombre}</h2>
            <p className="text-sm text-muted-foreground">
              {labelPeriodo(campana.periodo)} · {envios.length} empleados
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTimelineOpen(true)}
              className="gap-2"
            >
              <ListChecks className="h-4 w-4" />
              Puntos
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onSincronizar}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar empleados
                </DropdownMenuItem>
                {campana.estado === "activa" && (
                  <DropdownMenuItem onClick={onCerrar}>
                    Cerrar campaña
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 max-w-xl">
          <ProgresoFino
            label="Respondidos"
            hecho={campana.envioRespondidos}
            total={campana.totalEnvios}
            pct={pctRespondidos}
          />
          <ProgresoFino
            label="Reuniones"
            hecho={campana.envioReunionesHechas}
            total={campana.totalEnvios}
            pct={pctReuniones}
          />
        </div>
      </div>

      {/* Buscador minimalista */}
      <div className="max-w-xs">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar empleado..."
          className="h-9"
        />
      </div>

      {/* Tabla 4 columnas */}
      <ResizableColumnsProvider storageKey="calidad-cuestionarios-detalle">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <TableColumnHeader label="Empleado" />
                <TableColumnHeader label="Cuestionario" />
                <TableColumnHeader label="Reunión" />
                <TableColumnHeader label="Puntos clave" />
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-muted-foreground">
                    {envios.length === 0
                      ? "Sin empleados en esta campaña."
                      : "Ningún empleado coincide."}
                  </td>
                </tr>
              )}
              {filtrados.map((e) => (
                <EnvioFilaRow
                  key={e.id}
                  envio={e}
                  onClick={() => setEnvioAbierto(e.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <EmpleadoPanelLateral
        envioId={envioAbierto}
        campanaPlantillaId={campana.plantillaId}
        open={!!envioAbierto}
        onOpenChange={(v) => !v && setEnvioAbierto(null)}
        onCambio={() => startTransition(refresh)}
      />

      <PuntosTimelineDialog
        campanaId={campanaId}
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        onAbrirEmpleado={(envioId) => {
          setTimelineOpen(false);
          setEnvioAbierto(envioId);
        }}
      />

      {confirmDeleteDialog}
    </div>
  );
}

function EnvioFilaRow({
  envio,
  onClick,
}: {
  envio: EnvioFila;
  onClick: () => void;
}) {
  const puntosAbiertos = envio.puntos.filter((p) => p.estado !== "cerrado");
  const previewPunto = puntosAbiertos[0]?.texto ?? envio.puntos[0]?.texto ?? null;
  const restoPuntos =
    envio.puntos.length > 0 ? envio.puntos.length - 1 : 0;

  return (
    <tr
      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-3 py-2.5">
        <div className="font-medium">{envio.empleadoNombre}</div>
        {envio.empleadoPuesto && (
          <div className="text-xs text-muted-foreground">{envio.empleadoPuesto}</div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <EstadoCirculo on={envio.respondido} />
      </td>
      <td className="px-3 py-2.5">
        <EstadoCirculo on={envio.reunionEstado === "realizada"} />
      </td>
      <td className="px-3 py-2.5 max-w-md">
        {previewPunto ? (
          <div className="text-sm">
            <span className="line-clamp-1">{previewPunto}</span>
            {restoPuntos > 0 && (
              <span className="text-xs text-muted-foreground ml-1">
                · +{restoPuntos} más
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function EstadoCirculo({ on }: { on: boolean }) {
  if (on) return <CircleDot className="h-4 w-4 text-emerald-600" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function ProgresoFino({
  label,
  hecho,
  total,
  pct,
}: {
  label: string;
  hecho: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {hecho}/{total} · {pct}%
        </span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function labelPeriodo(p: string): string {
  const [year, semestre] = p.split("-");
  return semestre === "S1"
    ? `${year} · Enero – Junio`
    : `${year} · Julio – Diciembre`;
}
