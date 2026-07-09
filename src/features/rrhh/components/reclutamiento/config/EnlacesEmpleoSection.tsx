"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Copy, Check, Power, Trash2, Link2, Code, Sparkles, ExternalLink, Globe, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  getEmpleoUrlConfig,
  updateEmpleoUrlSlug,
} from "@/features/rrhh/actions/reclutamiento-actions";

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/** Solo deja el nombre apto para URL (igual que el servidor) — feedback en vivo. */
function sanitizeSlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

/** Deriva el código de URL a partir del nombre del canal (sin tildes, MAYÚSCULAS, _). */
function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CODIGO_MAX);
}

interface Props {
  empresaNombre: string;
}

/**
 * Enlaces del portal de empleo (antes diálogo «Enlaces» en la toolbar).
 * Vive embebido dentro de la página «Portal de empleo» de la configuración.
 */
export function EnlacesEmpleoSection({ empresaNombre }: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [links, setLinks] = useState<EmpleoLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, startCreate] = useTransition();
  const [copiado, setCopiado] = useState<string | null>(null);

  // ── Nombre de la empresa en la URL (slug del portal) ──
  const [origin, setOrigin] = useState("");
  const [slugCargando, setSlugCargando] = useState(true);
  const [slugGuardando, setSlugGuardando] = useState(false);
  // `slugGuardado` = lo que vive en BD (URL que funciona). `slugValor` = lo que se edita.
  const [slugGuardado, setSlugGuardado] = useState("");
  const [slugValor, setSlugValor] = useState("");

  async function refrescar() {
    setLoading(true);
    const r = await listEmpleoLinks();
    if (r.ok) setLinks(r.data);
    else toast.error(r.error ?? "Error al cargar enlaces");
    setLoading(false);
  }

  useEffect(() => {
    refrescar();
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let alive = true;
    setSlugCargando(true);
    getEmpleoUrlConfig()
      .then((cfg) => {
        if (!alive) return;
        const inicial = cfg?.empleoSlug || sanitizeSlug(cfg?.nombreComercial ?? empresaNombre);
        setSlugGuardado(inicial);
        setSlugValor(inicial);
      })
      .catch((err) => console.error("[EnlacesEmpleoSection] getEmpleoUrlConfig:", err))
      .finally(() => {
        if (alive) setSlugCargando(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaNombre]);

  const urlSlugGuardada = useMemo(
    () => (origin && slugGuardado ? `${origin}/empleo/${slugGuardado}` : ""),
    [origin, slugGuardado],
  );
  const urlSlugPreview = useMemo(
    () => (origin && slugValor ? `${origin}/empleo/${slugValor}` : ""),
    [origin, slugValor],
  );
  const haySlugCambios = slugValor !== slugGuardado;

  async function guardarSlug() {
    const limpio = sanitizeSlug(slugValor).replace(/-+$/, "");
    if (!limpio) {
      toast.error("Escribe un nombre válido para la URL.");
      return;
    }
    setSlugGuardando(true);
    try {
      const res = await updateEmpleoUrlSlug(limpio);
      if (res.ok) {
        setSlugGuardado(res.empleoSlug);
        setSlugValor(res.empleoSlug);
        toast.success("URL del portal de empleo guardada");
        refrescar(); // los enlaces (iframe/botón) usan el nuevo slug
      } else if (res.sugerencia) {
        const sugerida = res.sugerencia;
        toast.error(res.error, {
          action: {
            label: `Usar "${sugerida}"`,
            onClick: () => setSlugValor(sugerida),
          },
        });
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error("[EnlacesEmpleoSection] guardarSlug:", err);
      toast.error("No se pudo guardar la URL.");
    } finally {
      setSlugGuardando(false);
    }
  }

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
    <>
      {confirmDeleteDialog}

      {/* ── Nombre en la URL + enlace web e incrustar ──────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Enlace web e incrustar</span>
        </div>
        <CardContent className="p-5 space-y-5">
          {/* Nombre de la empresa en la URL */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Escribe el nombre de tu empresa, el cual aparecerá en la URL que verán tus futuros
              candidatos. Por defecto usamos el nombre comercial que ya guardaste.
            </p>

            {slugCargando ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            ) : (
              <>
                <div className="max-w-md">
                  <Label className="text-xs">Nombre en la URL</Label>
                  <Input
                    value={slugValor}
                    onChange={(e) => setSlugValor(sanitizeSlug(e.target.value))}
                    placeholder={empresaNombre}
                    className="mt-1"
                    maxLength={60}
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    La URL para ver todas tus vacantes quedará así:
                  </p>
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-3 border border-border">
                    <span className="text-sm font-mono text-primary flex-1 truncate">
                      {urlSlugPreview || "—"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => copiar(urlSlugGuardada, "slug-url", "URL copiada")}
                      disabled={haySlugCambios || !urlSlugGuardada}
                      title={haySlugCambios ? "Guarda los cambios antes de copiar" : undefined}
                    >
                      {copiado === "slug-url" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copiar
                    </Button>
                    {urlSlugGuardada && !haySlugCambios ? (
                      <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <a href={urlSlugGuardada} target="_blank" rel="noopener noreferrer" aria-label="Abrir en nueva pestaña">
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  {haySlugCambios && (
                    <p className="text-[11px] text-amber-600 mt-1.5">
                      Tienes cambios sin guardar. Pulsa «Guardar» para activarlos.
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button className="gap-1.5" onClick={guardarSlug} disabled={slugGuardando || !haySlugCambios}>
                    {slugGuardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Guardar
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Incrustar el portal en tu web */}
          <div className="border-t border-border pt-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              Comparte el enlace web por defecto en tu página y redes o incrústalo. Todo CV que llegue
              sin un canal concreto cuenta como «Web».
            </p>

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
                  <Label>URL pública (con atribución «Web»)</Label>
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-3 border border-border">
                    <span className="text-sm font-mono text-primary flex-1 truncate">
                      {webUrl || "—"}
                    </span>
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => copiar(webUrl, "web-link", "Enlace copiado")}>
                      {copiado === "web-link" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copiar
                    </Button>
                    {webUrl ? (
                      <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <a href={webUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir en nueva pestaña">
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
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
        </CardContent>
      </Card>

      {/* ── Otros canales ──────────────────────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Enlaces por canal</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Crea un enlace distinto por sitio (Instagram, InfoJobs, cartel…). Cada CV que llegue por
            él queda etiquetado con su canal, así sabes por dónde llega cada candidatura.
          </p>

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
        </CardContent>
      </Card>
    </>
  );
}
