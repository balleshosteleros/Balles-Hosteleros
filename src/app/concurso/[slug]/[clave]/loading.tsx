import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

// `force-dynamic` sin este archivo deja la pantalla en blanco mientras el
// servidor responde: el cliente cree que el enlace del correo no funciona.
export default function LoadingConcurso() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <LoadingSpinner size="lg" className="py-0" />
      <span className="text-xs uppercase tracking-widest">Cargando…</span>
    </div>
  );
}
