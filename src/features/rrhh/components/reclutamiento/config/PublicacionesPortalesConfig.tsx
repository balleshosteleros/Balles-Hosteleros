import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Clock, Plus } from "lucide-react";

export function PublicacionesPortalesConfig() {
  const portales = [
    { nombre: "InfoJobs", estado: "conectado", vacantesPublicadas: 3, icono: "🔵" },
    { nombre: "LinkedIn Jobs", estado: "conectado", vacantesPublicadas: 2, icono: "🔗" },
    { nombre: "Indeed", estado: "desconectado", vacantesPublicadas: 0, icono: "🟣" },
    { nombre: "Talentoo", estado: "pendiente", vacantesPublicadas: 0, icono: "🟡" },
  ];

  const estadoStyles: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    conectado: { label: "Conectado", className: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    desconectado: { label: "Desconectado", className: "bg-muted text-muted-foreground", icon: <AlertCircle className="h-3.5 w-3.5" /> },
    pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-700", icon: <Clock className="h-3.5 w-3.5" /> },
  };

  const historial = [
    { fecha: "2026-04-05", vacante: "CAMARERO", portal: "InfoJobs", estado: "Publicada" },
    { fecha: "2026-04-04", vacante: "JEFE DE SALA", portal: "LinkedIn Jobs", estado: "Publicada" },
    { fecha: "2026-04-03", vacante: "ARTISTA", portal: "InfoJobs", estado: "Error" },
    { fecha: "2026-04-01", vacante: "CAMARERO", portal: "LinkedIn Jobs", estado: "Publicada" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Publicaciones en portales</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona las conexiones con portales de empleo externos para publicar vacantes
        </p>
      </div>

      {/* Portales conectados */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Portales conectados</h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Conectar portal
          </Button>
        </div>
        <CardContent className="p-0">
          {portales.map((portal) => {
            const est = estadoStyles[portal.estado];
            return (
              <div key={portal.nombre} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{portal.icono}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{portal.nombre}</div>
                    {portal.vacantesPublicadas > 0 && (
                      <span className="text-xs text-muted-foreground">{portal.vacantesPublicadas} vacantes publicadas</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`gap-1 text-[11px] border-0 ${est.className}`}>
                    {est.icon} {est.label}
                  </Badge>
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    {portal.estado === "conectado" ? "Configurar" : "Conectar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Publicación automática */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Publicación automática</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configura la publicación automática en portales conectados</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Publicar automáticamente en todos los portales conectados", checked: false },
            { label: "Publicar solo al pasar a estado 'Publicada'", checked: true },
            { label: "Notificar si hay errores de publicación", checked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Historial de publicaciones</h3>
        </div>
        <CardContent className="p-0">
          {historial.map((h, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">{h.fecha}</span>
                <span className="font-medium text-foreground">{h.vacante}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-muted-foreground">{h.portal}</span>
              </div>
              <Badge variant={h.estado === "Error" ? "destructive" : "secondary"} className="text-[10px]">
                {h.estado}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
