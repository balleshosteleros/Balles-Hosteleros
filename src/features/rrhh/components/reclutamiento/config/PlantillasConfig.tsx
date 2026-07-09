import { useState, useMemo, useEffect, useTransition, useCallback, useRef } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Pencil, Mail, Eye, Search, Plus, Copy, Trash2,
  Variable, CheckCircle2, XCircle, Loader2,
  ClipboardList, Link2, FileText, Building2, Lock, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLAVES_ONBOARDING_PROTEGIDAS,
  etiquetaDestino,
  OPCIONES_DESTINO,
  DEPARTAMENTOS_CORREO,
  normalizarDestinoDepartamento,
  type DestinoPlantilla,
} from "@/features/rrhh/lib/plantillas-onboarding";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { CuestionariosVacanteManager } from "./CuestionariosVacanteManager";
import { DocumentosPlantillaTab } from "./DocumentosPlantillaTab";
import {
  VARIABLES_RECLUTAMIENTO,
  GRUPOS_VARIABLES_RECLUTAMIENTO,
  VARIABLES_RECLUTAMIENTO_EJEMPLO,
  sustituirVariablesReclutamiento,
  parsearEnlacesCuerpo,
  segmentoEsBoton,
  formatearEnlaceMarkdown,
} from "@/features/rrhh/lib/reclutamiento-email";
import {
  listReclutamientoEmailPlantillas,
  createReclutamientoEmailPlantilla,
  updateReclutamientoEmailPlantilla,
  toggleReclutamientoEmailPlantillaActiva,
  duplicateReclutamientoEmailPlantilla,
  deleteReclutamientoEmailPlantilla,
  type ReclutamientoEmailPlantilla,
} from "@/features/rrhh/actions/reclutamiento-email-plantillas-actions";
import { toast } from "sonner";

// ─── Editor modal (crear / editar) ──────────────────────────────
function PlantillaEditorDialog({
  plantilla,
  open,
  onOpenChange,
  onSaved,
  empresaNombre,
  empresaIsotipoUrl,
  initialTab = "editar",
}: {
  plantilla: ReclutamientoEmailPlantilla | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  empresaNombre: string;
  empresaIsotipoUrl?: string;
  initialTab?: "editar" | "preview";
}) {
  const [nombre, setNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [activa, setActiva] = useState(true);
  const [destino, setDestino] = useState<DestinoPlantilla>("candidato");
  const [destinoEmail, setDestinoEmail] = useState("");
  const [tab, setTab] = useState<"editar" | "preview">(initialTab);
  const [pending, startTransition] = useTransition();
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTexto, setLinkTexto] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Sincroniza el formulario al abrir o cambiar de plantilla.
  const plantillaId = plantilla?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setNombre(plantilla?.nombre ?? "");
    setAsunto(plantilla?.asunto ?? "");
    setCuerpo(plantilla?.cuerpo ?? "");
    setActiva(plantilla?.activa ?? true);
    // Normaliza destinos heredados (gestoria/rrhh) al modelo actual (departamento).
    const norm = normalizarDestinoDepartamento(
      plantilla?.destino ?? "candidato",
      plantilla?.destinoEmail ?? "",
    );
    setDestino(norm.destino);
    setDestinoEmail(
      norm.destino === "departamento"
        ? norm.destinoEmail || "correoRrhh"
        : norm.destinoEmail ?? "",
    );
    setTab(initialTab);
  }, [open, plantillaId, plantilla, initialTab]);

  // Nota: los correos de departamento se resuelven al ENVIAR, desde Ajustes →
  // Empresa. La vista previa muestra la etiqueta del departamento, no la dirección.

  const insertVariable = (variable: string) => {
    setCuerpo((prev) => (prev.endsWith(" ") || prev === "" ? prev : prev + " ") + variable);
  };

  // Abre el diálogo de enlace, precargando el texto seleccionado en el cuerpo.
  const openLinkDialog = () => {
    const el = cuerpoRef.current;
    const sel = el ? cuerpo.slice(el.selectionStart, el.selectionEnd) : "";
    setLinkTexto(sel.trim());
    setLinkUrl("");
    setLinkOpen(true);
  };

  // Inserta `[texto](url)` en la posición del cursor (o reemplaza la selección).
  const insertLink = () => {
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const snippet = formatearEnlaceMarkdown(linkTexto, url);
    const el = cuerpoRef.current;
    const start = el?.selectionStart ?? cuerpo.length;
    const end = el?.selectionEnd ?? cuerpo.length;
    const next = cuerpo.slice(0, start) + snippet + cuerpo.slice(end);
    setCuerpo(next);
    setLinkOpen(false);
    // Devuelve el foco y coloca el cursor tras el enlace insertado.
    requestAnimationFrame(() => {
      const node = cuerpoRef.current;
      if (!node) return;
      node.focus();
      const pos = start + snippet.length;
      node.setSelectionRange(pos, pos);
    });
  };

  const previewVars = { ...VARIABLES_RECLUTAMIENTO_EJEMPLO, empresa_nombre: empresaNombre };

  // Plantilla del sistema (gestoría, contratos, prueba): se identifica por su
  // CLAVE estable, no por el nombre → el nombre YA es editable y se propaga solo.
  // Solo se protege del borrado.
  const esDelSistema = plantilla?.clave ? CLAVES_ONBOARDING_PROTEGIDAS.has(plantilla.clave) : false;

  const handleSave = () => {
    if (destino === "personalizado" && !destinoEmail.trim()) {
      toast.error("Escribe el email del destinatario personalizado");
      return;
    }
    startTransition(async () => {
      const payload = { nombre, asunto, cuerpo, activa, destino, destinoEmail: destinoEmail.trim() };
      const res = plantilla
        ? await updateReclutamientoEmailPlantilla(plantilla.id, payload)
        : await createReclutamientoEmailPlantilla(payload);
      if (res.ok) {
        toast.success(plantilla ? "Plantilla guardada" : "Plantilla creada");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-primary" />
            {plantilla ? "Editar plantilla" : "Nueva plantilla de email"}
          </DialogTitle>
          <DialogDescription>
            Las plantillas son sueltas: créalas aquí y asóciales un estado desde Plantillas de estados o desde cada vacante.
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border">
          <button
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === "editar" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("editar")}
          >
            <Pencil className="h-3.5 w-3.5 inline mr-1.5" />Editar
          </button>
          <button
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === "preview" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("preview")}
          >
            <Eye className="h-3.5 w-3.5 inline mr-1.5" />Vista previa
          </button>
        </div>

        <ScrollArea className="max-h-[calc(90vh-210px)]">
          {tab === "editar" ? (
            <div className="px-6 py-5 space-y-5">
              {/* Nota para plantillas del sistema: se pueden editar y renombrar,
                  pero no borrar (el flujo las dispara automáticamente). */}
              {esDelSistema && (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <Lock className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Plantilla del <strong>sistema</strong>: la dispara el flujo automáticamente. Puedes editar
                    su nombre, asunto, texto y destinatario, pero no se puede borrar.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={activa} onCheckedChange={setActiva} />
                <Label className="text-xs">
                  {activa ? "Activa — se puede enviar al pasar a un estado asociado" : "Inactiva — no se envía correo"}
                </Label>
              </div>

              <div>
                <Label className="text-xs">Nombre de la plantilla</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-1"
                  placeholder="Ej. Bienvenida al proceso"
                />
              </div>

              {/* Destinatario: a quién se envía este correo. */}
              <div>
                <Label className="text-xs">Se envía a</Label>
                <Select
                  value={destino}
                  onValueChange={(v) => {
                    const d = v as DestinoPlantilla;
                    setDestino(d);
                    // Al elegir «Departamento», precarga uno por defecto (RRHH) si
                    // el valor guardado no es ya una clave de departamento válida.
                    if (d === "departamento" &&
                        !DEPARTAMENTOS_CORREO.some((x) => x.clave === destinoEmail)) {
                      setDestinoEmail("correoRrhh");
                    }
                    if (d === "personalizado" &&
                        DEPARTAMENTOS_CORREO.some((x) => x.clave === destinoEmail)) {
                      setDestinoEmail("");
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_DESTINO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {OPCIONES_DESTINO.find((o) => o.value === destino)?.ayuda}
                </p>
                {destino === "departamento" && (
                  <>
                    <Select value={destinoEmail || "correoRrhh"} onValueChange={setDestinoEmail}>
                      <SelectTrigger className="mt-2 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTAMENTOS_CORREO.map((d) => (
                          <SelectItem key={d.clave} value={d.clave}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      El correo se toma de Ajustes → Empresa → «Correos electrónicos».
                    </p>
                  </>
                )}
                {destino === "personalizado" && (
                  <Input
                    value={destinoEmail}
                    onChange={(e) => setDestinoEmail(e.target.value)}
                    className="mt-2"
                    type="email"
                    placeholder="correo@ejemplo.com"
                  />
                )}
              </div>

              <div>
                <Label className="text-xs">Asunto del email</Label>
                <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="mt-1" placeholder="Asunto del email..." />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Cuerpo del email</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={openLinkDialog}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Insertar enlace
                  </Button>
                </div>
                <Textarea
                  ref={cuerpoRef}
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  className="min-h-[220px] text-sm"
                  placeholder="Escribe el contenido del email..."
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Para enlazar a una web externa: selecciona el texto y pulsa «Insertar enlace», o escribe{" "}
                  <span className="font-mono">[texto](https://…)</span>. Las direcciones sueltas también se enlazan solas.
                </p>
              </div>

              <Separator />

              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1">
                  <Variable className="h-3.5 w-3.5 text-primary" /> Códigos disponibles
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Haz clic en un código para insertarlo. Al enviar el email se sustituye automáticamente por el dato real.
                </p>
                <div className="space-y-3">
                  {GRUPOS_VARIABLES_RECLUTAMIENTO.map((grupo) => {
                    const vars = VARIABLES_RECLUTAMIENTO.filter((v) => v.grupo === grupo);
                    if (vars.length === 0) return null;
                    return (
                      <div key={grupo}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{grupo}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {vars.map((v) => (
                            <button
                              key={v.variable}
                              onClick={() => insertVariable(v.variable)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-muted/50 text-[11px] font-mono text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
                              title={v.descripcion}
                            >
                              {v.variable}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Para:</span>{" "}
                    {destino === "candidato"
                      ? VARIABLES_RECLUTAMIENTO_EJEMPLO.candidato_email
                      : destino === "personalizado"
                        ? destinoEmail || "(escribe el email personalizado)"
                        : `${etiquetaDestino(destino, destinoEmail)} · correo de Ajustes → Empresa`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium">Asunto:</span> {sustituirVariablesReclutamiento(asunto, previewVars)}
                  </p>
                </div>
                {/* Cuerpo del correo TAL CUAL lo recibe el destinatario: logo de
                    la empresa arriba, botones para los CTA (enlace solo en su
                    línea) y pie automático. Coincide con bodyToHtml del envío. */}
                <div className="bg-white text-[#111827]">
                  {empresaIsotipoUrl && (
                    <div className="text-center px-6 pt-8 pb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={empresaIsotipoUrl}
                        alt={empresaNombre}
                        className="inline-block h-auto w-auto max-h-[88px] max-w-[220px]"
                      />
                    </div>
                  )}
                  <div className="px-6 py-5 text-sm leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      const segs = parsearEnlacesCuerpo(
                        sustituirVariablesReclutamiento(cuerpo, previewVars),
                      );
                      return segs.map((seg, i) => {
                        if (seg.type !== "link") return <span key={i}>{seg.value}</span>;
                        if (segmentoEsBoton(segs, i)) {
                          return (
                            <a
                              key={i}
                              href={seg.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block my-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white no-underline hover:bg-blue-700"
                            >
                              {seg.text}
                            </a>
                          );
                        }
                        return (
                          <a key={i} href={seg.href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                            {seg.text}
                          </a>
                        );
                      });
                    })()}
                  </div>
                  <div className="px-6 pb-6">
                    <p className="border-t border-[#e5e7eb] pt-3 text-[12px] leading-relaxed text-[#9ca3af]">
                      Este mensaje se ha enviado de forma automática desde una dirección que no admite respuestas. Por favor, no respondas a este correo.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Vista previa con datos de ejemplo. Los códigos se sustituirán con los datos reales del candidato al enviar.
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {plantilla ? "Guardar" : "Crear plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Sub-diálogo: insertar enlace externo */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-5 w-5 text-primary" /> Insertar enlace
            </DialogTitle>
            <DialogDescription>
              El texto se mostrará como enlace y al pulsarlo abrirá la dirección externa en una pestaña nueva.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-xs">Texto a mostrar</Label>
              <Input
                value={linkTexto}
                onChange={(e) => setLinkTexto(e.target.value)}
                className="mt-1"
                placeholder="Ej. Rellena el formulario"
              />
            </div>
            <div>
              <Label className="text-xs">Dirección (URL)</Label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1"
                placeholder="https://..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button onClick={insertLink} disabled={!linkUrl.trim()} className="gap-1.5">
              <Link2 className="h-4 w-4" /> Insertar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ─── Pestaña de Emails (biblioteca suelta) ──────────────────────
function PlantillasEmailTab() {
  const { empresaActual, getIsotipoUrl } = useEmpresa();
  const empresaIsotipoUrl = getIsotipoUrl(empresaActual.id) || undefined;
  const [plantillas, setPlantillas] = useState<ReclutamientoEmailPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReclutamientoEmailPlantilla | null>(null);
  const [creando, setCreando] = useState(false);
  const [editingTab, setEditingTab] = useState<"editar" | "preview">("editar");
  const [search, setSearch] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<string>("todos");
  const { confirm, dialog } = useConfirmDelete();

  const reload = useCallback(async () => {
    const data = await listReclutamientoEmailPlantillas();
    setPlantillas(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    let list = plantillas;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(s) || p.asunto.toLowerCase().includes(s));
    }
    if (filtroActivo === "activas") list = list.filter((p) => p.activa);
    if (filtroActivo === "inactivas") list = list.filter((p) => !p.activa);
    return list;
  }, [plantillas, search, filtroActivo]);

  const handleToggle = (id: string, current: boolean) => {
    setPlantillas((prev) => prev.map((p) => (p.id === id ? { ...p, activa: !current } : p)));
    void (async () => {
      const res = await toggleReclutamientoEmailPlantillaActiva(id, !current);
      if (res.ok) {
        toast.success("Estado de la plantilla actualizado");
      } else {
        toast.error(res.error);
        setPlantillas((prev) => prev.map((p) => (p.id === id ? { ...p, activa: current } : p)));
      }
    })();
  };

  const handleDuplicate = async (p: ReclutamientoEmailPlantilla) => {
    const res = await duplicateReclutamientoEmailPlantilla(p.id);
    if (res.ok) {
      toast.success("Plantilla duplicada");
      void reload();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async (p: ReclutamientoEmailPlantilla) => {
    const ok = await confirm({
      title: "¿Eliminar plantilla de email?",
      description: `Se eliminará «${p.nombre}». Se quitará su asociación de los estados y vacantes que la usaran.`,
    });
    if (!ok) return;
    const res = await deleteReclutamientoEmailPlantilla(p.id);
    if (res.ok) {
      toast.success("Plantilla eliminada");
      void reload();
    } else {
      toast.error(res.error);
    }
  };

  const activasCount = plantillas.filter((p) => p.activa).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Plantillas de email</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Biblioteca de correos reutilizables. Asocia cada uno a un estado en cada vacante.
            {!loading && <> {" "}{activasCount} de {plantillas.length} activas.</>}
          </p>
        </div>
        <Button onClick={() => setCreando(true)} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      {/* Buscar + filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar plantilla..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filtroActivo} onValueChange={setFiltroActivo}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="activas">Activas</SelectItem>
            <SelectItem value="inactivas">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando plantillas…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {plantillas.length === 0 ? "No hay plantillas de email todavía." : "Ninguna plantilla coincide con el filtro."}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {filtered.map((p) => {
              // Normaliza destinos heredados (gestoria/rrhh) → departamento.
              const dn = normalizarDestinoDepartamento(p.destino, p.destinoEmail);
              const destino = dn.destino;
              const protegida = p.clave ? CLAVES_ONBOARDING_PROTEGIDAS.has(p.clave) : false;
              return (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{p.nombre}</span>
                      {destino === "departamento" && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200" title="Se envía al correo de este departamento (Ajustes → Empresa)">
                          <Building2 className="h-3 w-3" /> {etiquetaDestino(destino, dn.destinoEmail)}
                        </Badge>
                      )}
                      {destino === "candidato" && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200" title="Este correo se envía al candidato registrado">
                          <User className="h-3 w-3" /> Candidato
                        </Badge>
                      )}
                      {destino === "personalizado" && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-violet-50 text-violet-700 border-violet-200" title={p.destinoEmail ? `Se envía a ${p.destinoEmail}` : "Destinatario personalizado"}>
                          <Mail className="h-3 w-3" /> {p.destinoEmail || "Personalizado"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">Asunto:</span> {p.asunto}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant={p.activa ? "secondary" : "outline"}
                    className={`text-[10px] gap-1 ${p.activa ? "bg-emerald-100 text-emerald-700" : ""}`}
                  >
                    {p.activa ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {p.activa ? "Activa" : "Inactiva"}
                  </Badge>
                  <Switch checked={p.activa} onCheckedChange={() => handleToggle(p.id, p.activa)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTab("editar"); setEditing(p); }} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTab("preview"); setEditing(p); }} title="Vista previa">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(p)} title="Duplicar">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {protegida ? (
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/50 cursor-not-allowed"
                      title="Plantilla del sistema · no se puede borrar"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(p)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Editor (editar) */}
      <PlantillaEditorDialog
        plantilla={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={reload}
        empresaNombre={empresaActual.nombre}
        empresaIsotipoUrl={empresaIsotipoUrl}
        initialTab={editingTab}
      />
      {/* Editor (crear) */}
      <PlantillaEditorDialog
        plantilla={null}
        open={creando}
        onOpenChange={setCreando}
        onSaved={reload}
        empresaNombre={empresaActual.nombre}
        empresaIsotipoUrl={empresaIsotipoUrl}
        initialTab="editar"
      />
      {dialog}
    </div>
  );
}

// ─── Selector de tipo de plantilla (3 botones azules) ───────────
// Las FASES/estados del pipeline son fijas del software (Selección · Onboarding ·
// Descartado): no se editan desde aquí, para no romper el flujo. Por eso no hay
// pestaña «Estados».
type TipoPlantilla = "emails" | "cuestionarios" | "documentos";

const BOTONES_PLANTILLA: { id: TipoPlantilla; label: string; icon: React.ReactNode }[] = [
  { id: "emails", label: "Emails", icon: <Mail className="h-4 w-4" /> },
  { id: "cuestionarios", label: "Cuestionarios", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "documentos", label: "Documentos", icon: <FileText className="h-4 w-4" /> },
];

export function PlantillasConfig() {
  const [tipo, setTipo] = useState<TipoPlantilla>("emails");

  return (
    <div className="space-y-6">
      {/* 3 botones azules — los 3 tipos de plantilla */}
      <div className="flex flex-wrap items-center gap-2">
        {BOTONES_PLANTILLA.map((b) => {
          const activo = tipo === b.id;
          return (
            <Button
              key={b.id}
              onClick={() => setTipo(b.id)}
              variant={activo ? "default" : "outline"}
              className={cn(
                "gap-2",
                activo
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              {b.icon}
              {b.label}
            </Button>
          );
        })}
      </div>

      {tipo === "emails" && <PlantillasEmailTab />}
      {tipo === "cuestionarios" && <CuestionariosVacanteManager />}
      {tipo === "documentos" && <DocumentosPlantillaTab />}
    </div>
  );
}
