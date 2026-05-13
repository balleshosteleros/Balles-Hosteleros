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
  startRecording: (title: string) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
}

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
  const { setState, setElapsed } = useRecordingStore();
  const [options, setOptions] = useState<RecordOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

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

  const processRecording = useCallback(
    async (blob: Blob, title: string) => {
      try {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        const duration = elapsedRef.current || Math.floor((Date.now() - startTimeRef.current) / 1000);
        const localResult: RecordingResult = {
          videoId: "local-" + Date.now(),
          url,
          duration,
          fileSize: blob.size,
        };
        setResult(localResult);
        setState("done");

        const formData = new FormData();
        formData.append("file", blob, `${title}.webm`);
        formData.append("title", title);
        formData.append("duration", duration.toString());
        formData.append("mimeType", blob.type);

        fetch("/api/recordings", { method: "POST", body: formData })
          .then((res) => res.json())
          .then((data) => {
            if (data?.id) {
              setResult({
                videoId: data.id,
                url: data.url,
                duration: data.duration,
                fileSize: data.file_size,
              });
            }
          })
          .catch((err) => {
            console.warn(
              "No se pudo guardar en el servidor, el video solo estará disponible localmente esta sesión.",
              err,
            );
          });
      } catch (err) {
        console.error("Error al procesar la grabación:", err);
        setState("error");
        setError("Error al procesar la grabación");
      }
    },
    [setState],
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

        screenStream.getVideoTracks()[0].addEventListener("ended", () => {
          if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") {
            stopRecording();
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
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    [options, processRecording, setElapsed, setState, stopAllStreams, stopRecording],
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

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setError(null);
    setState("idle");
    chunksRef.current = [];
  }, [previewUrl, setElapsed, setState]);

  const value: RecorderContextValue = {
    options,
    toggleOption,
    setQuality,
    error,
    result,
    previewUrl,
    cameraStream,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
  };

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}

export function useRecorder() {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error("useRecorder must be used within RecorderProvider");
  return ctx;
}
