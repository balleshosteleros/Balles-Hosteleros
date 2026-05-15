"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listTiposAusencia,
  createTipoAusencia,
  updateTipoAusencia,
  deleteTipoAusencia,
  listTiposFichaje,
  createTipoFichaje,
  updateTipoFichaje,
  deleteTipoFichaje,
  type TipoAusenciaRow,
  type TipoAusenciaInput,
  type TipoFichajeRow,
  type TipoFichajeInput,
} from "@/features/rrhh/actions/horarios-config-actions";

export type { TipoAusenciaRow, TipoFichajeRow };

export function useTiposAusencia(empresaId?: string) {
  const [items, setItems] = useState<TipoAusenciaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTiposAusencia(empresaId);
      if (res.ok) setItems(res.data);
      else toast.error(`Error al cargar tipos de ausencia: ${res.error ?? ""}`);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (input: TipoAusenciaInput, replicarEn?: string[]) => {
      const res = await createTipoAusencia(input, replicarEn);
      if (res.ok && res.data) {
        setItems((prev) => [...prev, res.data!]);
        toast.success("Tipo de ausencia creado");
        return true;
      }
      toast.error(res.error ?? "No se pudo crear");
      return false;
    },
    [],
  );

  const update = useCallback(
    async (id: string, input: Partial<TipoAusenciaInput> & { orden?: number }) => {
      const res = await updateTipoAusencia(id, input);
      if (res.ok && res.data) {
        setItems((prev) => prev.map((it) => (it.id === id ? res.data! : it)));
        return true;
      }
      toast.error(res.error ?? "No se pudo actualizar");
      return false;
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = items;
      setItems((curr) => curr.filter((it) => it.id !== id));
      const res = await deleteTipoAusencia(id);
      if (!res.ok) {
        setItems(prev);
        toast.error(res.error ?? "No se pudo eliminar");
        return false;
      }
      toast.success("Eliminado");
      return true;
    },
    [items],
  );

  return { items, loading, reload, create, update, remove };
}

export function useTiposFichaje(empresaId?: string) {
  const [items, setItems] = useState<TipoFichajeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTiposFichaje(empresaId);
      if (res.ok) setItems(res.data);
      else toast.error(`Error al cargar tipos de fichaje: ${res.error ?? ""}`);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (input: TipoFichajeInput, replicarEn?: string[]) => {
      const res = await createTipoFichaje(input, replicarEn);
      if (res.ok && res.data) {
        setItems((prev) => [...prev, res.data!]);
        toast.success("Tipo de fichaje creado");
        return true;
      }
      toast.error(res.error ?? "No se pudo crear");
      return false;
    },
    [],
  );

  const update = useCallback(
    async (id: string, input: Partial<TipoFichajeInput> & { orden?: number }) => {
      const res = await updateTipoFichaje(id, input);
      if (res.ok && res.data) {
        setItems((prev) => prev.map((it) => (it.id === id ? res.data! : it)));
        return true;
      }
      toast.error(res.error ?? "No se pudo actualizar");
      return false;
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = items;
      setItems((curr) => curr.filter((it) => it.id !== id));
      const res = await deleteTipoFichaje(id);
      if (!res.ok) {
        setItems(prev);
        toast.error(res.error ?? "No se pudo eliminar");
        return false;
      }
      toast.success("Eliminado");
      return true;
    },
    [items],
  );

  return { items, loading, reload, create, update, remove };
}
