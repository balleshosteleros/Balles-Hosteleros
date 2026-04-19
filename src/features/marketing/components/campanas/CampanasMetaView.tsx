"use client";

import { useEffect, useState } from "react";
import { Plus, Megaphone, Pencil, Trash2, Cloud, CloudOff, Play, Pause, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useCampanas } from "@/features/marketing/hooks/useCampanas";
import {
  crearCampanaMetaVacia,
  ESTADOS_CAMPANA,
  OBJETIVOS_META,
  CTA_META,
  type CampanaMeta,
  type ObjetivoMeta,
} from "@/features/marketing/data/campanas";
import {
  sincronizarCampanaMetaAction,
  cambiarEstadoMetaAction,
  traerInsightsMetaAction,
  verificarIntegracionesAction,
} from "@/features/marketing/actions/campanas-actions";
import { toast } from "sonner";

export function CampanasMetaView() {
  const { empresaActual } = useEmpresa();
  const { metas, guardar, eliminar, modoLocal } = useCampanas(empresaActual.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<CampanaMeta | null>(null);
  const [metaConfigured, setMetaConfigured] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    verificarIntegracionesAction().then((r) => setMetaConfigured(r.meta));
  }, []);

  function abrirNuevo() {
    setEdit(crearCampanaMetaVacia(empresaActual.id));
    setModalOpen(true);
  }

  function abrirEditar(c: CampanaMeta) {
    setEdit({ ...c });
    setModalOpen(true);
  }

  async function onGuardar() {
    if (!edit) return;
    if (!edit.nombre.trim() || !edit.creatividad.titular.trim()) {
      toast.error("Nombre y titular son obligatorios");
      return;
    }
    if (edit.presupuestoDiario < 1) {
      toast.error("El presupuesto diario debe ser mayor a 1€");
      return;
    }
    await guardar(edit);
    toast.success("Campaña de Meta guardada");
    setModalOpen(false);
  }

  async function onSincronizar(c: CampanaMeta) {
    setSyncing(c.id);
    const result = await sincronizarCampanaMetaAction(c);
    setSyncing(null);
    if (result.success) {
      await guardar({
        ...c,
        metaCampaignId: result.campaignId ?? c.metaCampaignId,
        metaAdSetId: result.adSetId ?? c.metaAdSetId,
        metaAdId: result.adId ?? c.metaAdId,
        metaSyncedAt: new Date().toISOString(),
        metaSyncError: null,
        estado: "pausada",
      });
      toast.success("Campaña sincronizada con Meta (en pausa)");
    } else {
      await guardar({ ...c, metaSyncError: result.error ?? "Error" });
      toast.error(result.error ?? "Error al sincronizar");
    }
  }

  async function onActivar(c: CampanaMeta) {
    if (!c.metaCampaignId) return;
    const r = await cambiarEstadoMetaAction(c.metaCampaignId, "ACTIVE");
    if (r.success) {
      await guardar({ ...c, estado: "activa" });
      toast.success("Campaña activada en Meta");
    } else toast.error(r.error ?? "Error");
  }

  async function onPausar(c: CampanaMeta) {
    if (!c.metaCampaignId) return;
    const r = await cambiarEstadoMetaAction(c.metaCampaignId, "PAUSED");
    if (r.success) {
      await guardar({ ...c, estado: "pausada" });
      toast.success("Campaña pausada en Meta");
    } else toast.error(r.error ?? "Error");
  }

  async function onRefrescarInsights(c: CampanaMeta) {
    if (!c.metaCampaignId) return;
    const insights = await traerInsightsMetaAction(c.metaCampaignId);
    if (insights) {
      await guardar({ ...c, estadisticas: insights });
      toast.success("Estadísticas actualizadas");
    } else toast.error("No se pudieron traer los insights");
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Campañas de Meta (Facebook + Instagram)</h1>
            <p className="text-sm text-muted-foreground">Publicidad simplificada: nosotros traducimos tu elección a la configuración de Meta Ads</p>
          </div>
        </div>
        <Button onClick={abrirNuevo} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva campaña
        </Button>
      </div>

      {(modoLocal || metaConfigured === false) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5">
            {modoLocal && (
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Almacenamiento local — aplica la migración <code className="font-mono text-[11px]">044_marketing_campanas.sql</code>.
              </p>
            )}
            {metaConfigured === false && (
              <p className="text-amber-800 dark:text-amber-300/80">
                Meta aún no está conectado. Define <code className="font-mono text-[11px]">META_ACCESS_TOKEN</code>, <code className="font-mono text-[11px]">META_AD_ACCOUNT_ID</code> y{" "}
                <code className="font-mono text-[11px]">META_PAGE_ID</code> en las variables de entorno. Puedes seguir creando campañas en borrador mientras tanto.
              </p>
            )}
          </div>
        </div>
      )}

      {metas.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Aún no has creado campañas de Meta</p>
          <p className="text-xs text-muted-foreground mb-4">Define presupuesto, público y creatividad — nosotros nos encargamos del resto</p>
          <Button onClick={abrirNuevo} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Crear campaña
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {metas.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm">{c.nombre}</h3>
                  <p className="text-xs text-muted-foreground">
                    {OBJETIVOS_META.find((o) => o.value === c.objetivo)?.label} ·{" "}
                    {c.presupuestoDiario}€/día · {c.duracionDias} días
                  </p>
                </div>
                <Badge variant="outline">{ESTADOS_CAMPANA.find((e) => e.value === c.estado)?.label}</Badge>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {c.plataformas.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[10px] capitalize">{p}</Badge>
                ))}
                {c.metaCampaignId ? (
                  <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-300">
                    <Cloud className="h-3 w-3" /> Sincronizada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                    <CloudOff className="h-3 w-3" /> Local
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/30 p-2">
                  <p className="text-lg font-bold">{c.estadisticas.impresiones.toLocaleString("es-ES")}</p>
                  <p className="text-[10px] text-muted-foreground">Impresiones</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2">
                  <p className="text-lg font-bold">{c.estadisticas.clicks.toLocaleString("es-ES")}</p>
                  <p className="text-[10px] text-muted-foreground">Clicks</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2">
                  <p className="text-lg font-bold">{c.estadisticas.gasto.toFixed(2)}€</p>
                  <p className="text-[10px] text-muted-foreground">Gasto</p>
                </div>
              </div>

              {c.metaSyncError && (
                <p className="text-[11px] text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                  {c.metaSyncError}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                {!c.metaCampaignId && (
                  <Button size="sm" className="gap-1.5 h-8" disabled={syncing === c.id} onClick={() => onSincronizar(c)}>
                    {syncing === c.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Sincronizar con Meta
                  </Button>
                )}
                {c.metaCampaignId && c.estado !== "activa" && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => onActivar(c)}>
                    <Play className="h-3.5 w-3.5" /> Activar
                  </Button>
                )}
                {c.metaCampaignId && c.estado === "activa" && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => onPausar(c)}>
                    <Pause className="h-3.5 w-3.5" /> Pausar
                  </Button>
                )}
                {c.metaCampaignId && (
                  <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={() => onRefrescarInsights(c)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Actualizar stats
                  </Button>
                )}
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => eliminar(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.metaCampaignId ? "Editar" : "Nueva"} campaña de Meta</DialogTitle>
            <DialogDescription>
              Cuéntanos qué quieres lograr, nosotros lo traducimos a la configuración de Meta Ads.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre de la campaña</Label>
                <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} placeholder="Promoción verano — Terraza" />
              </div>

              <div className="space-y-1.5">
                <Label>¿Qué quieres conseguir?</Label>
                <Select value={edit.objetivo} onValueChange={(v) => setEdit({ ...edit, objetivo: v as ObjetivoMeta })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJETIVOS_META.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div>
                          <p className="font-medium">{o.label}</p>
                          <p className="text-[11px] text-muted-foreground">{o.descripcion}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Presupuesto diario (€)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={edit.presupuestoDiario}
                    onChange={(e) => setEdit({ ...edit, presupuestoDiario: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Duración (días)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={edit.duracionDias}
                    onChange={(e) => setEdit({ ...edit, duracionDias: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Plataformas</Label>
                <div className="flex gap-3">
                  {(["facebook", "instagram"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={edit.plataformas.includes(p)}
                        onChange={(e) => {
                          const set = new Set(edit.plataformas);
                          if (e.target.checked) set.add(p);
                          else set.delete(p);
                          setEdit({ ...edit, plataformas: Array.from(set) as ("facebook" | "instagram")[] });
                        }}
                      />
                      <span className="text-sm capitalize">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <fieldset className="border rounded-lg p-3 space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground px-2">Público objetivo</legend>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Edad mín.</Label>
                    <Input
                      type="number"
                      min={13}
                      max={65}
                      value={edit.publicoObjetivo.edadMin}
                      onChange={(e) => setEdit({ ...edit, publicoObjetivo: { ...edit.publicoObjetivo, edadMin: Number(e.target.value) } })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Edad máx.</Label>
                    <Input
                      type="number"
                      min={13}
                      max={65}
                      value={edit.publicoObjetivo.edadMax}
                      onChange={(e) => setEdit({ ...edit, publicoObjetivo: { ...edit.publicoObjetivo, edadMax: Number(e.target.value) } })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Género</Label>
                    <Select
                      value={edit.publicoObjetivo.genero}
                      onValueChange={(v) => setEdit({ ...edit, publicoObjetivo: { ...edit.publicoObjetivo, genero: v as "todos" | "hombre" | "mujer" } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="hombre">Hombre</SelectItem>
                        <SelectItem value="mujer">Mujer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ubicaciones (ciudades separadas por coma)</Label>
                  <Input
                    value={edit.publicoObjetivo.ubicaciones.join(", ")}
                    onChange={(e) => setEdit({ ...edit, publicoObjetivo: { ...edit.publicoObjetivo, ubicaciones: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })}
                    placeholder="Madrid, Barcelona, Valencia"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Intereses (separados por coma)</Label>
                  <Input
                    value={edit.publicoObjetivo.intereses.join(", ")}
                    onChange={(e) => setEdit({ ...edit, publicoObjetivo: { ...edit.publicoObjetivo, intereses: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })}
                    placeholder="Restaurantes, Gastronomía, Vinos"
                  />
                </div>
              </fieldset>

              <fieldset className="border rounded-lg p-3 space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground px-2">Creatividad del anuncio</legend>
                <div className="space-y-1.5">
                  <Label className="text-xs">Titular</Label>
                  <Input
                    value={edit.creatividad.titular}
                    onChange={(e) => setEdit({ ...edit, creatividad: { ...edit.creatividad, titular: e.target.value } })}
                    placeholder="Reserva tu mesa de verano"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    value={edit.creatividad.descripcion}
                    onChange={(e) => setEdit({ ...edit, creatividad: { ...edit.creatividad, descripcion: e.target.value } })}
                    placeholder="Terraza, cócteles y cocina mediterránea"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto principal</Label>
                  <Textarea
                    rows={3}
                    value={edit.creatividad.textoPrincipal}
                    onChange={(e) => setEdit({ ...edit, creatividad: { ...edit.creatividad, textoPrincipal: e.target.value } })}
                    placeholder="Este verano disfruta de nuestra terraza con vistas. Menús desde 25€."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL de imagen</Label>
                    <Input
                      value={edit.creatividad.imagenUrl}
                      onChange={(e) => setEdit({ ...edit, creatividad: { ...edit.creatividad, imagenUrl: e.target.value } })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Botón (CTA)</Label>
                    <Select
                      value={edit.creatividad.cta}
                      onValueChange={(v) => setEdit({ ...edit, creatividad: { ...edit.creatividad, cta: v as CampanaMeta["creatividad"]["cta"] } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CTA_META.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL de destino</Label>
                  <Input
                    value={edit.creatividad.urlDestino}
                    onChange={(e) => setEdit({ ...edit, creatividad: { ...edit.creatividad, urlDestino: e.target.value } })}
                    placeholder="https://balles-hosteleros.com/reservas"
                  />
                </div>
              </fieldset>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={onGuardar}>Guardar borrador</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
