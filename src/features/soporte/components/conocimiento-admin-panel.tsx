"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Save, X, Sparkles, Video, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createConocimientoManual,
  updateConocimientoManual,
  deleteConocimientoManual,
} from "@/features/soporte/actions/conocimiento-actions";
import { MODULOS_SOPORTE } from "@/lib/soporte/modulos";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import type {
  ConocimientoChunk,
  ConocimientoManualInput,
  RecursoEnlace,
  RecursoVideo,
} from "@/features/soporte/types";

const EMPTY_INPUT: ConocimientoManualInput = {
  modulo: "GENERAL",
  titulo: "",
  contenido: "",
  enlaces: [],
  videos: [],
  activo: true,
};

interface ConocimientoAdminPanelProps {
  initialChunks: ConocimientoChunk[];
  estado: {
    total: number;
    porFuente: Record<string, number>;
    porModulo: Record<string, number>;
    sinEmbedding: number;
  };
}

export function ConocimientoAdminPanel({
  initialChunks,
  estado,
}: ConocimientoAdminPanelProps) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<ConocimientoManualInput>(EMPTY_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const manuales = initialChunks.filter((c) => c.fuente === "manual");
  const deFormacion = initialChunks.filter((c) => c.fuente === "formacion");

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_INPUT);
    setError(null);
  }

  function startEdit(c: ConocimientoChunk) {
    setEditingId(c.id);
    setForm({
      modulo: c.modulo,
      titulo: c.titulo,
      contenido: c.contenido,
      enlaces: c.enlaces ?? [],
      videos: c.videos ?? [],
      activo: c.activo,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_INPUT);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result =
        editingId === "new"
          ? await createConocimientoManual(form)
          : await updateConocimientoManual(editingId!, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  async function remove(id: string) {
    const ok = await confirmDelete({
      title: "Borrar artículo",
      description: "Se borrará este artículo. No se puede deshacer.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteConocimientoManual(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  // Edición de enlaces/vídeos del formulario
  function addEnlace() {
    setForm((f) => ({ ...f, enlaces: [...(f.enlaces ?? []), { titulo: "", url: "" }] }));
  }
  function setEnlace(i: number, patch: Partial<RecursoEnlace>) {
    setForm((f) => ({
      ...f,
      enlaces: (f.enlaces ?? []).map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    }));
  }
  function removeEnlace(i: number) {
    setForm((f) => ({ ...f, enlaces: (f.enlaces ?? []).filter((_, idx) => idx !== i) }));
  }
  function addVideo() {
    setForm((f) => ({ ...f, videos: [...(f.videos ?? []), { titulo: "", url: "" }] }));
  }
  function setVideo(i: number, patch: Partial<RecursoVideo>) {
    setForm((f) => ({
      ...f,
      videos: (f.videos ?? []).map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    }));
  }
  function removeVideo(i: number) {
    setForm((f) => ({ ...f, videos: (f.videos ?? []).filter((_, idx) => idx !== i) }));
  }

  return (
    <div className="space-y-6">
      {confirmDeleteDialog}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Base del asistente</h2>
          <p className="text-sm text-muted-foreground">
            Lo que el asistente sabe. Cada artículo se asigna a un módulo y solo
            llega a los empleados cuyo rol ve ese módulo.
          </p>
        </div>
        <Button onClick={startNew} disabled={editingId !== null}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo artículo
        </Button>
      </div>

      {/* Estado del índice */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <EstadoCard label="Total de artículos" valor={estado.total} />
        <EstadoCard label="Escritos a mano" valor={estado.porFuente.manual ?? 0} />
        <EstadoCard label="Desde Formación" valor={estado.porFuente.formacion ?? 0} />
        <EstadoCard
          label="Sin indexar"
          valor={estado.sinEmbedding}
          alerta={estado.sinEmbedding > 0}
        />
      </div>

      {/* Formulario */}
      {editingId !== null && (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">
            {editingId === "new" ? "Nuevo artículo" : "Editar artículo"}
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Módulo (quién lo verá)
              </label>
              <select
                value={form.modulo}
                onChange={(e) => setForm({ ...form, modulo: e.target.value })}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODULOS_SOPORTE.map((m) => (
                  <option key={m} value={m}>
                    {m === "GENERAL" ? "General (todos los roles)" : m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.activo ?? true}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="h-4 w-4 rounded border"
                />
                Activo (el asistente lo usa)
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Título
            </label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Cómo crear un escandallo"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Contenido (admite saltos de línea)
            </label>
            <textarea
              value={form.contenido}
              onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              rows={6}
              placeholder="Explicación paso a paso…"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Vídeos */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Video className="h-3.5 w-3.5" /> Vídeos formativos
              </label>
              <button
                type="button"
                onClick={addVideo}
                className="text-xs text-primary hover:underline"
              >
                + Añadir vídeo
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {(form.videos ?? []).map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={v.titulo}
                    onChange={(e) => setVideo(i, { titulo: e.target.value })}
                    placeholder="Título"
                    className="w-1/3 rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <input
                    value={v.url}
                    onChange={(e) => setVideo(i, { url: e.target.value })}
                    placeholder="https://…"
                    className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeVideo(i)}
                    className="rounded p-1.5 text-muted-foreground hover:text-red-600"
                    aria-label="Quitar vídeo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Enlaces */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> Enlaces de ayuda
              </label>
              <button
                type="button"
                onClick={addEnlace}
                className="text-xs text-primary hover:underline"
              >
                + Añadir enlace
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {(form.enlaces ?? []).map((e, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={e.titulo}
                    onChange={(ev) => setEnlace(i, { titulo: ev.target.value })}
                    placeholder="Título"
                    className="w-1/3 rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <input
                    value={e.url}
                    onChange={(ev) => setEnlace(i, { url: ev.target.value })}
                    placeholder="https://…"
                    className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnlace(i)}
                    className="rounded p-1.5 text-muted-foreground hover:text-red-600"
                    aria-label="Quitar enlace"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Button onClick={save} disabled={isPending}>
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="outline" onClick={cancelEdit} disabled={isPending}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Artículos a mano */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Artículos a mano
        </h3>
        {manuales.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            No hay artículos a mano. Pulsa <strong>Nuevo artículo</strong> para empezar.
          </div>
        ) : (
          <ul className="space-y-2">
            {manuales.map((c) => (
              <ChunkRow
                key={c.id}
                chunk={c}
                onEdit={() => startEdit(c)}
                onRemove={() => remove(c.id)}
                disabled={editingId !== null || isPending}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Desde Formación (solo lectura) */}
      {deFormacion.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Desde Formación (automático)
          </h3>
          <ul className="space-y-2">
            {deFormacion.map((c) => (
              <ChunkRow key={c.id} chunk={c} readOnly />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EstadoCard({
  label,
  valor,
  alerta,
}: {
  label: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3",
        alerta && "border-amber-300 bg-amber-50/60",
      )}
    >
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ChunkRow({
  chunk,
  onEdit,
  onRemove,
  disabled,
  readOnly,
}: {
  chunk: ConocimientoChunk;
  onEdit?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <li className="flex items-start justify-between rounded-md border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {chunk.modulo === "GENERAL" ? "General" : chunk.modulo}
          </span>
          {!chunk.activo && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Inactivo
            </span>
          )}
          {(chunk.videos?.length ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Video className="h-3 w-3" /> {chunk.videos.length}
            </span>
          )}
          {(chunk.enlaces?.length ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Link2 className="h-3 w-3" /> {chunk.enlaces.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">{chunk.titulo}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {chunk.contenido}
        </p>
      </div>
      {!readOnly && (
        <div className="ml-4 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="rounded p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Borrar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}
