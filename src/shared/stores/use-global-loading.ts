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
}

export const useGlobalLoading = create<GlobalLoadingState>((set, get) => ({
  count: 0,
  message: null,
  isLoading: false,
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
