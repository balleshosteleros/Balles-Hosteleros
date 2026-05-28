"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";
import {
  type LocalMin,
  type Mesa,
  type Plano,
  type Sala,
  type Zona,
} from "@/features/sala/planos/data/planos";
import { listLocalesEmpresa } from "@/features/sala/planos/actions/locales-actions";
import { listSalas } from "@/features/sala/planos/actions/salas-actions";
import { listZonas } from "@/features/sala/planos/actions/zonas-actions";
import { listMesas } from "@/features/sala/planos/actions/mesas-actions";
import {
  createPlano,
  deletePlano,
  listPlanos,
  updatePlano,
} from "@/features/sala/planos/actions/planos-actions";
import { PlanoEditor } from "./PlanoEditor";

export function PlanosTab() {
  const [locales, setLocales] = useState<LocalMin[]>([]);
  const [localId, setLocalId] = useState<string>("");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState<Plano | null>(null);
  const [planoEnEdicion, setPlanoEnEdicion] = useState<Plano | null>(null);

  const cargar = useCallback(async (id: string) => {
    setLoading(true);
    const [p, s, z, m] = await Promise.all([
      listPlanos(id),
      listSalas(id),
      listZonas(id),
      listMesas(id),
    ]);
    if (p.ok) setPlanos(p.data);
    if (s.ok) setSalas(s.data);
    if (z.ok) setZonas(z.data);
    if (m.ok) setMesas(m.data);
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
    if (localId) cargar(localId);
  }, [localId, cargar]);

  // Si está en modo edición de plano, refresca al volver
  function handleBackEditor() {
    setPlanoEnEdicion(null);
    if (localId) cargar(localId);
  }

  async function handleBorrar(p: Plano) {
    if (!confirm(`¿Borrar el plano "${p.nombre}"? Las mesas colocadas se quitarán.`)) return;
    const res = await deletePlano(p.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Plano borrado");
    cargar(localId);
  }

  async function handleTogglePrincipal(p: Plano) {
    const res = await updatePlano(p.id, { esPrincipal: !p.esPrincipal });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar");
      return;
    }
    cargar(localId);
  }

  if (planoEnEdicion) {
    return (
      <PlanoEditor
        plano={planoEnEdicion}
        salas={salas}
        zonas={zonas}
        mesas={mesas}
        onBack={handleBackEditor}
      />
    );
  }

  return (
    <div className="space-y-4">
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

      <header className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Planos del local</h3>
          <p className="text-[11px] text-muted-foreground">
            Versiones de layout (verano, invierno, evento). Solo uno puede ser el principal.
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
        <ul className="space-y-1.5">
          {planos.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.nombre}</span>
                {p.esPrincipal && (
                  <span className="text-[10px] uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                    Principal
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleTogglePrincipal(p)}
                  title={p.esPrincipal ? "Quitar marca principal" : "Marcar como principal"}
                >
                  {p.esPrincipal ? "Quitar principal" : "Hacer principal"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditandoNombre(p)}
                  title="Renombrar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPlanoEnEdicion(p)}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Editar layout
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
            </li>
          ))}
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plano) setNombre(plano.nombre);
  }, [plano]);

  if (!plano) return null;

  async function handleGuardar() {
    if (!plano) return;
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const res = await updatePlano(plano.id, { nombre });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Plano renombrado");
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
          <DialogTitle>Renombrar plano</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
          />
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
