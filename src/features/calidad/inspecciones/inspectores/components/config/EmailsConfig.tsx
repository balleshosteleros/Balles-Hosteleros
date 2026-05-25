import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";

export function EmailsConfig() {
  const plantillas = [
    { evento: "Inscripción recibida", asunto: "Hemos recibido tu inscripción", activa: true },
    { evento: "Pasa a Entrevista", asunto: "Vamos a conocernos", activa: true },
    { evento: "Aprobado", asunto: "Bienvenido al equipo de inspectores", activa: true },
    { evento: "Asignación de inspección", asunto: "Tienes una nueva inspección", activa: true },
    { evento: "Recordatorio 24h antes", asunto: "Recordatorio de tu inspección", activa: true },
    { evento: "Inspección completada", asunto: "Gracias por tu trabajo", activa: false },
    { evento: "Descartado", asunto: "Sobre tu candidatura", activa: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Plantillas de email</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Emails automáticos enviados a los inspectores en cada fase
        </p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Emails por evento</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Edita el asunto y cuerpo de cada email</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Nueva plantilla
          </Button>
        </div>
        <CardContent className="p-0">
          {plantillas.map((p) => (
            <div
              key={p.evento}
              className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary" className="text-[10px] shrink-0">{p.evento}</Badge>
                <span className="text-sm text-muted-foreground truncate">{p.asunto}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Switch checked={p.activa} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Reglas de envío</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Activar emails automáticos al cambiar de fase", checked: true },
            { label: "Pedir confirmación antes de enviar cada email", checked: true },
            { label: "Enviar copia al responsable de Calidad", checked: false },
            { label: "Incluir firma corporativa en los emails", checked: true },
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
