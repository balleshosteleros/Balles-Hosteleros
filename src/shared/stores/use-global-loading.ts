"use client";

import { create } from "zustand";

interface GlobalLoadingState {
  count: number;
  message: string | null;
  isLoading: boolean;
  show: (message?: string) => void;
  hide: () => void;
  reset: () => void;
  wrap: <T>(promise: Promise<T>, message?: string) => Promise<T>;
  /**
   * Sube cada vez que se cambia de empresa. Una vista que tarde en recargarse
   * (Reservas) mira este número: si subió desde la última vez que lo vio, sabe
   * que está pintando datos de la empresa ANTERIOR y mantiene el recuadro de
   * carga hasta tener los suyos. Antes el recuadro se quitaba con un temporizador
   * fijo de 900 ms —siempre demasiado corto para Sala—, así que se podía pulsar
   * sobre las reservas del restaurante anterior.
   */
  cambioEmpresaSeq: number;
  marcarCambioEmpresa: () => void;
}

export const useGlobalLoading = create<GlobalLoadingState>((set, get) => ({
  count: 0,
  message: null,
  isLoading: false,
  cambioEmpresaSeq: 0,
  marcarCambioEmpresa: () =>
    set((s) => ({ cambioEmpresaSeq: s.cambioEmpresaSeq + 1 })),
  show: (message) =>
    set((s) => ({
      count: s.count + 1,
      message: message ?? s.message,
      isLoading: true,
    })),
  hide: () =>
    set((s) => {
      const next = Math.max(0, s.count - 1);
      return {
        count: next,
        isLoading: next > 0,
        message: next > 0 ? s.message : null,
      };
    }),
  reset: () => set({ count: 0, isLoading: false, message: null }),
  wrap: async (promise, message) => {
    get().show(message);
    try {
      return await promise;
    } finally {
      get().hide();
    }
  },
}));
