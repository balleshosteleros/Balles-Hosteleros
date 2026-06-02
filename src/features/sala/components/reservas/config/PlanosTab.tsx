"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type LocalMin,
  type Plano,
  type Sala,
} from "@/features/sala/planos/data/planos";
import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import {
  createPlano,
  deletePlano,
  listPlanoSalas,
  listPlanos,
  togglePlanoSala,
  updatePlano,
} from "@/features/sala/planos/actions/planos-actions";

interface PlanosTabProps {
  /** Si viene seteado, omite la carga de locales y usa este localId directamente. */
  localId?: string;
  /** En modo embebido oculta el selector de local. */
  embedded?: boolean;
}

export function PlanosTab({ localId: localIdProp, embedded }: PlanosTabProps = {}) {
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localIdInterno, setLocalIdInterno] = useState<string>("");
  const localId = localIdProp ?? localIdInterno;
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  /** plano_id → set de sala_id asociadas */
  const [salasPorPlano, setSalasPorPlano] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState<Plano | null>(null);
  const [editandoSalas, setEditandoSalas] = useState<Plano | null>(null);

  const cargar = useCallback(async (id: string) => {
    setLoading(true);
    const [p, s] = await Promise.all([listPlanos(id), listSalas(id)]);
    const planosArr = p.ok ? p.data : [];
    setPlanos(planosArr);
    setSalas(s.ok ? s.data : []);
    // Cargar las salas asociadas a cada plano.
    const entries = await Promise.all(
      planosArr.map(async (pl) => {
        const ps = await listPlanoSalas(pl.id);
        return [pl.id, new Set(ps.ok ? ps.data : [])] as const;
      }),
    );
    setSalasPorPlano(new Map(entries));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (localIdProp !== undefined) return;
    (async () => {
      const r = await listLocalesEmpresa();
      if (r.ok) {
        setLocales(r.data);
        if (r.data.length > 0) setLocalIdInterno(r.data[0].id);
      }
    })();
  }, [localIdProp]);

  useEffect(() => {
    if (localId) cargar(localId);
  }, [localId, cargar]);

  async function handleBorrar(p: Plano) {
    if (!confirm(`¿Borrar el plano "${p.nombre}"?`)) return;
    const res = await deletePlano(p.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Plano borrado");
    cargar(localId);
  }

  return (
    <div className="space-y-4">
      {!embedded && locales.length > 1 && (
        <div className="space-y-1.5 max-w-sm">
          <Label className="text-xs">Local</Label>
          <select
            value={localId}
            onChange={(e) => setLocalIdInterno(e.target.value)}
            className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
          >
            {locales.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Planos</h3>
          <p className="text-[11px] text-muted-foreground">
            Un plano agrupa salas para una franja temporal. El diseño visual de cada sala se edita desde Salas.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setNuevoOpen(true)}
          disabled={!localId}
        >
          <Plus className="h-4 w-4 mr-1" />Nuevo plano
        </Button>
      </header>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : planos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin planos. Crea el primero — al menos uno debe marcarse como principal.
        </p>
      ) : (
        <ul className="space-y-2">
          {planos.map((p) => {
            const salasActivas = salasPorPlano.get(p.id) ?? new Set<string>();
            const salasDelPlano = salas.filter((s) => salasActivas.has(s.id));
            return (
              <li key={p.id} className="border rounded-md px-3 py-2 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.nombre}</span>
                    {p.esPrincipal && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditandoSalas(p)}
                      title="Editar salas"
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditandoNombre(p)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleBorrar(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Salas asociadas
                  </p>
                  {salasDelPlano.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Ninguna sala asociada todavía.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {salasDelPlano.map((s) => (
                        <span
                          key={s.id}
                          className="text-xs bg-muted px-2 py-0.5 rounded"
                        >
                          {s.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NuevoPlanoModal
        open={nuevoOpen}
        onOpenChange={setNuevoOpen}
        localId={localId}
        onSaved={() => cargar(localId)}
      />
      <RenombrarPlanoModal
        plano={editandoNombre}
        onClose={() => setEditandoNombre(null)}
        onSaved={() => cargar(localId)}
      />
      <EditarSalasPlanoModal
        plano={editandoSalas}
        salas={salas}
        salasActivasIniciales={
          editandoSalas ? salasPorPlano.get(editandoSalas.id) ?? new Set<string>() : new Set<string>()
        }
        onClose={() => setEditandoSalas(null)}
        onSaved={() => cargar(localId)}
      />
    </div>
  );
}

function NuevoPlanoModal({
  open,
  onOpenChange,
  localId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  localId: string;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre("");
      setEsPrincipal(false);
    }
  }, [open]);

  async function handleCrear() {
    if (!nombre.trim() || !localId) return;
    setSaving(true);
    try {
      const res = await createPlano({ localId, nombre, esPrincipal });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear");
        return;
      }
      toast.success("Plano creado");
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo plano</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Verano 2026"
              onKeyDown={(e) => e.key === "Enter" && handleCrear()}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={esPrincipal}
              onChange={(e) => setEsPrincipal(e.target.checked)}
            />
            <span>Marcar como plano principal (se usa cuando ningún otro aplica)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCrear} disabled={!nombre.trim() || saving}>
              Crear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenombrarPlanoModal({
  plano,
  onClose,
  onSaved,
}: {
  plano: Plano | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plano) {
      setNombre(plano.nombre);
      setEsPrincipal(plano.esPrincipal);
    }
  }, [plano]);

  if (!plano) return null;

  async function handleGuardar() {
    if (!plano) return;
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const patch: { nombre: string; esPrincipal?: boolean } = { nombre };
      if (!plano.esPrincipal && esPrincipal) patch.esPrincipal = true;
      const res = await updatePlano(plano.id, patch);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Plano actualizado");
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar plano</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
          />
          {!plano.esPrincipal && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={esPrincipal}
                onChange={(e) => setEsPrincipal(e.target.checked)}
              />
              <span>Marcar como principal</span>
            </label>
          )}
          {plano.esPrincipal && (
            <p className="text-[11px] text-muted-foreground italic">
              Este es el plano principal. Marca otro como principal para reemplazarlo.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardar} disabled={!nombre.trim() || saving}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditarSalasPlanoModal({
  plano,
  salas,
  salasActivasIniciales,
  onClose,
  onSaved,
}: {
  plano: Plano | null;
  salas: Sala[];
  salasActivasIniciales: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plano) setSeleccion(new Set(salasActivasIniciales));
  }, [plano, salasActivasIniciales]);

  if (!plano) return null;

  function toggle(salaId: string, activar: boolean) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (activar) next.add(salaId);
      else next.delete(salaId);
      return next;
    });
  }

  async function handleGuardar() {
    if (!plano) return;
    if (seleccion.size === 0) {
      toast.error("El plano debe tener al menos una sala.");
      return;
    }
    setSaving(true);
    try {
      const inicial = salasActivasIniciales;
      const aAnadir = [...seleccion].filter((id) => !inicial.has(id));
      const aQuitar = [...inicial].filter((id) => !seleccion.has(id));
      const resultados = await Promise.all([
        ...aAnadir.map((salaId) => togglePlanoSala(plano.id, salaId, true)),
        ...aQuitar.map((salaId) => togglePlanoSala(plano.id, salaId, false)),
      ]);
      const fallo = resultados.find((r) => !r.ok);
      if (fallo) {
        toast.error(fallo.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Composición actualizada");
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salas del plano · {plano.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Activa las salas que forman parte de este plano. Debe haber al menos una.
          </p>
          {salas.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No hay salas en este local todavía.
            </p>
          ) : (
            <div className="space-y-1">
              {salas.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <span className="truncate">{s.nombre}</span>
                  <Switch
                    checked={seleccion.has(s.id)}
                    onCheckedChange={(v) => toggle(s.id, v)}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardar} disabled={saving || seleccion.size === 0}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
