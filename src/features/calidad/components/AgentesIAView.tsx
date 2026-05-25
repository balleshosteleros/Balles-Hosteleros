"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Edit3,
  Loader2,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  actualizarAgenteIA,
  crearAgenteIA,
  crearAgentesPrincipiantes,
  eliminarAgenteIA,
  listAgentesIA,
} from "@/features/calidad/actions/agentes-ia-actions";
import {
  IDIOMA_LABEL,
  IDIOMA_OPCIONES,
  TIPO_RESENA_LABEL,
  TIPO_RESENA_OPCIONES,
  TONO_LABEL,
  TONO_OPCIONES,
  type AgenteIA,
  type FuenteConfig,
  type IdiomaAgente,
  type TipoResenaConfig,
  type TonoAgente,
} from "@/features/calidad/types/resenas";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const INSTRUCCIONES_DEFAULT =
  "Recibirá reseñas de clientes y debe generar una respuesta como propietario. La respuesta se usará tal cual en Google. Sé natural, evita clichés y no incluyas saludos genéricos.";

export function AgentesIAView() {
  const [agentes, setAgentes] = useState<AgenteIA[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setAgentes(await listAgentesIA());
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const onNuevo = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const onEditar = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const onPrincipiantes = async () => {
    const res = await crearAgentesPrincipiantes();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${res.created} agentes creados`);
    cargar();
  };

  const onEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el agente "${nombre}"?`)) return;
    const res = await eliminarAgenteIA(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Agente eliminado");
    cargar();
  };

  const onToggleActivo = async (a: AgenteIA) => {
    const res = await actualizarAgenteIA(a.id, { activo: !a.activo });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    cargar();
  };

  const agenteEditando = editingId
    ? (agentes.find((a) => a.id === editingId) ?? null)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Agentes de IA</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura agentes que generen automáticamente borradores de
            respuesta a tus reseñas según las estrellas. Tú revisas y publicas
            con un clic.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {agentes.length === 0 && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrincipiantes}
              className="h-9"
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Crear agentes de inicio
            </Button>
          )}
          <Button size="sm" onClick={onNuevo} className="h-9">
            <Plus className="h-3.5 w-3.5 mr-2" />
            Nuevo agente
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Tipo de reseña</th>
              <th className="px-4 py-2 font-medium">Fuente</th>
              <th className="px-4 py-2 font-medium">Tonos</th>
              <th className="px-4 py-2 font-medium">Idioma</th>
              <th className="px-4 py-2 font-medium text-right">Activo</th>
              <th className="px-4 py-2 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading && agentes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-12 text-xs text-muted-foreground"
                >
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && agentes.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Bot className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <div className="text-sm font-medium">
                    Aún no tienes agentes IA
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Crea uno desde cero o usa los de inicio (3+ estrellas y 2-
                    estrellas).
                  </div>
                </td>
              </tr>
            )}
            {agentes.map((a) => (
              <tr
                key={a.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{a.nombre}</div>
                  {a.pie_pagina && (
                    <div className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                      Firma: {a.pie_pagina}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-[11px]">
                    {TIPO_RESENA_LABEL[a.tipo_resena]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                  {a.fuente === "todas" ? "Todas" : a.fuente}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.tonos.length === 0 && (
                      <span className="text-xs text-muted-foreground/60">
                        Sin tono
                      </span>
                    )}
                    {a.tonos.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px] h-5"
                      >
                        {TONO_LABEL[t]}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {IDIOMA_LABEL[a.idioma]}
                </td>
                <td className="px-4 py-3 text-right">
                  <Switch
                    checked={a.activo}
                    onCheckedChange={() => onToggleActivo(a)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onEditar(a.id)}
                      title="Editar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-600 hover:text-rose-700"
                      onClick={() => onEliminar(a.id, a.nombre)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AgenteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agente={agenteEditando}
        onSaved={() => {
          setDialogOpen(false);
          cargar();
        }}
      />
    </div>
  );
}

// ─── Diálogo crear / editar ───────────────────────────────────

function AgenteDialog({
  open,
  onOpenChange,
  agente,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agente: AgenteIA | null;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [instrucciones, setInstrucciones] = useState(INSTRUCCIONES_DEFAULT);
  const [tonos, setTonos] = useState<TonoAgente[]>([]);
  const [idioma, setIdioma] = useState<IdiomaAgente>("dinamico");
  const [tipoResena, setTipoResena] = useState<TipoResenaConfig>("3_o_mas");
  const [fuente, setFuente] = useState<FuenteConfig>("google");
  const [piePagina, setPiePagina] = useState("");
  const [maxDia, setMaxDia] = useState(50);
  const [saving, setSaving] = useState(false);
  useGlobalLoadingSync(saving);

  useEffect(() => {
    if (open) {
      if (agente) {
        setNombre(agente.nombre);
        setInstrucciones(agente.instrucciones);
        setTonos(agente.tonos);
        setIdioma(agente.idioma);
        setTipoResena(agente.tipo_resena);
        setFuente(agente.fuente);
        setPiePagina(agente.pie_pagina ?? "");
        setMaxDia(agente.max_dia);
      } else {
        setNombre("");
        setInstrucciones(INSTRUCCIONES_DEFAULT);
        setTonos([]);
        setIdioma("dinamico");
        setTipoResena("3_o_mas");
        setFuente("google");
        setPiePagina("");
        setMaxDia(50);
      }
    }
  }, [open, agente]);

  const toggleTono = (t: TonoAgente) => {
    setTonos((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 2) {
        toast.error("Máximo 2 tonos");
        return prev;
      }
      return [...prev, t];
    });
  };

  const onSubmit = async () => {
    if (!nombre.trim()) {
      toast.error("Falta el nombre del agente");
      return;
    }
    if (!instrucciones.trim()) {
      toast.error("Faltan las instrucciones");
      return;
    }
    setSaving(true);
    const payload = {
      nombre,
      instrucciones,
      tonos,
      idioma,
      tipo_resena: tipoResena,
      fuente,
      pie_pagina: piePagina || null,
      max_dia: maxDia,
    };
    const res = agente
      ? await actualizarAgenteIA(agente.id, payload)
      : await crearAgenteIA(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(agente ? "Agente actualizado" : "Agente creado");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {agente ? "Editar agente de IA" : "Nuevo agente de IA"}
          </DialogTitle>
          <DialogDescription>
            Define cómo el agente debe responder las reseñas que cumplan el
            filtro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="nombre">Nombre del agente *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej. "3 estrellas o más"'
            />
          </div>

          <div>
            <Label htmlFor="instr">Instrucciones para el agente *</Label>
            <Textarea
              id="instr"
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              rows={5}
              placeholder="Cómo debe sonar, qué evitar, qué incluir..."
            />
          </div>

          <div>
            <Label className="mb-2 block">
              Tono del agente{" "}
              <span className="text-xs text-muted-foreground">
                (máximo 2)
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {TONO_OPCIONES.map((t) => {
                const selected = tonos.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTono(t.key)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    }`}
                  >
                    <span className="mr-1">{t.emoji}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Idioma</Label>
              <Select
                value={idioma}
                onValueChange={(v) => setIdioma(v as IdiomaAgente)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IDIOMA_OPCIONES.map((i) => (
                    <SelectItem key={i.key} value={i.key}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fuente de la reseña</Label>
              <Select
                value={fuente}
                onValueChange={(v) => setFuente(v as FuenteConfig)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Solo Google</SelectItem>
                  <SelectItem value="manual">Solo manual</SelectItem>
                  <SelectItem value="todas">Todas las fuentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de reseña</Label>
              <Select
                value={tipoResena}
                onValueChange={(v) => setTipoResena(v as TipoResenaConfig)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_RESENA_OPCIONES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      <span className="flex items-center gap-1.5">
                        {t.label}
                        {t.ratings.length <= 5 && t.key !== "todas" && t.key !== "sin_texto" && (
                          <span className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-2.5 w-2.5 ${
                                  t.ratings.includes(i + 1)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/20"
                                }`}
                              />
                            ))}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maxdia">Máx. borradores/día</Label>
              <Input
                id="maxdia"
                type="number"
                min={1}
                max={500}
                value={maxDia}
                onChange={(e) => setMaxDia(parseInt(e.target.value, 10) || 50)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pie">Pie de página (firma)</Label>
            <Textarea
              id="pie"
              value={piePagina}
              onChange={(e) => setPiePagina(e.target.value)}
              rows={2}
              placeholder="Ej. ¡Gracias! — Equipo Bacanal"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Se añade al final de cada respuesta generada por este agente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            {agente ? "Guardar cambios" : "Crear agente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
