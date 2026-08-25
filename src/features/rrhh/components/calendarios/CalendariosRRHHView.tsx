"use client";

import { useCallback, useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listAusenciasEmpresa,
  type AusenciaCalendario,
} from "@/features/rrhh/actions/calendario-ausencias-actions";
import { useFestivos } from "@/features/rrhh/hooks/useFestivos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown } from "lucide-react";
import {
  TIPOS_CALENDARIO,
  colorDeSubtipo,
} from "@/features/rrhh/data/calendario-tipos";
import { CalendarioUnico } from "@/features/rrhh/components/calendarios/CalendarioUnico";
import { RegistrarAusenciaDialog } from "@/features/rrhh/components/calendarios/RegistrarAusenciaDialog";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

/**
 * Lo que RRHH puede registrar a mano. La baja de contrato queda fuera: la
 * solicita el propio empleado y requiere firma, no se da de alta desde aquí.
 */
const REGISTRABLES = TIPOS_CALENDARIO.filter((t) => t.subtipo !== "baja_contrato");

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
  // Hueco de la cabecera donde el calendario coloca sus controles de vista.
  const [slotControles, setSlotControles] = useState<HTMLDivElement | null>(null);
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
        <div className="flex flex-wrap items-center gap-2">
          {/* Aquí aterrizan el selector de vista y la navegación del
              calendario, para no gastar una fila propia y que el año entero
              quepa en pantalla. */}
          <div ref={setSlotControles} className="flex flex-wrap items-center gap-2" />

          {/* Un solo botón: al pulsarlo se elige qué se registra. */}
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />Nuevo
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {REGISTRABLES.map((t) => (
              <DropdownMenuItem
                key={t.subtipo}
                onSelect={() => setRegistrando(t.subtipo)}
                className="gap-2"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorDeSubtipo(t.subtipo) }}
                />
                {t.label}
              </DropdownMenuItem>
            ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CalendarioUnico
        ausencias={ausencias}
        festivoEnFecha={festivoEnFecha}
        onAnioChange={handleAnio}
        cargando={cargando}
        slotControles={slotControles}
      />

      <RegistrarAusenciaDialog
        subtipo={registrando}
        onOpenChange={(abierto) => { if (!abierto) setRegistrando(null); }}
        onRegistrada={() => { setRegistrando(null); setRecarga((n) => n + 1); }}
      />
    </div>
  );
}
