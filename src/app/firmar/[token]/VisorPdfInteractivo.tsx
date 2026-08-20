"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Eraser, CheckCircle2, X, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type PosicionFirma = {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
  /** Alto del hueco medido en el documento, en % de página. */
  altoPct?: number;
};

type Props = {
  pdfUrl: string;
  onConfirm: (data: { trazoBase64: string; posicion: PosicionFirma }) => void;
  submitting?: boolean;
  /**
   * Posición donde va la firma, detectada en el servidor. El empleado NUNCA la
   * elige: solo dibuja el trazo. Si falta (documentos emitidos antes de la
   * detección automática) se cae al pie de la página, nunca al centro.
   */
  posicionFija?: PosicionFirma | null;
};

const PAGE_RENDER_WIDTH = 600;
const CANVAS_W = 360;
const CANVAS_H = 140;

/** Suelo para documentos antiguos sin posición guardada: pie de la página 1. */
const POSICION_SUELO: PosicionFirma = {
  pagina: 1,
  xPct: 0.1,
  yPct: 0.82,
  anchoPct: 0.32,
  altoPct: 0.06,
};

function detectarMovil(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || coarsePointer;
}

export function VisorPdfInteractivo({ pdfUrl, onConfirm, submitting, posicionFija }: Props) {
  const fija = posicionFija ?? POSICION_SUELO;
  const [numPages, setNumPages] = useState(0);
  const [trazoPng, setTrazoPng] = useState<string | null>(null);
  const [aplicada, setAplicada] = useState(false);
  const [esMovil, setEsMovil] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setEsMovil(detectarMovil());
    setShareUrl(window.location.href);
  }, []);

  const [pos, setPos] = useState<{ pagina: number; xPx: number; yPx: number } | null>(null);
  const [pageGeom, setPageGeom] = useState<Record<number, { top: number; height: number }>>({});

  const pagesWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trazoVacioRef = useRef(true);

  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = CANVAS_W * ratio;
    c.height = CANVAS_H * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    trazoVacioRef.current = true;
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  function onCanvasDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  }
  function onCanvasMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons !== 1 && e.pressure === 0) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
    trazoVacioRef.current = false;
  }
  function limpiar() {
    setupCanvas();
    setTrazoPng(null);
    setAplicada(false);
    setPos(null);
  }
  function aplicar() {
    if (trazoVacioRef.current) return;
    const png = canvasRef.current!.toDataURL("image/png");
    setTrazoPng(png);
    setAplicada(true);
    // La firma va SIEMPRE al hueco detectado en el servidor. La previsualización
    // reproduce el mismo encaje que hará el estampador del PDF: se escala al
    // mayor tamaño que quepa en la caja conservando la proporción del trazo.
    const g = pageGeom[fija.pagina];
    if (!g) return;
    setPos({
      pagina: fija.pagina,
      xPx: fija.xPct * PAGE_RENDER_WIDTH,
      yPx: g.top + fija.yPct * g.height,
    });
  }

  function confirmar() {
    if (!trazoPng) return;
    onConfirm({ trazoBase64: trazoPng, posicion: fija });
  }

  const registerPageGeom = useCallback((pagina: number, top: number, height: number) => {
    setPageGeom((g) => ({ ...g, [pagina]: { top, height } }));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="max-h-[760px] overflow-auto bg-white rounded-lg">
        <div ref={pagesWrapRef} className="relative mx-auto" style={{ width: PAGE_RENDER_WIDTH }}>
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<div className="py-16 text-center text-sm text-zinc-400">Cargando documento…</div>}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
              <PageWithGeom key={p} pagina={p} onGeom={registerPageGeom} />
            ))}
          </Document>

          {aplicada && trazoPng && pos && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: pos.xPx,
                top: pos.yPx,
                width: fija.anchoPct * PAGE_RENDER_WIDTH,
                height: (fija.altoPct ?? 0.06) * (pageGeom[fija.pagina]?.height ?? 0),
              }}
            >
              <img
                src={trazoPng}
                alt="firma"
                draggable={false}
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={limpiar}
                className="absolute -top-2.5 -right-2.5 bg-white border border-zinc-200 rounded-full p-1 shadow-sm hover:shadow pointer-events-auto"
                title="Borrar y volver a dibujar"
              >
                <X className="h-3 w-3 text-zinc-500" />
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">
            1 · Dibuja tu firma
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasMove}
            style={{ width: CANVAS_W, height: CANVAS_H }}
            className="w-full bg-zinc-50 rounded-md touch-none"
          />
          <div className="flex gap-1.5 mt-2">
            <Button size="sm" variant="ghost" onClick={limpiar} className="flex-1 text-zinc-500 hover:text-zinc-900">
              <Eraser className="h-3 w-3 mr-1" /> Borrar
            </Button>
            <Button
              size="sm"
              variant={aplicada ? "ghost" : "primary"}
              onClick={aplicar}
              disabled={aplicada}
              className="flex-1"
            >
              {aplicada ? "Aplicada" : "Aplicar"}
            </Button>
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">
            2 · Revisa y firma
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Tu firma se coloca sola en el espacio reservado del documento
            {numPages > 1 ? `, en la página ${fija.pagina}` : ""}. Compruébala en
            el documento y pulsa firmar.
          </p>
        </div>

        {!esMovil && shareUrl && (
          <div className="border-t border-zinc-100 pt-5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Smartphone className="h-3 w-3" /> Firma con tu móvil
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-3">
              Escanea el código con la cámara de tu móvil para abrir esta
              firma allí. Cuando firmes desde el móvil, esta pantalla se
              actualizará sola.
            </p>
            <div className="bg-white rounded-md p-3 flex items-center justify-center">
              <QRCodeSVG
                value={shareUrl}
                size={160}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
          </div>
        )}

        <Button
          variant="primary"
          onClick={confirmar}
          disabled={!aplicada || !pos || !!submitting}
          className="w-full"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          {submitting ? "Firmando…" : "Firmar ahora"}
        </Button>
      </aside>
    </div>
  );
}

function PageWithGeom({
  pagina,
  onGeom,
}: {
  pagina: number;
  onGeom: (pagina: number, top: number, height: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={wrapRef}
      className="mb-6 last:mb-0 shadow-[0_1px_3px_rgba(15,23,42,0.06)] rounded overflow-hidden"
    >
      <Page
        pageNumber={pagina}
        width={PAGE_RENDER_WIDTH}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        onRenderSuccess={() => {
          const el = wrapRef.current;
          if (!el) return;
          onGeom(pagina, el.offsetTop, el.offsetHeight);
        }}
      />
    </div>
  );
}
