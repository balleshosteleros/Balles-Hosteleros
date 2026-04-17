"use client";

/**
 * Zustand store del editor de páginas web.
 * Mantiene bloques en memoria; la persistencia a BD se hace en Fase 4 vía useAutosave.
 */
import { create } from "zustand";
import type { Bloque, BloqueTipo, PaginaWeb } from "../types";
import { crearBloqueDefault } from "../data/bloques-defaults";

export interface EditorState {
  paginaId: string | null;
  nombre: string;
  bloques: Bloque[];
  seleccionadoId: string | null;
  dirty: boolean;
  hydrating: boolean;

  hydrate: (pagina: PaginaWeb) => void;
  reset: () => void;

  agregarBloque: (tipo: BloqueTipo, posicion?: number) => string;
  moverBloque: (fromId: string, toIndex: number) => void;
  reordenar: (idsEnOrden: string[]) => void;
  borrarBloque: (id: string) => void;
  actualizarBloque: <T extends Bloque = Bloque>(id: string, datos: Partial<T["datos"]>) => void;
  toggleVisible: (id: string) => void;
  seleccionar: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  paginaId: null,
  nombre: "",
  bloques: [],
  seleccionadoId: null,
  dirty: false,
  hydrating: false,

  hydrate: (pagina) => {
    set({
      paginaId: pagina.id,
      nombre: pagina.nombre,
      bloques: Array.isArray(pagina.bloques)
        ? [...pagina.bloques].sort((a, b) => a.orden - b.orden)
        : [],
      seleccionadoId: null,
      dirty: false,
      hydrating: false,
    });
  },

  reset: () =>
    set({
      paginaId: null,
      nombre: "",
      bloques: [],
      seleccionadoId: null,
      dirty: false,
      hydrating: false,
    }),

  agregarBloque: (tipo, posicion) => {
    const { bloques } = get();
    const orden = typeof posicion === "number" ? posicion : bloques.length;
    const nuevo = crearBloqueDefault(tipo, orden);
    const arr = [...bloques];
    arr.splice(orden, 0, nuevo);
    const reordenados = arr.map((b, i) => ({ ...b, orden: i }));
    set({ bloques: reordenados, seleccionadoId: nuevo.id, dirty: true });
    return nuevo.id;
  },

  moverBloque: (fromId, toIndex) => {
    const { bloques } = get();
    const fromIndex = bloques.findIndex((b) => b.id === fromId);
    if (fromIndex === -1) return;
    const arr = [...bloques];
    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);
    set({ bloques: arr.map((b, i) => ({ ...b, orden: i })), dirty: true });
  },

  reordenar: (idsEnOrden) => {
    const { bloques } = get();
    const byId = new Map(bloques.map((b) => [b.id, b]));
    const reordenados: Bloque[] = [];
    idsEnOrden.forEach((id, i) => {
      const b = byId.get(id);
      if (b) reordenados.push({ ...b, orden: i });
    });
    set({ bloques: reordenados, dirty: true });
  },

  borrarBloque: (id) => {
    const { bloques, seleccionadoId } = get();
    const arr = bloques.filter((b) => b.id !== id).map((b, i) => ({ ...b, orden: i }));
    set({
      bloques: arr,
      seleccionadoId: seleccionadoId === id ? null : seleccionadoId,
      dirty: true,
    });
  },

  actualizarBloque: (id, datos) => {
    const { bloques } = get();
    set({
      bloques: bloques.map((b) =>
        b.id === id ? ({ ...b, datos: { ...b.datos, ...datos } } as Bloque) : b,
      ),
      dirty: true,
    });
  },

  toggleVisible: (id) => {
    const { bloques } = get();
    set({
      bloques: bloques.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
      dirty: true,
    });
  },

  seleccionar: (id) => set({ seleccionadoId: id }),
  setDirty: (dirty) => set({ dirty }),
}));
