import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { EnlacesEmpleoSection } from "./EnlacesEmpleoSection";

export function PortalEmpleoConfig() {
  const { empresaActual } = useEmpresa();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Portal de empleo</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Personaliza la URL pública y comparte tus enlaces — {empresaActual.nombre}
        </p>
      </div>

      {/* ── Nombre en la URL + enlaces e incrustar ────────── */}
      <EnlacesEmpleoSection empresaNombre={empresaActual.nombre} />
    </div>
  );
}
