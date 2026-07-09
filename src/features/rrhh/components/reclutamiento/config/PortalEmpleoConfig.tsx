import Link from "next/link";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Share2 } from "lucide-react";
import { EnlacesEmpleoSection } from "./EnlacesEmpleoSection";

/** Portales de empleo externos. Integración pendiente de conectar (futuro). */
const PORTALES = [
  { nombre: "InfoJobs", icono: "🔵" },
  { nombre: "JobToday", icono: "🟢" },
];

export function PortalEmpleoConfig() {
  const { empresaActual } = useEmpresa();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Portal de empleo</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Personaliza la URL pública, comparte tus enlaces y conecta tus portales — {empresaActual.nombre}
        </p>
      </div>

      {/* ── Nombre en la URL + enlaces e incrustar ────────── */}
      <EnlacesEmpleoSection empresaNombre={empresaActual.nombre} />

      {/* ── Publicación en portales externos ─────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Publicar en portales de empleo</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Activa o desactiva la publicación de tus vacantes en cada portal. La conexión y las
            claves de acceso se configuran en <span className="text-foreground font-medium">Ajustes → Integraciones</span>,
            fuera de RRHH, por seguridad.
          </p>
          <div className="rounded-lg border bg-card divide-y">
            {PORTALES.map((portal) => (
              <div key={portal.nombre} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{portal.icono}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{portal.nombre}</div>
                    <div className="text-[11px] text-muted-foreground">Pendiente de conexión en Ajustes</div>
                  </div>
                </div>
                <Switch checked={false} disabled title="Conecta el portal en Ajustes → Integraciones" />
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/ajustes?tab=integraciones">
              <ExternalLink className="h-4 w-4" /> Gestionar conexión en Ajustes
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
