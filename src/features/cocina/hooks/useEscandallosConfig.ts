"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listConfigItems,
  createConfigItem,
  updateConfigItem,
  deleteConfigItem,
  type EscandalloConfigItem,
  type GrupoCodigo,
} from "@/features/cocina/actions/escandallos-config-actions";

export type { EscandalloConfigItem, GrupoCodigo };

export function useEscandallosConfig(grupo: GrupoCodigo) {
  const [items, setItems] = useState<EscandalloConfigItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConfigItems(grupo);
      if (res.ok) {
        setItems(res.data);
      } else {
        toast.error(`Error al cargar ${grupo}: ${res.error ?? "desconocido"}`);
      }
    } catch (err) {
      console.error("[useEscandallosConfig] reload:", err);
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [grupo]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (input: { nombre: string; descripcion?: string; activa?: boolean }) => {
      const res = await createConfigItem({ grupo, ...input });
      if (res.ok && res.data) {
        setItems((prev) => [...prev, res.data!]);
        toast.success("Creado");
        return true;
      }
      toast.error(res.error ?? "No se pudo crear");
      return false;
    },
    [grupo]
  );

  const update = useCallback(
    async (
      id: string,
      input: { nombre?: string; descripcion?: string | null; activa?: boolean; orden?: number }
    ) => {
      const res = await updateConfigItem(id, input);
      if (res.ok && res.data) {
        setItems((prev) => prev.map((it) => (it.id === id ? res.data! : it)));
        return true;
      }
      toast.error(res.error ?? "No se pudo actualizar");
      return false;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    const prev = items;
    setItems((curr) => curr.filter((it) => it.id !== id));
    const res = await deleteConfigItem(id);
    if (!res.ok) {
      setItems(prev);
      toast.error(res.error ?? "No se pudo eliminar");
      return false;
    }
    toast.success("Eliminado");
    return true;
  }, [items]);

  return { items, loading, reload, create, update, remove };
}
