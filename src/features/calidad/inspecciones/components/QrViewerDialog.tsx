"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface QrViewerDialogProps {
  open: boolean;
  publicToken: string;
  envioId: string;
  numero: number | null;
  qr: { token: string; expires_at: string; verify_url: string };
  accent: string;
  nombreInspector: string;
  onQrUpdated: (qr: { token: string; expires_at: string; verify_url: string }) => void;
}

export function QrViewerDialog({
  open,
  publicToken,
  envioId,
  numero,
  qr,
  accent,
  nombreInspector,
  onQrUpdated,
}: QrViewerDialogProps) {
  // Comprobación de caducidad ligera: cada 30s basta (la ventana son 2h).
  // No se muestra cuenta atrás al usuario; solo cambiamos el estado del
  // diálogo cuando el token deja de ser válido.
  const [now, setNow] = useState(() => Date.now());
  const [regenerando, setRegenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const caducado = new Date(qr.expires_at).getTime() - now <= 0;

  async function regenerar() {
    setError(null);
    setRegenerando(true);
    try {
      const res = await fetch(`/api/inspectores/${publicToken}/qr/regenerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envio_id: envioId }),
      });
      const json = (await res.json()) as
        | { ok: true; qr: { token: string; expires_at: string; verify_url: string } }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : "No se pudo regenerar");
        return;
      }
      onQrUpdated(json.qr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setRegenerando(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div
          className="px-6 py-5 text-white"
          style={{ background: accent }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7" />
            <DialogHeader className="space-y-0.5">
              <DialogTitle className="text-white text-lg font-bold">
                ¡Inspección enviada{numero ? ` · #${numero}` : ""}!
              </DialogTitle>
              <DialogDescription className="text-white/90 text-sm">
                Verifica la visita con el jefe de sala
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="p-6 space-y-5 bg-white text-foreground">
          <div className="text-sm leading-relaxed text-muted-foreground text-center">
            Enseña este código al <strong>jefe de sala</strong>. Debe
            escanearlo y firmarlo con su DNI.
          </div>

          <div className="flex flex-col items-center gap-3">
            <div
              className={`rounded-xl border-2 border-dashed p-4 bg-white ${caducado ? "opacity-40" : ""}`}
              style={{ borderColor: accent }}
            >
              <QRCodeSVG
                value={qr.verify_url}
                size={260}
                level="M"
                marginSize={1}
                fgColor={accent}
                bgColor="#ffffff"
              />
            </div>
            {nombreInspector && (
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Inspector
                </p>
                <p
                  className="text-base font-semibold"
                  style={{ color: accent }}
                >
                  {nombreInspector}
                </p>
              </div>
            )}
          </div>

          {caducado && (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm text-center">
              El QR ha caducado. Pulsa <strong>Regenerar QR</strong> para
              crear uno nuevo.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {caducado && (
            <Button
              type="button"
              onClick={regenerar}
              disabled={regenerando}
              variant="outline"
              className="w-full"
            >
              {regenerando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Regenerar QR
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            El jefe de sala firmará la visita con su DNI y verá el descuento
            INSPECCIÓN aplicable al ticket.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
