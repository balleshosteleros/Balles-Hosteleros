import { create } from "zustand";

export type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped" | "uploading" | "done" | "error";

interface RecordingStore {
  state: RecordingState;
  elapsed: number;
  isDrawerOpen: boolean;
  setState: (state: RecordingState) => void;
  setElapsed: (elapsed: number) => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  state: "idle",
  elapsed: 0,
  isDrawerOpen: false,
  setState: (state) => set({ state }),
  setElapsed: (elapsed) => set({ elapsed }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
}));
