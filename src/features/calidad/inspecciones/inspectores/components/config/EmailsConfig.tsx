"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, RotateCcw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listInspectorEmailPlantillas,
  updateInspectorEmailPlantilla,
  toggleInspectorEmailPlantillaActiva,
  resetInspectorEmailPlantilla,
  type InspectorEmailPlantilla,
} from "../../email-plantillas-actions";
import { FASES_INSPECTOR_CONFIG } from "../../data";
import type { InspectorFase } from "../../types";

const PLACEHOLDERS: Array<{ token: string; descripcion: string }> = [
  { token: "{{nombre}}", descripcion: "Nombre del inspector" },
  { token: "{{apellidos}}", descripcion: "Apellidos del inspector" },
  { token: "{{nombre_completo}}", descripcion: "Nombre y apellidos" },
  { token: "{{empresa}}", descripcion: "Nombre de tu empresa" },
  { token: "{{ciudad}}", descripcion: "Ciudad del inspector" },
  { token: "{{telefono}}", descripcion: "Teléfono del inspector" },
  { token: "{{email}}", descripcion: "Email del inspector" },
  { token: "{{enlace_bolsa}}", descripcion: "URL pública de la bolsa" },
];

export function EmailsConfig() {
  const [plantillas, setPlantillas] = useState<InspectorEmailPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InspectorEmailPlantilla | null>(null);

  async function refresh() {
    const data = await listInspectorEmailPlantillas();
    setPlantillas(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleToggle(fase: InspectorFase, activa: boolean) {
    setPlantillas((prev) =>
      prev.map((p) => (p.fase === fase ? { ...p, activa } : p)),
    );
    const res = await toggleInspectorEmailPlantillaActiva(fase, activa);
    if (!res.ok) {
      toast.error(res.error);
      refresh();
      return;
    }
    toast.success(activa ? "Email activado" : "Email desactivado");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Plantillas de email</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Una plantilla por cada fase del pipeline de inspectores
        </p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">
            Emails por fase del pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Se envían automáticamente al mover un inspector entre columnas del Kanban
          </p>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
            </div>
          ) : (
            plantillas.map((p) => (
              <div
                key={p.fase}
                className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px] shrink-0 w-32 justify-center"
                  >
                    {p.nombre}
                  </Badge>
                  <span className="text-sm text-muted-foreground truncate">
                    {p.asunto}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditing(p)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Switch
                    checked={p.activa}
                    onCheckedChange={(v) => handleToggle(p.fase, v)}
                  />
                </div>
              </div>
            ))
          )}
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

      <EditPlantillaDialog
        plantilla={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}

// ─── Dialog de edición ────────────────────────────────────────────
function EditPlantillaDialog({
  plantilla,
  onClose,
  onSaved,
}: {
  plantilla: InspectorEmailPlantilla | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (plantilla) {
      setAsunto(plantilla.asunto);
      setCuerpo(plantilla.cuerpo);
    }
  }, [plantilla]);

  if (!plantilla) return null;

  function handleInsertToken(token: string) {
    setCuerpo((prev) => prev + (prev.endsWith(" ") || !prev ? "" : " ") + token);
  }

  function handleSave() {
    const fase = plantilla!.fase;
    startTransition(async () => {
      const res = await updateInspectorEmailPlantilla(fase, {
        asunto,
        cuerpo,
        activa: plantilla!.activa,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Plantilla guardada");
      onSaved();
      onClose();
    });
  }

  function handleReset() {
    const fase = plantilla!.fase;
    startTransition(async () => {
      const res = await resetInspectorEmailPlantilla(fase);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Plantilla restaurada al valor por defecto");
      onSaved();
      onClose();
    });
  }

  const faseLabel = FASES_INSPECTOR_CONFIG[plantilla.fase].label;
  const faseDesc = FASES_INSPECTOR_CONFIG[plantilla.fase].descripcion;

  return (
    <Dialog open={!!plantilla} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary">{faseLabel}</Badge>
            Editar plantilla
          </DialogTitle>
          <DialogDescription>{faseDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="asunto" className="text-xs font-semibold">
              Asunto
            </Label>
            <Input
              id="asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Asunto del email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cuerpo" className="text-xs font-semibold">
              Cuerpo
            </Label>
            <Textarea
              id="cuerpo"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={14}
              className="font-mono text-sm"
              placeholder="Escribe el cuerpo del email…"
            />
          </div>

          <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Datos automáticos disponibles
            </p>
            <p className="text-[11px] text-muted-foreground">
              Haz clic en una variable para añadirla al cuerpo. Se sustituirá por el dato real al enviar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((ph) => (
                <button
                  key={ph.token}
                  type="button"
                  onClick={() => handleInsertToken(ph.token)}
                  title={ph.descripcion}
                  className="text-[11px] font-mono bg-background border border-border hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors rounded px-1.5 py-0.5"
                >
                  {ph.token}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={pending}
            className="mr-auto gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" /> Restaurar por defecto
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
