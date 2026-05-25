import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PresentacionConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Presentación</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Slides públicas que ve el inspector antes de aceptar la inspección
        </p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Contenido visible</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Slides que se incluyen en la presentación</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Slide de bienvenida", checked: true },
            { label: "Qué hacemos y nuestra filosofía", checked: true },
            { label: "Qué buscamos en una inspección", checked: true },
            { label: "Compensación y forma de pago", checked: true },
            { label: "Día y hora — selector de cita", checked: true },
            { label: "Política de confidencialidad", checked: false },
            { label: "Slide de cierre con datos de contacto", checked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Estilo</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Color primario</Label>
            <Input defaultValue="#0F172A" className="font-mono text-xs w-44" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Texto del botón final</Label>
            <Input defaultValue="Reservar" className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pie de página</Label>
            <Textarea
              rows={2}
              defaultValue="Esta presentación es estrictamente confidencial. No se permite nombrar locales específicos."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Comportamiento</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Permitir saltar entre slides libremente", checked: true },
            { label: "Forzar lectura mínima de 3 segundos por slide", checked: false },
            { label: "Mostrar barra de progreso", checked: true },
            { label: "Activar tecla espacio para avanzar", checked: true },
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
