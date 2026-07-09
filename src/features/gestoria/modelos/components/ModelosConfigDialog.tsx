"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getModelosConfig, saveModelosConfig } from "../actions/modelos-config-actions";
import { MODELOS_CONFIG_DEFAULT, type ModelosConfig } from "../services/modelos-config";
import {
  MODELO_LABEL,
  grupoDeModelo,
  PLAZOS_PRESENTACION,
  MODELO_PERIODOS_VALIDOS,
  type ModeloTipo,
  type ModeloPeriodo,
} from "../types/modelos";

const TODOS_LOS_TIPOS = Object.keys(MODELO_LABEL) as ModeloTipo[];
const TIPOS_TRIMESTRALES = TODOS_LOS_TIPOS.filter((t) => grupoDeModelo(t) === "TRIMESTRALES");
const TIPOS_ANUALES = TODOS_LOS_TIPOS.filter((t) => grupoDeModelo(t) === "ANUALES");

// Opciones del desplegable "cuándo sale el email" (solo DESPUÉS del plazo: es
// para reclamar el modelo ya presentado). El valor es el offset en días.
const OPCIONES_OFFSET: { valor: number; etiqueta: string }[] = [
  { valor: 0, etiqueta: "El mismo día (fecha límite)" },
  { valor: 1, etiqueta: "1 día después" },
  { valor: 3, etiqueta: "3 días después" },
  { valor: 7, etiqueta: "7 días después" },
];

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const LABEL_PERIODO: Record<ModeloPeriodo, string> = {
  T1: "1T", T2: "2T", T3: "3T", T4: "4T", ANUAL: "Anual",
};

/** Fecha límite oficial en texto, indicando si cae en el año siguiente. */
function fechaLimiteTexto(tipo: ModeloTipo, periodo: ModeloPeriodo): string | null {
  const plazo = PLAZOS_PRESENTACION[tipo][periodo];
  if (!plazo) return null;
  const añoSiguiente = periodo === "T4" || periodo === "ANUAL";
  return `${plazo.dia} de ${NOMBRE_MES[plazo.mes - 1]}${añoSiguiente ? " (año siguiente)" : ""}`;
}

/** Filas del calendario fiscal oficial: un modelo con todos sus plazos. */
const CALENDARIO_OFICIAL = TODOS_LOS_TIPOS.map((tipo) => {
  const plazos = MODELO_PERIODOS_VALIDOS[tipo]
    .map((p) => ({ periodo: p, fecha: fechaLimiteTexto(tipo, p) }))
    .filter((x) => x.fecha);
  return { tipo, label: MODELO_LABEL[tipo], plazos };
}).filter((r) => r.plazos.length > 0);

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

            {/* Sección B — Modelos que se piden a la gestoría */}
            <section className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  Modelos que se piden a la gestoría
                </h3>
                <p className="text-xs text-muted-foreground">
                  La gestoría debe subir <b>todos estos a la vez</b>: si falta alguno, no puede
                  enviar. Por defecto se piden todos; desmarca los que esta empresa no presente.
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
                <div className={cn("space-y-1", !emailTrimActivo && "opacity-50")}>
                  <Label className="text-sm text-foreground">¿Cuándo se envía?</Label>
                  <Select
                    disabled={!emailTrimActivo}
                    value={String(emailTrimOffset)}
                    onValueChange={(v) => setEmailTrimOffset(Number(v))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCIONES_OFFSET.map((o) => (
                        <SelectItem key={o.valor} value={String(o.valor)}>
                          {o.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className={cn("space-y-1", !emailAnualActivo && "opacity-50")}>
                  <Label className="text-sm text-foreground">¿Cuándo se envía?</Label>
                  <Select
                    disabled={!emailAnualActivo}
                    value={String(emailAnualOffset)}
                    onValueChange={(v) => setEmailAnualOffset(Number(v))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCIONES_OFFSET.map((o) => (
                        <SelectItem key={o.valor} value={String(o.valor)}>
                          {o.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                El email se dirige a la gestoría (Ajustes → Empresa → Correo gestoría) y su
                texto es editable en Ajustes → Plantillas de email.
              </p>
            </section>

            {/* Sección C — Calendario fiscal oficial (informativo) */}
            <section className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  Calendario fiscal oficial (España)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Fecha límite de presentación de cada modelo ante la AEAT (régimen general).
                </p>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Modelo</th>
                      <th className="text-left font-medium px-3 py-2">Fecha límite de presentación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CALENDARIO_OFICIAL.map((fila) => (
                      <tr key={fila.tipo} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground align-top whitespace-nowrap">
                          {fila.label}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {fila.plazos.map((p) => (
                            <div key={p.periodo}>
                              <span className="font-medium text-foreground">
                                {LABEL_PERIODO[p.periodo]}:
                              </span>{" "}
                              {p.fecha}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                «Año siguiente» indica que el plazo cae en enero/febrero/julio del año posterior al
                ejercicio (p. ej. el 4T y los resúmenes anuales).
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
