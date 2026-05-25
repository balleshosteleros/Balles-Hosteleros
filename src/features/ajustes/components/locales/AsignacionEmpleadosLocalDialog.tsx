"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listEmpleadosEmpresaParaLocales,
  asignarLocalEmpleado,
  setEmpleadoTeletrabajo,
} from "@/features/ajustes/actions/locales-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, X, Check, Wifi } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

interface Empleado {
  id: string;
  nombre: string;
  apellidos: string | null;
  estado: string | null;
  local_id: string | null;
  permite_teletrabajo: boolean;
}

interface Props {
  localId: string;
  localNombre: string;
  empresaId?: string;
  abierto: boolean;
  onClose: () => void;
  onChange: () => void;
}

export function AsignacionEmpleadosLocalDialog({
  localId,
  localNombre,
  empresaId,
  abierto,
  onClose,
  onChange,
}: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  useGlobalLoadingSync(cargando);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listEmpleadosEmpresaParaLocales(empresaId);
    if (res.ok) setEmpleados(res.data as Empleado[]);
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  const asignados = useMemo(
    () => empleados.filter((e) => e.local_id === localId),
    [empleados, localId]
  );
  const disponibles = useMemo(() => {
    const q = busqueda.toLowerCase();
    return empleados.filter(
      (e) =>
        e.local_id !== localId &&
        (!q || `${e.nombre} ${e.apellidos ?? ""}`.toLowerCase().includes(q))
    );
  }, [empleados, localId, busqueda]);

  async function asignar(empleadoId: string) {
    const res = await asignarLocalEmpleado(empleadoId, localId);
    if (!res.ok) return toast.error(res.error ?? "Error");
    setEmpleados((prev) =>
      prev.map((e) => (e.id === empleadoId ? { ...e, local_id: localId } : e))
    );
    onChange();
  }

  async function quitar(empleadoId: string) {
    const res = await asignarLocalEmpleado(empleadoId, null);
    if (!res.ok) return toast.error(res.error ?? "Error");
    setEmpleados((prev) =>
      prev.map((e) => (e.id === empleadoId ? { ...e, local_id: null } : e))
    );
    onChange();
  }

  async function toggleTeletrabajo(empleadoId: string, valor: boolean) {
    const res = await setEmpleadoTeletrabajo(empleadoId, valor);
    if (!res.ok) return toast.error(res.error ?? "Error");
    setEmpleados((prev) =>
      prev.map((e) =>
        e.id === empleadoId ? { ...e, permite_teletrabajo: valor } : e
      )
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Empleados de {localNombre}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2 min-h-[400px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Asignados ({asignados.length})
              </h3>
            </div>
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {asignados.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  Sin empleados asignados.
                </p>
              ) : (
                asignados.map((e) => (
                  <FilaEmpleado
                    key={e.id}
                    empleado={e}
                    asignado
                    onAccion={() => quitar(e.id)}
                    onToggleTeletrabajo={(v) => toggleTeletrabajo(e.id, v)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Añadir empleados</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar"
                className="pl-9 h-9"
              />
            </div>
            <div className="border rounded-lg max-h-[360px] overflow-y-auto">
              {cargando ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  Cargando...
                </p>
              ) : disponibles.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  {busqueda ? "Sin resultados" : "Todos los empleados ya están asignados."}
                </p>
              ) : (
                disponibles.map((e) => (
                  <FilaEmpleado
                    key={e.id}
                    empleado={e}
                    asignado={false}
                    onAccion={() => asignar(e.id)}
                    onToggleTeletrabajo={(v) => toggleTeletrabajo(e.id, v)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilaEmpleado({
  empleado,
  asignado,
  onAccion,
  onToggleTeletrabajo,
}: {
  empleado: Empleado;
  asignado: boolean;
  onAccion: () => void;
  onToggleTeletrabajo: (v: boolean) => void;
}) {
  const nombre = `${empleado.nombre} ${empleado.apellidos ?? ""}`.trim();
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{nombre}</p>
        {empleado.estado && empleado.estado !== "Activo" && (
          <p className="text-[10px] uppercase text-muted-foreground">
            {empleado.estado}
          </p>
        )}
      </div>
      {asignado && (
        <button
          onClick={() => onToggleTeletrabajo(!empleado.permite_teletrabajo)}
          title={
            empleado.permite_teletrabajo
              ? "Teletrabajo activo (salta validación de zona)"
              : "Activar teletrabajo"
          }
          className={cn(
            "h-7 px-2 rounded-md text-xs flex items-center gap-1 transition-colors",
            empleado.permite_teletrabajo
              ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Wifi className="h-3 w-3" />
          {empleado.permite_teletrabajo ? "Remoto" : "Presencial"}
        </button>
      )}
      <Button
        variant={asignado ? "ghost" : "outline"}
        size="sm"
        className="h-7 px-2"
        onClick={onAccion}
      >
        {asignado ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
