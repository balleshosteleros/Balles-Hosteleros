"use client";

import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import type {
  ToolNotifKey,
  AgendaNotifConfig,
  NotificacionesConfig,
} from "@/features/ajustes/data/ajustes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Bell, Info, Megaphone } from "lucide-react";
import { toast } from "sonner";

interface Props {
  toolKey: ToolNotifKey;
  /** El icono tiene un contador real (badge). Si no, se oculta el toggle de badge. */
  hasBadge?: boolean;
  /** Solo la agenda: ventana de anuncio de contactos nuevos. */
  withDiasAnuncio?: boolean;
}

export function ToolNotifPanel({ toolKey, hasBadge = true, withDiasAnuncio = false }: Props) {
  const { ajustes, setAjustes } = useEmpresa();
  const cfg = ajustes.notificaciones[toolKey];

  const set = (patch: Partial<AgendaNotifConfig>) => {
    setAjustes((prev) => ({
      ...prev,
      notificaciones: {
        ...prev.notificaciones,
        [toolKey]: { ...prev.notificaciones[toolKey], ...patch },
      } as NotificacionesConfig,
    }));
  };

  const publicarAviso = () => {
    if (!cfg.popupActivo) {
      toast.error("Activa primero el aviso emergente para poder publicarlo.");
      return;
    }
    if (!cfg.popupTitulo.trim() && !cfg.popupMensaje.trim()) {
      toast.error("Escribe un título o un mensaje para el aviso.");
      return;
    }
    set({ popupVersion: cfg.popupVersion + 1 });
    toast.success("Aviso publicado", {
      description: "Se mostrará una sola vez a cada usuario con acceso.",
    });
  };

  const dias = (cfg as AgendaNotifConfig).diasAnuncio ?? 7;

  return (
    <div className="space-y-5 py-2">
      {/* Aviso multi-tenant */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Configura cómo avisa este icono en la barra superior. Se aplica a todos
          los usuarios de esta empresa. El círculo muestra <b>9+</b> cuando hay
          más de 9.
        </span>
      </div>

      {/* Badge */}
      {hasBadge && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Círculo de aviso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="block">Mostrar círculo de aviso</Label>
                <p className="text-xs text-muted-foreground">
                  Número de pendientes sobre el icono (máximo 9+).
                </p>
              </div>
              <Switch
                checked={cfg.badgeActivo}
                onCheckedChange={(v) => set({ badgeActivo: v })}
              />
            </div>

            {withDiasAnuncio && cfg.badgeActivo && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Tiempo que se anuncia un contacto nuevo</Label>
                  <span className="text-sm font-semibold text-foreground">
                    {dias} {dias === 1 ? "día" : "días"}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={[dias]}
                  onValueChange={([v]) => set({ diasAnuncio: v })}
                />
                <p className="text-xs text-muted-foreground">
                  Cada contacto cuenta durante este tiempo desde que se añade.
                  Pasado el plazo deja de anunciarse, pero los más recientes
                  siguen contando.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aviso emergente una sola vez */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            Aviso emergente (una sola vez)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="block">Mostrar pop-up al abrir el portal</Label>
              <p className="text-xs text-muted-foreground">
                Se muestra una única vez a cada usuario con acceso.
              </p>
            </div>
            <Switch
              checked={cfg.popupActivo}
              onCheckedChange={(v) => set({ popupActivo: v })}
            />
          </div>

          {cfg.popupActivo && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor={`popup-titulo-${toolKey}`}>Título</Label>
                <Input
                  id={`popup-titulo-${toolKey}`}
                  value={cfg.popupTitulo}
                  onChange={(e) => set({ popupTitulo: e.target.value })}
                  placeholder="Novedad"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`popup-mensaje-${toolKey}`}>Mensaje</Label>
                <Textarea
                  id={`popup-mensaje-${toolKey}`}
                  value={cfg.popupMensaje}
                  onChange={(e) => set({ popupMensaje: e.target.value })}
                  placeholder="Escribe el aviso que verá el equipo…"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {cfg.popupVersion > 0
                    ? "Publica de nuevo para volver a mostrarlo a todos."
                    : "Aún no se ha publicado."}
                </p>
                <Button size="sm" onClick={publicarAviso}>
                  <Megaphone className="h-4 w-4" />
                  Publicar aviso
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Configuración guardada")}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
