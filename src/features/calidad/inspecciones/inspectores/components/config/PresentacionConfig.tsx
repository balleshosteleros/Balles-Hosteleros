"use client";

import { PresentacionTab } from "../../../components/PresentacionTab";

export function PresentacionConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Presentación</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Slides públicas que ve el inspector antes de aceptar la inspección.
        </p>
      </div>
      <PresentacionTab />
    </div>
  );
}
