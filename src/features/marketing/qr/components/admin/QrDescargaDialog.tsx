"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CodigoQr } from "../../types";
import { friendlyError } from "@/shared/lib/friendly-errors";

/** Lado del PNG en píxeles. 2000 px aguanta un QR grande en una carta impresa sin
 *  que se vea pixelado; por debajo de eso la imprenta se queja. */
const LADO_PNG = 2000;

/**
 * Vista del QR + descarga para llevar a imprenta.
 *
 * El PNG se genera aquí, en el navegador, a partir del SVG. No se usa ningún
 * servicio externo de generación de QR a propósito: si esa web se cayera o cerrara,
 * nos quedaríamos sin poder producir los códigos, que es justo la dependencia de la
 * que estamos saliendo con GoHighLevel.
 */
export function QrDescargaDialog({
  qr,
  url,
  open,
  onOpenChange,
}: {
  qr: CodigoQr | null;
  url: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);

  if (!qr) return null;

  const nombreArchivo = `qr-${qr.codigo}-${slug(qr.nombre)}`;

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch (err) {
      toast.error("No se pudo copiar el enlace.", { description: friendlyError(err, "copiarEnlace") });
    }
  }

  function descargarSvg() {
    const svg = contenedorRef.current?.querySelector("svg");
    if (!svg) return;
    const texto = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([texto], { type: "image/svg+xml;charset=utf-8" });
    descargarBlob(blob, `${nombreArchivo}.svg`);
  }

  async function descargarPng() {
    const svg = contenedorRef.current?.querySelector("svg");
    if (!svg) return;

    setDescargando(true);
    try {
      const texto = new XMLSerializer().serializeToString(svg);
      const blobSvg = new Blob([texto], { type: "image/svg+xml;charset=utf-8" });
      const urlSvg = URL.createObjectURL(blobSvg);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("no se pudo cargar el svg"));
        img.src = urlSvg;
      });

      const canvas = document.createElement("canvas");
      canvas.width = LADO_PNG;
      canvas.height = LADO_PNG;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sin contexto 2d");

      // Fondo blanco explícito: un PNG transparente impreso sobre papel de color
      // pierde contraste y el lector deja de reconocer el código.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, LADO_PNG, LADO_PNG);
      ctx.drawImage(img, 0, 0, LADO_PNG, LADO_PNG);
      URL.revokeObjectURL(urlSvg);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("sin blob");
      descargarBlob(blob, `${nombreArchivo}.png`);
    } catch (err) {
      console.error("[qr][descargarPng]", err);
      toast.error("No se pudo generar el PNG. Prueba a descargar el SVG.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{qr.nombre}</DialogTitle>
          <DialogDescription>
            Este código no cambia nunca. Puedes cambiar a dónde lleva sin volver a
            imprimirlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={contenedorRef}
            className="mx-auto flex w-fit items-center justify-center rounded-lg border bg-white p-5"
          >
            {/* Corrección de errores alta: un QR impreso acaba rozado, con una gota
                de aceite o doblado por una esquina. Con nivel "H" sigue leyéndose
                aunque se pierda parte del dibujo. */}
            <QRCodeSVG value={url} size={220} level="H" marginSize={2} />
          </div>

          <div className="rounded-md bg-gray-50 px-3 py-2 text-center">
            <p className="text-xs text-gray-500">Enlace del código</p>
            <p className="mt-0.5 break-all font-mono text-sm text-gray-800">{url}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={descargarPng} disabled={descargando}>
              <Download className="mr-2 h-4 w-4" />
              {descargando ? "Generando…" : "PNG"}
            </Button>
            <Button variant="outline" onClick={descargarSvg}>
              <Download className="mr-2 h-4 w-4" />
              SVG
            </Button>
          </div>

          <p className="text-center text-xs text-gray-500">
            Para imprenta, mejor el SVG: no pierde calidad a ningún tamaño.
          </p>

          <div className="flex items-center justify-center gap-3 border-t pt-3">
            <Button variant="ghost" size="sm" onClick={copiarEnlace}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar enlace
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Probarlo
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
