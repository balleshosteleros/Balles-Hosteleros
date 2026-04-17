"use client";

import { Button } from "@/shared/components/ui/button";
import { QrCode } from "lucide-react";

/**
 * Genera el QR usando el API público de qrserver.com (sin instalar libs).
 */
export function QrDownloadButton({ url, fileName }: { url: string; fileName: string }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(
    url,
  )}`;

  const handleDownload = async () => {
    try {
      const res = await fetch(qrSrc);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      console.error("[qr] download:", err);
    }
  };

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={handleDownload}
      className="flex items-center gap-2"
    >
      <QrCode className="h-5 w-5" />
      Descargar QR
    </Button>
  );
}
