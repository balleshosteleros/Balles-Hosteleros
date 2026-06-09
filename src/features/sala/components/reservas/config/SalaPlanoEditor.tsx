"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as AlertDialogHeaderUI,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Circle,
  DoorOpen,
  Flower2,
  Minus,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Save,
  Square,
  StretchHorizontal,
  Tag,
  Trash2,
  Trees,
} from "lucide-react";
import { DECO_DEFAULTS, DecoBody } from "@/features/sala/planos/components/DecoBody";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  FormaMesa,
  Mesa,
  MesaPosicion,
  Sala,
  SalaDecoracion,
  TipoDecoracion,
  Zona,
} from "@/features/sala/planos/data/planos";
import {
  FORMA_MESA_LABELS,
  TIPO_DECORACION_LABELS,
} from "@/features/sala/planos/data/planos";
import {
  listMesaPosicionesSala,
  removeMesaPosicion,
  upsertMesaPosicion,
} from "@/features/sala/planos/actions/mesa-posiciones-actions";
import { updateMesa } from "@/features/sala/planos/actions/mesas-actions";
import {
  createSalaDecoracion,
  deleteSalaDecoracion,
  listSalaDecoraciones,
  updateSalaDecoracion,
} from "@/features/sala/planos/actions/sala-decoraciones-actions";
import { updateZona } from "@/features/sala/planos/actions/zonas-actions";

const MESA_SIZE = 60;
const MESA_RECT_W = 84;
const MESA_RECT_H = 48;
const CANVAS_W = 1200;
const CANVAS_H = 640;
/** Alto fijo del badge "etiqueta de zona" en px del canvas. */
const ZONA_LABEL_H = 22;

interface Props {
  sala: Sala;
  zonas: Zona[];
  mesas: Mesa[];
  onBack: () => void;
}

type DragState =
  | {
      kind: "mesa";
      mesaId: string;
      offsetX: number;
      offsetY: number;
      esNueva: boolean;
    }
  | {
      kind: "deco-nueva";
      tipo: TipoDecoracion;
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
    }
  | {
      kind: "deco";
      id: string;
      offsetX: number;
      offsetY: number;
    }
  | {
      kind: "mesa-resize";
      mesaId: string;
      startMouseX: number;
      startMouseY: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
      rotation: number;
      lockAspect: boolean;
    }
  | {
      kind: "deco-resize";
      id: string;
      startMouseX: number;
      startMouseY: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
      rotation: number;
    }
  | {
      kind: "zona-nueva";
      zonaId: string;
      width: number;
      offsetX: number;
      offsetY: number;
    }
  | {
      kind: "zona";
      zonaId: string;
      offsetX: number;
      offsetY: number;
    };

const MIN_MESA_SIZE = 36;
const MIN_DECO_SIZE = 16;

/** Decoraciones agrupadas para la paleta. */
const DECO_GRUPOS: { titulo: string; tipos: TipoDecoracion[] }[] = [
  {
    titulo: "Decoración",
    tipos: [
      "maceta",
      "planta_grande",
      "pared",
      "columna",
      "ventana",
      "puerta",
      "escaleras",
      "barra",
      "cocina",
      "pasillo",
      "wc",
    ],
  },
];

function getMesaDimsDefault(forma: FormaMesa) {
  if (forma === "rectangular") return { w: MESA_RECT_W, h: MESA_RECT_H };
  return { w: MESA_SIZE, h: MESA_SIZE };
}

function getMesaDims(forma: FormaMesa, pos?: MesaPosicion | null) {
  const def = getMesaDimsDefault(forma);
  return {
    w: pos?.width != null ? Number(pos.width) : def.w,
    h: pos?.height != null ? Number(pos.height) : def.h,
  };
}

/** Render del thumbnail de una mesa en la paleta lateral. */
function MesaThumb({ forma, color }: { forma: FormaMesa; color: string }) {
  if (forma === "rectangular") {
    return (
      <span
        aria-hidden
        className="inline-block border border-foreground/40"
        style={{ width: 18, height: 11, backgroundColor: color, borderRadius: 2 }}
      />
    );
  }
  if (forma === "redonda") {
    return (
      <span
        aria-hidden
        className="inline-block rounded-full border border-foreground/40"
        style={{ width: 14, height: 14, backgroundColor: color }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block border border-foreground/40"
      style={{ width: 14, height: 14, backgroundColor: color, borderRadius: 2 }}
    />
  );
}

/**
 * Tirador de redimensión visible al seleccionar una mesa/decoración.
 * - Anclado en la esquina inferior-derecha en el marco LOCAL del elemento.
 * - En mesas redondas se renderiza como anillo para sugerir resize uniforme.
 */
function ResizeHandle({
  onPointerDown,
  round = false,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  round?: boolean;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute bg-white border-2 border-primary shadow-sm",
        round ? "rounded-full" : "rounded-sm",
      )}
      style={{
        right: -7,
        bottom: -7,
        width: 14,
        height: 14,
        cursor: "nwse-resize",
        zIndex: 10,
      }}
      aria-label="Redimensionar"
    />
  );
}

/** Mini-icono para el botón de paleta de cada tipo. */
function DecoPaletteIcon({ tipo }: { tipo: TipoDecoracion }) {
  switch (tipo) {
    case "maceta":
      return <Flower2 className="h-3.5 w-3.5" />;
    case "planta_grande":
      return <Trees className="h-3.5 w-3.5" />;
    case "pared":
      return <Minus className="h-3.5 w-3.5" />;
    case "pasillo":
      return <StretchHorizontal className="h-3.5 w-3.5" />;
    case "columna":
      return <Circle className="h-3.5 w-3.5" />;
    case "ventana":
      return <RectangleHorizontal className="h-3.5 w-3.5" />;
    case "puerta":
      return <DoorOpen className="h-3.5 w-3.5" />;
    case "escaleras":
      return <StretchHorizontal className="h-3.5 w-3.5 rotate-90" />;
    case "barra":
      return <RectangleHorizontal className="h-3.5 w-3.5" />;
    case "cocina":
      return <RectangleHorizontal className="h-3.5 w-3.5" />;
    case "wc":
      return <Square className="h-3.5 w-3.5" />;
  }
}

export function SalaPlanoEditor({ sala, zonas, mesas, onBack }: Props) {
  const [posiciones, setPosiciones] = useState<Map<string, MesaPosicion>>(new Map());
  const [decoraciones, setDecoraciones] = useState<Map<string, SalaDecoracion>>(new Map());
  const [formas, setFormas] = useState<Map<string, FormaMesa>>(new Map());
  /**
   * Overrides locales para la posición del badge de cada zona (drag en curso o post-guardado).
   * - `null` = etiqueta NO colocada (quitada manualmente).
   * - `{x,y}` = colocada en esa posición.
   * Si no hay entrada, se usa el valor que llega por props (`zonas[].etiquetaX/Y`).
   */
  const [zonaLabelPos, setZonaLabelPos] = useState<
    Map<string, { x: number; y: number } | null>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string | null>(null);
  const [decoSeleccionada, setDecoSeleccionada] = useState<string | null>(null);
  const [zonaLabelSeleccionada, setZonaLabelSeleccionada] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  /**
   * Operaciones pendientes de guardar. Toda interacción del usuario alimenta estos
   * sets en lugar de llamar al servidor — el persist se dispara solo al pulsar Guardar.
   */
  const [pendingMesaUpserts, setPendingMesaUpserts] = useState<Set<string>>(new Set());
  const [pendingMesaRemovals, setPendingMesaRemovals] = useState<Set<string>>(new Set());
  const [pendingFormas, setPendingFormas] = useState<Set<string>>(new Set());
  const [pendingDecoCreates, setPendingDecoCreates] = useState<Set<string>>(new Set());
  const [pendingDecoUpdates, setPendingDecoUpdates] = useState<Set<string>>(new Set());
  const [pendingDecoRemovals, setPendingDecoRemovals] = useState<Set<string>>(new Set());
  const [pendingZonaLabels, setPendingZonaLabels] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isDirty =
    pendingMesaUpserts.size > 0 ||
    pendingMesaRemovals.size > 0 ||
    pendingFormas.size > 0 ||
    pendingDecoCreates.size > 0 ||
    pendingDecoUpdates.size > 0 ||
    pendingDecoRemovals.size > 0 ||
    pendingZonaLabels.size > 0;

  /** Aviso del navegador en refresh/cierre si hay cambios sin guardar. */
  useEffect(() => {
    if (!isDirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / CANVAS_W, h / CANVAS_H, 1);
      setScale(s > 0 ? s : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zonasSala = useMemo(
    () => zonas.filter((z) => z.salaId === sala.id),
    [zonas, sala.id],
  );
  const mesasSala = useMemo(() => {
    const zonaIds = new Set(zonasSala.map((z) => z.id));
    return mesas.filter((m) => zonaIds.has(m.zonaId));
  }, [mesas, zonasSala]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [posRes, decoRes] = await Promise.all([
      listMesaPosicionesSala(sala.id),
      listSalaDecoraciones(sala.id),
    ]);
    if (posRes.ok) {
      const map = new Map<string, MesaPosicion>();
      for (const p of posRes.data) map.set(p.mesaId, p);
      setPosiciones(map);
    }
    if (decoRes.ok) {
      const map = new Map<string, SalaDecoracion>();
      for (const d of decoRes.data) map.set(d.id, d);
      setDecoraciones(map);
    }
    setFormas(new Map());
    setZonaLabelPos(new Map());
    setPendingMesaUpserts(new Set());
    setPendingMesaRemovals(new Set());
    setPendingFormas(new Set());
    setPendingDecoCreates(new Set());
    setPendingDecoUpdates(new Set());
    setPendingDecoRemovals(new Set());
    setPendingZonaLabels(new Set());
    setLoading(false);
  }, [sala.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const mesasPorZona = useMemo(() => {
    const map = new Map<string, Mesa[]>();
    for (const m of mesasSala) {
      const arr = map.get(m.zonaId) ?? [];
      arr.push(m);
      map.set(m.zonaId, arr);
    }
    return map;
  }, [mesasSala]);

  const zonaPorId = useMemo(() => new Map(zonasSala.map((z) => [z.id, z])), [zonasSala]);
  const mesaPorId = useMemo(() => new Map(mesasSala.map((m) => [m.id, m])), [mesasSala]);

  function formaDe(mesaId: string): FormaMesa {
    return formas.get(mesaId) ?? mesaPorId.get(mesaId)?.forma ?? "cuadrada";
  }

  function mesaEstaColocada(mesaId: string): boolean {
    return posiciones.has(mesaId);
  }

  /** Ancho aproximado del badge por longitud del nombre (sin medir DOM). */
  function zonaLabelWidth(nombre: string): number {
    // ~7px por carácter + 16px de padding lateral, mínimo 48.
    return Math.max(48, nombre.length * 7 + 16);
  }

  /** Posición efectiva de la etiqueta de la zona: override local → prop → null. */
  function getZonaLabelPos(zonaId: string): { x: number; y: number } | null {
    if (zonaLabelPos.has(zonaId)) return zonaLabelPos.get(zonaId) ?? null;
    const z = zonaPorId.get(zonaId);
    if (!z) return null;
    if (z.etiquetaX == null || z.etiquetaY == null) return null;
    return { x: z.etiquetaX, y: z.etiquetaY };
  }

  /** ¿Hay al menos una mesa de esta zona colocada en el plano? Bloquea el "Quitar". */
  function zonaTieneMesasColocadas(zonaId: string): boolean {
    const ms = mesasPorZona.get(zonaId) ?? [];
    return ms.some((m) => posiciones.has(m.id));
  }

  function startDragNueva(e: React.PointerEvent, mesaId: string) {
    e.preventDefault();
    const dims = getMesaDims(formaDe(mesaId));
    setMesaSeleccionada(mesaId);
    setDecoSeleccionada(null);
    setDrag({
      kind: "mesa",
      mesaId,
      offsetX: dims.w / 2,
      offsetY: dims.h / 2,
      esNueva: true,
    });
  }

  function startDragExistente(e: React.PointerEvent, mesaId: string) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = posiciones.get(mesaId);
    if (!pos) return;
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    setDrag({
      kind: "mesa",
      mesaId,
      offsetX: mouseX - pos.x,
      offsetY: mouseY - pos.y,
      esNueva: false,
    });
  }

  function startDragDecoNueva(e: React.PointerEvent, tipo: TipoDecoracion) {
    e.preventDefault();
    const dims = DECO_DEFAULTS[tipo];
    setMesaSeleccionada(null);
    setDecoSeleccionada(null);
    setDrag({
      kind: "deco-nueva",
      tipo,
      width: dims.width,
      height: dims.height,
      offsetX: dims.width / 2,
      offsetY: dims.height / 2,
    });
  }

  function startDragDecoExistente(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const deco = decoraciones.get(id);
    if (!deco) return;
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    setDrag({
      kind: "deco",
      id,
      offsetX: mouseX - deco.x,
      offsetY: mouseY - deco.y,
    });
  }

  function startDragZonaLabelNueva(e: React.PointerEvent, zonaId: string) {
    e.preventDefault();
    const z = zonaPorId.get(zonaId);
    if (!z) return;
    const w = zonaLabelWidth(z.nombre);
    setMesaSeleccionada(null);
    setDecoSeleccionada(null);
    setZonaLabelSeleccionada(null);
    setDrag({
      kind: "zona-nueva",
      zonaId,
      width: w,
      offsetX: w / 2,
      offsetY: ZONA_LABEL_H / 2,
    });
  }

  function startDragZonaLabelExistente(e: React.PointerEvent, zonaId: string) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = getZonaLabelPos(zonaId);
    if (!pos) return;
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    setDrag({
      kind: "zona",
      zonaId,
      offsetX: mouseX - pos.x,
      offsetY: mouseY - pos.y,
    });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;

    if (drag.kind === "mesa") {
      const x = mouseX - drag.offsetX;
      const y = mouseY - drag.offsetY;
      setPosiciones((prev) => {
        const next = new Map(prev);
        const actual = prev.get(drag.mesaId);
        const dims = getMesaDims(formaDe(drag.mesaId), actual);
        next.set(drag.mesaId, {
          mesaId: drag.mesaId,
          x: Math.max(0, Math.min(CANVAS_W - dims.w, x)),
          y: Math.max(0, Math.min(CANVAS_H - dims.h, y)),
          rotation: actual?.rotation ?? 0,
          width: actual?.width ?? null,
          height: actual?.height ?? null,
        });
        return next;
      });
      return;
    }

    if (drag.kind === "mesa-resize") {
      const dx = mouseX - drag.startMouseX;
      const dy = mouseY - drag.startMouseY;
      const rad = (drag.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Delta del puntero en el marco local (sin rotación).
      const localDx = cos * dx + sin * dy;
      const localDy = -sin * dx + cos * dy;
      let newW = drag.startW + localDx;
      let newH = drag.startH + localDy;
      if (drag.lockAspect) {
        const s = Math.max(newW, newH);
        newW = s;
        newH = s;
      }
      newW = Math.max(MIN_MESA_SIZE, newW);
      newH = Math.max(MIN_MESA_SIZE, newH);
      // Anclar la esquina superior-izquierda en coordenadas del mundo.
      const cx0 = drag.startX + drag.startW / 2;
      const cy0 = drag.startY + drag.startH / 2;
      const tlX = cx0 + cos * (-drag.startW / 2) - sin * (-drag.startH / 2);
      const tlY = cy0 + sin * (-drag.startW / 2) + cos * (-drag.startH / 2);
      const newCx = tlX + (cos * newW) / 2 - (sin * newH) / 2;
      const newCy = tlY + (sin * newW) / 2 + (cos * newH) / 2;
      let newX = newCx - newW / 2;
      let newY = newCy - newH / 2;
      newX = Math.max(0, Math.min(CANVAS_W - newW, newX));
      newY = Math.max(0, Math.min(CANVAS_H - newH, newY));
      setPosiciones((prev) => {
        const next = new Map(prev);
        const actual = prev.get(drag.mesaId);
        if (!actual) return prev;
        next.set(drag.mesaId, {
          ...actual,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
        return next;
      });
      return;
    }

    if (drag.kind === "deco-resize") {
      const dx = mouseX - drag.startMouseX;
      const dy = mouseY - drag.startMouseY;
      const rad = (drag.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localDx = cos * dx + sin * dy;
      const localDy = -sin * dx + cos * dy;
      const newW = Math.max(MIN_DECO_SIZE, drag.startW + localDx);
      const newH = Math.max(MIN_DECO_SIZE, drag.startH + localDy);
      const cx0 = drag.startX + drag.startW / 2;
      const cy0 = drag.startY + drag.startH / 2;
      const tlX = cx0 + cos * (-drag.startW / 2) - sin * (-drag.startH / 2);
      const tlY = cy0 + sin * (-drag.startW / 2) + cos * (-drag.startH / 2);
      const newCx = tlX + (cos * newW) / 2 - (sin * newH) / 2;
      const newCy = tlY + (sin * newW) / 2 + (cos * newH) / 2;
      let newX = newCx - newW / 2;
      let newY = newCy - newH / 2;
      newX = Math.max(0, Math.min(CANVAS_W - newW, newX));
      newY = Math.max(0, Math.min(CANVAS_H - newH, newY));
      setDecoraciones((prev) => {
        const next = new Map(prev);
        const actual = prev.get(drag.id);
        if (!actual) return prev;
        next.set(drag.id, {
          ...actual,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
        return next;
      });
      return;
    }

    if (drag.kind === "deco") {
      setDecoraciones((prev) => {
        const next = new Map(prev);
        const actual = prev.get(drag.id);
        if (!actual) return prev;
        const x = mouseX - drag.offsetX;
        const y = mouseY - drag.offsetY;
        next.set(drag.id, {
          ...actual,
          x: Math.max(0, Math.min(CANVAS_W - actual.width, x)),
          y: Math.max(0, Math.min(CANVAS_H - actual.height, y)),
        });
        return next;
      });
      return;
    }

    if (drag.kind === "zona") {
      const z = zonaPorId.get(drag.zonaId);
      if (!z) return;
      const w = zonaLabelWidth(z.nombre);
      const x = mouseX - drag.offsetX;
      const y = mouseY - drag.offsetY;
      setZonaLabelPos((prev) => {
        const next = new Map(prev);
        next.set(drag.zonaId, {
          x: Math.max(0, Math.min(CANVAS_W - w, x)),
          y: Math.max(0, Math.min(CANVAS_H - ZONA_LABEL_H, y)),
        });
        return next;
      });
      return;
    }

    // deco-nueva / zona-nueva: solo previsualizamos en estado de drag (no creamos hasta soltar).
    // El render del fantasma sale a partir del puntero + drag.tipo/width/height.
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      setDrag(null);
      return;
    }

    if (drag.kind === "mesa" || drag.kind === "mesa-resize") {
      const mesaId = drag.mesaId;
      setDrag(null);
      if (!posiciones.has(mesaId)) return;
      setPendingMesaUpserts((prev) => {
        const next = new Set(prev);
        next.add(mesaId);
        return next;
      });
      // Si la mesa estaba marcada para borrar, deja de estarlo (volvió al lienzo).
      setPendingMesaRemovals((prev) => {
        if (!prev.has(mesaId)) return prev;
        const next = new Set(prev);
        next.delete(mesaId);
        return next;
      });
      return;
    }

    if (drag.kind === "deco" || drag.kind === "deco-resize") {
      const id = drag.id;
      setDrag(null);
      if (!decoraciones.has(id)) return;
      // Si es una deco aún no persistida (tmp_), basta con su estado local.
      if (pendingDecoCreates.has(id)) return;
      setPendingDecoUpdates((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      return;
    }

    if (drag.kind === "zona") {
      const zonaId = drag.zonaId;
      setDrag(null);
      setPendingZonaLabels((prev) => {
        const next = new Set(prev);
        next.add(zonaId);
        return next;
      });
      return;
    }

    if (drag.kind === "zona-nueva") {
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        setDrag(null);
        return;
      }
      const z = zonaPorId.get(drag.zonaId);
      if (!z) {
        setDrag(null);
        return;
      }
      const w = zonaLabelWidth(z.nombre);
      const x = Math.max(
        0,
        Math.min(CANVAS_W - w, (e.clientX - rect.left) / scale - drag.offsetX),
      );
      const y = Math.max(
        0,
        Math.min(CANVAS_H - ZONA_LABEL_H, (e.clientY - rect.top) / scale - drag.offsetY),
      );
      const zonaId = drag.zonaId;
      setDrag(null);
      setZonaLabelPos((prev) => {
        const next = new Map(prev);
        next.set(zonaId, { x, y });
        return next;
      });
      setZonaLabelSeleccionada(zonaId);
      setPendingZonaLabels((prev) => {
        const next = new Set(prev);
        next.add(zonaId);
        return next;
      });
      return;
    }

    // deco-nueva: el puntero debe terminar dentro del canvas.
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) {
      setDrag(null);
      return;
    }
    const x = Math.max(
      0,
      Math.min(CANVAS_W - drag.width, (e.clientX - rect.left) / scale - drag.offsetX),
    );
    const y = Math.max(
      0,
      Math.min(CANVAS_H - drag.height, (e.clientY - rect.top) / scale - drag.offsetY),
    );
    const tipo = drag.tipo;
    const width = drag.width;
    const height = drag.height;
    setDrag(null);
    const tempId = `tmp_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
    setDecoraciones((prev) => {
      const next = new Map(prev);
      next.set(tempId, {
        id: tempId,
        salaId: sala.id,
        tipo,
        x,
        y,
        rotation: 0,
        width,
        height,
      });
      return next;
    });
    setPendingDecoCreates((prev) => {
      const next = new Set(prev);
      next.add(tempId);
      return next;
    });
    setDecoSeleccionada(tempId);
  }

  function handleQuitarMesa(mesaId: string) {
    setPosiciones((prev) => {
      const next = new Map(prev);
      next.delete(mesaId);
      return next;
    });
    setMesaSeleccionada(null);
    setPendingMesaUpserts((prev) => {
      if (!prev.has(mesaId)) return prev;
      const next = new Set(prev);
      next.delete(mesaId);
      return next;
    });
    setPendingMesaRemovals((prev) => {
      const next = new Set(prev);
      next.add(mesaId);
      return next;
    });
  }

  function handleRotarMesa(mesaId: string, delta: number) {
    const pos = posiciones.get(mesaId);
    if (!pos) return;
    const nuevaRotacion = (pos.rotation + delta + 360) % 360;
    setPosiciones((prev) => {
      const next = new Map(prev);
      next.set(mesaId, { ...pos, rotation: nuevaRotacion });
      return next;
    });
    setPendingMesaUpserts((prev) => {
      const next = new Set(prev);
      next.add(mesaId);
      return next;
    });
  }

  function handleCambiarForma(mesaId: string, nueva: FormaMesa) {
    setFormas((prev) => {
      const next = new Map(prev);
      next.set(mesaId, nueva);
      return next;
    });
    setPendingFormas((prev) => {
      const next = new Set(prev);
      next.add(mesaId);
      return next;
    });
  }

  function handleRotarDeco(id: string, delta: number) {
    const deco = decoraciones.get(id);
    if (!deco) return;
    const nuevaRotacion = (deco.rotation + delta + 360) % 360;
    setDecoraciones((prev) => {
      const next = new Map(prev);
      next.set(id, { ...deco, rotation: nuevaRotacion });
      return next;
    });
    // Si aún no se ha creado en BD, basta con su estado local (el create lleva
    // la rotación actual). En otro caso, marca actualización pendiente.
    if (!pendingDecoCreates.has(id)) {
      setPendingDecoUpdates((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  function handleQuitarDeco(id: string) {
    setDecoraciones((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setDecoSeleccionada(null);
    if (pendingDecoCreates.has(id)) {
      // Nunca llegó a BD: descarta el create pendiente y listo.
      setPendingDecoCreates((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    setPendingDecoUpdates((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPendingDecoRemovals((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function handleQuitarEtiquetaZona(zonaId: string) {
    if (zonaTieneMesasColocadas(zonaId)) {
      toast.error(
        "No se puede quitar: la zona tiene mesas en el plano. Quita las mesas primero.",
      );
      return;
    }
    setZonaLabelPos((prev) => {
      const next = new Map(prev);
      next.set(zonaId, null);
      return next;
    });
    setZonaLabelSeleccionada(null);
    setPendingZonaLabels((prev) => {
      const next = new Set(prev);
      next.add(zonaId);
      return next;
    });
  }

  async function handleSave(): Promise<boolean> {
    if (saving) return false;
    setSaving(true);

    const failedMesaUpserts = new Set<string>();
    const failedMesaRemovals = new Set<string>();
    const failedFormas = new Set<string>();
    const failedDecoCreates = new Set<string>();
    const failedDecoUpdates = new Set<string>();
    const failedDecoRemovals = new Set<string>();
    const failedZonaLabels = new Set<string>();
    let errCount = 0;

    // 1) Removals primero (libera mesas/decos).
    for (const mesaId of pendingMesaRemovals) {
      const res = await removeMesaPosicion(mesaId);
      if (!res.ok) {
        errCount++;
        failedMesaRemovals.add(mesaId);
      }
    }
    for (const id of pendingDecoRemovals) {
      const res = await deleteSalaDecoracion(id);
      if (!res.ok) {
        errCount++;
        failedDecoRemovals.add(id);
      }
    }

    // 2) Cambios de forma.
    for (const mesaId of pendingFormas) {
      const forma = formas.get(mesaId);
      if (!forma) continue;
      const res = await updateMesa(mesaId, { forma });
      if (!res.ok) {
        errCount++;
        failedFormas.add(mesaId);
      }
    }

    // 3) Posiciones/tamaños/rotaciones de mesas ya colocadas.
    for (const mesaId of pendingMesaUpserts) {
      if (pendingMesaRemovals.has(mesaId)) continue;
      const pos = posiciones.get(mesaId);
      if (!pos) continue;
      const res = await upsertMesaPosicion({
        mesaId,
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
        width: pos.width,
        height: pos.height,
      });
      if (!res.ok) {
        errCount++;
        failedMesaUpserts.add(mesaId);
      }
    }

    // 4) Updates de decos ya persistidas.
    for (const id of pendingDecoUpdates) {
      const deco = decoraciones.get(id);
      if (!deco) continue;
      const res = await updateSalaDecoracion(id, {
        x: deco.x,
        y: deco.y,
        rotation: deco.rotation,
        width: deco.width,
        height: deco.height,
      });
      if (!res.ok) {
        errCount++;
        failedDecoUpdates.add(id);
      }
    }

    // 5) Creates de decos nuevas (tmp_id → id real).
    const tempIds = Array.from(pendingDecoCreates);
    for (const tempId of tempIds) {
      const deco = decoraciones.get(tempId);
      if (!deco) continue;
      const res = await createSalaDecoracion({
        salaId: sala.id,
        tipo: deco.tipo,
        x: deco.x,
        y: deco.y,
        rotation: deco.rotation,
        width: deco.width,
        height: deco.height,
      });
      if (!res.ok) {
        errCount++;
        failedDecoCreates.add(tempId);
        continue;
      }
      if (res.data) {
        const real = res.data;
        setDecoraciones((prev) => {
          const next = new Map(prev);
          next.delete(tempId);
          next.set(real.id, real);
          return next;
        });
        setDecoSeleccionada((cur) => (cur === tempId ? real.id : cur));
      }
    }

    // 6) Etiquetas de zona (posición o limpieza).
    for (const zonaId of pendingZonaLabels) {
      const pos = zonaLabelPos.get(zonaId);
      const res = await updateZona(zonaId, {
        etiquetaX: pos ? Math.round(pos.x) : null,
        etiquetaY: pos ? Math.round(pos.y) : null,
      });
      if (!res.ok) {
        errCount++;
        failedZonaLabels.add(zonaId);
      }
    }

    setPendingMesaUpserts(failedMesaUpserts);
    setPendingMesaRemovals(failedMesaRemovals);
    setPendingFormas(failedFormas);
    setPendingDecoCreates(failedDecoCreates);
    setPendingDecoUpdates(failedDecoUpdates);
    setPendingDecoRemovals(failedDecoRemovals);
    setPendingZonaLabels(failedZonaLabels);
    setSaving(false);

    if (errCount === 0) {
      toast.success("Plano guardado");
      return true;
    }
    toast.error(`No se pudieron guardar ${errCount} cambio(s)`);
    return false;
  }

  function handleBack() {
    if (isDirty || saving) {
      setExitDialogOpen(true);
      return;
    }
    onBack();
  }

  async function handleGuardarYSalir() {
    const ok = await handleSave();
    if (ok) {
      setExitDialogOpen(false);
      onBack();
    }
  }

  function handleSalirSinGuardar() {
    setExitDialogOpen(false);
    onBack();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const mesaSel = mesaSeleccionada ? mesaPorId.get(mesaSeleccionada) : null;
  const decoSel = decoSeleccionada ? decoraciones.get(decoSeleccionada) : null;

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a salas
        </Button>
        <div className="text-sm flex-1 text-center">
          <span className="text-muted-foreground">Plano de</span>{" "}
          <span className="font-semibold">{sala.nombre}</span>
          {sala.esPrincipal && (
            <span className="ml-2 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">
              Principal
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && !saving && (
            <span className="text-[11px] text-muted-foreground italic">
              Cambios sin guardar
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Guardando…" : isDirty ? "Guardar" : "Guardado"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[280px_1fr] gap-3" style={{ height: CANVAS_H }}>
        <aside className="border rounded-md overflow-y-auto p-3 space-y-4 bg-card">
          <section className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Mesas disponibles (arrastra al lienzo)
            </p>
            {zonasSala.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Esta sala aún no tiene zonas.
              </p>
            ) : (
              <div className="space-y-2">
                {zonasSala.map((zona) => {
                  const ms = (mesasPorZona.get(zona.id) ?? []).filter(
                    (m) => !mesaEstaColocada(m.id),
                  );
                  if (ms.length === 0) return null;
                  return (
                    <div key={zona.id} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded"
                          style={{ backgroundColor: zona.colorPastel }}
                        />
                        {zona.nombre}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ms.map((m) => {
                          const forma = formaDe(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onPointerDown={(e) => startDragNueva(e, m.id)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold border rounded px-2 py-1 cursor-grab active:cursor-grabbing hover:border-foreground"
                              style={{ backgroundColor: `${zona.colorPastel}66` }}
                            >
                              <MesaThumb forma={forma} color={zona.colorPastel} />
                              {m.codigo}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {mesasSala.every((m) => mesaEstaColocada(m.id)) && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Todas las mesas de esta sala ya están en el lienzo.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2 border-t pt-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Etiquetas de zona (arrastra al lienzo)
            </p>
            {zonasSala.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                Esta sala aún no tiene zonas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {zonasSala
                  .filter((z) => getZonaLabelPos(z.id) === null)
                  .map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onPointerDown={(e) => startDragZonaLabelNueva(e, z.id)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold border rounded px-2 py-1 cursor-grab active:cursor-grabbing hover:border-foreground"
                      style={{ backgroundColor: z.colorPastel }}
                      title={`Colocar etiqueta "${z.nombre}"`}
                    >
                      <Tag className="h-3 w-3 opacity-70" />
                      {z.nombre}
                    </button>
                  ))}
                {zonasSala.every((z) => getZonaLabelPos(z.id) !== null) && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Todas las etiquetas ya están en el lienzo.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2 border-t pt-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Decoración (arrastra al lienzo)
            </p>
            <div className="space-y-2">
              {DECO_GRUPOS.map((g) => (
                <div key={g.titulo} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">{g.titulo}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.tipos.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onPointerDown={(e) => startDragDecoNueva(e, t)}
                        className="flex items-center gap-1.5 text-[11px] border rounded px-2 py-1 cursor-grab active:cursor-grabbing hover:border-foreground bg-muted/30"
                        title={TIPO_DECORACION_LABELS[t]}
                      >
                        <DecoPaletteIcon tipo={t} />
                        {TIPO_DECORACION_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {mesaSel && mesaSeleccionada && (
            <section className="space-y-2 border-t pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Mesa {mesaSel.codigo}
              </p>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Forma del recuadro</p>
                <div className="flex gap-1">
                  {(["cuadrada", "redonda", "rectangular"] as FormaMesa[]).map((f) => {
                    const activa = formaDe(mesaSeleccionada) === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => handleCambiarForma(mesaSeleccionada, f)}
                        className={cn(
                          "flex-1 text-[11px] border rounded px-2 py-1.5 flex items-center justify-center gap-1.5",
                          activa
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "hover:border-foreground",
                        )}
                      >
                        <MesaThumb forma={f} color="#e5e7eb" />
                        {FORMA_MESA_LABELS[f]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Solo cambia el aspecto. Sigue siendo una mesa con la misma capacidad y zona.
                </p>
              </div>
              <div className="flex gap-1 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRotarMesa(mesaSeleccionada, -15)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRotarMesa(mesaSeleccionada, 15)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => handleQuitarMesa(mesaSeleccionada)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Quitar
                </Button>
              </div>
            </section>
          )}

          {decoSel && decoSeleccionada && (
            <section className="space-y-2 border-t pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {TIPO_DECORACION_LABELS[decoSel.tipo]}
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRotarDeco(decoSeleccionada, -15)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRotarDeco(decoSeleccionada, 15)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => handleQuitarDeco(decoSeleccionada)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Quitar
                </Button>
              </div>
            </section>
          )}

          {zonaLabelSeleccionada && zonaPorId.get(zonaLabelSeleccionada) && (
            <section className="space-y-2 border-t pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Etiqueta de zona
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-sm border border-foreground/20"
                  style={{
                    backgroundColor: zonaPorId.get(zonaLabelSeleccionada)!.colorPastel,
                  }}
                />
                <span className="text-sm font-semibold">
                  {zonaPorId.get(zonaLabelSeleccionada)!.nombre}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tamaño fijo. Color heredado de la zona. Arrastra para mover.
              </p>
              {zonaTieneMesasColocadas(zonaLabelSeleccionada) ? (
                <div className="space-y-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full opacity-50 cursor-not-allowed"
                    disabled
                    title="La zona tiene mesas en el plano. Quita primero todas las mesas."
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Quitar
                  </Button>
                  <p className="text-[10px] text-muted-foreground italic">
                    No se puede quitar mientras haya al menos una mesa de esta zona en el plano.
                  </p>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleQuitarEtiquetaZona(zonaLabelSeleccionada)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Quitar
                </Button>
              )}
            </section>
          )}
        </aside>

        <div
          ref={outerRef}
          className="border rounded-md overflow-hidden bg-muted/20 relative flex items-center justify-center"
          style={{ height: CANVAS_H }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={() => {
            setMesaSeleccionada(null);
            setDecoSeleccionada(null);
            setZonaLabelSeleccionada(null);
          }}
        >
          <div
            style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              position: "relative",
            }}
          >
            <div
              ref={canvasRef}
              className="relative"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `scale(${scale})`,
                transformOrigin: "0 0",
                backgroundImage:
                  "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            >
              {/* Decoraciones — siempre debajo de las mesas */}
              {Array.from(decoraciones.values()).map((d) => {
                const sel = decoSeleccionada === d.id;
                return (
                  <div
                    key={d.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDecoSeleccionada(d.id);
                      setMesaSeleccionada(null);
                      startDragDecoExistente(e, d.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute cursor-grab active:cursor-grabbing select-none",
                      sel && "outline outline-2 outline-primary outline-offset-2 rounded-sm",
                    )}
                    style={{
                      left: Math.max(0, Math.min(CANVAS_W - d.width, d.x)),
                      top: Math.max(0, Math.min(CANVAS_H - d.height, d.y)),
                      width: d.width,
                      height: d.height,
                      transform: `rotate(${d.rotation}deg)`,
                      transformOrigin: "center",
                    }}
                  >
                    <DecoBody
                      tipo={d.tipo}
                      width={d.width}
                      height={d.height}
                      counterRotation={d.rotation}
                    />
                    {sel && (
                      <ResizeHandle
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setDrag({
                            kind: "deco-resize",
                            id: d.id,
                            startMouseX: (e.clientX - rect.left) / scale,
                            startMouseY: (e.clientY - rect.top) / scale,
                            startX: d.x,
                            startY: d.y,
                            startW: d.width,
                            startH: d.height,
                            rotation: d.rotation,
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Etiquetas de zona — encima de la decoración, debajo de las mesas */}
              {zonasSala.map((z) => {
                const pos = getZonaLabelPos(z.id);
                if (!pos) return null;
                const w = zonaLabelWidth(z.nombre);
                const sel = zonaLabelSeleccionada === z.id;
                return (
                  <div
                    key={`zlabel-${z.id}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setZonaLabelSeleccionada(z.id);
                      setMesaSeleccionada(null);
                      setDecoSeleccionada(null);
                      startDragZonaLabelExistente(e, z.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute flex items-center justify-center text-[11px] font-bold tracking-wide text-zinc-800 rounded shadow-sm cursor-grab active:cursor-grabbing select-none border border-foreground/15",
                      sel && "outline outline-2 outline-primary outline-offset-2",
                    )}
                    style={{
                      left: Math.max(0, Math.min(CANVAS_W - w, pos.x)),
                      top: Math.max(0, Math.min(CANVAS_H - ZONA_LABEL_H, pos.y)),
                      width: w,
                      height: ZONA_LABEL_H,
                      backgroundColor: z.colorPastel,
                    }}
                    title={z.nombre}
                  >
                    {z.nombre}
                  </div>
                );
              })}

              {/* Mesas — encima de la decoración */}
              {Array.from(posiciones.values()).map((pos) => {
                const mesa = mesaPorId.get(pos.mesaId);
                if (!mesa) return null;
                const zona = zonaPorId.get(mesa.zonaId);
                const seleccionada = mesaSeleccionada === pos.mesaId;
                const forma = formaDe(pos.mesaId);
                const dims = getMesaDims(forma, pos);
                const radius =
                  forma === "redonda" ? 9999 : forma === "rectangular" ? 6 : 6;
                return (
                  <div
                    key={pos.mesaId}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setMesaSeleccionada(pos.mesaId);
                      setDecoSeleccionada(null);
                      startDragExistente(e, pos.mesaId);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute flex flex-col items-center justify-center text-xs font-semibold border-2 cursor-grab active:cursor-grabbing select-none",
                      seleccionada ? "border-primary shadow-lg" : "border-foreground/40",
                    )}
                    style={{
                      left: Math.max(0, Math.min(CANVAS_W - dims.w, pos.x)),
                      top: Math.max(0, Math.min(CANVAS_H - dims.h, pos.y)),
                      width: dims.w,
                      height: dims.h,
                      borderRadius: radius,
                      backgroundColor: zona?.colorPastel ?? "#FDE68A",
                      transform: `rotate(${pos.rotation}deg)`,
                    }}
                  >
                    {/* Etiquetas siempre legibles: counter-rotación del texto. */}
                    <div
                      className="flex flex-col items-center justify-center pointer-events-none"
                      style={{ transform: `rotate(${-pos.rotation}deg)` }}
                    >
                      <span>{mesa.codigo}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {mesa.capacidadMin}-{mesa.capacidadMax}
                      </span>
                    </div>
                    {seleccionada && (
                      <ResizeHandle
                        round={forma === "redonda"}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setDrag({
                            kind: "mesa-resize",
                            mesaId: pos.mesaId,
                            startMouseX: (e.clientX - rect.left) / scale,
                            startMouseY: (e.clientY - rect.top) / scale,
                            startX: pos.x,
                            startY: pos.y,
                            startW: dims.w,
                            startH: dims.h,
                            rotation: pos.rotation,
                            lockAspect: forma !== "rectangular",
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Fantasma de decoración mientras se arrastra desde la paleta */}
              {drag?.kind === "deco-nueva" && (
                <DecoGhost drag={drag} canvasRef={canvasRef} scale={scale} />
              )}

              {/* Fantasma de etiqueta de zona mientras se arrastra desde la paleta */}
              {drag?.kind === "zona-nueva" && zonaPorId.get(drag.zonaId) && (
                <ZonaLabelGhost
                  drag={drag}
                  nombre={zonaPorId.get(drag.zonaId)!.nombre}
                  color={zonaPorId.get(drag.zonaId)!.colorPastel}
                  canvasRef={canvasRef}
                  scale={scale}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Arrastra mesas o decoraciones desde el panel al lienzo. Click para seleccionar y rotar, cambiar forma o quitar. Las decoraciones son solo visuales — no afectan a las reservas. Pulsa <span className="font-semibold">Guardar</span> para conservar los cambios.
      </p>

      <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeaderUI>
            <AlertDialogTitle>¿Guardar los cambios del plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar en este plano. Si sales sin guardar se perderán.
            </AlertDialogDescription>
          </AlertDialogHeaderUI>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setExitDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={handleSalirSinGuardar}
              disabled={saving}
            >
              Salir sin guardar
            </Button>
            <Button onClick={handleGuardarYSalir} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Guardando…" : "Guardar y salir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Fantasma de previsualización al arrastrar una decoración nueva desde la paleta. */
function DecoGhost({
  drag,
  canvasRef,
  scale,
}: {
  drag: Extract<DragState, { kind: "deco-nueva" }>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        x: (e.clientX - rect.left) / scale - drag.offsetX,
        y: (e.clientY - rect.top) / scale - drag.offsetY,
      });
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [drag, canvasRef, scale]);
  if (!pos) return null;
  return (
    <div
      className="absolute opacity-60 pointer-events-none"
      style={{
        left: Math.max(0, Math.min(CANVAS_W - drag.width, pos.x)),
        top: Math.max(0, Math.min(CANVAS_H - drag.height, pos.y)),
      }}
    >
      <DecoBody tipo={drag.tipo} width={drag.width} height={drag.height} />
    </div>
  );
}

/** Fantasma de previsualización al arrastrar una etiqueta de zona nueva desde la paleta. */
function ZonaLabelGhost({
  drag,
  nombre,
  color,
  canvasRef,
  scale,
}: {
  drag: Extract<DragState, { kind: "zona-nueva" }>;
  nombre: string;
  color: string;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        x: (e.clientX - rect.left) / scale - drag.offsetX,
        y: (e.clientY - rect.top) / scale - drag.offsetY,
      });
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [drag, canvasRef, scale]);
  if (!pos) return null;
  return (
    <div
      className="absolute opacity-70 pointer-events-none flex items-center justify-center text-[11px] font-bold tracking-wide text-zinc-800 rounded shadow-sm border border-foreground/15"
      style={{
        left: Math.max(0, Math.min(CANVAS_W - drag.width, pos.x)),
        top: Math.max(0, Math.min(CANVAS_H - ZONA_LABEL_H, pos.y)),
        width: drag.width,
        height: ZONA_LABEL_H,
        backgroundColor: color,
      }}
    >
      {nombre}
    </div>
  );
}
