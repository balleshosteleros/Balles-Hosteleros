"use client";

/**
 * Diálogo de BAJA DE CONTRATO iniciada POR LA EMPRESA. Se abre desde la ficha de
 * un empleado (botón «BAJA CONTRATO» en rojo). Deja claro que esta baja la CAUSA
 * la empresa (disciplinaria, fin de contrato, etc.) y NO es la baja voluntaria
 * —esa la solicita el propio trabajador desde Mi Panel → Solicitudes—.
 *
 * Al confirmar: avisa a la gestoría (datos del trabajador + tipo de baja + último
 * día + día oficial de la baja) y mueve al candidato a la fase «Baja contrato»
 * del offboarding. NO marca al empleado como Inactivo (eso ocurre al final, al
 * pasarlo a «Ex-empleados»).
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CalendarDays, Loader2, Sparkles, UserMinus } from "lucide-react";
import {
  etiquetaTipoBajaEmpresa,
  TIPOS_BAJA_EMPRESA,
  type TipoBajaContrato,
} from "@/features/rrhh/data/campos-gestoria";
import { darBajaContratoEmpresa } from "@/features/rrhh/actions/candidatos-actions";
import { friendlyError } from "@/shared/lib/friendly-errors";

function hoyIso(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** dd/mm/aaaa a partir de un ISO YYYY-MM-DD. */
function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Día siguiente (día oficial de la baja) a partir de un ISO. */
function diaSiguiente(iso: string): string {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return iso;
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export function BajaContratoEmpresaDialog({
  open,
  onOpenChange,
  candidatoId,
  empleadoNombre,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidatoId: string | null;
  empleadoNombre: string;
  onDone?: () => void;
}) {
  const [tipoBaja, setTipoBaja] = useState<TipoBajaContrato>("disciplinaria");
  const [ultimoDia, setUltimoDia] = useState<string>(hoyIso());
  const [motivo, setMotivo] = useState("");
  const [hechos, setHechos] = useState("");
  const [mejorando, setMejorando] = useState(false);
  /** Texto previo a la última mejora con IA, para poder deshacerla. */
  const [hechosPrevios, setHechosPrevios] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipoBaja("disciplinaria");
    setUltimoDia(hoyIso());
    setMotivo("");
    setHechos("");
    setHechosPrevios(null);
  }, [open]);

  /**
   * Pide a la IA que reescriba los hechos con el registro formal de una carta
   * de despido. La IA solo reformula: no inventa datos (lo que falte lo deja
   * [entre corchetes]). El texto vuelve al campo y RRHH puede retocarlo,
   * volver a mejorarlo o deshacer.
   */
  const mejorarConIa = async () => {
    const base = hechos.trim();
    if (!base) {
      toast.error("Escribe primero los hechos y luego pulsa «Mejorar con IA».");
      return;
    }
    setMejorando(true);
    try {
      const res = await fetch("/api/rrhh/ia-redactar-baja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrador: base,
          tipoBajaLabel: etiquetaTipoBajaEmpresa(tipoBaja),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        toast.error(data?.error ?? "No se pudo redactar con IA.");
        return;
      }
      setHechosPrevios(base);
      setHechos(data.hechos as string);
      toast.success("Hechos redactados. Revísalos antes de enviar.");
    } catch (err) {
      toast.error("No se pudo conectar con la IA.", { description: friendlyError(err, "mejorarConIa") });
    } finally {
      setMejorando(false);
    }
  };

  const deshacerMejora = () => {
    if (hechosPrevios == null) return;
    setHechos(hechosPrevios);
    setHechosPrevios(null);
  };

  const diaOficial = useMemo(() => (ultimoDia ? fmt(diaSiguiente(ultimoDia)) : "—"), [ultimoDia]);

  const confirmar = async () => {
    if (!candidatoId) return;
    if (!ultimoDia) {
      toast.error("Indica el último día de trabajo.");
      return;
    }
    setGuardando(true);
    try {
      const res = await darBajaContratoEmpresa(candidatoId, {
        tipoBaja,
        ultimoDiaIso: ultimoDia,
        motivo: motivo.trim() || null,
        hechos: hechos.trim() || null,
      });
      if (!res.ok) {
        toast.error(("error" in res && res.error) || "No se pudo dar de baja");
        return;
      }
      if (res.gestoriaAvisada) {
        toast.success("Baja iniciada. Avisada la gestoría y movido a «Baja contrato».");
      } else {
        toast.warning(
          `Baja iniciada y movido a «Baja contrato», pero no se avisó a la gestoría: ${res.gestoriaError ?? "revisa el correo de gestoría en Ajustes → Empresa."}`,
        );
      }
      // La carta al trabajador no bloquea la baja: si falla, se avisa aparte
      // para que RRHH pueda reenviarla desde el documento.
      if (res.cartaEnviada) {
        toast.success("Enviada al trabajador la carta de comunicación para firmar.");
      } else {
        toast.warning(
          `No se pudo enviar la carta al trabajador: ${res.cartaError ?? "revisa su email en la ficha."}`,
        );
      }
      onOpenChange(false);
      onDone?.();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <UserMinus className="h-5 w-5" /> Baja de contrato
          </DialogTitle>
          <DialogDescription>
            Vas a dar de baja a <strong>{empleadoNombre}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Aviso: esta baja la causa la EMPRESA, no el trabajador. */}
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Esto es para causar la baja <strong>por parte de la empresa</strong> (despido, fin de
            contrato, etc.). Si es el trabajador quien quiere irse, debe solicitarlo él mismo desde{" "}
            <strong>Mis Paneles → Solicitudes</strong>.
          </p>
        </div>

        <div className="space-y-4 py-1">
          {/* Tipo de baja */}
          <div className="space-y-1.5">
            <Label>Tipo de baja</Label>
            <Select value={tipoBaja} onValueChange={(v) => setTipoBaja(v as TipoBajaContrato)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_BAJA_EMPRESA.map((t) => (
                  <SelectItem key={t} value={t}>{etiquetaTipoBajaEmpresa(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipoBaja === "voluntaria" && (
              <p className="text-xs text-muted-foreground">
                Voluntaria forzosa: úsala solo cuando el trabajador no da señales de vida y
                tramitas su baja voluntaria en su nombre.
              </p>
            )}
          </div>

          {/* Último día de trabajo */}
          <div className="space-y-1.5">
            <Label htmlFor="ultimoDiaBaja">Último día de trabajo</Label>
            <Input
              id="ultimoDiaBaja"
              type="date"
              value={ultimoDia}
              onChange={(e) => setUltimoDia(e.target.value)}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Día oficial de la baja: <strong>{diaOficial}</strong> (un día después del último trabajado).
            </p>
          </div>

          {/* Hechos: van en la CARTA que firma el trabajador. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hechosBaja">Hechos que motivan la baja</Label>
              <div className="flex items-center gap-1">
                {hechosPrevios != null && !mejorando && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deshacerMejora}
                  >
                    Deshacer
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={mejorarConIa}
                  disabled={mejorando || !hechos.trim()}
                >
                  {mejorando ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Redactando…</>
                  ) : (
                    <><Sparkles className="h-3 w-3" /> Mejorar con IA</>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              id="hechosBaja"
              value={hechos}
              onChange={(e) => setHechos(e.target.value)}
              placeholder="Escríbelos como te salgan y pulsa «Mejorar con IA» para darles forma de carta. Ej.: lleva 3 meses llegando tarde, avisado 2 veces por escrito, el 12 de agosto no vino y no avisó."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Este texto aparece en la carta que se envía al trabajador para que la firme. La IA
              solo reescribe lo que pongas: si falta un dato lo deja marcado{" "}
              <span className="font-mono">[entre corchetes]</span> para que lo completes.
            </p>
          </div>

          {/* Motivo (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="motivoBaja">Nota interna para la gestoría (opcional)</Label>
            <Textarea
              id="motivoBaja"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Detalle interno de la baja (se incluye en el aviso a la gestoría, no en la carta)."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={guardando || !ultimoDia}>
            {guardando ? "Dando de baja…" : "Dar de baja y avisar a gestoría"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
