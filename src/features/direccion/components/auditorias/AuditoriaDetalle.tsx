"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { cn } from "@/lib/utils";
import { AuditoriaKpis } from "./AuditoriaKpis";
import {
  listPuntos,
  createPunto,
  updatePunto,
  deletePunto,
  updateAuditoria,
} from "@/features/direccion/actions/auditorias-actions";
import {
  type Auditoria,
  type AuditoriaPunto,
  type AuditoriaValoracion,
  type PuntoTipo,
  type PuntoSeveridad,
  type PuntoEstado,
  VALORACION_META,
  VALORACION_OPCIONES,
  TIPO_META,
  TIPO_OPCIONES,
  SEVERIDAD_META,
  PUNTO_ESTADO_META,
  periodoLabel,
} from "@/features/direccion/data/auditorias";

interface Props {
  auditoriaId: string;
  cabecera: Auditoria | null;
  onVolver: () => void;
}

type PuntoDraft = {
  id?: string;
  tipo: PuntoTipo;
  titulo: string;
  descripcion: string;
  severidad: PuntoSeveridad;
  estado: PuntoEstado;
  responsable: string;
};

const DRAFT_VACIO: PuntoDraft = {
  tipo: "incidencia",
  titulo: "",
  descripcion: "",
  severidad: "media",
  estado: "abierto",
  responsable: "",
};

export function AuditoriaDetalle({ auditoriaId, cabecera, onVolver }: Props) {
  const { confirm, dialog } = useConfirmDelete();
  const [puntos, setPuntos] = useState<AuditoriaPunto[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado local de cabecera (optimista sobre la prop).
  const [valoracion, setValoracion] = useState<AuditoriaValoracion | null>(
    cabecera?.valoracion ?? null
  );
  const [fechaReunion, setFechaReunion] = useState<string>(cabecera?.fecha_reunion ?? "");
  const [notas, setNotas] = useState<string>(cabecera?.notas_reunion ?? "");
  const [estado, setEstado] = useState<"borrador" | "cerrada">(
    cabecera?.estado ?? "borrador"
  );
  const cerrada = estado === "cerrada";

  // Dialog de punto (crear/editar)
  const [puntoOpen, setPuntoOpen] = useState(false);
  const [draft, setDraft] = useState<PuntoDraft>(DRAFT_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listPuntos(auditoriaId);
    if (res.ok) setPuntos(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [auditoriaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const porTipo = useMemo(() => {
    const map: Record<PuntoTipo, AuditoriaPunto[]> = {
      incidencia: [],
      notificacion: [],
      problematica: [],
      mejora: [],
    };
    for (const p of puntos) map[p.tipo].push(p);
    return map;
  }, [puntos]);

  async function setValoracionRemota(v: AuditoriaValoracion) {
    const next = valoracion === v ? null : v;
    setValoracion(next);
    const res = await updateAuditoria(auditoriaId, { valoracion: next });
    if (!res.ok) toast.error(res.error);
  }

  async function guardarFecha(value: string) {
    setFechaReunion(value);
    const res = await updateAuditoria(auditoriaId, { fecha_reunion: value || null });
    if (!res.ok) toast.error(res.error);
  }

  async function guardarNotas() {
    const res = await updateAuditoria(auditoriaId, { notas_reunion: notas });
    if (!res.ok) toast.error(res.error);
  }

  async function toggleCierre() {
    const next = cerrada ? "borrador" : "cerrada";
    setEstado(next);
    const res = await updateAuditoria(auditoriaId, { estado: next });
    if (!res.ok) {
      toast.error(res.error);
      setEstado(cerrada ? "cerrada" : "borrador");
      return;
    }
    toast.success(next === "cerrada" ? "Auditoría cerrada" : "Auditoría reabierta");
  }

  function abrirNuevo(tipo: PuntoTipo) {
    setDraft({ ...DRAFT_VACIO, tipo });
    setPuntoOpen(true);
  }

  function abrirEditar(p: AuditoriaPunto) {
    setDraft({
      id: p.id,
      tipo: p.tipo,
      titulo: p.titulo,
      descripcion: p.descripcion,
      severidad: p.severidad,
      estado: p.estado,
      responsable: p.responsable,
    });
    setPuntoOpen(true);
  }

  async function guardarPunto() {
    if (!draft.titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setGuardando(true);
    const res = draft.id
      ? await updatePunto(draft.id, {
          tipo: draft.tipo,
          titulo: draft.titulo,
          descripcion: draft.descripcion,
          severidad: draft.severidad,
          estado: draft.estado,
          responsable: draft.responsable,
        })
      : await createPunto({
          auditoriaId,
          tipo: draft.tipo,
          titulo: draft.titulo,
          descripcion: draft.descripcion,
          severidad: draft.severidad,
          estado: draft.estado,
          responsable: draft.responsable,
        });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPuntoOpen(false);
    cargar();
  }

  async function cambiarEstadoPunto(p: AuditoriaPunto, nuevo: PuntoEstado) {
    setPuntos((prev) => prev.map((x) => (x.id === p.id ? { ...x, estado: nuevo } : x)));
    const res = await updatePunto(p.id, { estado: nuevo });
    if (!res.ok) {
      toast.error(res.error);
      cargar();
    }
  }

  async function borrarPunto(p: AuditoriaPunto) {
    const ok = await confirm({
      title: "Borrar punto",
      description: `Se eliminará “${p.titulo}”.`,
    });
    if (!ok) return;
    const res = await deletePunto(p.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    cargar();
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onVolver} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              {cabecera?.departamento_nombre ?? "Auditoría"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {cabecera ? periodoLabel(cabecera.periodo) : ""}
            </p>
          </div>
        </div>
        <Button
          variant={cerrada ? "outline" : "default"}
          size="sm"
          onClick={toggleCierre}
          className="gap-1.5"
        >
          {cerrada ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {cerrada ? "Reabrir" : "Cerrar auditoría"}
        </Button>
      </div>

      {/* Valoración + fecha de reunión */}
      <div className="flex flex-wrap items-end gap-6 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Valoración del mes</Label>
          <div className="flex gap-2">
            {VALORACION_OPCIONES.map((v) => {
              const m = VALORACION_META[v];
              const activo = valoracion === v;
              return (
                <button
                  key={v}
                  disabled={cerrada}
                  onClick={() => setValoracionRemota(v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition",
                    activo ? m.badge : "text-muted-foreground hover:bg-muted/50",
                    cerrada && "opacity-60"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", m.dot)} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Fecha de la reunión</Label>
          <Input
            type="date"
            value={fechaReunion}
            disabled={cerrada}
            onChange={(e) => guardarFecha(e.target.value)}
            className="h-9 w-[170px]"
          />
        </div>
      </div>

      {/* KPIs y productividad (automático, datos reales del sistema) */}
      {cabecera && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-indigo-400" />
            <h3 className="text-sm font-medium">KPIs y productividad</h3>
          </div>
          <AuditoriaKpis
            departamentoId={cabecera.departamento_id}
            periodo={cabecera.periodo}
          />
        </section>
      )}

      {/* Puntos por tipo */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-5">
          {TIPO_OPCIONES.map((tipo) => {
            const m = TIPO_META[tipo];
            const lista = porTipo[tipo];
            return (
              <section key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-4 w-1 rounded-full", m.bar)} />
                    <h3 className="text-sm font-medium">{m.plural}</h3>
                    <span className="text-xs text-muted-foreground">{lista.length}</span>
                  </div>
                  {!cerrada && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      onClick={() => abrirNuevo(tipo)}
                    >
                      <Plus className="h-4 w-4" />
                      Añadir
                    </Button>
                  )}
                </div>
                {lista.length === 0 ? (
                  <p className="px-3 text-sm text-muted-foreground">Sin {m.plural.toLowerCase()}.</p>
                ) : (
                  <div className="space-y-2">
                    {lista.map((p) => (
                      <PuntoRow
                        key={p.id}
                        punto={p}
                        cerrada={cerrada}
                        onEditar={() => abrirEditar(p)}
                        onBorrar={() => borrarPunto(p)}
                        onEstado={(e) => cambiarEstadoPunto(p, e)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Notas de la reunión */}
      <div className="space-y-2 rounded-lg border bg-card p-4">
        <Label className="text-xs text-muted-foreground">Notas de la reunión</Label>
        <Textarea
          value={notas}
          disabled={cerrada}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={guardarNotas}
          rows={4}
          placeholder="Lo hablado en la reunión mensual con el departamento…"
        />
      </div>

      {/* Dialog crear/editar punto */}
      <Dialog open={puntoOpen} onOpenChange={setPuntoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar punto" : "Nuevo punto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={draft.tipo}
                  onValueChange={(v) => setDraft((d) => ({ ...d, tipo: v as PuntoTipo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPCIONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severidad</Label>
                <Select
                  value={draft.severidad}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, severidad: v as PuntoSeveridad }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SEVERIDAD_META) as PuntoSeveridad[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEVERIDAD_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={draft.titulo}
                onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
                placeholder="Resumen breve"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={draft.descripcion}
                onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                rows={3}
                placeholder="Detalle (opcional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={draft.estado}
                  onValueChange={(v) => setDraft((d) => ({ ...d, estado: v as PuntoEstado }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PUNTO_ESTADO_META) as PuntoEstado[]).map((e) => (
                      <SelectItem key={e} value={e}>
                        {PUNTO_ESTADO_META[e].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Input
                  value={draft.responsable}
                  onChange={(e) => setDraft((d) => ({ ...d, responsable: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPuntoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarPunto} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}

function PuntoRow({
  punto,
  cerrada,
  onEditar,
  onBorrar,
  onEstado,
}: {
  punto: AuditoriaPunto;
  cerrada: boolean;
  onEditar: () => void;
  onBorrar: () => void;
  onEstado: (e: PuntoEstado) => void;
}) {
  const sev = SEVERIDAD_META[punto.severidad];
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{punto.titulo}</p>
          <Badge variant="outline" className={cn("text-[11px]", sev.badge)}>
            {sev.label}
          </Badge>
        </div>
        {punto.descripcion && (
          <p className="mt-1 text-sm text-muted-foreground">{punto.descripcion}</p>
        )}
        {punto.responsable && (
          <p className="mt-1 text-xs text-muted-foreground">Responsable: {punto.responsable}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {cerrada ? (
          <Badge variant="outline" className={cn("text-[11px]", PUNTO_ESTADO_META[punto.estado].badge)}>
            {PUNTO_ESTADO_META[punto.estado].label}
          </Badge>
        ) : (
          <Select value={punto.estado} onValueChange={(v) => onEstado(v as PuntoEstado)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PUNTO_ESTADO_META) as PuntoEstado[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {PUNTO_ESTADO_META[e].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!cerrada && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditar}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onBorrar}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
