"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Copy, Check, Power, Trash2, Link2, Code, Sparkles, ExternalLink, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  CODIGO_MAX,
  validarCodigo,
  type EmpleoLink,
} from "@/features/empleo-publico/data/empleo-links";
import {
  listEmpleoLinks,
  createEmpleoLink,
  toggleEmpleoLink,
  deleteEmpleoLink,
} from "@/features/rrhh/actions/empleo-links-actions";

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/** Deriva el código de URL a partir del nombre del canal (sin tildes, MAYÚSCULAS, _). */
function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CODIGO_MAX);
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaNombre: string;
}

export function EnlacesEmpleoDialog({ open, onOpenChange, empresaNombre }: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [links, setLinks] = useState<EmpleoLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, startCreate] = useTransition();
  const [copiado, setCopiado] = useState<string | null>(null);

  async function refrescar() {
    setLoading(true);
    const r = await listEmpleoLinks();
    if (r.ok) setLinks(r.data);
    else toast.error(r.error ?? "Error al cargar enlaces");
    setLoading(false);
  }

  useEffect(() => {
    if (open) refrescar();
  }, [open]);

  const webLink = useMemo(() => links.find((l) => l.protegido) ?? null, [links]);
  const canales = useMemo(() => links.filter((l) => !l.protegido), [links]);

  const codigoNuevo = useMemo(() => codigoDesdeNombre(nuevoNombre), [nuevoNombre]);
  const nombreValido = nuevoNombre.trim().length > 0 && validarCodigo(codigoNuevo).ok;

  // Snippets para incrustar el portal en la web (basados en el enlace WEB por defecto).
  const webUrl = webLink?.urlGenerada ?? "";
  const iframeSnippet = useMemo(() => (
    `<iframe
  src="${webUrl}"
  title="Empleo ${empresaNombre}"
  width="100%"
  height="800"
  style="border:0; max-width:100%;"
  loading="lazy"
></iframe>`
  ), [webUrl, empresaNombre]);
  const buttonSnippet = useMemo(() => (
    `<a
  href="${webUrl}"
  target="_blank"
  rel="noopener noreferrer"
  style="display:inline-block;padding:14px 28px;background:#0f172a;color:#fff;border-radius:9999px;font-family:system-ui,sans-serif;font-weight:600;text-decoration:none;"
>Trabaja con nosotros</a>`
  ), [webUrl]);

  function copiar(text: string, key: string, mensaje = "Copiado al portapapeles") {
    if (typeof navigator === "undefined" || !text) return;
    void navigator.clipboard.writeText(text);
    setCopiado(key);
    toast.success(mensaje);
    setTimeout(() => setCopiado((cur) => (cur === key ? null : cur)), 1800);
  }

  function onCrear() {
    if (!nombreValido) return;
    startCreate(async () => {
      const r = await createEmpleoLink({
        codigo: codigoNuevo,
        nombre: nuevoNombre.trim(),
      });
      if (!r.ok) {
        toast.error(r.error ?? "Error al crear el canal");
        return;
      }
      toast.success(`Canal "${r.data!.nombre}" creado`);
      setNuevoNombre("");
      refrescar();
    });
  }

  async function onToggle(link: EmpleoLink) {
    const r = await toggleEmpleoLink(link.id, !link.activo);
    if (!r.ok) {
      toast.error(r.error ?? "Error al actualizar");
      return;
    }
    refrescar();
  }

  async function onEliminar(link: EmpleoLink) {
    const ok = await confirmDelete({
      title: "Eliminar canal",
      description: `¿Eliminar el canal "${link.nombre}"? Las candidaturas históricas conservarán el canal.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const r = await deleteEmpleoLink(link.id);
    if (!r.ok) {
      toast.error(r.error ?? "Error al eliminar");
      return;
    }
    toast.success("Canal eliminado");
    refrescar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {confirmDeleteDialog}
        <DialogHeader>
          <DialogTitle>Enlaces del portal de empleo</DialogTitle>
          <DialogDescription>
            Comparte el enlace web por defecto en tu página y redes, o crea un canal por cada
            sitio (Instagram, InfoJobs, cartel…) para saber por dónde llega cada CV.
          </DialogDescription>
        </DialogHeader>

        {/* ── Enlace WEB por defecto ─────────────────────────── */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-medium">Enlace web</span>
            <Badge variant="secondary" className="text-[10px]">Por defecto</Badge>
            <span className="text-xs text-muted-foreground">
              El que pones en tu web. Todo CV sin un canal concreto cuenta como «Web».
            </span>
          </div>

          {loading && !webLink ? (
            <p className="text-sm text-muted-foreground py-2">Cargando…</p>
          ) : (
            <Tabs defaultValue="link">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="link" className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Enlace</TabsTrigger>
                <TabsTrigger value="iframe" className="gap-1.5"><Code className="h-3.5 w-3.5" /> Iframe</TabsTrigger>
                <TabsTrigger value="button" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Botón</TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="space-y-1.5 mt-3">
                <Label>URL pública</Label>
                <div className="flex gap-2">
                  <Input value={webUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copiar(webUrl, "web-link", "Enlace copiado")} aria-label="Copiar enlace">
                    {copiado === "web-link" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  {webUrl ? (
                    <Button asChild variant="outline" size="icon">
                      <a href={webUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir en nueva pestaña">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Pégala en tu web, LinkedIn, WhatsApp o en tu firma de email.
                </p>
              </TabsContent>

              <TabsContent value="iframe" className="space-y-2 mt-3">
                <Label>Código para incrustar en tu web</Label>
                <Textarea value={iframeSnippet} readOnly rows={7} className="font-mono text-[11px]" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
                <Button variant="outline" size="sm" className="w-full" onClick={() => copiar(iframeSnippet, "web-iframe")}>
                  {copiado === "web-iframe" ? <><Check className="h-4 w-4 mr-1.5" /> Copiado</> : <><Copy className="h-4 w-4 mr-1.5" /> Copiar código iframe</>}
                </Button>
              </TabsContent>

              <TabsContent value="button" className="space-y-2 mt-3">
                <Label>Botón &quot;Trabaja con nosotros&quot;</Label>
                <Textarea value={buttonSnippet} readOnly rows={8} className="font-mono text-[11px]" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
                <Button variant="outline" size="sm" className="w-full" onClick={() => copiar(buttonSnippet, "web-button")}>
                  {copiado === "web-button" ? <><Check className="h-4 w-4 mr-1.5" /> Copiado</> : <><Copy className="h-4 w-4 mr-1.5" /> Copiar HTML del botón</>}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* ── Otros canales ──────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Otros canales</h3>
            <p className="text-xs text-muted-foreground">
              Un enlace distinto por sitio. Cada CV que llegue por él queda etiquetado con su canal.
            </p>
          </div>

          {/* Alta de canal */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="canal-nombre">Canal</Label>
                <Input
                  id="canal-nombre"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Instagram, InfoJobs, cartel…"
                  onKeyDown={(e) => { if (e.key === "Enter") onCrear(); }}
                />
              </div>
              <Button size="sm" onClick={onCrear} disabled={!nombreValido || creando}>
                {creando ? "Creando…" : "Añadir canal"}
              </Button>
            </div>
            {nuevoNombre.trim() && (
              <p className="text-[11px] text-muted-foreground">
                Enlace: <code className="text-muted-foreground">…?o={codigoNuevo.toLowerCase()}</code>
              </p>
            )}
          </div>

          {/* Lista de canales */}
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Enlace</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Creado</th>
                  <th className="px-3 py-2 text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Cargando…</td></tr>
                )}
                {!loading && canales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-8">
                      <Link2 className="h-7 w-7 mx-auto mb-2 opacity-40" />
                      <div>Sin canales adicionales.</div>
                      <div className="text-xs">Crea uno para diferenciar por dónde llegan los CV.</div>
                    </td>
                  </tr>
                )}
                {!loading && canales.map((l) => (
                  <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{l.nombre}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 max-w-[320px]">
                        <code className="text-xs text-muted-foreground truncate">{l.urlGenerada}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copiar(l.urlGenerada, l.id, "Enlace copiado")} title="Copiar">
                          {copiado === l.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {l.activo
                        ? <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/15">Activo</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatFecha(l.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onToggle(l)} title={l.activo ? "Desactivar" : "Activar"}>
                          <Power className={l.activo ? "h-3.5 w-3.5 text-emerald-600" : "h-3.5 w-3.5 text-muted-foreground"} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onEliminar(l)} title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
