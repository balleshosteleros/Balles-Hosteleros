"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped" | "uploading" | "done" | "error";

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

const DEFAULT_OPTIONS: RecordOptions = {
  includeSystemAudio: true,
  includeMic: true,
  includeCamera: false,
  quality: "1080p",
};

export function useScreenRecorder(options: RecordOptions = DEFAULT_OPTIONS) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  function stopAllStreams() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    micStreamRef.current = null;
    cameraStreamRef.current = null;
  }

  const startRecording = useCallback(async (title: string) => {
    setError(null);
    setState("requesting");
    chunksRef.current = [];

    try {
      // 1. Screen capture
      const videoConstraints: MediaTrackConstraints =
        options.quality === "1080p"
          ? { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: options.includeSystemAudio,
      });
      screenStreamRef.current = screenStream;

      // Stop recording automatically when user stops sharing
      screenStream.getVideoTracks()[0].addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      });

      // 2. Mic audio (optional)
      let micStream: MediaStream | null = null;
      if (options.includeMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          micStreamRef.current = micStream;
        } catch {
          // mic permission denied is non-fatal
        }
      }

      // 3. Camera (optional)
      let cameraStream: MediaStream | null = null;
      if (options.includeCamera) {
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          cameraStreamRef.current = cameraStream;
        } catch {
          // camera permission denied is non-fatal
        }
      }

      // 4. Combine audio tracks
      const audioTracks: MediaStreamTrack[] = [];
      if (options.includeSystemAudio && screenStream.getAudioTracks().length > 0) {
        audioTracks.push(...screenStream.getAudioTracks());
      }
      if (micStream) {
        audioTracks.push(...micStream.getAudioTracks());
      }

      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...audioTracks,
      ]);

      // 5. Setup MediaRecorder
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: options.quality === "1080p" ? 5_000_000 : 2_500_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState("uploading");
        await uploadRecording(blob, title);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect chunks every 1s

      // 6. Start timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
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
  }, [options]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setState("paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
      setState("recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopAllStreams();
    setState("stopped");
  }, []);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setElapsed(0);
    setError(null);
    setState("idle");
    chunksRef.current = [];
  }, [previewUrl]);

  async function uploadRecording(blob: Blob, title: string) {
    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      formData.append("title", title);
      formData.append("duration", String(elapsed || Math.floor((Date.now() - startTimeRef.current) / 1000)));
      formData.append("mimeType", blob.type);

      const res = await fetch("/api/recordings", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar la grabación");
      }

      const data = await res.json();
      setResult(data);
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Error al subir la grabación");
    }
  }

  return {
    state,
    elapsed,
    error,
    result,
    previewUrl,
    cameraStream: cameraStreamRef.current,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
  };
}

function getSupportedMimeType(): string {
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
