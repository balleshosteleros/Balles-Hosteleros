import { create } from "zustand";

export type RecordingState =
  | "idle"
  | "requesting"
  | "countdown"
  | "recording"
  | "paused"
  | "stopped"
  | "uploading"
  | "done"
  | "error";

interface RecordingStore {
  state: RecordingState;
  elapsed: number;
  countdownValue: number;
  isDrawerOpen: boolean;
  setState: (state: RecordingState) => void;
  setElapsed: (elapsed: number) => void;
  setCountdownValue: (value: number) => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  state: "idle",
  elapsed: 0,
  countdownValue: 0,
  isDrawerOpen: false,
  setState: (state) => set({ state }),
  setElapsed: (elapsed) => set({ elapsed }),
  setCountdownValue: (countdownValue) => set({ countdownValue }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
}));
