import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { ORIGEN_LABELS } from "@/features/rrhh/data/reclutamiento";

export function CandidatosConfig() {
  const camposFormulario = [
    { nombre: "Nombre y apellidos", obligatorio: true, activo: true },
    { nombre: "Email", obligatorio: true, activo: true },
    { nombre: "Teléfono", obligatorio: true, activo: true },
    { nombre: "CV adjunto", obligatorio: false, activo: true },
    { nombre: "Carta de presentación", obligatorio: false, activo: false },
    { nombre: "Disponibilidad", obligatorio: false, activo: true },
    { nombre: "Experiencia previa", obligatorio: false, activo: false },
    { nombre: "Foto", obligatorio: false, activo: false },
  ];

  const etiquetas = ["Urgente", "VIP", "Recomendado", "Experiencia senior", "Sin experiencia"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Candidatos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura los campos del formulario, orígenes y etiquetas de candidatos
        </p>
      </div>

      {/* Campos del formulario */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Campos del formulario de candidatura</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Campos visibles al inscribirse un candidato</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir campo
          </Button>
        </div>
        <CardContent className="p-0">
          {camposFormulario.map((campo) => (
            <div key={campo.nombre} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm text-foreground">{campo.nombre}</span>
                {campo.obligatorio && <Badge variant="secondary" className="text-[10px]">Obligatorio</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={campo.activo} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Orígenes de candidatura */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Orígenes de candidatura</h3>
            <p className="text-xs text-muted-foreground mt-0.5">De dónde pueden llegar los candidatos</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        <CardContent className="p-0">
          {Object.entries(ORIGEN_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Etiquetas */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Etiquetas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Etiquetas para clasificar candidatos</p>
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

      {/* Permisos de visualización */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Permisos de visualización</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Quién puede ver información de los candidatos</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Reclutadores pueden ver todos los candidatos", checked: true },
            { label: "Administradores ven datos sensibles (email, teléfono)", checked: true },
            { label: "Otros departamentos pueden consultar candidatos", checked: false },
          ].map((perm) => (
            <div key={perm.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{perm.label}</Label>
              <Switch checked={perm.checked} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
