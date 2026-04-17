"use client";

/**
 * Autosave del editor: escucha cambios de `bloques` en el store y persiste
 * con debounce (default 1000 ms) llamando a guardarBloques.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditorStore } from "./useEditorStore";
import { guardarBloques } from "../actions/bloques-actions";
import type { EstadoAutosave } from "../components/admin/editor/AutosaveIndicator";

export function useAutosave(paginaId: string | null, debounceMs = 1000) {
  const [estado, setEstado] = useState<EstadoAutosave>("idle");
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!paginaId) return;

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      // Evita guardar durante hidratación o si no hay cambios reales
      if (state.hydrating) return;
      if (state.bloques === prev.bloques) return;
      if (!state.dirty) return;

      setEstado("dirty");

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        const snapshot = useEditorStore.getState().bloques;
        setEstado("saving");
        const res = await guardarBloques(paginaId, snapshot);
        if (res.ok) {
          useEditorStore.getState().setDirty(false);
          setUltimoGuardado(new Date());
          setEstado("saved");
        } else {
          setEstado("error");
          toast.error(res.error ?? "Error al guardar");
        }
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [paginaId, debounceMs]);

  return { estado, ultimoGuardado };
}
