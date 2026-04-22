import { Suspense } from "react";
import { DemoLoginForm } from "@/features/auth/components";

export default function AccesoDemoPage() {
  return (
    <div className="space-y-8">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-900/50 bg-blue-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Modo demo
        </span>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Prueba Balles Hosteleros
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Una experiencia completa del software sin registro real.
        </p>
      </div>

      <Suspense fallback={<div className="h-64" />}>
        <DemoLoginForm />
      </Suspense>
    </div>
  );
}
