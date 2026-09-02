"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/shared/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getNominasGestoriaConfig,
  setNominasGestoriaConfig,
  enviarNominasGestoriaAhora,
  getCorreoGestoria,
  type NominasGestoriaConfig,
} from "@/features/rrhh/actions/nominas-gestoria-config-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

// Ajustes del envío automático de nóminas a la gestoría (general de empresa).
// La gestoría recibe un correo el día configurado con un enlace para subir las
// nóminas del mes; la IA las lee y vuelca al sistema automáticamente.
const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Los 6 últimos meses YA TERMINADOS, del más reciente al más antiguo. No incluye
 * el mes en curso: no tiene sentido reclamar nóminas de un mes sin cerrar (el
 * servidor también lo rechaza).
 */
function ultimosMesesCerrados(n = 6): string[] {
  const out: string[] = [];
  const hoy = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const MESES_ELEGIBLES = ultimosMesesCerrados();

function etiquetaMes(periodo: string): string {
  const [y, m] = periodo.split("-");
  return `${MESES_ES[Number(m) - 1] ?? ""} ${y}`.trim();
}

export function NominasGestoriaConfigPanel() {
  const [cfg, setCfg] = useState<NominasGestoriaConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Mes a reclamar con «Enviar ahora». Por defecto, el último ya cerrado.
  const [mesEnvio, setMesEnvio] = useState(MESES_ELEGIBLES[0]);
  // Correo REAL al que irá el envío (Ajustes → Configuración), para poder
  // enseñarlo y confirmarlo antes de mandar nada.
  const [correoGestoria, setCorreoGestoria] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDelete();

  useEffect(() => {
    getNominasGestoriaConfig().then(setCfg);
    getCorreoGestoria().then(setCorreoGestoria);
  }, []);

  if (!cfg) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const set = <K extends keyof NominasGestoriaConfig>(k: K, v: NominasGestoriaConfig[K]) =>
    setCfg((prev) => (prev ? { ...prev, [k]: v } : prev));

  const guardar = async () => {
    setGuardando(true);
    const res = await setNominasGestoriaConfig(cfg);
    setGuardando(false);
    if (res.ok) toast.success("Ajustes de envío a gestoría guardados.");
    else toast.error("No se pudieron guardar los ajustes.");
  };

  const enviarAhora = async () => {
    // CONFIRMACIÓN: esto manda un correo REAL a la gestoría. Sin este paso, un
    // clic sin querer les llega igual y no hay forma de recuperar el correo.
    if (!correoGestoria) {
      toast.error("No hay correo de gestoría configurado en Ajustes → Configuración.");
      return;
    }
    const ok = await confirm({
      title: `Enviar a la gestoría las nóminas de ${etiquetaMes(mesEnvio)}`,
      description:
        `Se enviará un correo a ${correoGestoria} con un enlace para subir las nóminas de ` +
        `${etiquetaMes(mesEnvio)}. Es el enlace de siempre: no caduca. ¿Continuar?`,
      confirmLabel: "Enviar correo",
    });
    if (!ok) return;
    setEnviando(true);
    // El correo NO se comprueba aquí: vive en Ajustes → Configuración, no en este
    // panel, así que mirar `cfg.email` bloqueaba el envío aunque estuviera puesto.
    // Si de verdad falta, el servidor devuelve el motivo.
    const res = await enviarNominasGestoriaAhora(mesEnvio);
    setEnviando(false);
    if (res.ok) {
      toast.success(`Enlace enviado a la gestoría para las nóminas de ${etiquetaMes(mesEnvio)}.`, {
        description: "Se ha enviado el enlace permanente de la empresa.",
      });
    } else {
      toast.error(res.error ?? "No se pudo enviar el correo.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Envío de nóminas a la gestoría</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Un día fijo del mes se envía a la gestoría un correo con un enlace para subir las
          nóminas. Al adjuntarlas, la IA las lee y vuelca los datos al sistema automáticamente.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Activar el envío automático</Label>
          <p className="text-xs text-muted-foreground">
            Cada mes, el día indicado, la gestoría recibe el enlace para subir las nóminas.
          </p>
        </div>
        <Switch checked={cfg.activo} onCheckedChange={(v) => set("activo", v)} />
      </div>

      {cfg.activo && (
        <>
          {/* El correo NO se edita aquí: vive en Ajustes → Configuración, que es
              la fuente única (lo usan también los modelos fiscales y el alta de
              personal). Tener un campo propio aquí duplicaba el dato y, al estar
              vacío, hacía creer que no había correo configurado. */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <Label className="text-sm">Correo de la gestoría</Label>
            <p className="mt-1 text-sm font-medium">
              {correoGestoria ?? (
                <span className="text-destructive">Sin configurar</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Se toma de Ajustes → Configuración. Cámbialo allí si hace falta.
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <Label className="text-sm">Día del mes en el que se envía</Label>
            <div className="flex items-center gap-2">
              <NumberInput
                min={1}
                max={28}
                decimales={false}
                emptyValue={1}
                value={cfg.diaEnvio}
                onValueChange={(v) => set("diaEnvio", v)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">de cada mes (1 a 28)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              El correo sale a las 00:00 (medianoche) de la zona horaria de la empresa. Por
              defecto el día 1. Se limita al día 28 para que exista en todos los meses.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Avisar a RRHH cuando la gestoría suba nóminas</Label>
              <p className="text-xs text-muted-foreground">
                Al volcarse las nóminas, RRHH recibe una notificación con el resumen (volcadas,
                ya existentes y sin empleado).
              </p>
            </div>
            <Switch checked={cfg.notifRrhh} onCheckedChange={(v) => set("notifRrhh", v)} />
          </div>

          {cfg.ultimoEnvio && (
            <p className="text-xs text-muted-foreground">
              Último envío automático: {cfg.ultimoEnvio}.
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {cfg.activo && (
          <div className="mr-auto flex items-center gap-2">
            <label htmlFor="mes-envio" className="text-xs text-muted-foreground">
              Reclamar el mes
            </label>
            <select
              id="mes-envio"
              value={mesEnvio}
              onChange={(e) => setMesEnvio(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {MESES_ELEGIBLES.map((p) => (
                <option key={p} value={p}>{etiquetaMes(p)}</option>
              ))}
            </select>
          </div>
        )}
        {cfg.activo && (
          <Button
            variant="outline"
            onClick={enviarAhora}
            disabled={enviando}
            className="gap-2"
            title="Envía a la gestoría el enlace de subida, indicando el mes elegido."
          >
            {enviando ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Enviando…</>
            ) : (
              <><Send className="h-4 w-4" />Enviar ahora</>
            )}
          </Button>
        )}
        <Button onClick={guardar} disabled={guardando} className="gap-2">
          {guardando ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
          ) : (
            <><Save className="h-4 w-4" />Guardar</>
          )}
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}
