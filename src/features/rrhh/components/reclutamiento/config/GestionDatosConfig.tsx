import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash2, Shield, FileText, AlertTriangle } from "lucide-react";

export function GestionDatosConfig() {
  const logs = [
    { fecha: "2026-04-06 14:30", usuario: "Antonio Ballesteros", accion: "Exportó candidatos de CAMARERO" },
    { fecha: "2026-04-05 11:15", usuario: "Sara Molina", accion: "Archivó vacante MANTENIMIENTO" },
    { fecha: "2026-04-04 09:00", usuario: "Sistema", accion: "Eliminación automática de datos expirados (RGPD)" },
    { fecha: "2026-04-03 16:45", usuario: "Antonio Ballesteros", accion: "Exportó todos los candidatos a CSV" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Gestión de datos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Exportación, archivado, RGPD y trazabilidad de datos del reclutamiento
        </p>
      </div>

      {/* Exportación */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Exportación de datos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Descarga datos de candidatos y vacantes</p>
        </div>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-1.5 text-sm">
              <Download className="h-4 w-4" /> Exportar candidatos (CSV)
            </Button>
            <Button variant="outline" className="gap-1.5 text-sm">
              <Download className="h-4 w-4" /> Exportar vacantes (CSV)
            </Button>
            <Button variant="outline" className="gap-1.5 text-sm">
              <FileText className="h-4 w-4" /> Generar informe PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Archivado */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Borrado y archivado</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Archivar automáticamente candidatos descartados tras 90 días", checked: true },
            { label: "Eliminar CVs de candidatos descartados tras 1 año", checked: false },
            { label: "Permitir borrado manual de candidatos", checked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RGPD */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">RGPD y protección de datos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Configuración de cumplimiento normativo</p>
          </div>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Periodo de conservación de datos</Label>
            <Select defaultValue="12">
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
                <SelectItem value="36">36 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {[
            { label: "Solicitar consentimiento explícito al inscribirse", checked: true },
            { label: "Permitir al candidato solicitar eliminación de sus datos", checked: true },
            { label: "Anonimizar datos expirados en lugar de eliminarlos", checked: false },
            { label: "Registrar todos los accesos a datos personales", checked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{item.label}</Label>
              <Switch checked={item.checked} />
            </div>
          ))}
          <div className="rounded-lg bg-accent border border-border p-3 flex items-start gap-2 text-xs text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            <span>Recuerda revisar periódicamente la configuración RGPD para cumplir con la normativa vigente.</span>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Registro de actividad</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Trazabilidad de acciones sobre datos</p>
        </div>
        <CardContent className="p-0">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 text-sm">
              <span className="text-xs text-muted-foreground w-36 shrink-0">{log.fecha}</span>
              <span className="font-medium text-foreground w-40 shrink-0">{log.usuario}</span>
              <span className="text-muted-foreground">{log.accion}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="destructive" className="gap-1.5">
          <Trash2 className="h-4 w-4" /> Purgar datos expirados
        </Button>
      </div>
    </div>
  );
}
