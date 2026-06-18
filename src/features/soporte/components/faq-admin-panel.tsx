"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createFaq,
  updateFaq,
  deleteFaq,
} from "@/features/soporte/actions/faq-actions";
import type { Faq, FaqInput } from "@/features/soporte/types";
import type { AppRole } from "@/features/auth/contexts/auth-context";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const ALL_ROLES: AppRole[] = [
  "admin",
  "director",
  "gerencia",
  "responsable",
  "empleado",
  "solo_lectura",
];

const EMPTY_INPUT: FaqInput = {
  categoria: "",
  pregunta: "",
  respuesta: "",
  visible_para: [...ALL_ROLES],
  orden: 0,
};

interface FaqAdminPanelProps {
  initialFaqs: Faq[];
}

export function FaqAdminPanel({ initialFaqs }: FaqAdminPanelProps) {
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FaqInput>(EMPTY_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_INPUT);
    setError(null);
  }

  function startEdit(faq: Faq) {
    setEditingId(faq.id);
    setForm({
      categoria: faq.categoria,
      pregunta: faq.pregunta,
      respuesta: faq.respuesta,
      visible_para: faq.visible_para,
      orden: faq.orden,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_INPUT);
    setError(null);
  }

  function toggleRole(role: AppRole) {
    setForm((f) => ({
      ...f,
      visible_para: f.visible_para.includes(role)
        ? f.visible_para.filter((r) => r !== role)
        : [...f.visible_para, role],
    }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result =
        editingId === "new"
          ? await createFaq(form)
          : await updateFaq(editingId!, form);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Optimistic refresh: reload list by reloading the page action
      // In production we'd refetch, here we use revalidatePath in the action
      window.location.reload();
    });
  }

  async function remove(id: string) {
    const ok = await confirmDelete({
      title: "Borrar FAQ",
      description: "Se borrará esta FAQ. No se puede deshacer.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteFaq(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    });
  }

  // Agrupar por categoría para el listado
  const grouped = faqs.reduce<Record<string, Faq[]>>((acc, f) => {
    (acc[f.categoria] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {confirmDeleteDialog}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestión de FAQs</h2>
          <p className="text-sm text-muted-foreground">
            Añade, edita o elimina preguntas frecuentes. Cada FAQ puede estar
            visible solo para ciertos roles.
          </p>
        </div>
        <Button onClick={startNew} disabled={editingId !== null}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva FAQ
        </Button>
      </div>

      {/* Formulario de creación/edición */}
      {editingId !== null && (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">
            {editingId === "new" ? "Nueva FAQ" : "Editar FAQ"}
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Categoría
              </label>
              <input
                type="text"
                value={form.categoria}
                onChange={(e) =>
                  setForm({ ...form, categoria: e.target.value })
                }
                placeholder="Ej: RRHH, Cocina, Logística..."
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Orden (dentro de la categoría)
              </label>
              <input
                type="number"
                value={form.orden ?? 0}
                onChange={(e) =>
                  setForm({ ...form, orden: parseInt(e.target.value) || 0 })
                }
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Pregunta
            </label>
            <input
              type="text"
              value={form.pregunta}
              onChange={(e) => setForm({ ...form, pregunta: e.target.value })}
              placeholder="¿Cómo hago X?"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Respuesta (admite saltos de línea)
            </label>
            <textarea
              value={form.respuesta}
              onChange={(e) => setForm({ ...form, respuesta: e.target.value })}
              rows={6}
              placeholder="Respuesta detallada..."
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Visible para los siguientes roles
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    form.visible_para.includes(role)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  {role}
                </button>
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
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              variant="outline"
              onClick={cancelEdit}
              disabled={isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Listado agrupado por categoría */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No hay FAQs todavía. Pulsa <strong>Nueva FAQ</strong> para empezar.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <section key={cat}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </h3>
              <ul className="space-y-2">
                {items.map((faq) => (
                  <li
                    key={faq.id}
                    className="flex items-start justify-between rounded-md border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {faq.pregunta}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {faq.respuesta}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {faq.visible_para.map((r) => (
                          <span
                            key={r}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(faq)}
                        disabled={editingId !== null}
                        className="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(faq.id)}
                        disabled={editingId !== null || isPending}
                        className="rounded p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Borrar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
