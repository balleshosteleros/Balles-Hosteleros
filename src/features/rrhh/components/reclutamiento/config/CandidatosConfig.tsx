import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical } from "lucide-react";
import { OrigenesCandidatoConfig } from "./OrigenesCandidatoConfig";

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Candidatos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura los campos del formulario de candidatura
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

      {/* ¿Cómo nos has conocido? — orígenes configurables (BD) */}
      <OrigenesCandidatoConfig />

      {/* Permisos de visualización */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Permisos de visualización</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Quién puede ver información de los candidatos</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Reclutadores pueden ver todos los candidatos", checked: true },
            { label: "Directores ven datos sensibles (email, teléfono)", checked: true },
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
