"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRecordingStore } from "../store/recording-store";
import {
  addPending,
  listPending,
  markRetryFailure,
  removePending,
  type PendingRecording,
} from "../lib/pending-storage";

export interface RecordOptions {
  includeSystemAudio: boolean;
  includeMic: boolean;
  includeCamera: boolean;
  quality: "720p" | "1080p";
}

export interface RecordingResult {
  videoId: string;
  url: string;
  duration: number;
  fileSize: number;
}

interface RecorderContextValue {
  options: RecordOptions;
  toggleOption: (key: keyof RecordOptions) => void;
  setQuality: (quality: RecordOptions["quality"]) => void;
  error: string | null;
  result: RecordingResult | null;
  previewUrl: string | null;
  cameraStream: MediaStream | null;
  displaySurface: string | null;
  pendingCount: number;
  startRecording: (title: string) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
  refreshPending: () => Promise<PendingRecording[]>;
  retryPending: (id: string) => Promise<boolean>;
  retryAllPending: () => Promise<void>;
  deletePending: (id: string) => Promise<void>;
}

const COUNTDOWN_SECONDS = 3;

const RecorderContext = createContext<RecorderContextValue | null>(null);

const DEFAULT_OPTIONS: RecordOptions = {
  includeSystemAudio: true,
  includeMic: true,
  includeCamera: false,
  quality: "1080p",
};

function getSupportedMimeType(): string {
  if (typeof window === "undefined") return "video/webm";
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RecorderProvider({ children }: { children: ReactNode }) {
  const { setState, setElapsed, setCountdownValue } = useRecordingStore();
  const [options, setOptions] = useState<RecordOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [displaySurface, setDisplaySurface] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const previewUrlRef = useRef<string | null>(null);
  const countdownCancelRef = useRef<boolean>(false);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  const stopAllStreams = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    screenStreamRef.current = null;
    micStreamRef.current = null;
    cameraStreamRef.current = null;
    audioContextRef.current = null;
    setCameraStream(null);
    setDisplaySurface(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAllStreams();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [stopAllStreams]);

  const toggleOption = useCallback((key: keyof RecordOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setQuality = useCallback((quality: RecordOptions["quality"]) => {
    setOptions((prev) => ({ ...prev, quality }));
  }, []);

  const refreshPending = useCallback(async (): Promise<PendingRecording[]> => {
    try {
      const list = await listPending();
      setPendingCount(list.length);
      return list;
    } catch (err) {
      console.error("[recorder] listPending failed:", err);
      return [];
    }
  }, []);

  const uploadBlob = useCallback(
    async (
      pendingId: string,
      blob: Blob,
      title: string,
      duration: number,
    ): Promise<{ id: string; url: string; duration: number; file_size: number } | null> => {
      const formData = new FormData();
      formData.append("file", blob, `${title}.webm`);
      formData.append("title", title);
      formData.append("duration", duration.toString());
      formData.append("mimeType", blob.type);

      try {
        const res = await fetch("/api/recordings", { method: "POST", body: formData });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        if (!data?.id) throw new Error("Respuesta sin id");
        await removePending(pendingId).catch(() => {});
        await refreshPending();
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[recorder] upload failed, kept in IndexedDB:", msg);
        await markRetryFailure(pendingId, msg).catch(() => {});
        await refreshPending();
        return null;
      }
    },
    [refreshPending],
  );

  const processRecording = useCallback(
    async (blob: Blob, title: string) => {
      try {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        const duration =
          elapsedRef.current || Math.floor((Date.now() - startTimeRef.current) / 1000);
        const pendingId =
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

        const localResult: RecordingResult = {
          videoId: pendingId,
          url,
          duration,
          fileSize: blob.size,
        };
        setResult(localResult);
        setState("done");

        // Persistir en IndexedDB ANTES de intentar subir.
        // Así, si el upload falla o el usuario cierra la pestaña,
        // el video sigue disponible para reintentar más tarde.
        try {
          await addPending({
            id: pendingId,
            title,
            blob,
            mimeType: blob.type,
            duration,
            fileSize: blob.size,
            createdAt: Date.now(),
            retryCount: 0,
          });
          await refreshPending();
        } catch (err) {
          // Si IndexedDB no está disponible (cuota llena, modo privado, etc.)
          // seguimos adelante con el upload directo sin fallback local.
          console.warn("[recorder] no se pudo guardar en IndexedDB:", err);
        }

        // Subida en segundo plano. Si tiene éxito, removePending lo borra.
        const data = await uploadBlob(pendingId, blob, title, duration);
        if (data) {
          setResult({
            videoId: data.id,
            url: data.url,
            duration: data.duration,
            fileSize: data.file_size,
          });
        }
      } catch (err) {
        console.error("Error al procesar la grabación:", err);
        setState("error");
        setError("Error al procesar la grabación");
      }
    },
    [refreshPending, setState, uploadBlob],
  );

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopAllStreams();
    setState("uploading");
  }, [setState, stopAllStreams]);

  const startRecording = useCallback(
    async (title: string) => {
      setError(null);
      setState("requesting");
      chunksRef.current = [];

      try {
        const videoConstraints: MediaTrackConstraints =
          options.quality === "1080p"
            ? { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: videoConstraints,
          audio: options.includeSystemAudio,
        });
        screenStreamRef.current = screenStream;

        const videoTrack = screenStream.getVideoTracks()[0];
        const trackSettings = videoTrack.getSettings() as MediaTrackSettings & {
          displaySurface?: string;
        };
        setDisplaySurface(trackSettings.displaySurface ?? null);

        videoTrack.addEventListener("ended", () => {
          if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") {
            stopRecording();
          } else {
            // Usuario detuvo el share durante el countdown o antes de empezar a grabar
            countdownCancelRef.current = true;
            stopAllStreams();
            setCountdownValue(0);
            setState("idle");
          }
        });

        let micStream: MediaStream | null = null;
        if (options.includeMic) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            micStreamRef.current = micStream;
          } catch {
            // mic permission denied is non-fatal
          }
        }

        if (options.includeCamera) {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
              audio: false,
            });
            cameraStreamRef.current = camStream;
            setCameraStream(camStream);
          } catch (camErr) {
            console.warn("Camera permission denied or not available:", camErr);
          }
        }

        let finalStream: MediaStream;
        const audioTracksToMix: MediaStreamTrack[] = [];

        if (options.includeSystemAudio && screenStream.getAudioTracks().length > 0) {
          audioTracksToMix.push(...screenStream.getAudioTracks());
        }
        if (micStream && micStream.getAudioTracks().length > 0) {
          audioTracksToMix.push(...micStream.getAudioTracks());
        }

        if (audioTracksToMix.length > 0) {
          const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          audioContextRef.current = audioContext;
          const destination = audioContext.createMediaStreamDestination();
          audioTracksToMix.forEach((track) => {
            const source = audioContext.createMediaStreamSource(new MediaStream([track]));
            source.connect(destination);
          });
          finalStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...destination.stream.getAudioTracks(),
          ]);
        } else {
          finalStream = new MediaStream([...screenStream.getVideoTracks()]);
        }

        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(finalStream, {
          mimeType,
          videoBitsPerSecond: options.quality === "1080p" ? 5_000_000 : 2_500_000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          await processRecording(blob, title);
        };

        mediaRecorderRef.current = recorder;

        // Countdown 3..2..1 antes de empezar a grabar realmente
        countdownCancelRef.current = false;
        setState("countdown");
        for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
          if (countdownCancelRef.current) return;
          setCountdownValue(n);
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (countdownCancelRef.current) return;
        setCountdownValue(0);

        recorder.start(1000);

        startTimeRef.current = Date.now();
        elapsedRef.current = 0;
        setElapsed(0);
        timerRef.current = setInterval(() => {
          const next = Math.floor((Date.now() - startTimeRef.current) / 1000);
          elapsedRef.current = next;
          setElapsed(next);
        }, 500);

        setState("recording");
      } catch (err) {
        countdownCancelRef.current = true;
        setCountdownValue(0);
        setState("error");
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            setError("Permiso denegado. Debes permitir el acceso a la pantalla.");
          } else {
            setError(err.message);
          }
        }
        stopAllStreams();
      }
    },
    [options, processRecording, setCountdownValue, setElapsed, setState, stopAllStreams, stopRecording],
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState("paused");
    }
  }, [setState]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now() - elapsedRef.current * 1000;
      timerRef.current = setInterval(() => {
        const next = Math.floor((Date.now() - startTimeRef.current) / 1000);
        elapsedRef.current = next;
        setElapsed(next);
      }, 500);
      setState("recording");
    }
  }, [setElapsed, setState]);

  const retryPending = useCallback(
    async (id: string): Promise<boolean> => {
      const all = await listPending();
      const rec = all.find((r) => r.id === id);
      if (!rec) {
        await refreshPending();
        return false;
      }
      const data = await uploadBlob(rec.id, rec.blob, rec.title, rec.duration);
      return !!data;
    },
    [refreshPending, uploadBlob],
  );

  const retryAllPending = useCallback(async () => {
    const all = await listPending();
    for (const rec of all) {
      await uploadBlob(rec.id, rec.blob, rec.title, rec.duration);
    }
  }, [uploadBlob]);

  const deletePending = useCallback(
    async (id: string) => {
      await removePending(id).catch(() => {});
      await refreshPending();
    },
    [refreshPending],
  );

  // Al montar: contar pendientes y reintentar subidas si hay red.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshPending();
      if (cancelled || list.length === 0) return;
      if (typeof navigator === "undefined" || navigator.onLine) {
        retryAllPending().catch(() => {});
      }
    })();

    function handleOnline() {
      retryAllPending().catch(() => {});
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
    };
  }, [refreshPending, retryAllPending]);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setCountdownValue(0);
    setError(null);
    setState("idle");
    chunksRef.current = [];
  }, [previewUrl, setCountdownValue, setElapsed, setState]);

  const value: RecorderContextValue = {
    options,
    toggleOption,
    setQuality,
    error,
    result,
    previewUrl,
    cameraStream,
    displaySurface,
    pendingCount,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
    refreshPending,
    retryPending,
    retryAllPending,
    deletePending,
  };

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}

export function useRecorder() {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error("useRecorder must be used within RecorderProvider");
  return ctx;
}
