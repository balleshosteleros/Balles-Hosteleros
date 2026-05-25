import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DatosEmpresaConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Datos de tu empresa</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Información mostrada en la bolsa pública y la presentación a inspectores
        </p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Datos públicos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Visibles para los inspectores</p>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre comercial</Label>
              <Input placeholder="Mi empresa" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sector</Label>
              <Input placeholder="Hostelería / Restauración" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email de contacto</Label>
              <Input type="email" placeholder="calidad@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input placeholder="+34 600 000 000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descripción corta</Label>
            <Textarea rows={3} placeholder="Breve descripción que verán los inspectores en la bolsa pública" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Imagen de marca</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Se hereda de Ajustes → Imagen de marca</p>
        </div>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">
            Para cambiar el logo y la paleta de colores, ve a <span className="font-medium text-foreground">Ajustes → Imagen de marca</span>.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Guardar cambios</Button>
      </div>
    </div>
  );
}
