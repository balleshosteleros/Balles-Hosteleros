"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Palmtree, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCalendariosParaAsignar,
  asignarCalendarioEmpleado,
  getSaldoVacacionesEmpleado,
  type CalendarioOpcion,
} from "@/features/rrhh/actions/calendarios-vacaciones-actions";
import type { SaldoVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";

type Props = {
  empresaId: string;
  empleadoId: string;
  calendarioVacacionesId: string | null;
  onSaved?: () => Promise<void> | void;
};

/**
 * Asigna a este empleado su calendario de vacaciones (obligatorio para que pueda
 * solicitar vacaciones). Muestra además el saldo actual: días totales, gastados
 * y restantes del año del calendario.
 */
export function CalendarioVacacionesEmpleadoCard({
  empresaId,
  empleadoId,
  calendarioVacacionesId,
  onSaved,
}: Props) {
  const [opciones, setOpciones] = useState<CalendarioOpcion[]>([]);
  const [saldo, setSaldo] = useState<SaldoVacaciones | null>(null);
  const [seleccion, setSeleccion] = useState<string>(calendarioVacacionesId ?? "");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setSeleccion(calendarioVacacionesId ?? "");
  }, [calendarioVacacionesId]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([
      listCalendariosParaAsignar(empresaId),
      getSaldoVacacionesEmpleado(empleadoId),
    ]).then(([opcRes, saldoRes]) => {
      if (!activo) return;
      setOpciones(opcRes.ok ? opcRes.data : []);
      setSaldo(saldoRes.ok ? saldoRes.data : null);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empresaId, empleadoId]);

  async function guardar() {
    if (!seleccion) {
      toast.error("Selecciona un calendario de vacaciones.");
      return;
    }
    setGuardando(true);
    const res = await asignarCalendarioEmpleado(empleadoId, seleccion);
    if (res.ok) {
      const saldoRes = await getSaldoVacacionesEmpleado(empleadoId);
      setSaldo(saldoRes.ok ? saldoRes.data : null);
    }
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo asignar el calendario.");
      return;
    }
    toast.success("Calendario de vacaciones asignado.");
    await onSaved?.();
  }

  const sinCalendarios = !cargando && opciones.length === 0;
  const sinAsignar = !calendarioVacacionesId;

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          <Palmtree className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Calendario de vacaciones</h3>
          <p className="text-sm text-muted-foreground">
            Rige los días disponibles y los periodos en los que este empleado puede
            pedir vacaciones. Es obligatorio para poder solicitarlas.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : sinCalendarios ? (
        <p className="text-sm text-rose-600">
          No hay ningún calendario de vacaciones creado. Crea uno en RRHH →
          Calendarios → Vacaciones y vuelve aquí para asignarlo.
        </p>
      ) : (
        <>
          {sinAsignar && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                Este empleado no tiene calendario asignado todavía y no podrá
                solicitar vacaciones hasta que se lo asignes.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <div className="space-y-1.5">
              <Label>Calendario asignado</Label>
              <Select value={seleccion} onValueChange={setSeleccion}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un calendario" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nombre} ({o.anio ?? "todos los años"}) · {o.diasTotales} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={guardar} disabled={guardando} className="gap-2">
                {guardando ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
                ) : (
                  <><Save className="h-4 w-4" />Guardar</>
                )}
              </Button>
            </div>
          </div>

          {saldo && saldo.calendarioId && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
              <div>
                <p className="text-lg font-semibold">{saldo.diasTotales}</p>
                <p className="text-xs text-muted-foreground">Totales {saldo.anio}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-amber-600">{saldo.diasGastados}</p>
                <p className="text-xs text-muted-foreground">Gastados</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600">{saldo.diasRestantes}</p>
                <p className="text-xs text-muted-foreground">Restantes</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
