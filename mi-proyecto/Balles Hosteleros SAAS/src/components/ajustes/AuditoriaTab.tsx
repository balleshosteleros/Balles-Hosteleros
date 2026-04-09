import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent } from "@/components/ui/card";
import { User, CalendarDays, FileText } from "lucide-react";

export function AuditoriaTab() {
  const { ajustes } = useEmpresa();

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-foreground">HISTORIAL DE AUDITORÍA</h3>
      {ajustes.auditoria.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No hay registros de auditoría.</p>
      )}
      <div className="space-y-0">
        {ajustes.auditoria.map((entry, idx) => (
          <div key={entry.id} className="relative pl-6 pb-4 last:pb-0">
            {idx < ajustes.auditoria.length - 1 && (
              <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />
            )}
            <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3.5 w-3.5" /> {entry.usuario}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><FileText className="h-3.5 w-3.5" /> {entry.apartado}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {entry.fecha}</span>
                </div>
                <p className="text-sm font-medium text-foreground mt-1">{entry.accion}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
