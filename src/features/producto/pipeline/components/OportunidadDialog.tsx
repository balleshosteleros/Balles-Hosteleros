"use client";

/**
 * La ficha de una oportunidad: se abre al pulsar una tarjeta del tablero, y
 * también en blanco desde "Nuevo".
 *
 * La FASE y el ESTADO se editan aquí los dos, porque son cosas distintas: la
 * fase es el paso del embudo (se puede cambiar arrastrando la tarjeta) y el
 * estado es cómo acabó. Al marcar perdida o abandonada se pide el motivo, que
 * es lo que luego se lee para saber qué está fallando.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { parseDecimalOr0 } from "@/shared/lib/numero";
import { borrarOportunidad, guardarOportunidad } from "../actions/pipeline-actions";
import type { Oportunidad, OportunidadEstado, PipelineFase } from "../types";
import { OPORTUNIDAD_ESTADOS, OPORTUNIDAD_ESTADO_LABEL } from "../types";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** null = alta nueva. */
  oportunidad: Oportunidad | null;
  pipelineId: string;
  fases: PipelineFase[];
  onGuardado: () => void;
}

export function OportunidadDialog({
  abierto,
  onCerrar,
  oportunidad,
  pipelineId,
  fases,
  onGuardado,
}: Props) {
  const { confirm, dialog } = useConfirmDelete();
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [valor, setValor] = useState("0");
  const [fuente, setFuente] = useState("");
  const [asignado, setAsignado] = useState("");
  const [faseId, setFaseId] = useState("");
  const [estado, setEstado] = useState<OportunidadEstado>("ABIERTA");
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");
  const [cierrePrevisto, setCierrePrevisto] = useState("");

  const fasesActivas = useMemo(() => fases.filter((f) => f.activa), [fases]);

  useEffect(() => {
    if (!abierto) return;
    const o = oportunidad;
    setNombre(o?.nombre ?? "");
    setTelefono(o?.telefono ?? "");
    setEmail(o?.email ?? "");
    setValor(o ? String(o.valor).replace(".", ",") : "0");
    setFuente(o?.fuente ?? "");
    setAsignado(o?.asignado_a ?? "");
    setFaseId(o?.fase_id ?? fasesActivas[0]?.id ?? "");
    setEstado(o?.estado ?? "ABIERTA");
    setMotivo(o?.motivo_cierre ?? "");
    setNotas(o?.notas ?? "");
    setCierrePrevisto(o?.cierre_previsto ?? "");
  }, [abierto, oportunidad, fasesActivas]);

  const pideMotivo = estado === "PERDIDA" || estado === "ABANDONADA";

  const onGuardar = async () => {
    if (!faseId) {
      toast.error("Elige una fase.");
      return;
    }
    setGuardando(true);
    const res = await guardarOportunidad({
      id: oportunidad?.id,
      pipeline_id: pipelineId,
      fase_id: faseId,
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      valor: parseDecimalOr0(valor),
      fuente: fuente.trim() || null,
      asignado_a: asignado.trim() || null,
      estado,
      motivo_cierre: pideMotivo ? motivo.trim() || null : null,
      notas: notas.trim() || null,
      etiquetas: oportunidad?.etiquetas ?? [],
      cierre_previsto: cierrePrevisto || null,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Guardado");
    onGuardado();
    onCerrar();
  };

  const onBorrar = async () => {
    if (!oportunidad) return;
    const ok = await confirm({
      title: "Borrar la oportunidad",
      description: `Se borra "${oportunidad.nombre}" del pipeline. La ficha del cliente se queda.`,
    });
    if (!ok) return;
    const res = await borrarOportunidad(oportunidad.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Borrada");
    onGuardado();
    onCerrar();
  };

  return (
    <>
      <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{oportunidad ? oportunidad.nombre : "Nueva oportunidad"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="op-nombre">Nombre</Label>
              <Input
                id="op-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="op-telefono">Teléfono</Label>
              <Input
                id="op-telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                inputMode="tel"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="op-email">Correo</Label>
              <Input
                id="op-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="op-fase">Fase</Label>
              <Select value={faseId} onValueChange={setFaseId}>
                <SelectTrigger id="op-fase">
                  <SelectValue placeholder="Elige la fase" />
                </SelectTrigger>
                <SelectContent>
                  {fasesActivas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.icono ? `${f.icono} ${f.nombre}` : f.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="op-estado">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as OportunidadEstado)}>
                <SelectTrigger id="op-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPORTUNIDAD_ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {OPORTUNIDAD_ESTADO_LABEL[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pideMotivo && (
              <div className="sm:col-span-2">
                <Label htmlFor="op-motivo">Motivo</Label>
                <Input
                  id="op-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por qué no salió"
                  autoComplete="off"
                />
              </div>
            )}

            <div>
              <Label htmlFor="op-valor">Valor</Label>
              <Input
                id="op-valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="op-cierre">Cierre previsto</Label>
              <Input
                id="op-cierre"
                type="date"
                value={cierrePrevisto}
                onChange={(e) => setCierrePrevisto(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="op-fuente">Fuente</Label>
              <Input
                id="op-fuente"
                value={fuente}
                onChange={(e) => setFuente(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="op-asignado">Asignada a</Label>
              <Input
                id="op-asignado"
                value={asignado}
                onChange={(e) => setAsignado(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="op-notas">Notas</Label>
              <Textarea
                id="op-notas"
                rows={4}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            {oportunidad && oportunidad.etiquetas.length > 0 && (
              <div className="sm:col-span-2">
                <Label>Etiquetas</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {oportunidad.etiquetas.map((e) => (
                    <Badge key={e} variant="secondary" className="text-[10px] font-normal">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {oportunidad && (
              <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                Creada el {formatearFechaEs(oportunidad.created_at)} · en esta fase desde el{" "}
                {formatearFechaEs(oportunidad.fase_at)}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {oportunidad ? (
              <Button
                type="button"
                variant="outline"
                onClick={onBorrar}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Borrar
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" onClick={onGuardar} disabled={guardando || !nombre.trim()}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
