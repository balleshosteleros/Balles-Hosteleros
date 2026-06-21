"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { FichajeBar } from "@/features/mi-panel/components/FichajeBar";
import { CalendarioPersonal } from "@/features/mi-panel/components/CalendarioPersonal";
import { SolicitudModal } from "@/features/mi-panel/components/SolicitudModal";
import { MisSolicitudesList } from "@/features/mi-panel/components/MisSolicitudesList";
import { MisTareasCronogramaWidget } from "@/features/mi-panel/components/MisTareasCronogramaWidget";
import { NotificacionesGate } from "@/features/notificaciones/components/NotificacionesGate";
import { NotificacionBell } from "@/features/notificaciones/components/NotificacionBell";
import { PointsHeroCard } from "@/features/mi-panel/components/PointsHeroCard";
import { ResumenTiles } from "@/features/mi-panel/components/ResumenTiles";
import {
  getMiPanelResumen,
  type MiPanelResumen,
} from "@/features/mi-panel/actions/mi-panel-actions";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

const EMPTY_RESUMEN: MiPanelResumen = {
  points: {
    acumulados: 0,
    canjeables: 0,
    nivelNombre: null,
    nivelColor: null,
    nivelIcon: null,
    siguienteNombre: null,
    progresoPct: 0,
    faltan: 0,
  },
  fichajes: { mesCount: 0, mesHoras: 0, incidencias: 0 },
  solicitudes: { pendientes: 0, aprobadas: 0, rechazadas: 0 },
  comunicados: { total: 0, ultimoTitulo: null, ultimaFecha: null },
  cuestionarios: { pendientes: 0 },
  formacion: { cursosAsignados: 0, cursosCompletados: 0 },
};

function saludoSegunHora(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function MiPanelView() {
  const { profile, user } = useAuth();
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resumen, setResumen] = useState<MiPanelResumen>(EMPTY_RESUMEN);
  const [loadingResumen, setLoadingResumen] = useState(true);

  const today = new Date();
  const fechaLarga = `${DIAS_LARGOS[today.getDay()]} ${today.getDate()} de ${MESES_LARGOS[today.getMonth()]}`;

  const userName = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : (user?.email?.split("@")[0] ?? "");

  const cargarResumen = useCallback(async () => {
    const res = await getMiPanelResumen();
    if (res.ok) setResumen(res.data);
    setLoadingResumen(false);
  }, []);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen, refreshKey]);

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <NotificacionesGate />
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {saludoSegunHora()}{userName ? `, ${userName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{fechaLarga}</p>
        </div>
        <NotificacionBell />
      </div>

      {/* Barra de fichaje */}
      <FichajeBar onChange={handleRefresh} onSolicitar={() => setSolicitudOpen(true)} />

      {/* POINTS — destacado */}
      <PointsHeroCard resumen={resumen.points} loading={loadingResumen} />

      {/* Tareas del cronograma del rol del usuario */}
      <MisTareasCronogramaWidget />

      {/* Resumen de toda mi panel */}
      <ResumenTiles resumen={resumen} loading={loadingResumen} />

      {/* Detalle: calendario + solicitudes */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <CalendarioPersonal refreshKey={refreshKey} />
        </div>
        <div className="space-y-5">
          <MisSolicitudesList refreshKey={refreshKey} onChange={handleRefresh} />
        </div>
      </div>

      <SolicitudModal
        open={solicitudOpen}
        onOpenChange={setSolicitudOpen}
        onCreated={handleRefresh}
      />
    </div>
  );
}
