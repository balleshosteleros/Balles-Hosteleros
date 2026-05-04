"use client";

import { CalendarioPersonal } from "./CalendarioPersonal";

export function MiCalendarioView() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <CalendarioPersonal />
    </div>
  );
}
