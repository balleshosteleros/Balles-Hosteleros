"use client";

import { LifeBuoy } from "lucide-react";
import { SoporteDrawer } from "./soporte-drawer";

export function FloatingSoporteButton() {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <SoporteDrawer>
        <button
          type="button"
          aria-label="Abrir chat de soporte"
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <LifeBuoy className="h-6 w-6 transition-transform group-hover:rotate-12" />
        </button>
      </SoporteDrawer>
    </div>
  );
}
