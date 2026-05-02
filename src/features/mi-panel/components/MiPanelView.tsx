"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { FichajeBar } from "@/features/mi-panel/components/FichajeBar";
import { CalendarioPersonal } from "@/features/mi-panel/components/CalendarioPersonal";
import { SolicitudModal } from "@/features/mi-panel/components/SolicitudModal";
import { MisSolicitudesList } from "@/features/mi-panel/components/MisSolicitudesList";
import { AccesosRapidos } from "@/features/mi-panel/components/AccesosRapidos";
import { MisTareasCronogramaWidget } from "@/features/mi-panel/components/MisTareasCronogramaWidget";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

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

  const today = new Date();
  const fechaLarga = `${DIAS_LARGOS[today.getDay()]} ${today.getDate()} de ${MESES_LARGOS[today.getMonth()]}`;

  const userName = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : (user?.email?.split("@")[0] ?? "");

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {saludoSegunHora()}{userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{fechaLarga}</p>
      </div>

      {/* Barra de fichaje */}
      <FichajeBar onChange={handleRefresh} onSolicitar={() => setSolicitudOpen(true)} />

      {/* Tareas del cronograma del rol del usuario — pinned al top */}
      <MisTareasCronogramaWidget />

      {/* Grid principal */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <CalendarioPersonal refreshKey={refreshKey} />
          <AccesosRapidos />
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
