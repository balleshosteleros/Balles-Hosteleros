"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Archive, Eye, X, Sparkles, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createFaq,
  updateFaq,
  archivarFaq,
  publicarFaq,
} from "@/features/soporte/actions/faq-actions";
import { MODULOS_SOPORTE } from "@/lib/soporte/modulos";
import type { Faq, FaqInput } from "@/features/soporte/types";

/**
 * Las preguntas frecuentes, vistas desde Dirección.
 *
 * Casi todas las escribe el software solo: agrupa lo que la gente pregunta al
 * asistente y publica lo que se repite, ordenado por cuánto se pregunta. Aquí no
 * se teclean, se revisan. Se puede corregir la redacción, archivar lo que no
 * proceda y, si hace falta, escribir alguna a mano.
 */

const EMPTY_INPUT: FaqInput = {
  modulo: "GENERAL",
  pregunta: "",
  respuesta: "",
  estado: "publicada",
};

interface FaqAdminPanelProps {
  initialFaqs: Faq[];
}

export function FaqAdminPanel({ initialFaqs }: FaqAdminPanelProps) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FaqInput>(EMPTY_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const publicadas = initialFaqs.filter((f) => f.estado === "publicada");
  const archivadas = initialFaqs.filter((f) => f.estado === "archivada");
  const escritasSolas = publicadas.filter((f) => f.origen === "ia").length;

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_INPUT);
    setError(null);
  }

  function startEdit(faq: Faq) {
    setEditingId(faq.id);
    setForm({
      modulo: faq.modulo,
      pregunta: faq.pregunta,
      respuesta: faq.respuesta,
      estado: faq.estado,
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
        editingId === "new" ? await createFaq(form) : await updateFaq(editingId!, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  function cambiarEstado(id: string, archivar: boolean) {
    setError(null);
    startTransition(async () => {
      const result = archivar ? await archivarFaq(id) : await publicarFaq(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold">Preguntas frecuentes</h2>
          <p className="text-sm text-muted-foreground">
            Se escriben solas con lo que la gente pregunta al asistente, ordenadas por
            cuántas veces se preguntan. Cada una lleva un módulo: solo la ve quien ve
            ese módulo.
          </p>
        </div>
        <Button onClick={startNew} disabled={editingId !== null}>
          <Plus className="mr-2 h-4 w-4" />
          Escribir una a mano
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <EstadoCard label="Publicadas" valor={publicadas.length} />
        <EstadoCard label="Escritas solas" valor={escritasSolas} />
        <EstadoCard label="Archivadas" valor={archivadas.length} />
      </div>

      {editingId !== null && (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">
            {editingId === "new" ? "Nueva pregunta" : "Editar pregunta"}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Módulo (quién la verá)
              </label>
              <select
                value={form.modulo}
                onChange={(e) => setForm({ ...form, modulo: e.target.value })}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODULOS_SOPORTE.map((m) => (
                  <option key={m} value={m}>
                    {m === "GENERAL" ? "General (la ve todo el mundo)" : m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Pregunta
              </label>
              <input
                type="text"
                value={form.pregunta}
                onChange={(e) => setForm({ ...form, pregunta: e.target.value })}
                placeholder="Cómo pido unas vacaciones"
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Respuesta
              </label>
              <textarea
                value={form.respuesta}
                onChange={(e) => setForm({ ...form, respuesta: e.target.value })}
                rows={7}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={isPending}>
              Guardar
            </Button>
            <Button variant="outline" onClick={cancelEdit} disabled={isPending}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && editingId === null && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {publicadas.length === 0 && archivadas.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-base font-medium text-foreground">
            Todavía no hay ninguna pregunta publicada.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Se publican solas en cuanto una misma duda se repite tres veces en el
            asistente. Hasta que la gente no empiece a preguntar, esto está vacío a
            propósito.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...publicadas, ...archivadas].map((faq) => (
            <FilaFaq
              key={faq.id}
              faq={faq}
              disabled={isPending || editingId !== null}
              onEdit={() => startEdit(faq)}
              onToggle={() => cambiarEstado(faq.id, faq.estado === "publicada")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaFaq({
  faq,
  disabled,
  onEdit,
  onToggle,
}: {
  faq: Faq;
  disabled: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const archivada = faq.estado === "archivada";
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        archivada && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pildora>{faq.modulo}</Pildora>
            {faq.origen === "ia" ? (
              <Pildora>
                <Sparkles className="h-3 w-3" />
                Escrita sola
              </Pildora>
            ) : (
              <Pildora>
                <PenLine className="h-3 w-3" />A mano
              </Pildora>
            )}
            {faq.veces_preguntada > 0 && (
              <Pildora>
                Preguntada {faq.veces_preguntada}{" "}
                {faq.veces_preguntada === 1 ? "vez" : "veces"}
              </Pildora>
            )}
            {archivada && <Pildora>Archivada</Pildora>}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{faq.pregunta}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {faq.respuesta}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={disabled}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggle} disabled={disabled}>
            {archivada ? <Eye className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Pildora({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function EstadoCard({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
    </div>
  );
}
