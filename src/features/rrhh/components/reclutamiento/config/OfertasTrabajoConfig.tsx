import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { TIPO_JORNADA_LABELS } from "@/features/rrhh/data/reclutamiento";

export function OfertasTrabajoConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Vacantes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura los tipos de jornada de las vacantes
        </p>
      </div>

      {/* Tipos de jornada */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Tipos de jornada</h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        <CardContent className="p-0">
          {Object.entries(TIPO_JORNADA_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
