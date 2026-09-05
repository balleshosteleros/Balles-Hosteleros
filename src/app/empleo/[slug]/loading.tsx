import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

/** Carga del listado de vacantes: mismo cargando que el resto del portal. */
export default function LoadingPortalEmpleo() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <LoadingSpinner size="lg" className="py-0" />
      <span className="text-xs uppercase tracking-widest">Cargando…</span>
    </div>
  );
}
