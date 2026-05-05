"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Save, Award, Gift, Crown, Trophy, Cake } from "lucide-react";
import { AntiguedadEmpleadosPanel } from "./AntiguedadEmpleadosPanel";
import { createClient } from "@/lib/supabase/client";
import {
  getNiveles,
  getReglas,
  getRecompensas,
} from "@/features/toques/services/toques.service";
import {
  actualizarNivel,
  actualizarRecompensa,
  actualizarRegla,
  crearRecompensa,
  eliminarRecompensa,
} from "@/features/toques/actions/toques-admin-actions";
import type { Nivel, Recompensa, Regla, RecompensaTipo } from "@/features/toques/types/toques.types";

const TIPOS_RECOMPENSA: { value: RecompensaTipo; label: string }[] = [
  { value: "hora_libre", label: "Hora libre" },
  { value: "dia_vacaciones", label: "Día de vacaciones" },
  { value: "fin_semana", label: "Fin de semana" },
  { value: "semana_vacaciones", label: "Semana de vacaciones" },
  { value: "regalo_anual_descriptivo", label: "Premio anual (sin coste)" },
  { value: "custom", label: "Otro" },
];

export function ToquesAdminTab() {
  const supabase = useMemo(() => createClient(), []);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [nuevaRecompensa, setNuevaRecompensa] = useState<{
    nombre: string;
    descripcion: string;
    costeToques: number;
    tipo: RecompensaTipo;
  }>({
    nombre: "",
    descripcion: "",
    costeToques: 50,
    tipo: "custom",
  });
  const [creando, setCreando] = useState(false);

  // Estados editables (mirror local)
  const [reglasDraft, setReglasDraft] = useState<Record<string, { toques: number; activa: boolean }>>({});
  const [nivelesDraft, setNivelesDraft] = useState<Record<string, { nombre: string; toquesMin: number; badgeColor: string }>>({});
  const [recompensasDraft, setRecompensasDraft] = useState<
    Record<string, { nombre: string; descripcion: string; costeToques: number; activa: boolean }>
  >({});

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sin sesión");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const eId = (profile?.empresa_id as string) ?? null;
      setEmpresaId(eId);
      if (!eId) {
        setError("Sin empresa asignada");
        setLoading(false);
        return;
      }
      const [r, n, rec] = await Promise.all([
        getReglas(supabase, eId),
        getNiveles(supabase, eId),
        getRecompensas(supabase, eId),
      ]);
      setReglas(r);
      setNiveles(n);
      // Para Ajustes mostramos también las inactivas
      const { data: allRec } = await supabase
        .from("toques_recompensas")
        .select("*")
        .eq("empresa_id", eId)
        .order("orden", { ascending: true });
      const allMapped = (allRec ?? []).map((row) => ({
        id: String((row as Record<string, unknown>).id),
        empresaId: String((row as Record<string, unknown>).empresa_id),
        nombre: String((row as Record<string, unknown>).nombre ?? ""),
        descripcion: String((row as Record<string, unknown>).descripcion ?? ""),
        costeToques: Number((row as Record<string, unknown>).coste_toques ?? 0),
        tipo: String((row as Record<string, unknown>).tipo ?? "custom") as RecompensaTipo,
        activa: Boolean((row as Record<string, unknown>).activa),
        orden: Number((row as Record<string, unknown>).orden ?? 0),
      }));
      setRecompensas(allMapped.length ? allMapped : rec);

      setReglasDraft(
        Object.fromEntries(r.map((x) => [x.id, { toques: x.toques, activa: x.activa }]))
      );
      setNivelesDraft(
        Object.fromEntries(
          n.map((x) => [x.id, { nombre: x.nombre, toquesMin: x.toquesMin, badgeColor: x.badgeColor }])
        )
      );
      setRecompensasDraft(
        Object.fromEntries(
          (allMapped.length ? allMapped : rec).map((x) => [
            x.id,
            { nombre: x.nombre, descripcion: x.descripcion, costeToques: x.costeToques, activa: x.activa },
          ])
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardarRegla = async (id: string) => {
    const draft = reglasDraft[id];
    if (!draft) return;
    setSaving(id);
    const res = await actualizarRegla({ id, toques: draft.toques, activa: draft.activa });
    setSaving(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void cargar();
  };

  const guardarNivel = async (id: string) => {
    const draft = nivelesDraft[id];
    if (!draft) return;
    setSaving(id);
    const res = await actualizarNivel({
      id,
      nombre: draft.nombre,
      toquesMin: draft.toquesMin,
      badgeColor: draft.badgeColor,
    });
    setSaving(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void cargar();
  };

  const guardarRecompensa = async (id: string) => {
    const draft = recompensasDraft[id];
    if (!draft) return;
    setSaving(id);
    const res = await actualizarRecompensa({
      id,
      nombre: draft.nombre,
      descripcion: draft.descripcion,
      costeToques: draft.costeToques,
      activa: draft.activa,
    });
    setSaving(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void cargar();
  };

  const handleCrearRecompensa = async () => {
    if (!nuevaRecompensa.nombre.trim()) {
      setError("Nombre requerido");
      return;
    }
    setCreando(true);
    const res = await crearRecompensa({
      nombre: nuevaRecompensa.nombre,
      descripcion: nuevaRecompensa.descripcion,
      costeToques: nuevaRecompensa.costeToques,
      tipo: nuevaRecompensa.tipo,
      orden: 50,
    });
    setCreando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNuevaRecompensa({ nombre: "", descripcion: "", costeToques: 50, tipo: "custom" });
    void cargar();
  };

  const handleEliminarRecompensa = async (id: string) => {
    setSaving(id);
    const res = await eliminarRecompensa({ id });
    setSaving(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void cargar();
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (!empresaId) {
    return <Card className="p-4 text-rose-700 bg-rose-50 border-rose-200 text-sm">Sin empresa</Card>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</Card>
      )}

      <Tabs defaultValue="reglas">
        <TabsList>
          <TabsTrigger value="reglas">
            <Award className="h-3.5 w-3.5 mr-1" />
            Reglas
          </TabsTrigger>
          <TabsTrigger value="recompensas">
            <Gift className="h-3.5 w-3.5 mr-1" />
            Recompensas
          </TabsTrigger>
          <TabsTrigger value="niveles">
            <Crown className="h-3.5 w-3.5 mr-1" />
            Niveles
          </TabsTrigger>
          <TabsTrigger value="antiguedad">
            <Cake className="h-3.5 w-3.5 mr-1" />
            Antigüedad
          </TabsTrigger>
        </TabsList>

        {/* REGLAS */}
        <TabsContent value="reglas" className="mt-3">
          <Card className="p-4 md:p-5">
            <div className="text-sm text-muted-foreground mb-3">
              Reglas de devengo. Las inactivas no se evalúan en el cron diario. Algunas requieren fuentes
              de datos aún no disponibles (chat, APPCC, mermas…) — quedan inactivas hasta que se
              implementen.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Regla</th>
                    <th className="py-2 pr-3">Periodicidad</th>
                    <th className="py-2 pr-3 w-28">Points</th>
                    <th className="py-2 pr-3 w-24">Activa</th>
                    <th className="py-2 w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reglas.map((r) => {
                    const draft = reglasDraft[r.id] ?? { toques: r.toques, activa: r.activa };
                    const dirty = draft.toques !== r.toques || draft.activa !== r.activa;
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.nombre}</div>
                          <div className="text-xs text-muted-foreground">{r.descripcion}</div>
                          <div className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{r.codigo}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className="text-[10px]">
                            {r.periodicidad}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            value={draft.toques}
                            onChange={(e) =>
                              setReglasDraft((prev) => ({
                                ...prev,
                                [r.id]: { ...draft, toques: Number(e.target.value) || 0 },
                              }))
                            }
                            className="h-8 w-20"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Switch
                            checked={draft.activa}
                            onCheckedChange={(v) =>
                              setReglasDraft((prev) => ({
                                ...prev,
                                [r.id]: { ...draft, activa: v },
                              }))
                            }
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => guardarRegla(r.id)}
                            disabled={!dirty || saving === r.id}
                          >
                            {saving === r.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* RECOMPENSAS */}
        <TabsContent value="recompensas" className="mt-3 space-y-3">
          <NuevaRecompensaCard
            value={nuevaRecompensa}
            onChange={setNuevaRecompensa}
            onSubmit={handleCrearRecompensa}
            saving={creando}
          />
          <Card className="p-4 md:p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3 w-28">Coste</th>
                    <th className="py-2 pr-3 w-24">Activa</th>
                    <th className="py-2 w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recompensas.map((rec) => {
                    const draft =
                      recompensasDraft[rec.id] ?? {
                        nombre: rec.nombre,
                        descripcion: rec.descripcion,
                        costeToques: rec.costeToques,
                        activa: rec.activa,
                      };
                    const dirty =
                      draft.nombre !== rec.nombre ||
                      draft.descripcion !== rec.descripcion ||
                      draft.costeToques !== rec.costeToques ||
                      draft.activa !== rec.activa;
                    return (
                      <tr key={rec.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3">
                          <Input
                            value={draft.nombre}
                            onChange={(e) =>
                              setRecompensasDraft((prev) => ({
                                ...prev,
                                [rec.id]: { ...draft, nombre: e.target.value },
                              }))
                            }
                            className="h-8 mb-1"
                          />
                          <Textarea
                            rows={2}
                            value={draft.descripcion}
                            onChange={(e) =>
                              setRecompensasDraft((prev) => ({
                                ...prev,
                                [rec.id]: { ...draft, descripcion: e.target.value },
                              }))
                            }
                            className="text-xs"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className="text-[10px]">
                            {rec.tipo}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            value={draft.costeToques}
                            onChange={(e) =>
                              setRecompensasDraft((prev) => ({
                                ...prev,
                                [rec.id]: { ...draft, costeToques: Number(e.target.value) || 0 },
                              }))
                            }
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Switch
                            checked={draft.activa}
                            onCheckedChange={(v) =>
                              setRecompensasDraft((prev) => ({
                                ...prev,
                                [rec.id]: { ...draft, activa: v },
                              }))
                            }
                          />
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => guardarRecompensa(rec.id)}
                              disabled={!dirty || saving === rec.id}
                            >
                              {saving === rec.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                            <ConfirmDelete
                              onConfirm={() => handleEliminarRecompensa(rec.id)}
                              busy={saving === rec.id}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* NIVELES */}
        <TabsContent value="niveles" className="mt-3">
          <Card className="p-4 md:p-5">
            <div className="text-sm text-muted-foreground mb-3">
              Niveles de progresión calculados sobre <strong>points acumulados</strong> (no decrementan al canjear).
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3 w-12">Orden</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3 w-32">Points mín.</th>
                    <th className="py-2 pr-3 w-28">Color</th>
                    <th className="py-2 w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {niveles.map((nv) => {
                    const draft =
                      nivelesDraft[nv.id] ?? {
                        nombre: nv.nombre,
                        toquesMin: nv.toquesMin,
                        badgeColor: nv.badgeColor,
                      };
                    const dirty =
                      draft.nombre !== nv.nombre ||
                      draft.toquesMin !== nv.toquesMin ||
                      draft.badgeColor !== nv.badgeColor;
                    return (
                      <tr key={nv.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Trophy className="h-3.5 w-3.5" style={{ color: draft.badgeColor }} />
                            <span className="font-mono text-xs">{nv.orden}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            value={draft.nombre}
                            onChange={(e) =>
                              setNivelesDraft((prev) => ({
                                ...prev,
                                [nv.id]: { ...draft, nombre: e.target.value },
                              }))
                            }
                            className="h-8"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            value={draft.toquesMin}
                            onChange={(e) =>
                              setNivelesDraft((prev) => ({
                                ...prev,
                                [nv.id]: { ...draft, toquesMin: Number(e.target.value) || 0 },
                              }))
                            }
                            className="h-8"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="color"
                            value={draft.badgeColor}
                            onChange={(e) =>
                              setNivelesDraft((prev) => ({
                                ...prev,
                                [nv.id]: { ...draft, badgeColor: e.target.value },
                              }))
                            }
                            className="h-8 p-1"
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => guardarNivel(nv.id)}
                            disabled={!dirty || saving === nv.id}
                          >
                            {saving === nv.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ANTIGÜEDAD */}
        <TabsContent value="antiguedad" className="mt-3">
          <AntiguedadEmpleadosPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface NuevaRecompensaProps {
  value: { nombre: string; descripcion: string; costeToques: number; tipo: RecompensaTipo };
  onChange: (v: NuevaRecompensaProps["value"]) => void;
  onSubmit: () => void;
  saving: boolean;
}

function NuevaRecompensaCard({ value, onChange, onSubmit, saving }: NuevaRecompensaProps) {
  return (
    <Card className="p-4 md:p-5 border-dashed">
      <div className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Nueva recompensa
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input
            value={value.nombre}
            onChange={(e) => onChange({ ...value, nombre: e.target.value })}
            className="h-8 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={value.tipo} onValueChange={(v) => onChange({ ...value, tipo: v as RecompensaTipo })}>
            <SelectTrigger className="h-8 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_RECOMPENSA.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Coste (points)</Label>
          <Input
            type="number"
            value={value.costeToques}
            onChange={(e) => onChange({ ...value, costeToques: Number(e.target.value) || 0 })}
            className="h-8 mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={onSubmit} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Crear
          </Button>
        </div>
        <div className="md:col-span-4">
          <Label className="text-xs">Descripción</Label>
          <Textarea
            rows={2}
            value={value.descripcion}
            onChange={(e) => onChange({ ...value, descripcion: e.target.value })}
            className="text-xs mt-1"
          />
        </div>
      </div>
    </Card>
  );
}

function ConfirmDelete({ onConfirm, busy }: { onConfirm: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={busy}>
        <Trash2 className="h-3 w-3" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar recompensa</DialogTitle>
            <DialogDescription>
              Si la recompensa tiene canjes asociados se desactivará en su lugar (no se borra el histórico).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
