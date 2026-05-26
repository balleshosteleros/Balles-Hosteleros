import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function PlantillasInspeccionConfig() {
  const plantillas = [
    { nombre: "Calidad de sala — completa", secciones: 8, preguntas: 47, activa: true },
    { nombre: "Limpieza y APPCC", secciones: 5, preguntas: 31, activa: true },
    { nombre: "Imagen y atención al cliente", secciones: 4, preguntas: 22, activa: true },
    { nombre: "Auditoría rápida (10 min)", secciones: 2, preguntas: 12, activa: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Plantillas de inspección</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Plantillas reutilizables que el inspector rellena durante la visita
        </p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Plantillas disponibles</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Activa o desactiva plantillas para los inspectores</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Nueva plantilla
          </Button>
        </div>
        <CardContent className="p-0">
          {plantillas.map((p) => (
            <div
              key={p.nombre}
              className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground">{p.nombre}</span>
                <Badge variant="secondary" className="text-[10px]">{p.secciones} secciones</Badge>
                <Badge variant="secondary" className="text-[10px]">{p.preguntas} preguntas</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                <Switch checked={p.activa} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Reglas por defecto</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Permitir al inspector guardar borradores", checked: true },
            { label: "Requerir foto en preguntas con incidencia", checked: true },
            { label: "Requerir firma del responsable al cerrar", checked: true },
            { label: "Bloquear envío si quedan preguntas sin contestar", checked: false },
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
