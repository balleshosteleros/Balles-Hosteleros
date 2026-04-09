import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConfigGeneralConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Configuración</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ajustes generales del sistema de reclutamiento
        </p>
      </div>

      {/* Emails automáticos */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Emails automáticos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Controla cuándo se envían emails a los candidatos</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Activar emails automáticos al cambiar de fase", checked: true },
            { label: "Pedir confirmación antes de enviar cada email", checked: true },
            { label: "Enviar copia al reclutador asignado", checked: false },
            { label: "Incluir firma corporativa en los emails", checked: true },
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
          <p className="text-xs text-muted-foreground mt-0.5">Quién puede gestionar el módulo de reclutamiento</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Administradores pueden mover candidatos entre fases", checked: true },
            { label: "Reclutadores pueden mover candidatos entre fases", checked: true },
            { label: "RRHH puede ver y editar vacantes", checked: true },
            { label: "Otros roles pueden ver vacantes (solo lectura)", checked: false },
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
            <Label className="text-sm text-foreground">Idioma del portal de empleo</Label>
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
            { label: "Permitir candidaturas duplicadas (mismo email)", checked: false },
            { label: "Archivar automáticamente vacantes cerradas tras 30 días", checked: true },
            { label: "Mostrar contador de candidatos en la vista principal", checked: true },
            { label: "Notificar al reclutador cuando llega una nueva candidatura", checked: true },
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
