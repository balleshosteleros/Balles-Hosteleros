import { create } from "zustand";
import type { LlamadaTipo } from "@/features/llamadas-internas/types";

/** PRP-054 · Fase 4 — Estado de la llamada activa (una a la vez en v1). */
export type FaseLlamada =
  | "idle"
  | "saliente" // yo llamo, esperando que acepten
  | "entrante" // me llaman, sonando
  | "conectando" // aceptada, negociando WebRTC
  | "en_curso"; // audio establecido

export interface LlamadaActiva {
  callId: string;
  peerUserId: string;
  peerNombre: string;
  peerAvatar: string | null;
  tipo: LlamadaTipo;
  rol: "caller" | "callee";
  /** Solo en entrante: offer guardada para responder al aceptar. */
  offer?: RTCSessionDescriptionInit;
  /** Timestamp ms cuando se conectó (para el cronómetro). */
  conectadaEn: number | null;
}

interface LlamadaStore {
  fase: FaseLlamada;
  llamada: LlamadaActiva | null;
  setEntrante: (l: LlamadaActiva) => void;
  setSaliente: (l: LlamadaActiva) => void;
  setFase: (f: FaseLlamada) => void;
  marcarConectada: (ts: number) => void;
  reset: () => void;
}

export const useLlamadaStore = create<LlamadaStore>((set) => ({
  fase: "idle",
  llamada: null,
  setEntrante: (llamada) => set({ llamada, fase: "entrante" }),
  setSaliente: (llamada) => set({ llamada, fase: "saliente" }),
  setFase: (fase) => set({ fase }),
  marcarConectada: (ts) =>
    set((s) => ({
      fase: "en_curso",
      llamada: s.llamada ? { ...s.llamada, conectadaEn: ts } : null,
    })),
  reset: () => set({ fase: "idle", llamada: null }),
}));
