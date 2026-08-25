"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import {
  createGrupoZona,
  deleteGrupoZona,
  getExigirZonaCliente,
  listGruposZonas,
  setExigirZonaCliente,
  updateGrupoZona,
  type GrupoZona,
} from "@/features/sala/planos/actions/grupos-zonas-actions";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";
import type { Mesa, Zona } from "@/features/sala/planos/data/planos";

interface Local {
  id: string;
  nombre: string;
}

export function GruposZonasTab() {
  const [locales, setLocales] = useState<Local[]>([]);
  const [localId, setLocalId] = useState("");
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [publicas, setPublicas] = useState<GrupoZona[]>([]);
  const [exigir, setExigir] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [dialogo, setDialogo] = useState(false);
  const [editando, setEditando] = useState<GrupoZona | null>(null);
  const [nombre, setNombre] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const { confirm, dialog } = useConfirmDelete();

  useEffect(() => {
    (async () => {
      const [l, e] = await Promise.all([listLocalesEmpresa(), getEmpresaActivaId()]);
      if (l.ok && l.data.length > 0) {
        setLocales(l.data);
        setLocalId((prev) => prev || l.data[0].id);
      }
      if (e) {
        setEmpresaId(e);
        const cfg = await getExigirZonaCliente(e);
        if (cfg.ok) setExigir(cfg.data);
      }
      setLoading(false);
    })();
  }, []);

  const cargar = useCallback(async (id: string) => {
    if (!id) return;
    const [z, m, p] = await Promise.all([listZonas(id), listMesas(id), listGruposZonas(id)]);
    if (z.ok) setZonas(z.data);
    if (m.ok) setMesas(m.data);
    if (p.ok) setPublicas(p.data);
  }, []);

  useEffect(() => {
    if (localId) cargar(localId);
  }, [localId, cargar]);

  /** Cuántas mesas activas tiene cada zona interna. */
  const mesasPorZona = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of mesas) {
      if (!x.activa) continue;
      m.set(x.zonaId, (m.get(x.zonaId) ?? 0) + 1);
    }
    return m;
  }, [mesas]);

  const zonaPorId = useMemo(() => {
    const m = new Map<string, Zona>();
    for (const z of zonas) m.set(z.id, z);
    return m;
  }, [zonas]);

  /** Zonas internas que aún no están en ningún grupo. */
  const sinAgrupar = useMemo(() => {
    const usadas = new Set<string>();
    for (const p of publicas) for (const z of p.zonaIds) usadas.add(z);
    return zonas.filter((z) => !usadas.has(z.id));
  }, [zonas, publicas]);

  /** En el diálogo: las libres más las del grupo que se está editando. */
  const disponiblesEnDialogo = useMemo(() => {
    const propias = new Set(editando?.zonaIds ?? []);
    return zonas.filter((z) => propias.has(z.id) || sinAgrupar.some((s) => s.id === z.id));
  }, [zonas, sinAgrupar, editando]);

  function abrirNueva() {
    setEditando(null);
    setNombre("");
    setSeleccion([]);
    setDialogo(true);
  }

  function abrirEdicion(p: GrupoZona) {
    setEditando(p);
    setNombre(p.nombre);
    setSeleccion([...p.zonaIds]);
    setDialogo(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("Ponle un nombre");
      return;
    }
    if (seleccion.length === 0) {
      toast.error("Elige al menos una zona");
      return;
    }
    setGuardando(true);
    const res = editando
      ? await updateGrupoZona(editando.id, { nombre, zonaIds: seleccion })
      : await createGrupoZona({ localId, nombre, zonaIds: seleccion });
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success(editando ? "Grupo actualizado" : "Grupo creado");
    setDialogo(false);
    cargar(localId);
  }

  async function borrar(p: GrupoZona) {
    const ok = await confirm({
      title: `Borrar "${p.nombre}"`,
      description:
        "El cliente dejará de ver esta opción al reservar. Las zonas y mesas no se tocan.",
    });
    if (!ok) return;
    const res = await deleteGrupoZona(p.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Grupo borrado");
    cargar(localId);
  }

  async function alternarActiva(p: GrupoZona) {
    const res = await updateGrupoZona(p.id, { activa: !p.activa });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar");
      return;
    }
    cargar(localId);
  }

  async function alternarExigir(v: boolean) {
    setExigir(v);
    const res = await setExigirZonaCliente(empresaId, v);
    if (!res.ok) {
      setExigir(!v);
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success(
      v ? "El cliente deberá elegir zona" : "El cliente ya no elige zona",
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            Agrupa tus zonas internas bajo el nombre que verá el cliente al reservar. Por
            ejemplo, una zona &quot;Sala&quot; que incluya Cuadrado, Redondas y Cristalera.
          </p>
          <p>
            <span className="font-medium text-foreground">
              El cliente solo puede reservar en los grupos que crees aquí.
            </span>{" "}
            Las que dejes fuera siguen disponibles por teléfono y desde Sala.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {locales.length > 1 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Local</Label>
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button onClick={abrirNueva} size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo grupo
        </Button>
      </div>

      {/* Interruptor de obligatoriedad. */}
      <Card className="flex items-center justify-between gap-4 p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Exigir que el cliente elija zona</p>
          <p className="text-xs text-muted-foreground">
            Al activarlo, el formulario público muestra el desplegable de zonas y no deja
            reservar sin elegir una.
          </p>
        </div>
        <Switch
          checked={exigir}
          onCheckedChange={alternarExigir}
          disabled={!empresaId || publicas.length === 0}
        />
      </Card>

      {exigir && publicas.filter((p) => p.activa).length === 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
          Está activado exigir zona pero no hay ningún grupo activo:{" "}
          <span className="font-medium">nadie podrá reservar online</span>. Crea al menos una.
        </div>
      )}

      {/* Listado. */}
      {publicas.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium mb-1">Sin grupos de zonas</p>
          <p>Crea el primero para que el cliente pueda elegir dónde sentarse.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {publicas.map((p) => {
            const internas = p.zonaIds
              .map((id) => zonaPorId.get(id))
              .filter((z): z is Zona => Boolean(z));
            const totalMesas = internas.reduce(
              (s, z) => s + (mesasPorZona.get(z.id) ?? 0),
              0,
            );
            return (
              <Card
                key={p.id}
                className={`flex flex-wrap items-center gap-3 p-3 ${p.activa ? "" : "opacity-60"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">{p.nombre}</span>
                    {!p.activa && (
                      <Badge variant="secondary" className="text-[10px]">
                        Inactiva
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {internas.length === 0 ? (
                      <span className="text-xs text-destructive">Sin zonas asignadas</span>
                    ) : (
                      internas.map((z) => (
                        <Badge
                          key={z.id}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {z.nombre}
                          <span className="ml-1 text-muted-foreground">
                            {mesasPorZona.get(z.id) ?? 0}
                          </span>
                        </Badge>
                      ))
                    )}
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      · {totalMesas} {totalMesas === 1 ? "mesa" : "mesas"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Switch
                    checked={p.activa}
                    onCheckedChange={() => alternarActiva(p)}
                    aria-label={p.activa ? "Desactivar" : "Activar"}
                  />
                  <Button variant="ghost" size="sm" onClick={() => abrirEdicion(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => borrar(p)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Zonas que se quedan fuera del canal web. */}
      {sinAgrupar.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium mb-1.5">No reservables online</p>
          <div className="flex flex-wrap gap-1">
            {sinAgrupar.map((z) => (
              <Badge key={z.id} variant="secondary" className="text-[10px] font-normal">
                {z.nombre}
                <span className="ml-1 text-muted-foreground">
                  {mesasPorZona.get(z.id) ?? 0}
                </span>
              </Badge>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Estas zonas no aparecen en el formulario del cliente. Siguen disponibles por
            teléfono y desde Sala.
          </p>
        </div>
      )}

      {/* Alta / edición. */}
      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar grupo de zonas" : "Nuevo grupo de zonas"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre que verá el cliente</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Sala, Terraza, Salón mesa alta…"
                maxLength={60}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Zonas que incluye
                {seleccion.length > 0 && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({seleccion.length})
                  </span>
                )}
              </Label>
              {disponiblesEnDialogo.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todas las zonas están ya en otro grupo. Quítalas de allí para poder
                  usarlas aquí.
                </p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto rounded-md border p-1">
                  {disponiblesEnDialogo.map((z) => {
                    const marcada = seleccion.includes(z.id);
                    const nMesas = mesasPorZona.get(z.id) ?? 0;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() =>
                          setSeleccion((prev) =>
                            marcada ? prev.filter((x) => x !== z.id) : [...prev, z.id],
                          )
                        }
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                          marcada ? "bg-accent" : "hover:bg-muted"
                        }`}
                      >
                        <span
                          className={`h-3.5 w-3.5 rounded-sm border ${
                            marcada ? "bg-primary border-primary" : "border-input"
                          }`}
                        />
                        <span className="flex-1">{z.nombre}</span>
                        <span className="text-xs text-muted-foreground">
                          {nMesas} {nMesas === 1 ? "mesa" : "mesas"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Una zona solo puede pertenecer a un grupo.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
      <div className="pb-28" />
    </div>
  );
}
