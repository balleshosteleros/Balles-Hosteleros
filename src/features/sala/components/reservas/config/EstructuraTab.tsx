"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";
import {
  TIPO_MESA_LABELS,
  type LocalMin,
  type Mesa,
  type MesaCombinacion,
  type Plano,
  type Sala,
  type Zona,
} from "@/features/sala/planos/data/planos";
import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas, createSala, deleteSala, setSalaPrincipal, updateSala } from "@/features/sala/planos/actions/salas-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import { listCombinaciones } from "@/features/sala/planos/actions/combinaciones-actions";
import { listPlanosConSalas } from "@/features/sala/planos/actions/planos-actions";
import { ZonaConfigModal } from "./ZonaConfigModal";
import { MesaConfigModal } from "./MesaConfigModal";
import { CombinacionConfigModal } from "./CombinacionConfigModal";
import { PlanosTab } from "./PlanosTab";
import { SalaPlanoEditor } from "./SalaPlanoEditor";

export function EstructuraTab() {
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [salasPorPlano, setSalasPorPlano] = useState<Map<string, Set<string>>>(new Map());
  const [combinaciones, setCombinaciones] = useState<MesaCombinacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [salaModalOpen, setSalaModalOpen] = useState(false);
  const [salaEdit, setSalaEdit] = useState<Sala | null>(null);
  const [salaEnEdicionPlano, setSalaEnEdicionPlano] = useState<Sala | null>(null);
  const [zonaEdit, setZonaEdit] = useState<Zona | null>(null);
  const [zonaModalOpen, setZonaModalOpen] = useState(false);
  const [mesaEdit, setMesaEdit] = useState<Mesa | null>(null);
  const [mesaModalOpen, setMesaModalOpen] = useState(false);
  const [combinacionEdit, setCombinacionEdit] = useState<MesaCombinacion | null>(null);
  const [combinacionModalOpen, setCombinacionModalOpen] = useState(false);

  const cargarTodo = useCallback(async (id: string) => {
    setLoading(true);
    const [s, z, m, c, pcs] = await Promise.all([
      listSalas(id),
      listZonas(id),
      listMesas(id),
      listCombinaciones(id),
      listPlanosConSalas(id),
    ]);
    if (s.ok) setSalas(s.data);
    if (z.ok) setZonas(z.data);
    if (m.ok) setMesas(m.data);
    if (c.ok) setCombinaciones(c.data);
    setPlanos(pcs.data.planos);
    const mapa = new Map<string, Set<string>>();
    for (const [pid, sids] of pcs.data.salasPorPlano) {
      mapa.set(pid, new Set(sids));
    }
    setSalasPorPlano(mapa);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await listLocalesEmpresa();
      if (r.ok) {
        setLocales(r.data);
        if (r.data.length > 0) setLocalId(r.data[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (localId) cargarTodo(localId);
  }, [localId, cargarTodo]);

  async function handleBorrarSala(s: Sala) {
    if (!confirm(`¿Borrar la sala "${s.nombre}"? Si tiene zonas, se bloqueará.`)) return;
    const res = await deleteSala(s.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Sala borrada");
    cargarTodo(localId);
  }

  function zonasDeSala(salaId: string): Zona[] {
    return zonas.filter((z) => z.salaId === salaId);
  }

  function mesasDeZona(zonaId: string): Mesa[] {
    return mesas.filter((m) => m.zonaId === zonaId);
  }

  if (salaEnEdicionPlano) {
    return (
      <SalaPlanoEditor
        sala={salaEnEdicionPlano}
        zonas={zonas}
        mesas={mesas}
        onBack={() => {
          setSalaEnEdicionPlano(null);
          if (localId) cargarTodo(localId);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {locales.length > 1 && (
        <div className="space-y-1.5 max-w-sm">
          <Label className="text-xs">Local</Label>
          <select
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
          >
            {locales.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* PLANOS — sección embebida arriba del todo, misma estética.
          Le pasamos los datos ya cargados para que NO duplique los fetch. */}
      <PlanosTab
        localId={localId}
        embedded
        planos={planos}
        salas={salas}
        salasPorPlano={salasPorPlano}
        loading={loading || !localId}
        onReload={() => { if (localId) cargarTodo(localId); }}
      />

      <Separator />

      {loading || !localId ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* SALAS */}
          <section className="space-y-3">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Salas</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSalaEdit(null); setSalaModalOpen(true); }}
                disabled={!localId}
              >
                <Plus className="h-4 w-4 mr-1" />Nueva sala
              </Button>
            </header>
            {salas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin salas. Crea la primera.</p>
            ) : (
              <ul className="space-y-1.5">
                {salas.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.nombre}</span>
                      {s.esPrincipal && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSalaEnEdicionPlano(s)}
                        title="Editar el plano visual de esta sala"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" />
                        Editar plano
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Editar"
                        onClick={() => { setSalaEdit(s); setSalaModalOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleBorrarSala(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          {/* ZONAS */}
          <section className="space-y-3">
            <header className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Zonas</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setZonaEdit(null);
                  setZonaModalOpen(true);
                }}
                disabled={salas.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />Nueva zona
              </Button>
            </header>
            {salas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Crea al menos una sala antes de añadir zonas.
              </p>
            ) : zonas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin zonas.</p>
            ) : (
              <div className="space-y-4">
                {salas.map((sala) => {
                  const zs = zonasDeSala(sala.id);
                  return (
                    <div key={sala.id} className="space-y-2 border rounded-md p-3 bg-muted/20">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span>{sala.nombre}</span>
                        {sala.esPrincipal && (
                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-normal">
                            Principal
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                          {zs.length} zona{zs.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {zs.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">
                          Aún no hay zonas en esta sala.
                        </p>
                      ) : (
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {zs.map((z) => (
                          <li
                            key={z.id}
                            className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-4 w-4 rounded border"
                                style={{ backgroundColor: z.colorPastel }}
                              />
                              <span className="font-medium">{z.nombre}</span>
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => {
                                setZonaEdit(z);
                                setZonaModalOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* MESAS */}
          <section className="space-y-3">
            <header className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Mesas</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMesaEdit(null);
                  setMesaModalOpen(true);
                }}
                disabled={zonas.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />Nueva mesa
              </Button>
            </header>
            {zonas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Crea al menos una zona antes de añadir mesas.
              </p>
            ) : mesas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin mesas.</p>
            ) : (
              <div className="space-y-3">
                {zonas.map((zona) => {
                  const ms = mesasDeZona(zona.id);
                  if (ms.length === 0) return null;
                  return (
                    <div key={zona.id} className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded"
                          style={{ backgroundColor: zona.colorPastel }}
                        />
                        {zona.nombre}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {ms.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setMesaEdit(m);
                                setMesaModalOpen(true);
                              }}
                              className="border rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1.5 hover:border-foreground transition-colors"
                              style={{ backgroundColor: `${zona.colorPastel}33` }}
                            >
                              <span className="font-semibold">{m.codigo}</span>
                              <span className="text-muted-foreground">
                                ({m.capacidadMin}-{m.capacidadMax})
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase">
                                {TIPO_MESA_LABELS[m.tipo]}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* COMBINACIONES */}
      {!loading && localId && mesas.length >= 2 && (
        <>
          <Separator />
          <section className="space-y-3">
            <header className="flex items-baseline justify-between">
              <div>
                <h3 className="text-sm font-semibold">Combinaciones</h3>
                <p className="text-[11px] text-muted-foreground">
                  Mesas virtuales que agrupan 2+ mesas reales (T-5+T-6+T-7) para reservas grandes.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCombinacionEdit(null);
                  setCombinacionModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />Nueva combinación
              </Button>
            </header>
            {combinaciones.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sin combinaciones. Crea la primera para permitir reservas de grupos grandes.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {combinaciones.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between border-2 rounded-md px-3 py-2 text-sm bg-card"
                    style={{ borderColor: c.colorMarca }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-4 w-4 rounded"
                        style={{ backgroundColor: c.colorMarca }}
                      />
                      <span className="font-mono font-semibold">{c.codigo}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.capacidadMin}-{c.capacidadMax} pax
                        {c.tipo && ` · ${TIPO_MESA_LABELS[c.tipo]}`}
                        {c.capacidadAuto && " · auto"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => {
                        setCombinacionEdit(c);
                        setCombinacionModalOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ZonaConfigModal
        open={zonaModalOpen}
        onOpenChange={setZonaModalOpen}
        zona={zonaEdit}
        localId={localId}
        salas={salas}
        onSaved={() => cargarTodo(localId)}
        onDeleted={() => cargarTodo(localId)}
      />
      <MesaConfigModal
        open={mesaModalOpen}
        onOpenChange={setMesaModalOpen}
        mesa={mesaEdit}
        localId={localId}
        zonas={zonas}
        onSaved={() => cargarTodo(localId)}
        onDeleted={() => cargarTodo(localId)}
      />
      <CombinacionConfigModal
        open={combinacionModalOpen}
        onOpenChange={setCombinacionModalOpen}
        combinacion={combinacionEdit}
        localId={localId}
        mesas={mesas}
        zonas={zonas}
        onSaved={() => cargarTodo(localId)}
        onDeleted={() => cargarTodo(localId)}
      />
      <SalaModal
        open={salaModalOpen}
        onOpenChange={setSalaModalOpen}
        sala={salaEdit}
        localId={localId}
        planos={planos}
        onSaved={() => cargarTodo(localId)}
      />
    </div>
  );
}

function SalaModal({
  open, onOpenChange, sala, localId, planos, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sala: Sala | null;
  localId: string;
  planos: Plano[];
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [planoId, setPlanoId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(sala?.nombre ?? "");
    setEsPrincipal(sala?.esPrincipal ?? false);
    // Por defecto: el plano principal; si no, el primero disponible.
    const principal = planos.find((p) => p.esPrincipal);
    setPlanoId(principal?.id ?? planos[0]?.id ?? "");
  }, [open, sala, planos]);

  async function handleGuardar() {
    const n = nombre.trim();
    if (!n) return;
    setSaving(true);
    try {
      if (sala) {
        const patch: { nombre?: string } = {};
        if (n !== sala.nombre) patch.nombre = n;
        if (Object.keys(patch).length > 0) {
          const res = await updateSala(sala.id, patch);
          if (!res.ok) { toast.error(res.error ?? "No se pudo guardar"); return; }
        }
        if (!sala.esPrincipal && esPrincipal) {
          const res = await setSalaPrincipal(sala.id);
          if (!res.ok) { toast.error(res.error ?? "No se pudo marcar como principal"); return; }
        }
        toast.success("Sala actualizada");
      } else {
        const res = await createSala({ localId, nombre: n, planoId: planoId || undefined });
        if (!res.ok) { toast.error(res.error ?? "No se pudo crear"); return; }
        toast.success("Sala creada");
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const yaEsPrincipal = sala?.esPrincipal ?? false;
  const sinPlanos = planos.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{sala ? "Editar sala" : "Nueva sala"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Salón Principal, Azotea"
              onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
            />
          </div>
          {!sala && (
            sinPlanos ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Crea primero un plano en este local.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <select
                  value={planoId}
                  onChange={(e) => setPlanoId(e.target.value)}
                  className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
                >
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.esPrincipal ? " (Principal)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
          {sala && !yaEsPrincipal && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={esPrincipal}
                onChange={(e) => setEsPrincipal(e.target.checked)}
              />
              <span>Marcar como principal</span>
            </label>
          )}
          {sala && yaEsPrincipal && (
            <p className="text-[11px] text-muted-foreground italic">
              Esta es la sala principal. Marca otra para reemplazarla.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardar} disabled={!nombre.trim() || saving || (!sala && sinPlanos)}>
              {sala ? "Guardar" : "Crear"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
