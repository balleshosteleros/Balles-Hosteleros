"use client";

import { useMemo, useState } from "react";
import { Copy, Check, ExternalLink, Code, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaSlug: string;
  empresaNombre: string;
  ofertaId?: string;
  ofertaTitulo?: string;
}

export function DialogSnippetEmbed({
  open, onOpenChange,
  empresaSlug, empresaNombre,
  ofertaId, ofertaTitulo,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const url = useMemo(() => {
    if (!origin) return "";
    return ofertaId
      ? `${origin}/empleo/${empresaSlug}/${ofertaId}`
      : `${origin}/empleo/${empresaSlug}`;
  }, [origin, empresaSlug, ofertaId]);

  const iframeSnippet = useMemo(() => {
    return `<iframe
  src="${url}"
  title="Empleo ${empresaNombre}"
  width="100%"
  height="800"
  style="border:0; max-width:100%;"
  loading="lazy"
></iframe>`;
  }, [url, empresaNombre]);

  const buttonSnippet = useMemo(() => {
    const label = ofertaTitulo ? `Postular a "${ofertaTitulo}"` : "Trabaja con nosotros";
    return `<a
  href="${url}"
  target="_blank"
  rel="noopener noreferrer"
  style="display:inline-block;padding:14px 28px;background:#0f172a;color:#fff;border-radius:9999px;font-family:system-ui,sans-serif;font-weight:600;text-decoration:none;"
>${label}</a>`;
  }, [url, ofertaTitulo]);

  function copy(label: string, text: string) {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Compartir {ofertaTitulo ? "esta oferta" : "el portal de empleo"}
          </DialogTitle>
          <DialogDescription>
            Tres formas de añadir las ofertas de {empresaNombre} a tu web, redes o cualquier sitio.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="link" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Enlace
            </TabsTrigger>
            <TabsTrigger value="iframe" className="gap-1.5">
              <Code className="h-3.5 w-3.5" /> Iframe
            </TabsTrigger>
            <TabsTrigger value="button" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Botón
            </TabsTrigger>
          </TabsList>

          {/* Tab Enlace */}
          <TabsContent value="link" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>URL pública</Label>
              <div className="flex gap-2">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy("link", url)}
                  aria-label="Copiar enlace"
                >
                  {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir en nueva pestaña">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Compártela en LinkedIn, Twitter, WhatsApp o pégala en tu firma de email.
              </p>
            </div>
          </TabsContent>

          {/* Tab Iframe */}
          <TabsContent value="iframe" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Código para incrustar en tu web</Label>
              <Textarea
                value={iframeSnippet}
                readOnly
                rows={7}
                className="font-mono text-[11px]"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copy("iframe", iframeSnippet)}
              >
                {copied === "iframe" ? (
                  <><Check className="h-4 w-4 mr-1.5" /> Copiado</>
                ) : (
                  <><Copy className="h-4 w-4 mr-1.5" /> Copiar código iframe</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Pégalo en tu HTML donde quieras que aparezca el portal. Funciona en cualquier web.
              </p>
            </div>
          </TabsContent>

          {/* Tab Botón */}
          <TabsContent value="button" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Botón &quot;Trabaja con nosotros&quot;</Label>
              <Textarea
                value={buttonSnippet}
                readOnly
                rows={9}
                className="font-mono text-[11px]"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copy("button", buttonSnippet)}
              >
                {copied === "button" ? (
                  <><Check className="h-4 w-4 mr-1.5" /> Copiado</>
                ) : (
                  <><Copy className="h-4 w-4 mr-1.5" /> Copiar HTML del botón</>
                )}
              </Button>
              <div className="rounded-md bg-muted p-4 flex items-center justify-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "14px 28px",
                    background: "#0f172a",
                    color: "#fff",
                    borderRadius: "9999px",
                    fontFamily: "system-ui,sans-serif",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {ofertaTitulo ? `Postular a "${ofertaTitulo}"` : "Trabaja con nosotros"}
                </a>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
