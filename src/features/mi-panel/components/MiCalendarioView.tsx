"use client";

import { CalendarDays } from "lucide-react";
import { CalendarioPersonal } from "./CalendarioPersonal";
import { MisReunionesMeet } from "./MisReunionesMeet";
import { SubpageHeader } from "./SubpageHeader";

export function MiCalendarioView() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <SubpageHeader
        title="Calendario"
        subtitle="Días trabajados, ausencias aprobadas y horas fichadas"
        icon={CalendarDays}
      />
      <CalendarioPersonal />
      <MisReunionesMeet />
    </div>
  );
}
