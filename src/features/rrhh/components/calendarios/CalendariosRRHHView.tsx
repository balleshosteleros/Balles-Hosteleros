"use client";

import { useCallback, useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listAusenciasEmpresa,
  type AusenciaCalendario,
} from "@/features/rrhh/actions/calendario-ausencias-actions";
import { useFestivos } from "@/features/rrhh/hooks/useFestivos";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CalendarioUnico } from "@/features/rrhh/components/calendarios/CalendarioUnico";
import { RegistrarAusenciaDialog } from "@/features/rrhh/components/calendarios/RegistrarAusenciaDialog";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

/**
 * Calendario de RRHH: UN solo calendario donde se ve todo a la vez —
 * vacaciones, bajas médicas, permisos, bajas de contrato y festivos—, con
 * filtros por tipo y por estado.
 *
 * Antes eran cinco pestañas, una por tipo, así que para saber quién faltaba un
 * día había que recorrerlas todas.
 */
export function CalendariosRRHHView() {
  const { empresaActual } = useEmpresa();
  const [anio, setAnio] = useState<number>(() => new Date().getFullYear());
  const { festivoEnFecha } = useFestivos(anio);

  const [ausencias, setAusencias] = useState<AusenciaCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  // Tipo que RRHH está registrando a mano, o null si no hay diálogo abierto.
  const [registrando, setRegistrando] = useState<SolicitudSubtipoAusencia | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    listAusenciasEmpresa(empresaActual.id, anio).then((res) => {
      if (!activo) return;
      setAusencias(res.data);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empresaActual.id, anio, recarga]);

  // El calendario avisa del año que está mirando para traer sus datos.
  const handleAnio = useCallback((a: number) => {
    setAnio((actual) => (actual === a ? actual : a));
  }, []);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Calendario</h2>
          <p className="text-sm text-muted-foreground">
            Quién falta cada día y por qué. Pasa el ratón por una cara para ver
            el detalle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setRegistrando("baja_medica")}>
            <Plus className="h-4 w-4" />Baja médica
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setRegistrando("permiso")}>
            <Plus className="h-4 w-4" />Permiso
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setRegistrando("vacaciones")}>
            <Plus className="h-4 w-4" />Vacaciones
          </Button>
        </div>
      </div>

      <CalendarioUnico
        ausencias={ausencias}
        festivoEnFecha={festivoEnFecha}
        onAnioChange={handleAnio}
        cargando={cargando}
      />

      <RegistrarAusenciaDialog
        subtipo={registrando}
        onOpenChange={(abierto) => { if (!abierto) setRegistrando(null); }}
        onRegistrada={() => { setRegistrando(null); setRecarga((n) => n + 1); }}
      />
    </div>
  );
}
