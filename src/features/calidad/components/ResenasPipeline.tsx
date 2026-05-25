"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import {
  actualizarResena,
  buscarPlaceCustom,
  detectarPlaceIdEmpresa,
  eliminarResena,
  getEmpresaPlaceInfo,
  listResenas,
  moverResena,
  setEmpresaPlaceId,
  syncResenasGoogle,
  type EmpresaPlaceInfo,
} from "@/features/calidad/actions/resenas-actions";
import {
  desmarcarComoPublicada,
  generarBorradorResena,
  marcarComoPublicada,
} from "@/features/calidad/actions/agentes-ia-actions";
import {
  ESTADOS_RESENA,
  ORIGEN_LABEL,
  type EstadoResena,
  type Resena,
} from "@/features/calidad/types/resenas";
import { AgentesIAView } from "./AgentesIAView";

// ─── Filtro de período ────────────────────────────────────────
type PeriodoResenas = "todo" | "semana" | "mes" | "personalizado";

const PERIODOS: { id: PeriodoResenas; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "semana", label: "Semanal" },
  { id: "mes", label: "Mensual" },
  { id: "personalizado", label: "Personalizado" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function rangoFromPeriodo(
  periodo: PeriodoResenas,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  const today = todayIso();
  switch (periodo) {
    case "todo":
      return { from: null, to: null };
    case "semana":
      return { from: shiftIso(today, -6), to: today };
    case "mes":
      return { from: shiftIso(today, -29), to: today };
    case "personalizado":
      return { from: customFrom || null, to: customTo || null };
  }
}

export function ResenasPipeline() {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [info, setInfo] = useState<EmpresaPlaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoResenas>("todo");
  const [customFrom, setCustomFrom] = useState<string>(shiftIso(todayIso(), -6));
  const [customTo, setCustomTo] = useState<string>(todayIso());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [candidatePlace, setCandidatePlace] = useState<{
    placeId: string;
    name: string;
    address: string;
  } | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [agentesOpen, setAgentesOpen] = useState(false);
  const [detalleResena, setDetalleResena] = useState<Resena | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [data, place] = await Promise.all([
      listResenas(),
      getEmpresaPlaceInfo(),
    ]);
    setResenas(data);
    setInfo(place);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ─── Filtrado por búsqueda + período ─────────────────────────
  const rango = useMemo(
    () => rangoFromPeriodo(periodo, customFrom, customTo),
    [periodo, customFrom, customTo],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return resenas.filter((r) => {
      if (q) {
        const match =
          r.nombre_comensal.toLowerCase().includes(q) ||
          (r.comentario ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.telefono ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (rango.from || rango.to) {
        const fecha = (r.fecha_reseña ?? r.created_at ?? "").slice(0, 10);
        if (!fecha) return false;
        if (rango.from && fecha < rango.from) return false;
        if (rango.to && fecha > rango.to) return false;
      }
      return true;
    });
  }, [resenas, busqueda, rango]);

  const porEstado = useMemo(() => {
    const map = new Map<EstadoResena, Resena[]>();
    for (const e of ESTADOS_RESENA) map.set(e.key, []);
    for (const r of filtradas) {
      const col = map.get(r.estado);
      if (col) col.push(r);
    }
    return map;
  }, [filtradas]);

  // ─── Drag & drop ──────────────────────────────────────────────
  const onDragStart = (id: string) => setDraggingId(id);
  const onDragEnd = () => setDraggingId(null);

  const onDrop = async (estado: EstadoResena) => {
    if (!draggingId) return;
    const r = resenas.find((x) => x.id === draggingId);
    if (!r || r.estado === estado) {
      setDraggingId(null);
      return;
    }
    // Optimista
    setResenas((prev) =>
      prev.map((x) => (x.id === draggingId ? { ...x, estado } : x)),
    );
    setDraggingId(null);
    const res = await moverResena(r.id, estado);
    if (!res.ok) {
      toast.error("No se pudo mover la reseña");
      cargar();
    }
  };

  // ─── Sync Google ──────────────────────────────────────────────
  const onSync = async () => {
    setSyncing(true);
    const res = await syncResenasGoogle();
    setSyncing(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        MISSING_GOOGLE_MAPS_API_KEY:
          "Falta GOOGLE_MAPS_API_KEY en el servidor. Pídeselo al admin.",
        EMPRESA_SIN_PLACE_ID:
          "La empresa no tiene un ID de Google vinculado todavía.",
        PLACE_NO_ENCONTRADO: "Google no encontró este local.",
      };
      toast.error(map[res.error ?? ""] ?? `Error: ${res.error}`);
      return;
    }
    toast.success(
      `Sincronizado: ${res.insertadas} nuevas, ${res.actualizadas} actualizadas (${res.total} en Google)`,
    );
    cargar();
  };

  const onDetectar = async () => {
    setDetecting(true);
    const res = await detectarPlaceIdEmpresa();
    setDetecting(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        MISSING_GOOGLE_MAPS_API_KEY:
          "Falta GOOGLE_MAPS_API_KEY en el servidor.",
      };
      toast.error(map[res.error] ?? res.error);
      return;
    }
    setCandidatePlace(res.candidate);
  };

  const onConfirmarPlace = async () => {
    if (!candidatePlace) return;
    const res = await setEmpresaPlaceId(candidatePlace.placeId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Local vinculado con Google");
    setCandidatePlace(null);
    setManualMode(false);
    cargar();
  };

  const onDescartar = () => {
    setCandidatePlace(null);
    setManualMode(true);
  };

  const onBuscarManual = async (query: string) => {
    const res = await buscarPlaceCustom(query);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCandidatePlace(res.candidate);
  };

  const onPegarPlaceId = async (placeId: string) => {
    const clean = placeId.trim();
    if (!clean) {
      toast.error("Pega un Place ID");
      return;
    }
    const res = await setEmpresaPlaceId(clean);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Place ID guardado");
    setManualMode(false);
    cargar();
  };

  const onDesvincular = async () => {
    const res = await setEmpresaPlaceId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Vinculación eliminada");
    setManualMode(false);
    cargar();
  };

  // ─── Render ───────────────────────────────────────────────────
  const sinApiKey = info ? !info.googleApiKeyConfigured : false;
  const sinPlaceId = info ? !info.googlePlaceId : false;

  const necesitaAtencion = sinApiKey || sinPlaceId || !!candidatePlace || manualMode;

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar comensal o comentario"
        ocultarNuevo
        extraDerecha={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={onSync}
              disabled={syncing || sinApiKey || sinPlaceId}
              title={
                sinApiKey
                  ? "Configura GOOGLE_MAPS_API_KEY en el servidor"
                  : sinPlaceId
                    ? "Primero vincula la empresa con Google (Ajustes)"
                    : "Traer reseñas de Google"
              }
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Google
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 relative"
                  title="Configuración de reseñas"
                  aria-label="Configuración de reseñas"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                  {necesitaAtencion && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3 space-y-3" align="end">
                <GoogleBanner
                  info={info}
                  candidate={candidatePlace}
                  detecting={detecting}
                  manualMode={manualMode}
                  onDetectar={onDetectar}
                  onConfirmar={onConfirmarPlace}
                  onDescartar={onDescartar}
                  onBuscarManual={onBuscarManual}
                  onPegarPlaceId={onPegarPlaceId}
                  onSalirManual={() => setManualMode(false)}
                  onDesvincular={onDesvincular}
                />
                <div className="border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-9"
                    onClick={() => setAgentesOpen(true)}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Configurar agentes de IA
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Agentes que generan borradores de respuesta según las
                    estrellas de la reseña.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      />

      <FiltroPeriodo
        periodo={periodo}
        customFrom={customFrom}
        customTo={customTo}
        onPeriodoChange={setPeriodo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {ESTADOS_RESENA.map((col) => (
          <KanbanColumna
            key={col.key}
            label={col.label}
            accent={col.accent}
            badge={col.badge}
            resenas={porEstado.get(col.key) ?? []}
            draggingId={draggingId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={() => onDrop(col.key)}
            onCardClick={(r) => setDetalleResena(r)}
            loading={loading}
          />
        ))}
      </div>

      <Dialog open={agentesOpen} onOpenChange={setAgentesOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agentes de IA</DialogTitle>
            <DialogDescription>
              Configura los agentes que generan borradores de respuesta a las
              reseñas.
            </DialogDescription>
          </DialogHeader>
          <AgentesIAView />
        </DialogContent>
      </Dialog>

      <DetalleResenaDialog
        resena={detalleResena}
        onClose={() => setDetalleResena(null)}
        onSaved={cargar}
      />
    </div>
  );
}

// ─── Filtro de período ────────────────────────────────────────

function FiltroPeriodo({
  periodo,
  customFrom,
  customTo,
  onPeriodoChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  periodo: PeriodoResenas;
  customFrom: string;
  customTo: string;
  onPeriodoChange: (p: PeriodoResenas) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PERIODOS.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={periodo === p.id ? "default" : "outline"}
          onClick={() => onPeriodoChange(p.id)}
          className={cn("h-9 text-xs", periodo === p.id && "shadow-sm")}
        >
          {p.label}
        </Button>
      ))}
      {periodo === "personalizado" && (
        <div className="flex items-center gap-1.5 ml-1">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="h-9 w-[140px] text-xs"
            aria-label="Desde"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="h-9 w-[140px] text-xs"
            aria-label="Hasta"
          />
        </div>
      )}
    </div>
  );
}

// ─── Banner Google ────────────────────────────────────────────

function GoogleBanner({
  info,
  candidate,
  detecting,
  manualMode,
  onDetectar,
  onConfirmar,
  onDescartar,
  onBuscarManual,
  onPegarPlaceId,
  onSalirManual,
  onDesvincular,
}: {
  info: EmpresaPlaceInfo | null;
  candidate: { placeId: string; name: string; address: string } | null;
  detecting: boolean;
  manualMode: boolean;
  onDetectar: () => void;
  onConfirmar: () => void;
  onDescartar: () => void;
  onBuscarManual: (query: string) => Promise<void>;
  onPegarPlaceId: (placeId: string) => Promise<void>;
  onSalirManual: () => void;
  onDesvincular: () => void;
}) {
  if (!info) return null;

  if (!info.googleApiKeyConfigured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium text-amber-900">
            Falta configurar la API key de Google Maps
          </div>
          <div className="text-amber-800 text-xs mt-0.5">
            El servidor no tiene <code>GOOGLE_MAPS_API_KEY</code>. Hasta que se
            configure, no se pueden traer reseñas de Google.
          </div>
        </div>
      </div>
    );
  }

  if (candidate) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
        <div className="flex items-start gap-3">
          <Check className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-sky-900">
              ¿Es este el local correcto?
            </div>
            <div className="text-sky-800 text-xs mt-0.5">
              <span className="font-medium">{candidate.name}</span>
              {" · "}
              {candidate.address}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onDescartar}>
              No es este
            </Button>
            <Button size="sm" onClick={onConfirmar}>
              Sí, vincular
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (manualMode) {
    return (
      <ManualLinkPanel
        defaultQuery={info.nombre}
        onBuscar={onBuscarManual}
        onPegar={onPegarPlaceId}
        onCancelar={onSalirManual}
      />
    );
  }

  if (!info.googlePlaceId) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 text-sm flex items-center gap-3">
        <div className="flex-1">
          <div className="font-medium">
            Vincula esta empresa con su ficha de Google
          </div>
          <div className="text-muted-foreground text-xs mt-0.5">
            Detectaré el local automáticamente usando el nombre y la dirección
            que ya tiene en Ajustes.
          </div>
        </div>
        <Button size="sm" onClick={onDetectar} disabled={detecting}>
          {detecting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
          Vincular con Google
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card px-4 py-2 text-xs flex items-center gap-3 text-muted-foreground">
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      <span>
        Vinculado con Google ·{" "}
        <code className="text-foreground">{info.googlePlaceId.slice(0, 24)}…</code>
      </span>
      <button
        type="button"
        onClick={onDesvincular}
        className="ml-auto text-xs underline hover:text-foreground"
      >
        Desvincular
      </button>
    </div>
  );
}

function ManualLinkPanel({
  defaultQuery,
  onBuscar,
  onPegar,
  onCancelar,
}: {
  defaultQuery: string;
  onBuscar: (q: string) => Promise<void>;
  onPegar: (id: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [query, setQuery] = useState(`Restaurante ${defaultQuery} Madrid`);
  const [placeId, setPlaceId] = useState("");
  const [busy, setBusy] = useState(false);

  const handleBuscar = async () => {
    setBusy(true);
    await onBuscar(query);
    setBusy(false);
  };

  const handlePegar = async () => {
    setBusy(true);
    await onPegar(placeId);
    setBusy(false);
  };

  return (
    <div className="rounded-lg border bg-card px-4 py-3 text-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Vincular manualmente</div>
        <button
          type="button"
          onClick={onCancelar}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          Opción 1 · Buscar en Google con texto libre
        </Label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Ej. "Restaurante Habana Madrid Leganés"'
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBuscar();
            }}
          />
          <Button size="sm" onClick={handleBuscar} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Buscar
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          Opción 2 · Pegar el Place ID directamente
        </Label>
        <div className="flex gap-2">
          <Input
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="Ej. ChIJN1t_tDeuEmsRUsoyG83frY4"
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePegar();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handlePegar}
            disabled={busy}
          >
            Guardar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ¿Cómo conseguir el Place ID? Busca tu local en{" "}
          <a
            href="https://developers.google.com/maps/documentation/places/web-service/place-id"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            esta herramienta de Google
          </a>{" "}
          y copia el código que empieza por <code>ChIJ…</code>
        </p>
      </div>
    </div>
  );
}

// ─── Columna kanban ───────────────────────────────────────────

function KanbanColumna({
  label,
  accent,
  badge,
  resenas,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onCardClick,
  loading,
}: {
  label: string;
  accent: string;
  badge: string;
  resenas: Resena[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onCardClick: (r: Resena) => void;
  loading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop();
      }}
      className={`flex flex-col rounded-lg border bg-card border-t-4 ${accent} transition-colors ${
        dragOver ? "ring-2 ring-primary/30 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="font-medium text-sm">{label}</div>
        <Badge variant="secondary" className={`text-[10px] h-5 px-2 ${badge}`}>
          {resenas.length}
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-340px)] min-h-[300px]">
        <div className="p-2 space-y-2">
          {loading && resenas.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Cargando…
            </div>
          )}
          {!loading && resenas.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground/60">
              Vacío
            </div>
          )}
          {resenas.map((r) => (
            <ResenaCard
              key={r.id}
              resena={r}
              isDragging={draggingId === r.id}
              onDragStart={() => onDragStart(r.id)}
              onDragEnd={onDragEnd}
              onClick={() => onCardClick(r)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Tarjeta ──────────────────────────────────────────────────

function ResenaCard({
  resena,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  resena: Resena;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-background border rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {resena.autor_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resena.autor_avatar}
            alt={resena.nombre_comensal}
            className="h-7 w-7 rounded-full shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
            {resena.nombre_comensal.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-xs truncate min-w-0 flex-1">
              {resena.nombre_comensal}
            </span>
            {resena.origen === "google" && (
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-100 px-1 py-px rounded">
                Google
              </span>
            )}
          </div>
          {resena.rating ? (
            <div className="flex items-center gap-0.5 mt-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < (resena.rating ?? 0)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          ) : null}
          {resena.comentario && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">
              {resena.comentario}
            </p>
          )}
          <CardFooterEstado resena={resena} />
        </div>
      </div>
    </div>
  );
}

function CardFooterEstado({ resena }: { resena: Resena }) {
  const tieneBorrador =
    !!resena.respuesta_propietario && !!resena.respuesta_borrador_at;
  const publicada = !!resena.respuesta_publicada_at;

  if (publicada) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
        <CheckCircle2 className="h-3 w-3" />
        Publicada en Google
      </div>
    );
  }
  if (tieneBorrador) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-violet-600 font-medium">
        <Sparkles className="h-3 w-3" />
        Borrador IA listo
      </div>
    );
  }
  return null;
}

// ─── Diálogo: Detalle ─────────────────────────────────────────

function DetalleResenaDialog({
  resena,
  onClose,
  onSaved,
}: {
  resena: Resena | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [comentario, setComentario] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [estado, setEstado] = useState<EstadoResena>("nuevo_comensal");
  const [saving, setSaving] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    if (resena) {
      setComentario(resena.comentario ?? "");
      setRespuesta(resena.respuesta_propietario ?? "");
      setEstado(resena.estado);
    }
  }, [resena]);

  if (!resena) return null;

  const esGoogle = resena.origen === "google";
  const tieneBorrador = !!resena.respuesta_borrador_at;
  const publicada = !!resena.respuesta_publicada_at;

  const onGuardar = async () => {
    setSaving(true);
    const res = await actualizarResena(resena.id, {
      comentario: esGoogle ? undefined : comentario,
      respuesta_propietario: respuesta || null,
      estado,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Reseña actualizada");
    onClose();
    onSaved();
  };

  const onGenerar = async () => {
    setGenerando(true);
    const res = await generarBorradorResena(resena.id);
    setGenerando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo generar el borrador");
      return;
    }
    if (res.texto) setRespuesta(res.texto);
    toast.success("Borrador generado");
    onSaved();
  };

  const onPublicarEnGoogle = async () => {
    if (!respuesta.trim()) {
      toast.error("No hay texto de respuesta para publicar");
      return;
    }
    setPublicando(true);
    try {
      try {
        await navigator.clipboard.writeText(respuesta);
        toast.success("Respuesta copiada al portapapeles");
      } catch {
        toast.warning("No se pudo copiar; cópiala manualmente");
      }
      const url = resena.autor_url ?? "https://www.google.com/maps";
      window.open(url, "_blank", "noopener,noreferrer");
      // Pequeña pausa para que se vea el toast
      await new Promise((r) => setTimeout(r, 400));
      if (
        confirm(
          "Abrí Google Maps con tu respuesta en el portapapeles.\n\n" +
            "Pulsa Cmd+V para pegarla, publícala en Google y vuelve aquí.\n\n" +
            "¿La publicaste? (OK = marcar como publicada / Cancelar = aún no)",
        )
      ) {
        const res = await marcarComoPublicada(resena.id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Marcada como publicada en Google");
        onClose();
        onSaved();
      }
    } finally {
      setPublicando(false);
    }
  };

  const onDesmarcarPublicada = async () => {
    const res = await desmarcarComoPublicada(resena.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Desmarcada");
    onSaved();
  };

  const onCopiar = async () => {
    if (!respuesta.trim()) return;
    try {
      await navigator.clipboard.writeText(respuesta);
      toast.success("Copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const onEliminar = async () => {
    if (!confirm("¿Eliminar esta reseña? No se puede deshacer.")) return;
    const res = await eliminarResena(resena.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Reseña eliminada");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!resena} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {resena.autor_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resena.autor_avatar}
                alt={resena.nombre_comensal}
                className="h-10 w-10 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {resena.nombre_comensal.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {resena.nombre_comensal}
                {esGoogle && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                    Google
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                {resena.rating ? (
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < (resena.rating ?? 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </span>
                ) : null}
                <span className="text-xs">
                  Origen: {ORIGEN_LABEL[resena.origen]}
                </span>
                {resena.autor_url && (
                  <a
                    href={resena.autor_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline inline-flex items-center gap-0.5"
                  >
                    Ver en Google <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Estado en pipeline</Label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as EstadoResena)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_RESENA.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Comentario {esGoogle && "(de Google · no editable)"}</Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              disabled={esGoogle}
              rows={4}
              placeholder="Sin comentario"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="flex items-center gap-2">
                Respuesta
                {publicada && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Publicada
                  </span>
                )}
                {!publicada && tieneBorrador && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Borrador IA
                  </span>
                )}
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={onGenerar}
                  disabled={generando}
                  title="Generar borrador con IA"
                >
                  {generando ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {tieneBorrador ? "Regenerar" : "Generar con IA"}
                </Button>
                {respuesta && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={onCopiar}
                    title="Copiar al portapapeles"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={4}
              placeholder="Escribe la respuesta o genera un borrador con IA…"
            />
            {tieneBorrador && !publicada && (
              <Button
                size="sm"
                onClick={onPublicarEnGoogle}
                disabled={publicando || !respuesta.trim()}
                className="mt-2 w-full bg-sky-600 hover:bg-sky-700"
              >
                {publicando ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                )}
                Publicar en Google (copia y abre Maps)
              </Button>
            )}
            {publicada && (
              <button
                type="button"
                onClick={onDesmarcarPublicada}
                className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                Desmarcar como publicada
              </button>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onEliminar}
            className="text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Eliminar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={onGuardar} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
