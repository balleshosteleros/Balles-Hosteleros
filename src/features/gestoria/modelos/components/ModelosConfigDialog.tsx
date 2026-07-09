"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getModelosConfig, saveModelosConfig } from "../actions/modelos-config-actions";
import { MODELOS_CONFIG_DEFAULT, type ModelosConfig } from "../services/modelos-config";
import { MODELO_LABEL, grupoDeModelo, type ModeloTipo } from "../types/modelos";

const TODOS_LOS_TIPOS = Object.keys(MODELO_LABEL) as ModeloTipo[];
const TIPOS_TRIMESTRALES = TODOS_LOS_TIPOS.filter((t) => grupoDeModelo(t) === "TRIMESTRALES");
const TIPOS_ANUALES = TODOS_LOS_TIPOS.filter((t) => grupoDeModelo(t) === "ANUALES");

interface ModelosConfigDialogProps {
  onSaved?: () => void;
}

export function ModelosConfigDialog({ onSaved }: ModelosConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Set de tipos activos. Si es null en config → todos activos.
  const [activos, setActivos] = useState<Set<ModeloTipo>>(new Set(TODOS_LOS_TIPOS));
  // Obligatorios en el enlace de la gestoría. null en config → todos obligatorios.
  const [obligatorios, setObligatorios] = useState<Set<ModeloTipo>>(new Set(TODOS_LOS_TIPOS));
  const [emailTrimActivo, setEmailTrimActivo] = useState(false);
  const [emailTrimOffset, setEmailTrimOffset] = useState(1);
  const [emailAnualActivo, setEmailAnualActivo] = useState(false);
  const [emailAnualOffset, setEmailAnualOffset] = useState(1);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    void getModelosConfig()
      .then((r) => {
        const c = r.ok ? r.data : MODELOS_CONFIG_DEFAULT;
        setActivos(
          c.tipos_activos == null ? new Set(TODOS_LOS_TIPOS) : new Set(c.tipos_activos),
        );
        setObligatorios(
          c.tipos_obligatorios == null ? new Set(TODOS_LOS_TIPOS) : new Set(c.tipos_obligatorios),
        );
        setEmailTrimActivo(c.email_trim_activo);
        setEmailTrimOffset(c.email_trim_dias_offset);
        setEmailAnualActivo(c.email_anual_activo);
        setEmailAnualOffset(c.email_anual_dias_offset);
      })
      .finally(() => setCargando(false));
  }, [open]);

  const toggleTipo = (tipo: ModeloTipo, activo: boolean) => {
    setActivos((prev) => {
      const next = new Set(prev);
      if (activo) next.add(tipo);
      else next.delete(tipo);
      return next;
    });
  };

  const toggleObligatorio = (tipo: ModeloTipo, obl: boolean) => {
    setObligatorios((prev) => {
      const next = new Set(prev);
      if (obl) next.add(tipo);
      else next.delete(tipo);
      return next;
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const todosActivos = TODOS_LOS_TIPOS.every((t) => activos.has(t));
      const todosObligatorios = TODOS_LOS_TIPOS.every((t) => obligatorios.has(t));
      const input: ModelosConfig = {
        tipos_activos: todosActivos
          ? null
          : TODOS_LOS_TIPOS.filter((t) => activos.has(t)),
        tipos_obligatorios: todosObligatorios
          ? null
          : TODOS_LOS_TIPOS.filter((t) => obligatorios.has(t)),
        email_trim_activo: emailTrimActivo,
        email_trim_dias_offset: emailTrimOffset,
        email_anual_activo: emailAnualActivo,
        email_anual_dias_offset: emailAnualOffset,
      };
      const res = await saveModelosConfig(input);
      if (res.ok) {
        toast.success("Configuración guardada");
        setOpen(false);
        onSaved?.();
      } else {
        toast.error(res.error ?? "No se pudo guardar la configuración");
      }
    } finally {
      setGuardando(false);
    }
  };

  const listaTipos = (tipos: ModeloTipo[]) => (
    <div className="space-y-1">
      {tipos.map((tipo) => (
        <div
          key={tipo}
          className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
        >
          <Label htmlFor={`modelo-${tipo}`} className="text-sm font-normal text-foreground cursor-pointer">
            {MODELO_LABEL[tipo]}
          </Label>
          <Switch
            id={`modelo-${tipo}`}
            checked={activos.has(tipo)}
            onCheckedChange={(v) => toggleTipo(tipo, v)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configuración de modelos">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración de modelos</DialogTitle>
          <DialogDescription>
            Elige qué modelos ves y cómo se avisa a la gestoría.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Sección A — Modelos visibles */}
            <section className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">Modelos visibles</h3>
                <p className="text-xs text-muted-foreground">
                  Oculta los modelos que no presentas para simplificar la vista.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Trimestrales</p>
                  {listaTipos(TIPOS_TRIMESTRALES)}
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Anuales</p>
                  {listaTipos(TIPOS_ANUALES)}
                </div>
              </div>
            </section>

            {/* Sección B — Obligatorios en el enlace de la gestoría */}
            <section className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  Obligatorios al subir por la gestoría
                </h3>
                <p className="text-xs text-muted-foreground">
                  La gestoría debe subir <b>todos los obligatorios</b> para poder enviar (todo o
                  nada). Por defecto todos lo son; desmarca los que quieras dejar opcionales.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                {TODOS_LOS_TIPOS.filter((t) => activos.has(t)).map((tipo) => (
                  <div
                    key={`obl-${tipo}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <Label
                      htmlFor={`obl-${tipo}`}
                      className="text-sm font-normal text-foreground cursor-pointer"
                    >
                      {MODELO_LABEL[tipo]}
                    </Label>
                    <Switch
                      id={`obl-${tipo}`}
                      checked={obligatorios.has(tipo)}
                      onCheckedChange={(v) => toggleObligatorio(tipo, v)}
                    />
                  </div>
                ))}
                {TODOS_LOS_TIPOS.filter((t) => activos.has(t)).length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    No hay modelos visibles.
                  </p>
                ) : null}
              </div>
            </section>

            {/* Sección B — Emails a la gestoría */}
            <section className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">Emails a la gestoría</h3>
                <p className="text-xs text-muted-foreground">
                  El email se envía a la gestoría con un enlace para que suba los modelos. Se
                  dispara N días respecto a la fecha límite de presentación.
                </p>
              </div>

              {/* Trimestrales */}
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Trimestrales</Label>
                    <p className="text-xs text-muted-foreground">
                      Aviso para los modelos trimestrales.
                    </p>
                  </div>
                  <Switch checked={emailTrimActivo} onCheckedChange={setEmailTrimActivo} />
                </div>
                <div className={cn("flex items-center gap-2", !emailTrimActivo && "opacity-50")}>
                  <Label htmlFor="email-trim-offset" className="text-sm text-foreground">
                    Días tras la fecha límite
                  </Label>
                  <Input
                    id="email-trim-offset"
                    type="number"
                    min={-60}
                    max={60}
                    disabled={!emailTrimActivo}
                    value={emailTrimOffset}
                    onChange={(e) => setEmailTrimOffset(Number(e.target.value))}
                    className="w-20 h-9"
                  />
                </div>
              </div>

              {/* Anuales */}
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Anuales</Label>
                    <p className="text-xs text-muted-foreground">
                      Aviso para los modelos anuales.
                    </p>
                  </div>
                  <Switch checked={emailAnualActivo} onCheckedChange={setEmailAnualActivo} />
                </div>
                <div className={cn("flex items-center gap-2", !emailAnualActivo && "opacity-50")}>
                  <Label htmlFor="email-anual-offset" className="text-sm text-foreground">
                    Días tras la fecha límite
                  </Label>
                  <Input
                    id="email-anual-offset"
                    type="number"
                    min={-60}
                    max={60}
                    disabled={!emailAnualActivo}
                    value={emailAnualOffset}
                    onChange={(e) => setEmailAnualOffset(Number(e.target.value))}
                    className="w-20 h-9"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Ver plantilla del email · Editable en Ajustes → Plantillas de email
              </p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => void guardar()} disabled={guardando || cargando}>
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
