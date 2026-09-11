"use client";

import { useState, useTransition } from "react";
import { X, CircleSlash, BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULOS_SOPORTE } from "@/lib/soporte/modulos";
import {
  responderHueco,
  descartarHueco,
} from "@/features/soporte/actions/huecos-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import type { HuecoConocimiento } from "@/features/soporte/types";

/**
 * Lo que la gente pregunta y el asistente no sabe contestar.
 *
 * Es la lista de trabajo que hace que la ayuda se alimente sola: se escribe la
 * explicación UNA vez, el asistente ya sabe contestar esa duda y, cuando se
 * repita, la pregunta acaba publicándose sola en las frecuentes.
 */

interface HuecosPanelProps {
  huecos: HuecoConocimiento[];
}

export function HuecosPanel({ huecos }: HuecosPanelProps) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [form, setForm] = useState({ modulo: "GENERAL", titulo: "", contenido: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDelete();

  function empezar(h: HuecoConocimiento) {
    setAbierto(h.id);
    setForm({
      modulo: h.modulo_probable ?? "GENERAL",
      titulo: h.pregunta,
      contenido: "",
    });
    setError(null);
  }

  function cancelar() {
    setAbierto(null);
    setError(null);
  }

  function guardar(huecoId: string) {
    setError(null);
    startTransition(async () => {
      const r = await responderHueco({ huecoId, ...form });
      if (r.error) {
        setError(r.error);
        return;
      }
      window.location.reload();
    });
  }

  async function descartar(h: HuecoConocimiento) {
    const ok = await confirm({
      title: "Descartar la pregunta",
      description:
        "Dejará de salir en la lista. No se borra nada, pero no se escribe ninguna explicación y el asistente seguirá sin saber contestarla.",
      confirmLabel: "Descartar",
      tono: "normal",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await descartarHueco(h.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4 pb-28">
      {dialog}
      <div>
        <h2 className="text-lg font-semibold">Lo que no sabemos contestar</h2>
        <p className="text-sm text-muted-foreground">
          Preguntas que la gente le ha hecho al asistente y que no están explicadas en
          ningún sitio. Escribe la explicación una vez y el asistente ya sabrá
          contestarlas.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {huecos.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-base font-medium text-foreground">
            No hay nada pendiente de explicar.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando alguien pregunte algo que el asistente no sepa, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {huecos.map((h) => (
            <div key={h.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {h.modulo_probable && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Parece de {h.modulo_probable}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Preguntada {h.veces_preguntada}{" "}
                      {h.veces_preguntada === 1 ? "vez" : "veces"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {h.pregunta}
                  </p>
                </div>
                {abierto !== h.id && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => empezar(h)}
                      disabled={isPending}
                    >
                      <BookPlus className="mr-2 h-4 w-4" />
                      Explicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => descartar(h)}
                      disabled={isPending}
                    >
                      <CircleSlash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {abierto === h.id && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Módulo (quién podrá verlo)
                    </label>
                    <select
                      value={form.modulo}
                      onChange={(e) => setForm({ ...form, modulo: e.target.value })}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {MODULOS_SOPORTE.map((m) => (
                        <option key={m} value={m}>
                          {m === "GENERAL" ? "General (lo ve todo el mundo)" : m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Título
                    </label>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Explicación
                    </label>
                    <textarea
                      value={form.contenido}
                      onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                      rows={7}
                      placeholder="Explícalo como se lo contarías a alguien que acaba de entrar."
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => guardar(h.id)} disabled={isPending}>
                      Guardar
                    </Button>
                    <Button variant="outline" onClick={cancelar} disabled={isPending}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
