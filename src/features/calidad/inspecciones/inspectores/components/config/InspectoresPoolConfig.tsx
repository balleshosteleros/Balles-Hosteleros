import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, Pencil, Trash2 } from "lucide-react";

export function InspectoresPoolConfig() {
  const camposFormulario = [
    { nombre: "Nombre y apellidos", obligatorio: true, activo: true },
    { nombre: "Email", obligatorio: true, activo: true },
    { nombre: "Teléfono", obligatorio: true, activo: true },
    { nombre: "Ciudad", obligatorio: true, activo: true },
    { nombre: "Disponibilidad horaria", obligatorio: false, activo: true },
    { nombre: "Vehículo propio", obligatorio: false, activo: true },
    { nombre: "Experiencia previa en inspecciones", obligatorio: false, activo: false },
    { nombre: "Foto de perfil", obligatorio: false, activo: false },
  ];

  const etiquetas = ["Senior", "Junior", "VIP", "Bilingüe", "Disponibilidad inmediata"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Inspectores</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura el pool de inspectores, campos del perfil y etiquetas
        </p>
      </div>

      {/* Campos del perfil */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Campos del perfil de inspector</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Datos visibles al darse de alta en la bolsa</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir campo
          </Button>
        </div>
        <CardContent className="p-0">
          {camposFormulario.map((campo) => (
            <div
              key={campo.nombre}
              className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm text-foreground">{campo.nombre}</span>
                {campo.obligatorio && <Badge variant="secondary" className="text-[10px]">Obligatorio</Badge>}
              </div>
              <Switch checked={campo.activo} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Etiquetas */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Etiquetas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Para clasificar inspectores</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {etiquetas.map((e) => (
              <Badge key={e} variant="outline" className="gap-1 text-xs py-1 px-2.5">
                {e}
                <Trash2 className="h-3 w-3 ml-1 text-muted-foreground hover:text-destructive cursor-pointer" />
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Asignación */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Asignación de inspecciones</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Cómo se asignan las inspecciones a los inspectores</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Asignar automáticamente según disponibilidad", checked: false },
            { label: "Priorizar inspectores con mejor nota media", checked: true },
            { label: "Repartir carga equitativamente", checked: true },
            { label: "Notificar al inspector por email al asignar", checked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Permisos */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Permisos de visualización</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Quién puede ver datos sensibles del inspector</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Directores ven email y teléfono", checked: true },
            { label: "Calidad puede mover inspectores entre fases", checked: true },
            { label: "Otros roles pueden consultar inspectores (solo lectura)", checked: false },
          ].map((perm) => (
            <div key={perm.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{perm.label}</Label>
              <Switch checked={perm.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
        <Button>Guardar cambios</Button>
      </div>
    </div>
  );
}
