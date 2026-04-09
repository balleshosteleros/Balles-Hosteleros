import { getConfigCalendario } from "@/data/calendarios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";

const MODALIDAD_LABELS: Record<string, string> = {
  laboral: "Laboral",
  vacaciones: "Vacaciones",
  festivos: "Festivos",
  bajas: "Bajas médicas",
  justificadas: "Justificadas",
};

export function CalendarioConfig({ modalidad, onBack }: { modalidad: string; onBack: () => void }) {
  const config = getConfigCalendario(modalidad);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}><ArrowLeft className="h-4 w-4" />Volver</Button>
        <h3 className="text-lg font-semibold">Configuración — {MODALIDAD_LABELS[modalidad]}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tipos de solicitud</CardTitle>
            <CardDescription className="text-xs">Tipos disponibles para esta modalidad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {config.tiposSolicitud.map(t => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1 mt-2"><Plus className="h-3 w-3" />Añadir tipo</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estados</CardTitle>
            <CardDescription className="text-xs">Flujo de estados de las solicitudes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {config.estados.map(e => (
                <Badge key={e} variant="outline" className="text-xs">{e.charAt(0).toUpperCase() + e.slice(1)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reglas de aprobación</CardTitle>
            <CardDescription className="text-xs">Configuración del flujo de aprobación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Requiere aprobación</span>
              <Switch defaultChecked={config.requiereAprobacion} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Requiere justificante</span>
              <Switch defaultChecked={config.requiereJustificante} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Observaciones obligatorias</span>
              <Switch defaultChecked={config.observacionesObligatorias} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Duración y restricciones</CardTitle>
            <CardDescription className="text-xs">Límites de duración de la solicitud</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm min-w-[120px]">Duración mín. (días)</span>
              <Input type="number" className="w-24" defaultValue={config.duracionMinDias ?? ""} placeholder="—" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm min-w-[120px]">Duración máx. (días)</span>
              <Input type="number" className="w-24" defaultValue={config.duracionMaxDias ?? ""} placeholder="—" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Visibilidad</CardTitle>
            <CardDescription className="text-xs">Quién puede ver estas ausencias</CardDescription>
          </CardHeader>
          <CardContent>
            <Select defaultValue={config.visibilidad}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los empleados</SelectItem>
                <SelectItem value="departamento">Solo su departamento</SelectItem>
                <SelectItem value="responsable">Solo responsable</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Avisos y notificaciones</CardTitle>
            <CardDescription className="text-xs">Alertas automáticas del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Notificar al responsable</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Notificar al empleado</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Aviso de solapamiento</span>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
