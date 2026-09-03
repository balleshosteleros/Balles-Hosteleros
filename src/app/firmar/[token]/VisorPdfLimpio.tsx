"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function VisorPdfLimpio({ pdfUrl, width: widthMax = 720 }: { pdfUrl: string; width?: number }) {
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(widthMax);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Mide el ancho real disponible: en móvil el contenedor es más estrecho que
    // `widthMax` (pensado para escritorio) y renderizar a ese ancho fijo forzaba
    // scroll horizontal dentro del visor.
    const medir = () => setWidth(Math.max(240, Math.min(widthMax, el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthMax]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center bg-white">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={<div className="py-16 text-sm text-zinc-400">Cargando documento…</div>}
        error={<div className="py-16 text-sm text-rose-500">No se pudo cargar el documento.</div>}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
          <div key={p} className="mb-6 last:mb-0 shadow-[0_1px_3px_rgba(15,23,42,0.06)] rounded">
            <Page
              pageNumber={p}
              width={width}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
