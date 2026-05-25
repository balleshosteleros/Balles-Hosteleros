import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ConfigGeneralInspeccionesConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Configuración general</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ajustes globales del módulo de inspecciones
        </p>
      </div>

      {/* Notificaciones */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Notificaciones</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Avisos internos del módulo</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Notificar a Calidad al recibir una nueva inscripción", checked: true },
            { label: "Notificar al director del local al cerrar una inspección", checked: true },
            { label: "Avisar si una inspección queda sin asignar pasadas 24h", checked: true },
            { label: "Resumen semanal por email", checked: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Roles y acceso */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Usuarios autorizados y roles</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Quién puede gestionar el módulo de inspecciones</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Directores pueden mover inspectores entre fases", checked: true },
            { label: "Calidad puede crear y editar plantillas", checked: true },
            { label: "RRHH puede ver inspectores (solo lectura)", checked: true },
            { label: "Otros roles pueden ver inspecciones realizadas", checked: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Idioma y regional */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Idioma y ajustes regionales</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Idioma de la bolsa pública</Label>
            <Select defaultValue="es">
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ca">Català</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Formato de fecha</Label>
            <Select defaultValue="dd/mm/yyyy">
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/mm/yyyy">DD/MM/AAAA</SelectItem>
                <SelectItem value="mm/dd/yyyy">MM/DD/AAAA</SelectItem>
                <SelectItem value="yyyy-mm-dd">AAAA-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Ajustes generales</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Permitir inscripciones duplicadas (mismo email)", checked: false },
            { label: "Archivar automáticamente inspectores descartados tras 90 días", checked: true },
            { label: "Mostrar contador de inspectores en la vista principal", checked: true },
            { label: "Anonimizar nombres de locales en la presentación pública", checked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Guardar cambios</Button>
      </div>
    </div>
  );
}
