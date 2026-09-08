import { Loader2 } from "lucide-react";

/**
 * Carga del portal. Sin esto, al pulsar en una clase o un curso no pasaba nada
 * visible hasta que el servidor respondía.
 */
export default function CargandoEscuela() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-background px-8 py-6 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    </div>
  );
}
