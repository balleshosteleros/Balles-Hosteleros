"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, Coffee, Play, Loader2, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ficharEntradaPersonal,
  ficharSalidaPersonal,
  finalizarPausaPersonal,
  getMiFichajeHoy,
  iniciarPausaPersonal,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";

function formatHora(iso: string | null): string {
  if (!iso) return "—";
  if (iso.length <= 8) return iso.slice(0, 5);
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function calcHorasVivas(fichaje: MiFichajeHoy | null): string {
  if (!fichaje?.horaEntrada) return "0:00 h";
  const entrada = new Date(fichaje.horaEntrada).getTime();
  const fin = fichaje.horaSalida ? new Date(fichaje.horaSalida).getTime() : Date.now();
  const ms = Math.max(0, fin - entrada);
  const horas = Math.floor(ms / 3600000);
  const minutos = Math.floor((ms % 3600000) / 60000);
  return `${horas}:${String(minutos).padStart(2, "0")} h`;
}

export function FichajeBar({
  onChange,
  onSolicitar,
}: {
  onChange?: () => void;
  onSolicitar?: () => void;
}) {
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tick, setTick] = useState(0);

  async function refresh() {
    const res = await getMiFichajeHoy();
    if (res.ok) setFichaje(res.data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const enPausa = !!fichaje?.pausaInicio && !fichaje?.pausaFin;
  const finalizado = !!fichaje?.horaSalida;
  const trabajando = !!fichaje?.horaEntrada && !finalizado && !enPausa;
  const sinFichar = !fichaje;

  async function handleEntrada() {
    setWorking(true);
    const res = await ficharEntradaPersonal();
    setWorking(false);
    if (!res.ok) return toast.error(res.error || "No se pudo fichar entrada");
    toast.success("Entrada registrada");
    await refresh();
    onChange?.();
  }
  async function handleSalida() {
    if (!fichaje) return;
    setWorking(true);
    const res = await ficharSalidaPersonal(fichaje.id);
    setWorking(false);
    if (!res.ok) return toast.error(res.error || "No se pudo fichar salida");
    toast.success("Salida registrada");
    await refresh();
    onChange?.();
  }
  async function handlePausa() {
    if (!fichaje) return;
    setWorking(true);
    const res = await iniciarPausaPersonal(fichaje.id);
    setWorking(false);
    if (!res.ok) return toast.error(res.error || "No se pudo iniciar el descanso");
    toast.success("Descanso iniciado");
    await refresh();
  }
  async function handleReanudar() {
    if (!fichaje) return;
    setWorking(true);
    const res = await finalizarPausaPersonal(fichaje.id);
    setWorking(false);
    if (!res.ok) return toast.error(res.error || "No se pudo reanudar");
    toast.success("Trabajo reanudado");
    await refresh();
  }

  void tick; // forzar render del cronómetro

  let estadoLabel = "Sin fichar";
  let estadoColor = "bg-slate-100 text-slate-700 border-slate-200";
  if (finalizado) {
    estadoLabel = "Jornada finalizada";
    estadoColor = "bg-violet-100 text-violet-800 border-violet-200";
  } else if (enPausa) {
    estadoLabel = "En descanso";
    estadoColor = "bg-amber-100 text-amber-800 border-amber-200";
  } else if (trabajando) {
    estadoLabel = "Trabajando";
    estadoColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
  }

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Estado actual */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={estadoColor}>
                {estadoLabel}
              </Badge>
              {fichaje && (
                <span className="text-xs text-muted-foreground">
                  Entrada {formatHora(fichaje.horaEntrada)}
                  {fichaje.horaSalida && ` · Salida ${formatHora(fichaje.horaSalida)}`}
                </span>
              )}
            </div>
            <div className="text-xl font-semibold mt-0.5 tabular-nums">
              {finalizado
                ? `${formatHorasDecimal(fichaje?.horasTotales)} trabajadas`
                : calcHorasVivas(fichaje)}
            </div>
          </div>
        </div>

        {/* Separador flexible */}
        <div className="hidden md:block flex-1" />

        {/* Accesos de fichaje */}
        <div className="flex flex-wrap items-center gap-2">
          {sinFichar && (
            <Button
              size="lg"
              disabled={loading || working}
              onClick={handleEntrada}
              className="h-12 px-6 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/50"
            >
              {working ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Fichar entrada
            </Button>
          )}
          {trabajando && (
            <>
              <Button variant="outline" size="sm" disabled={working} onClick={handlePausa}>
                <Coffee className="mr-1.5 h-4 w-4" />
                Iniciar descanso
              </Button>
              <Button
                size="sm"
                disabled={working}
                onClick={handleSalida}
                className="px-5 font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 ring-1 ring-red-500/40"
              >
                {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
                Fichar salida
              </Button>
            </>
          )}
          {enPausa && (
            <>
              <Button variant="default" size="sm" disabled={working} onClick={handleReanudar}>
                <Play className="mr-1.5 h-4 w-4" />
                Reanudar trabajo
              </Button>
              <Button
                size="sm"
                disabled={working}
                onClick={handleSalida}
                className="px-5 font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 ring-1 ring-red-500/40"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Fichar salida
              </Button>
            </>
          )}
          {finalizado && (
            <Button
              size="sm"
              disabled={loading || working}
              onClick={handleEntrada}
              className="px-5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/40"
            >
              {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogIn className="mr-1.5 h-4 w-4" />}
              Fichar nueva entrada
            </Button>
          )}
          {onSolicitar && (
            <Button
              variant="default"
              size="sm"
              onClick={onSolicitar}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Solicitar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
