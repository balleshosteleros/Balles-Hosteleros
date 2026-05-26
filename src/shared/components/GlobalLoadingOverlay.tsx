"use client";

import { Loader2 } from "lucide-react";
import { useGlobalLoading } from "@/shared/stores/use-global-loading";

const LABEL = "Cargando…";

export function GlobalLoadingOverlay() {
  const isLoading = useGlobalLoading((s) => s.isLoading);

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={LABEL}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/40 backdrop-blur-[1px] animate-in fade-in duration-150"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/95 px-8 py-6 shadow-xl border border-border">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">{LABEL}</span>
      </div>
    </div>
  );
}
