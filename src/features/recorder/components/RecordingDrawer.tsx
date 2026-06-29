"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Monitor,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Circle,
  Pause,
  Play,
  Square,
  Download,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  X,
  FileVideo,
  ExternalLink,
  Trash2,
  UploadCloud,
  AlertCircle,
  Search,
  Pencil,
  HardDrive,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useRecordingStore } from "../store/recording-store";
import { useRecorder, formatDuration } from "../contexts/recorder-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  formatFechaEnZona,
  formatFechaHoraEnZona,
} from "@/features/empresa/lib/zona-horaria";

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

type DateBucket = "hoy" | "ayer" | "semana" | "antiguas";

function getDateBucket(iso: string): DateBucket {
  const now = new Date();
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - startOfDate) / 86_400_000);
  if (diffDays <= 0) return "hoy";
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return "semana";
  return "antiguas";
}

const BUCKET_LABEL: Record<DateBucket, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  antiguas: "Más antiguas",
};

const BUCKET_ORDER: DateBucket[] = ["hoy", "ayer", "semana", "antiguas"];

export function RecordingDrawer() {
  const { isDrawerOpen, setDrawerOpen, state } = useRecordingStore();
  const { reset } = useRecorder();

  function handleOpenChange(open: boolean) {
    if (!open && (state === "done" || state === "error")) {
      reset();
    }
    setDrawerOpen(open);
  }

  return (
    <Sheet open={isDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Grabadora de Pantalla</SheetTitle>

        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-2 rounded-lg relative",
                state === "recording" ? "bg-red-100 text-red-600 animate-pulse" : "bg-red-50 text-red-600"
              )}>
                <Monitor className="h-5 w-5" />
                <div className={cn(
                  "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white",
                  state === "recording" ? "bg-red-500" : "bg-red-500"
                )} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Grabación de pantalla</h3>
              </div>
            </div>

            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <RecordingContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecordingContent() {
  const { state } = useRecordingStore();
  const { empresaActual } = useEmpresa();
  const tz = empresaActual?.zonaHoraria ?? "";
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const {
    options,
    toggleOption,
    error,
    result,
    previewUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
  } = useRecorder();

  const { elapsed } = useRecordingStore();

  useEffect(() => {
    if (previewUrl && videoPreviewRef.current) {
      videoPreviewRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  async function handleCopyLink() {
    if (!result) return;
    const shareUrl = result.url.startsWith("blob:")
      ? result.url
      : `${window.location.origin}${result.url}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStart() {
    const recordTitle = title.trim() || `Grabación ${formatFechaHoraEnZona(new Date().toISOString(), tz)}`;
    startRecording(recordTitle);
  }

  if (state === "idle") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="space-y-2">
          <Label htmlFor="rec-title">Nombre de la grabación</Label>
          <Input
            id="rec-title"
            placeholder={`Grabación ${formatFechaEnZona(new Date().toISOString(), tz)}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Configuración</p>
          <div className="grid grid-cols-1 gap-3">
            <OptionToggle
              icon={Volume2}
              iconOff={VolumeX}
              label="Sonido"
              description="Captura el sonido de tu PC"
              enabled={options.includeSystemAudio}
              onToggle={() => toggleOption("includeSystemAudio")}
            />
            <OptionToggle
              icon={Mic}
              iconOff={MicOff}
              label="Micrófono"
              description="Tu voz mientras grabas"
              enabled={options.includeMic}
              onToggle={() => toggleOption("includeMic")}
            />
            <OptionToggle
              icon={Camera}
              iconOff={CameraOff}
              label="Cámara"
              description="Burbuja de cámara"
              enabled={options.includeCamera}
              onToggle={() => toggleOption("includeCamera")}
            />
          </div>
        </div>

        <Button
          onClick={handleStart}
          className="w-full gap-3 h-12 text-base font-semibold shadow-lg shadow-red-200 bg-red-600 hover:bg-red-700"
        >
          <Circle className="h-5 w-5 fill-white animate-pulse text-white" />
          Iniciar Grabación
        </Button>

        <RecordingsList />
      </div>
    );
  }

  if (state === "requesting") {
    return (
      <div className="py-20 text-center space-y-4 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
          <Monitor className="h-10 w-10 text-primary animate-bounce" />
        </div>
        <h3 className="text-xl font-bold">Esperando permiso</h3>
        <p className="text-sm text-muted-foreground px-4">
          Selecciona la pantalla o ventana que quieres capturar en el diálogo del navegador.
        </p>
      </div>
    );
  }

  if (state === "countdown") {
    return <CountdownView />;
  }

  if (state === "recording" || state === "paused") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Card className="border-red-100 bg-red-50/50 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {state === "recording" ? (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
                    <div className="w-3 h-3 bg-red-500 rounded-full relative" />
                    <Badge className="bg-red-100 text-red-600 border-red-200 hover:bg-red-100">
                      EN VIVO
                    </Badge>
                  </>
                ) : (
                  <Badge className="bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-100">
                    PAUSADO
                  </Badge>
                )}
              </div>
              <span className="font-mono text-3xl font-bold tabular-nums text-slate-800">
                {formatDuration(elapsed)}
              </span>
            </div>

            <p className="text-sm font-semibold text-slate-700 truncate mb-6">
              {title.trim() || "Grabación en curso..."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {state === "recording" ? (
                <Button
                  variant="outline"
                  className="gap-2 bg-white border-slate-200"
                  onClick={pauseRecording}
                >
                  <Pause className="h-4 w-4" />
                  Pausar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2 bg-white border-slate-200"
                  onClick={resumeRecording}
                >
                  <Play className="h-4 w-4" />
                  Continuar
                </Button>
              )}
              <Button
                variant="destructive"
                className="gap-2 shadow-lg shadow-red-200"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4" />
                Detener
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h3 className="text-xl font-bold">Procesando Video</h3>
        <p className="text-sm text-muted-foreground">
          Guardando tu grabación de {formatDuration(elapsed)}...
        </p>
      </div>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold">¡Listo!</h3>
          <p className="text-sm text-muted-foreground">Grabación completada con éxito</p>
        </div>

        {previewUrl && (
          <div className="rounded-xl overflow-hidden border bg-black aspect-video shadow-xl">
            <video
              ref={videoPreviewRef}
              controls
              className="w-full h-full"
              src={previewUrl}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <a href={result.url} download className="w-full">
            <Button variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </a>
          <Button
            variant={copied ? "secondary" : "outline"}
            className="w-full gap-2"
            onClick={handleCopyLink}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Link"}
          </Button>
        </div>

        <div className="pt-2 border-t">
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Grabar otro video
          </Button>
        </div>

        <RecordingsList />
      </div>
    );
  }

  if (state === "done" && !result) {
    return (
      <div className="space-y-6">
        <div className="py-8 text-center space-y-3">
          <h3 className="text-lg font-bold">Grabación anterior cerrada</h3>
          <p className="text-sm text-muted-foreground">
            Sigue disponible abajo en tus grabaciones guardadas.
          </p>
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Nueva grabación
          </Button>
        </div>
        <RecordingsList />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h3 className="text-xl font-bold">Error</h3>
        <p className="text-sm text-red-500">{error || "No se pudo iniciar la grabación"}</p>
        <Button variant="outline" onClick={reset}>Reintentar</Button>
      </div>
    );
  }

  return null;
}

function CountdownView() {
  const { countdownValue } = useRecordingStore();
  return (
    <div className="py-20 text-center space-y-4 animate-in fade-in duration-200">
      <div className="w-20 h-20 bg-red-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-red-200">
        <span className="text-4xl font-bold tabular-nums">{countdownValue}</span>
      </div>
      <h3 className="text-xl font-bold">Empezando en {countdownValue}…</h3>
      <p className="text-sm text-muted-foreground px-4">
        Prepárate. La grabación arranca en {countdownValue} segundo{countdownValue !== 1 ? "s" : ""}.
      </p>
    </div>
  );
}

function OptionToggle({
  icon: Icon,
  iconOff: IconOff,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: typeof Camera;
  iconOff: typeof CameraOff;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
        enabled
          ? "border-red-500 bg-red-50/50 ring-1 ring-red-500/20"
          : "border-border bg-background hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
        enabled ? "bg-red-600 text-white shadow-md shadow-red-200" : "bg-muted text-muted-foreground"
      )}>
        {enabled ? <Icon className="h-5 w-5" /> : <IconOff className="h-5 w-5" />}
      </div>
      <div>
        <p className={cn("text-sm font-semibold", !enabled && "text-muted-foreground")}>{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

interface SavedRecording {
  id: string;
  title: string;
  url: string;
  duration: number;
  file_size: number;
  created_at: string;
}

function RecordingsList() {
  const { empresaActual } = useEmpresa();
  const tz = empresaActual?.zonaHoraria ?? "";
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const { pendingCount } = useRecorder();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } =
    useConfirmDelete();

  useEffect(() => {
    let alive = true;
    fetch("/api/recordings")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (alive && Array.isArray(data)) setRecordings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [pendingCount]);

  useEffect(() => {
    let alive = true;
    fetch("/api/recordings/quota")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setQuota({ used: Number(data.bytes_used ?? 0), limit: Number(data.bytes_limit ?? 0) });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recordings.length, pendingCount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recordings;
    return recordings.filter((r) => r.title.toLowerCase().includes(q));
  }, [recordings, search]);

  const grouped = useMemo(() => {
    const map = new Map<DateBucket, SavedRecording[]>();
    for (const rec of filtered) {
      const bucket = getDateBucket(rec.created_at);
      const list = map.get(bucket) ?? [];
      list.push(rec);
      map.set(bucket, list);
    }
    return BUCKET_ORDER.flatMap((bucket) => {
      const list = map.get(bucket);
      return list && list.length > 0 ? [{ bucket, items: list }] : [];
    });
  }, [filtered]);

  async function handleDelete(id: string) {
    const ok = await confirmDelete({
      title: "¿Eliminar esta grabación?",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await fetch("/api/recordings", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRecordings((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleCopyLink(rec: SavedRecording) {
    try {
      await navigator.clipboard.writeText(rec.url);
      setCopiedId(rec.id);
      setTimeout(() => setCopiedId((id) => (id === rec.id ? null : id)), 1500);
    } catch {
      // clipboard puede fallar en http o iframes; ignoramos silenciosamente
    }
  }

  function startEdit(rec: SavedRecording) {
    setEditingId(rec.id);
    setEditingTitle(rec.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
  }

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    const current = recordings.find((r) => r.id === editingId);
    if (!current || current.title === trimmed) {
      cancelEdit();
      return;
    }
    setSavingRename(true);
    try {
      const res = await fetch("/api/recordings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, title: trimmed }),
      });
      if (res.ok) {
        setRecordings((prev) =>
          prev.map((r) => (r.id === editingId ? { ...r, title: trimmed } : r))
        );
      }
    } finally {
      setSavingRename(false);
      cancelEdit();
    }
  }, [editingId, editingTitle, recordings]);

  return (
    <div className="space-y-3 pt-4 border-t">
      <PendingUploadsList />

      {quota && quota.limit > 0 && <QuotaBar used={quota.used} limit={quota.limit} />}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Mis grabaciones</p>
        <span className="text-[11px] text-muted-foreground">{recordings.length}</span>
      </div>

      {recordings.length > 3 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <FileVideo className="h-6 w-6 text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground">Aún no hay grabaciones</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Search className="h-5 w-5 text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground">Sin resultados para “{search}”</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
          {grouped.map(({ bucket, items }) => (
            <div key={bucket} className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 px-1">
                {BUCKET_LABEL[bucket]}
              </p>
              {items.map((rec) => {
                const isEditing = editingId === rec.id;
                const isCopied = copiedId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <FileVideo className="h-4 w-4" />
                    </div>

                    {isEditing ? (
                      <div className="flex-1 min-w-0">
                        <Input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          disabled={savingRename}
                          className="h-7 text-xs"
                        />
                      </div>
                    ) : (
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 group"
                        title={rec.title}
                      >
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                          {rec.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFechaEnZona(rec.created_at, tz)} ·{" "}
                          {formatDuration(rec.duration)} · {formatBytes(rec.file_size)}
                        </p>
                      </a>
                    )}

                    {!isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(rec)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                          title="Renombrar"
                          aria-label="Renombrar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(rec)}
                          className={cn(
                            "p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary",
                            isCopied && "text-green-600"
                          )}
                          title={isCopied ? "Copiado" : "Copiar enlace"}
                          aria-label="Copiar enlace"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a
                          href={rec.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                          title="Abrir"
                          aria-label="Abrir"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={rec.url}
                          download={`${rec.title}.webm`}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                          title="Descargar"
                          aria-label="Descargar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {confirmDeleteDialog}
    </div>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone =
    pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const textTone =
    pct >= 95 ? "text-red-600" : pct >= 80 ? "text-amber-700" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-[11px] font-medium text-muted-foreground truncate">
            Almacenamiento beta
          </p>
        </div>
        <p className={cn("text-[11px] font-semibold tabular-nums", textTone)}>
          {formatBytes(used)} / {formatBytes(limit)}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PendingUploadsList() {
  const { refreshPending, retryPending, retryAllPending, deletePending, pendingCount } =
    useRecorder();
  const [pending, setPending] = useState<
    Array<{
      id: string;
      title: string;
      blob: Blob;
      duration: number;
      fileSize: number;
      createdAt: number;
      retryCount: number;
      lastError?: string;
    }>
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } =
    useConfirmDelete();

  useEffect(() => {
    let alive = true;
    refreshPending().then((list) => {
      if (alive) setPending(list);
    });
    return () => {
      alive = false;
    };
  }, [refreshPending, pendingCount]);

  // Memo de blob URLs con cleanup para no fugar memoria entre renders
  const blobUrls = useMemo(() => {
    const map = new Map<string, string>();
    pending.forEach((p) => map.set(p.id, URL.createObjectURL(p.blob)));
    return map;
  }, [pending]);

  useEffect(() => {
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [blobUrls]);

  if (pending.length === 0) return null;

  async function handleRetry(id: string) {
    setBusyId(id);
    await retryPending(id);
    setBusyId(null);
  }

  async function handleRetryAll() {
    setRetryingAll(true);
    await retryAllPending();
    setRetryingAll(false);
  }

  async function handleDelete(id: string) {
    const ok = await confirmDelete({
      title: "¿Eliminar esta grabación local?",
      description: "No se podrá recuperar.",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    await deletePending(id);
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800 truncate">
            Pendientes de subida · {pending.length}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 border-amber-300 bg-white hover:bg-amber-100"
          onClick={handleRetryAll}
          disabled={retryingAll}
        >
          {retryingAll ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UploadCloud className="h-3 w-3" />
          )}
          Subir todo
        </Button>
      </div>

      <p className="text-[10px] text-amber-700/80 leading-snug">
        Estas grabaciones están guardadas en tu navegador. Se subirán automáticamente cuando vuelva
        la conexión, o puedes reintentarlo ahora.
      </p>

      <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
        {pending.map((rec) => {
          const localUrl = blobUrls.get(rec.id) ?? "";
          const isBusy = busyId === rec.id || retryingAll;
          return (
            <div
              key={rec.id}
              className="flex items-center gap-2 p-2 rounded-md border border-amber-200/80 bg-white"
            >
              <div className="w-8 h-8 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FileVideo className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" title={rec.title}>
                  {rec.title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDuration(rec.duration)} ·{" "}
                  {(rec.fileSize / (1024 * 1024)).toFixed(1)} MB
                  {rec.retryCount > 0 ? ` · ${rec.retryCount} intentos` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRetry(rec.id)}
                disabled={isBusy}
                className="p-1.5 rounded hover:bg-amber-100 text-amber-700 disabled:opacity-50"
                title="Reintentar subida"
                aria-label="Reintentar subida"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
              </button>
              <a
                href={localUrl}
                download={`${rec.title}.webm`}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                title="Descargar"
                aria-label="Descargar"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(rec.id)}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Eliminar local"
                aria-label="Eliminar local"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {confirmDeleteDialog}
    </div>
  );
}
