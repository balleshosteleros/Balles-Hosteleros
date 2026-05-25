"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Type,
} from "lucide-react";
import {
  importarMarcaConIA,
  type MarcaImportada,
} from "@/features/empresa/actions/marca-import-actions";

interface ImportarMarcaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (data: MarcaImportada) => void | Promise<void>;
}

export function ImportarMarcaDialog({
  open,
  onOpenChange,
  onApply,
}: ImportarMarcaDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [resultado, setResultado] = useState<MarcaImportada | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setResultado(null);
    setError(null);
  }

  async function importar() {
    setLoading(true);
    setError(null);
    setResultado(null);
    const res = await importarMarcaConIA({ urlWeb: url });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResultado(res.data);
  }

  async function aplicar() {
    if (!resultado) return;
    setApplying(true);
    try {
      await onApply(resultado);
      toast.success("Imagen de marca aplicada");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar marca con IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">URL de tu web</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ej. tunegocio.com"
                disabled={loading || !!resultado}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim() && !loading && !resultado) {
                    importar();
                  }
                }}
                autoFocus
              />
              <Button
                onClick={importar}
                disabled={!url.trim() || loading || !!resultado}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Analizar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              La IA extrae <strong>logotipo + isotipo + paleta + tipografía</strong>.
              Si algo no convence, podrás ajustarlo a mano después.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultado && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Marca detectada
                {resultado.nombreSugerido && (
                  <span className="text-muted-foreground font-normal">· {resultado.nombreSugerido}</span>
                )}
              </div>

              {/* Logotipo + Isotipo */}
              <div className="grid grid-cols-2 gap-3">
                <LogoPreview
                  titulo="Logotipo"
                  descripcion="Icono + texto"
                  imagen={resultado.logotipo}
                />
                <LogoPreview
                  titulo="Isotipo"
                  descripcion="Solo icono"
                  imagen={resultado.isotipo}
                />
              </div>

              {/* Paleta */}
              <div className="grid grid-cols-3 gap-2">
                <ColorChip label="Primario" hex={resultado.paleta.primario} />
                <ColorChip label="Secundario" hex={resultado.paleta.secundario} />
                <ColorChip label="Texto" hex={resultado.paleta.texto} />
              </div>

              {/* Tipografía */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Type className="h-3.5 w-3.5" />
                  Tipografía
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Títulos</div>
                    <div className="font-medium truncate">
                      {resultado.tipografia.titulos ?? <span className="text-muted-foreground">No detectada</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cuerpo</div>
                    <div className="truncate">
                      {resultado.tipografia.cuerpo ?? <span className="text-muted-foreground">No detectada</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vista previa con colores */}
              <div
                className="rounded-md px-4 py-3"
                style={{
                  backgroundColor: resultado.paleta.primario,
                  color: resultado.paleta.texto,
                  fontFamily: resultado.tipografia.titulos
                    ? `'${resultado.tipografia.titulos}', sans-serif`
                    : undefined,
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                  Vista previa
                </div>
                <div className="text-sm mt-0.5 truncate">
                  {resultado.nombreSugerido ?? "Tu marca"}
                </div>
                <div
                  className="mt-2 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: resultado.paleta.secundario,
                    color: pickContrast(resultado.paleta.secundario),
                  }}
                >
                  Botón secundario
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div>
            {resultado && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={applying}
                className="text-muted-foreground"
              >
                Probar otra URL
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || applying}
            >
              Cancelar
            </Button>
            {resultado && (
              <Button onClick={aplicar} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Aplicar todo
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogoPreview({
  titulo,
  descripcion,
  imagen,
}: {
  titulo: string;
  descripcion: string;
  imagen: { dataUrl: string; mimeType: string } | null;
}) {
  return (
    <div className="rounded-md border bg-background p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold">{titulo}</div>
          <div className="text-[10px] text-muted-foreground">{descripcion}</div>
        </div>
      </div>
      <div className="h-20 w-full rounded border bg-white flex items-center justify-center overflow-hidden">
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagen.dataUrl}
            alt={titulo}
            className="max-h-16 max-w-full object-contain"
          />
        ) : (
          <div className="text-[10px] text-muted-foreground flex flex-col items-center gap-1">
            <ImageIcon className="h-4 w-4 opacity-50" />
            No detectado
          </div>
        )}
      </div>
    </div>
  );
}

function ColorChip({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="rounded-md border bg-background p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 rounded border shrink-0"
          style={{ backgroundColor: hex }}
        />
        <code className="text-[11px] font-mono">{hex}</code>
      </div>
    </div>
  );
}

function pickContrast(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#111111" : "#ffffff";
}
