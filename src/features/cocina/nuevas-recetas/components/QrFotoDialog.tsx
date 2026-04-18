"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { generarQrUpload } from "../actions/qr-foto-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recetaId: string;
  cataId: string;
}

export function QrFotoDialog({ open, onOpenChange, recetaId, cataId }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cargarQr = async () => {
    setLoading(true);
    const res = await generarQrUpload({ recetaId, cataId });
    if (res.ok) {
      setUrl(res.data.url);
      setExpiresAt(res.data.expires_at);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && !url) cargarQr();
    if (!open) {
      setUrl(null);
      setExpiresAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function copiar() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const minutosRestantes = expiresAt
    ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Subir foto desde el móvil</DialogTitle>
          <DialogDescription>
            Escanea este QR con tu móvil para hacer la foto en vivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {loading && <p className="text-sm text-muted-foreground">Generando QR...</p>}

          {url && !loading && (
            <>
              <div className="p-3 bg-white rounded-lg border">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`}
                  alt="QR para subir foto"
                  width={260}
                  height={260}
                  className="block"
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Válido durante <span className="font-semibold">{minutosRestantes} min</span>
              </p>

              <div className="flex gap-2 w-full">
                <Button variant="outline" size="sm" onClick={copiar} className="flex-1">
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? "Copiado" : "Copiar URL"}
                </Button>
                <Button variant="outline" size="sm" onClick={cargarQr}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
