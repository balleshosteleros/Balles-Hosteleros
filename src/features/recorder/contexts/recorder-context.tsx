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
import { useAuth } from "@/features/auth/contexts/auth-context";
import {
  addPending,
  listPending,
  markRetryFailure,
  removePending,
  type PendingRecording,
} from "../lib/pending-storage";
import fixWebmDuration from "fix-webm-duration";

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
  /** Grabaciones nuevas (visibles para mi rol) que aún no he abierto. */
  newCount: number;
  /** Marca todas como vistas (oculta el badge de nuevas). */
  markRecordingsSeen: () => void;
  /** Departamentos (canónicos) a los que el usuario tiene acceso. */
  departamentos: string[];
  /** Departamento elegido para guardar la próxima grabación. */
  selectedDepartamento: string | null;
  setSelectedDepartamento: (dep: string | null) => void;
  /** Recarga los departamentos accesibles según el rol vigente. */
  refreshDepartamentos: () => Promise<string[]>;
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

function seenKey(userId: string | undefined) {
  return `bh_recordings_seen_${userId ?? "anon"}`;
}

export function RecorderProvider({ children }: { children: ReactNode }) {
  const { setState, setElapsed, setCountdownValue } = useRecordingStore();
  const isDrawerOpen = useRecordingStore((s) => s.isDrawerOpen);
  const { user } = useAuth();
  const [newCount, setNewCount] = useState<number>(0);
  const [options, setOptions] = useState<RecordOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [displaySurface, setDisplaySurface] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [selectedDepartamento, setSelectedDepartamento] = useState<string | null>(null);
  const selectedDepartamentoRef = useRef<string | null>(null);

  useEffect(() => {
    selectedDepartamentoRef.current = selectedDepartamento;
  }, [selectedDepartamento]);

  // Recarga los departamentos accesibles según el ROL VIGENTE. Se llama al
  // montar y cada vez que se abre el drawer, para que — si el rol del usuario
  // cambia — las carpetas visibles y las opciones de guardado se actualicen
  // sin depender de un F5. Depura la selección si el depto elegido ya no existe.
  const refreshDepartamentos = useCallback(async (): Promise<string[]> => {
    try {
      const res = await fetch("/api/recordings/departamentos", { cache: "no-store" });
      const data = res.ok ? await res.json() : { departamentos: [] };
      const list: string[] = Array.isArray(data?.departamentos) ? data.departamentos : [];
      setDepartamentos(list);
      setSelectedDepartamento((prev) => {
        if (list.length === 1) return list[0]; // uno solo → auto
        if (prev && !list.includes(prev)) return null; // el elegido ya no es accesible
        return prev;
      });
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    refreshDepartamentos();
  }, [refreshDepartamentos]);

  // Al abrir el drawer, recargar por si el rol cambió desde la última vez.
  useEffect(() => {
    if (isDrawerOpen) refreshDepartamentos();
  }, [isDrawerOpen, refreshDepartamentos]);

  // ── Badge de grabaciones NUEVAS ────────────────────────────────────────
  // Cuenta las grabaciones visibles para MI rol (/api/recordings ya filtra por
  // RLS: solo mis departamentos) creadas después de la última vez que abrí el
  // panel. El timestamp "visto" se guarda por usuario en localStorage.
  const refreshNewCount = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/recordings", { cache: "no-store" });
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list)) return;
      let seenRaw = window.localStorage.getItem(seenKey(user?.id));
      if (!seenRaw) {
        // Primer uso: nada es "nuevo" retroactivamente. Fijamos "visto" a ahora.
        window.localStorage.setItem(seenKey(user?.id), String(Date.now()));
        seenRaw = String(Date.now());
      }
      const seenTs = Number(seenRaw);
      const nuevas = list.filter(
        (r: { created_at?: string }) =>
          r.created_at && new Date(r.created_at).getTime() > seenTs,
      ).length;
      setNewCount(nuevas);
    } catch {
      /* silencioso */
    }
  }, [user?.id]);

  const markRecordingsSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(seenKey(user?.id), String(Date.now()));
    setNewCount(0);
  }, [user?.id]);

  // Recalcular al montar y cada 60 s (para reflejar grabaciones de otros).
  useEffect(() => {
    refreshNewCount();
    const iv = setInterval(refreshNewCount, 60_000);
    return () => clearInterval(iv);
  }, [refreshNewCount]);

  // Al abrir el panel, marcar todo como visto → el badge desaparece.
  useEffect(() => {
    if (isDrawerOpen) markRecordingsSeen();
  }, [isDrawerOpen, markRecordingsSeen]);

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
  // Composición cámara-en-pantalla: cuando hay cámara activa, dibujamos pantalla
  // + burbuja de cámara en un canvas y grabamos ese canvas, para que la cámara
  // quede INCRUSTADA en el vídeo aunque grabes otra ventana o toda la pantalla.
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const compositeRafRef = useRef<number | null>(null);

  const stopCompositing = useCallback(() => {
    if (compositeRafRef.current != null) {
      cancelAnimationFrame(compositeRafRef.current);
      compositeRafRef.current = null;
    }
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;
  }, []);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  const stopAllStreams = useCallback(() => {
    stopCompositing();
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
  }, [stopCompositing]);

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
      const mimeType = blob.type || "video/webm";

      // Camino preferido: subida directa a R2 con URL firmada. Sube el vídeo sin
      // pasar por la función serverless, evitando el límite de ~4.5 MB del body
      // de Vercel que hacía fallar las grabaciones aunque hubiera conexión.
      // Requiere CORS PUT habilitado en el bucket R2. Si falla (p. ej. CORS aún
      // no aplicado), cae al camino FormData legado más abajo.
      const departamento = selectedDepartamentoRef.current ?? undefined;

      async function tryDirectUpload(): Promise<{ id: string; url: string; duration: number; file_size: number } | null> {
        const presignRes = await fetch("/api/recordings/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileSize: blob.size, mimeType, departamento }),
        });
        if (!presignRes.ok) {
          // 413 = cuota llena → error real, no reintentar por FormData.
          const text = await presignRes.text().catch(() => "");
          throw new Error(`presign HTTP ${presignRes.status} ${text.slice(0, 200)}`);
        }
        const { uploadUrl, r2Key, fileId, departamento: depConfirmado } = await presignRes.json();
        if (!uploadUrl || !r2Key) return null;

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        if (!putRes.ok) return null; // p. ej. CORS o firma rechazada → fallback

        const res = await fetch("/api/recordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            r2Key,
            fileId,
            title,
            duration,
            fileSize: blob.size,
            mimeType,
            departamento: depConfirmado ?? departamento,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`registro HTTP ${res.status} ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        if (!data?.id) throw new Error("Respuesta sin id");
        return data;
      }

      // Fallback legado: el archivo viaja por el servidor (limitado a ~4.5 MB en Vercel).
      async function legacyFormDataUpload() {
        const formData = new FormData();
        formData.append("file", blob, `${title}.webm`);
        formData.append("title", title);
        formData.append("duration", duration.toString());
        formData.append("mimeType", mimeType);
        const res = await fetch("/api/recordings", { method: "POST", body: formData });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        if (!data?.id) throw new Error("Respuesta sin id");
        return data;
      }

      try {
        const data = (await tryDirectUpload()) ?? (await legacyFormDataUpload());
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
        const duration =
          elapsedRef.current || Math.floor((Date.now() - startTimeRef.current) / 1000);
        // MediaRecorder no escribe el elemento Duration en los WebM que genera.
        // Sin él, Chromium recalcula la duración durante la reproducción y la
        // barra nativa puede saltar o parpadear. Reparamos el contenedor antes
        // de previsualizarlo, persistirlo o subirlo.
        let playableBlob = blob;
        if (blob.type.toLowerCase().startsWith("video/webm")) {
          try {
            playableBlob = await fixWebmDuration(
              blob,
              Math.max(duration, 1) * 1000,
              { logger: false },
            );
          } catch (err) {
            // La grabación sigue siendo reproducible aunque un navegador genere
            // una variante WebM que la librería no pueda reescribir.
            console.warn("[recorder] no se pudo fijar la duración WebM:", err);
          }
        }

        const url = URL.createObjectURL(playableBlob);
        setPreviewUrl(url);

        const pendingId =
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

        const localResult: RecordingResult = {
          videoId: pendingId,
          url,
          duration,
          fileSize: playableBlob.size,
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
            blob: playableBlob,
            mimeType: playableBlob.type,
            duration,
            fileSize: playableBlob.size,
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
        const data = await uploadBlob(pendingId, playableBlob, title, duration);
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

  // Dibuja pantalla + burbuja de cámara (círculo, esquina inf. derecha) en un
  // canvas a 30 fps y devuelve la pista de vídeo del canvas. Así la cámara queda
  // SIEMPRE incrustada en el vídeo, sin depender de qué ventana se comparta.
  const buildCompositeVideoTracks = useCallback(
    async (
      screenStream: MediaStream,
      cameraStream: MediaStream,
      screenSettings: MediaTrackSettings,
    ): Promise<MediaStreamTrack[]> => {
      const width = screenSettings.width ?? 1920;
      const height = screenSettings.height ?? 1080;
      const fps = screenSettings.frameRate ?? 30;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return screenStream.getVideoTracks(); // fallback: sin composición

      const screenVideo = document.createElement("video");
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      screenVideo.playsInline = true;
      screenVideo.play().catch(() => {});

      const camVideo = document.createElement("video");
      camVideo.srcObject = cameraStream;
      camVideo.muted = true;
      camVideo.playsInline = true;
      camVideo.play().catch(() => {});

      // Esperar a que la pantalla tenga fotogramas reales antes de capturar el
      // canvas: si captureStream() arranca sobre un lienzo en blanco, el primer
      // keyframe se codifica vacío y el vídeo resultante sale negro.
      await new Promise<void>((resolve) => {
        if (screenVideo.readyState >= 2) return resolve();
        const done = () => resolve();
        screenVideo.addEventListener("loadeddata", done, { once: true });
        setTimeout(done, 3000); // tope de seguridad: nunca bloquear la grabación
      });

      // Burbuja circular ~ 22% del alto, en la esquina inferior derecha.
      const bubble = Math.round(height * 0.22);
      const margin = Math.round(height * 0.03);

      const draw = () => {
        // Pantalla de fondo (cubre todo el lienzo).
        if (screenVideo.readyState >= 2) {
          ctx.drawImage(screenVideo, 0, 0, width, height);
        }
        // Cámara: recorte circular espejado, con borde rojo.
        if (camVideo.readyState >= 2) {
          const cx = width - margin - bubble / 2;
          const cy = height - margin - bubble / 2;
          const r = bubble / 2;

          // Recorte del vídeo de cámara a un cuadrado central (object-cover).
          const cw = camVideo.videoWidth || 640;
          const ch = camVideo.videoHeight || 480;
          const side = Math.min(cw, ch);
          const sx = (cw - side) / 2;
          const sy = (ch - side) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          // Espejo horizontal para que se vea como un selfie.
          ctx.translate(cx + r, cy - r);
          ctx.scale(-1, 1);
          ctx.drawImage(camVideo, sx, sy, side, side, 0, 0, bubble, bubble);
          ctx.restore();

          // Anillo rojo alrededor de la burbuja.
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(3, Math.round(height * 0.004));
          ctx.strokeStyle = "#ef4444";
          ctx.stroke();
          ctx.restore();
        }
        compositeRafRef.current = requestAnimationFrame(draw);
      };
      draw();

      // Un fotograma ya pintado en el lienzo antes de exponerlo como pista.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const canvasStream = canvas.captureStream(fps);
      canvasStreamRef.current = canvasStream;
      return canvasStream.getVideoTracks();
    },
    [],
  );

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

        // ── Pista de VÍDEO ────────────────────────────────────────────────
        // Con cámara activa: componemos pantalla + burbuja de cámara en un
        // canvas y grabamos ESE canvas, para que la cámara quede incrustada en
        // el vídeo grabes lo que grabes. Sin cámara: la pantalla directa.
        let videoTracks: MediaStreamTrack[];
        if (cameraStreamRef.current) {
          videoTracks = await buildCompositeVideoTracks(
            screenStream,
            cameraStreamRef.current,
            trackSettings,
          );
        } else {
          videoTracks = screenStream.getVideoTracks();
        }

        if (videoTracks.length === 0) {
          throw new Error(
            "No se obtuvo la imagen de la pantalla. Vuelve a intentarlo y elige la pantalla o ventana en el diálogo del navegador.",
          );
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
            ...videoTracks,
            ...destination.stream.getAudioTracks(),
          ]);
        } else {
          finalStream = new MediaStream([...videoTracks]);
        }

        const mimeType = getSupportedMimeType();

        // Countdown 3..2..1 ANTES de construir el MediaRecorder. Si se crea antes
        // y se arranca después, la pista de vídeo lleva segundos sin consumidor:
        // el navegador la congela y el primer fragmento sale sin keyframe, con lo
        // que el WebM queda con audio pero sin imagen. Construir y arrancar
        // seguidos garantiza que el codificador reciba un keyframe inicial.
        countdownCancelRef.current = false;
        setState("countdown");
        for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
          if (countdownCancelRef.current) return;
          setCountdownValue(n);
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (countdownCancelRef.current) return;
        setCountdownValue(0);

        // La pista debe estar viva justo antes de grabar. Si el usuario detuvo
        // el share durante la cuenta atrás, abortamos sin crear el recorder.
        if (videoTracks.length === 0 || videoTracks[0].readyState !== "live") {
          stopAllStreams();
          setState("idle");
          return;
        }

        const recorder = new MediaRecorder(finalStream, {
          mimeType,
          // Ambos bitrates explícitos: si solo se fija el de vídeo, Chrome trata
          // el valor como presupuesto global y puede dejar la pista de vídeo sin
          // asignación real, produciendo un archivo con solo audio.
          videoBitsPerSecond: options.quality === "1080p" ? 5_000_000 : 2_500_000,
          audioBitsPerSecond: 128_000,
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
    [options, processRecording, setCountdownValue, setElapsed, setState, stopAllStreams, stopRecording, buildCompositeVideoTracks],
  );

  // Nada de avisos del navegador al cerrar: las grabaciones pendientes viven en
  // IndexedDB y sobreviven al cierre, y el contador de pendientes ya se ve en el
  // botón de grabación y en el panel, que es donde se reintenta la subida.

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
    newCount,
    markRecordingsSeen,
    departamentos,
    selectedDepartamento,
    setSelectedDepartamento,
    refreshDepartamentos,
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
