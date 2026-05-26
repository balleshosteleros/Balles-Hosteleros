"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Code,
  Copy,
  ExternalLink,
  LayoutPanelTop,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getToken,
  rotarToken,
  setPlantillaActiva,
  listPlantillas,
} from "../../actions";
import { getBolsaConfig } from "../actions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaNombre?: string;
}

type Modo = "elegir" | "presentacion" | "bolsa";

export function DialogCompartirInspectores({
  open,
  onOpenChange,
  empresaNombre = "tu empresa",
}: Props) {
  const [modo, setModo] = useState<Modo>("elegir");

  useEffect(() => {
    if (!open) setModo("elegir");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {modo === "elegir" && (
          <ElegirPaso onPick={setModo} />
        )}
        {modo === "presentacion" && (
          <PresentacionPaso onBack={() => setModo("elegir")} />
        )}
        {modo === "bolsa" && (
          <BolsaPaso
            onBack={() => setModo("elegir")}
            empresaNombre={empresaNombre}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ElegirPaso({ onPick }: { onPick: (m: Modo) => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Compartir
        </DialogTitle>
        <DialogDescription>
          ¿Qué quieres compartir?
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <button
          type="button"
          onClick={() => onPick("presentacion")}
          className="rounded-xl border bg-card p-5 text-left hover:border-primary/60 hover:bg-primary/5 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutPanelTop className="h-4 w-4" />
            </span>
            <span className="font-semibold text-sm">Presentación</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enlace que el inspector abre para ver la presentación y rellenar la
            inspección.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onPick("bolsa")}
          className="rounded-xl border bg-card p-5 text-left hover:border-primary/60 hover:bg-primary/5 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </span>
            <span className="font-semibold text-sm">Bolsa de inspectores</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Formulario público para que nuevos inspectores se inscriban en tu
            bolsa.
          </p>
        </button>
      </div>
    </>
  );
}

function PresentacionPaso({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [plantillaActivaId, setPlantillaActivaId] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState<{ id: string; nombre: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadingRot, setLoadingRot] = useState(false);
  const [confirmRotarOpen, setConfirmRotarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([getToken(), listPlantillas()]).then(([t, ps]) => {
      setToken(t?.token ?? null);
      setPlantillaActivaId(t?.plantilla_activa_id ?? null);
      setPlantillas(
        ps.filter((p) => !p.archivada).map((p) => ({ id: p.id, nombre: p.nombre })),
      );
      setLoading(false);
    });
  }, []);

  const url = useMemo(() => {
    if (!token) return "";
    if (typeof window === "undefined") return `/inspectores/${token}`;
    return `${window.location.origin}/inspectores/${token}`;
  }, [token]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function confirmarRotacion() {
    setConfirmRotarOpen(false);
    setLoadingRot(true);
    const res = await rotarToken();
    setLoadingRot(false);
    if (res.ok) {
      setToken(res.token);
      toast.success("Enlace rotado. Actualiza el mensaje automático de Calidad.");
    } else {
      toast.error(res.error);
    }
  }

  async function cambiarPlantilla(id: string) {
    const res = await setPlantillaActiva(id);
    if (res.ok) {
      setPlantillaActivaId(id);
      toast.success("Plantilla activa actualizada");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1 h-7 px-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </Button>
        </div>
        <DialogTitle className="flex items-center gap-2 pt-1">
          <LayoutPanelTop className="h-5 w-5 text-primary" /> Compartir presentación
        </DialogTitle>
        <DialogDescription>
          Enlace público que el inspector abre para realizar la inspección.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Enlace público para inspectores</Label>
            <div className="flex items-center gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                onClick={copyLink}
                disabled={!token}
                aria-label="Copiar enlace"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                asChild
                disabled={!token}
                aria-label="Abrir en nueva pestaña"
              >
                <a href={url || "#"} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmRotarOpen(true)}
                disabled={loadingRot}
                className="gap-1.5 shrink-0"
              >
                {loadingRot ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Rotar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se mantiene estable salvo que lo rotes manualmente.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-xs">Plantilla activa</Label>
            <div className="grid gap-1.5">
              {plantillas.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Aún no hay plantillas. Crea una en la pestaña PLANTILLAS.
                </div>
              ) : (
                plantillas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => cambiarPlantilla(p.id)}
                    className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                      plantillaActivaId === p.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{p.nombre}</span>
                      {plantillaActivaId === p.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              La plantilla activa es la que el inspector verá automáticamente al
              abrir el enlace.
            </p>
          </div>
        </div>
      )}

      <AlertDialog open={confirmRotarOpen} onOpenChange={setConfirmRotarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ¿Rotar el enlace de inspecciones?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>
                    Esto invalida el enlace actual de forma inmediata e
                    irreversible.
                  </strong>
                </p>
                <p>Como consecuencia:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>
                    Cualquier inspector que abra el enlace antiguo verá un error
                    404.
                  </li>
                  <li>
                    El mensaje automático de Calidad{" "}
                    <strong>dejará de funcionar</strong> hasta que pegues el
                    enlace nuevo.
                  </li>
                  <li>
                    Los envíos ya recibidos NO se ven afectados, solo el acceso
                    futuro.
                  </li>
                </ul>
                <p className="pt-1">
                  Rota solo si necesitas cortar el acceso (p. ej. el enlace se ha
                  filtrado).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarRotacion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, rotar y cortar acceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BolsaPaso({
  onBack,
  empresaNombre,
}: {
  onBack: () => void;
  empresaNombre: string;
}) {
  const [empresaSlug, setEmpresaSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getBolsaConfig();
      if (res.ok) setEmpresaSlug(res.empresaSlug);
      setLoading(false);
    })();
  }, []);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const url = useMemo(() => {
    if (!origin || !empresaSlug) return "";
    return `${origin}/inspectores/bolsa/${empresaSlug}`;
  }, [origin, empresaSlug]);

  const iframeSnippet = useMemo(() => {
    return `<iframe
  src="${url}"
  title="Bolsa de inspectores ${empresaNombre}"
  width="100%"
  height="800"
  style="border:0; max-width:100%;"
  loading="lazy"
></iframe>`;
  }, [url, empresaNombre]);

  const buttonSnippet = useMemo(() => {
    return `<a
  href="${url}"
  target="_blank"
  rel="noopener noreferrer"
  style="display:inline-block;padding:14px 28px;background:#0f172a;color:#fff;border-radius:9999px;font-family:system-ui,sans-serif;font-weight:600;text-decoration:none;"
>Únete como inspector</a>`;
  }, [url]);

  function copy(label: string, text: string) {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1 h-7 px-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </Button>
        </div>
        <DialogTitle className="flex items-center gap-2 pt-1">
          <Users className="h-5 w-5 text-primary" /> Compartir la bolsa de
          inspectores
        </DialogTitle>
        <DialogDescription>
          Tres formas de añadir la bolsa a tu web, redes o cualquier sitio.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !empresaSlug ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          La empresa no tiene <code>slug</code>. Configúralo en Ajustes →
          Empresas para activar la URL pública.
        </div>
      ) : (
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
                  {copied === "link" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir en nueva pestaña"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Compártela en LinkedIn, Twitter, WhatsApp o pégala en tu firma
                de email.
              </p>
            </div>
          </TabsContent>

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
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" /> Copiar código iframe
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Pégalo en tu HTML donde quieras que aparezca la bolsa. Funciona
                en cualquier web.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="button" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Botón &quot;Únete como inspector&quot;</Label>
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
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" /> Copiar HTML del botón
                  </>
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
                  Únete como inspector
                </a>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
