"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function VisorPdfLimpio({ pdfUrl, width = 720 }: { pdfUrl: string; width?: number }) {
  const [numPages, setNumPages] = useState(0);
  return (
    <div className="w-full flex flex-col items-center bg-white">
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
