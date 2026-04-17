"use client";

import { useEffect, useState } from "react";
import { getPresentacion } from "../actions/presentaciones-actions";
import { SlideRenderer } from "./SlideRenderer";
import type { PresentacionConSlides, Branding } from "../types/presentaciones";

interface Props {
  presentacionId: string;
}

export function PrintView({ presentacionId }: Props) {
  const [data, setData] = useState<PresentacionConSlides | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getPresentacion(presentacionId);
      if (res.ok && res.data) {
        setData(res.data);
        // Disparar print cuando las slides ya estén montadas + fuentes listas
        setTimeout(() => window.print(), 600);
      }
    })();
  }, [presentacionId]);

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Preparando impresión…</div>;
  }

  const branding = (data.branding_snapshot ?? {}) as Partial<Branding>;

  return (
    <>
      <style jsx global>{`
        @page {
          size: landscape;
          margin: 0;
        }
        @media print {
          body { margin: 0; background: white; }
          .no-print { display: none !important; }
          .print-slide {
            width: 100vw;
            height: 100vh;
            page-break-after: always;
          }
          .print-slide:last-child { page-break-after: auto; }
        }
        @media screen {
          .print-slide {
            width: 960px;
            height: 540px;
            margin: 20px auto;
            box-shadow: 0 4px 14px rgba(0,0,0,0.12);
          }
        }
      `}</style>
      <div className="no-print p-4 text-center text-sm text-muted-foreground bg-muted/30 border-b">
        Si no se abre el diálogo de impresión automáticamente, usa Ctrl+P (Cmd+P
        en Mac) y elige &quot;Guardar como PDF&quot;.
      </div>
      <div>
        {data.slides.map((s) => (
          <div key={s.id} className="print-slide">
            <SlideRenderer slide={s} branding={branding} />
          </div>
        ))}
      </div>
    </>
  );
}
