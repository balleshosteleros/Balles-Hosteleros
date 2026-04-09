import { useState } from "react";
import type { ProcesoJuridico, ActualizacionProceso, DocumentoProceso } from "@/features/juridico/data/procesos-juridicos";
import { JURIDICOS, CATEGORIAS_DOCUMENTO, type CategoriaDocumento } from "@/features/juridico/data/procesos-juridicos";
import { tiempoTranscurrido } from "@/shared/lib/timeUtils";
import { EstadoProcesoBadge, GravedadProcesoBadge } from "@/features/juridico/components/BadgesProceso";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Clock, Plus, User, CalendarDays, MessageSquare, FileText, ExternalLink, Download, Upload, FolderOpen, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  item: ProcesoJuridico;
  onAddActualizacion: (procesoId: string, act: ActualizacionProceso) => void;
  onAddDocumento?: (procesoId: string, doc: DocumentoProceso) => void;
}

/* ---- Reusable doc list ---- */
function DocumentosList({ docs, label, icon: Icon }: { docs: DocumentoProceso[]; label: string; icon: React.ElementType }) {
  if (docs.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label} ({docs.length})
      </div>
      {docs.map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-sm rounded-md border p-2 bg-muted/20">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground text-xs block truncate">{d.nombre}</span>
            <span className="text-[11px] text-muted-foreground block truncate">{d.descripcion}</span>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <Badge variant="outline" className="text-[9px] px-1 py-0">{d.categoria}</Badge>
              <span>{d.subidoPor}</span>
              <span>·</span>
              <span>{d.fechaSubida}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
            <a href={d.url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ---- Add doc form (inline) ---- */
function AddDocForm({ onAdd, onCancel }: { onAdd: (d: DocumentoProceso) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDocumento>("Otro");

  const handleAdd = () => {
    if (!nombre.trim()) { toast.error("El nombre del documento es obligatorio"); return; }
    onAdd({
      id: crypto.randomUUID(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      categoria,
      url: "#",
      tipo: "pdf",
      subidoPor: JURIDICOS[0],
      fechaSubida: new Date().toISOString().slice(0, 10),
    });
    setNombre("");
    setDescripcion("");
    setCategoria("Otro");
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold"><Upload className="h-3.5 w-3.5" /> Adjuntar documento</div>
      <Input placeholder="Nombre del archivo…" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 text-xs" />
      <Input placeholder="Descripción breve…" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="h-8 text-xs" />
      <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaDocumento)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{CATEGORIAS_DOCUMENTO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd}><Upload className="h-3 w-3" /> Adjuntar</Button>
      </div>
    </div>
  );
}

export function DetalleProceso({ open, onClose, item, onAddActualizacion, onAddDocumento }: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [apuntadoPor, setApuntadoPor] = useState(JURIDICOS[0]);
  // docs for the new update being created
  const [actDocs, setActDocs] = useState<DocumentoProceso[]>([]);
  const [showActDocForm, setShowActDocForm] = useState(false);

  const handleAdd = () => {
    if (!texto.trim()) return;
    onAddActualizacion(item.id, {
      id: crypto.randomUUID(),
      texto: texto.trim(),
      fecha,
      apuntadoPor,
      documentos: actDocs,
    });
    setTexto("");
    setFecha(hoy);
    setActDocs([]);
    setShowForm(false);
  };

  const tiempoDesdeApertura = tiempoTranscurrido(item.fecha, hoy);
  const totalDocsGeneral = item.documentos.length;
  const totalDocsActualizaciones = item.actualizaciones.reduce((s, a) => s + a.documentos.length, 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-bold">DETALLE DEL EXPEDIENTE</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div>
            <h3 className="font-bold text-foreground text-base">{item.titulo}</h3>
            <p className="text-sm text-muted-foreground mt-1">{item.descripcion}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">EMPRESA</span>
              <p className="font-medium text-foreground">{item.empresa}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">TIPO</span>
              <p className="font-medium text-foreground">{item.tipo}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">ESTADO</span>
              <div className="mt-0.5"><EstadoProcesoBadge value={item.estado} /></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">GRAVEDAD</span>
              <div className="mt-0.5"><GravedadProcesoBadge value={item.gravedad} /></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">JURÍDICO RESPONSABLE</span>
              <p className="font-medium text-foreground">{item.juridico}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">FECHA DE APERTURA</span>
              <p className="font-medium text-foreground">{item.fecha}</p>
            </div>
          </div>

          {/* Elapsed time */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-muted-foreground">TIEMPO DESDE APERTURA</p>
              <p className="text-lg font-black text-primary">{tiempoDesdeApertura}</p>
            </div>
          </div>

          <Separator />

          {/* ========== DOCUMENTACIÓN GENERAL DEL PROCESO ========== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4" /> DOCUMENTACIÓN DEL EXPEDIENTE
                <Badge variant="secondary" className="text-[10px] ml-1">{totalDocsGeneral}</Badge>
              </h4>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setShowDocForm(!showDocForm)}>
                <Plus className="h-3 w-3" /> Adjuntar
              </Button>
            </div>

            {showDocForm && (
              <AddDocForm
                onCancel={() => setShowDocForm(false)}
                onAdd={(d) => { onAddDocumento?.(item.id, d); setShowDocForm(false); toast.success("Documento adjuntado al expediente"); }}
              />
            )}

            {totalDocsGeneral === 0 && !showDocForm && (
              <p className="text-xs text-muted-foreground text-center py-3">No hay documentos adjuntos al expediente.</p>
            )}

            <DocumentosList docs={item.documentos} label="Documentos generales" icon={FolderOpen} />
          </div>

          <Separator />

          {/* ========== HISTORIAL DE ACTUALIZACIONES ========== */}
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              HISTORIAL DE ACTUALIZACIONES
              {totalDocsActualizaciones > 0 && (
                <Badge variant="outline" className="text-[10px] ml-1 gap-0.5"><Paperclip className="h-2.5 w-2.5" /> {totalDocsActualizaciones} docs</Badge>
              )}
            </h4>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-3.5 w-3.5" /> AÑADIR
            </Button>
          </div>

          {/* New update form */}
          {showForm && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <Label className="text-xs font-bold">ACTUALIZACIÓN</Label>
                <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Detalle de la actualización…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">FECHA</Label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-bold">APUNTADO POR</Label>
                  <Select value={apuntadoPor} onValueChange={setApuntadoPor}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{JURIDICOS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Docs for this update */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1"><Paperclip className="h-3 w-3" /> Documentos de esta actualización ({actDocs.length})</span>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => setShowActDocForm(!showActDocForm)}>
                    <Plus className="h-3 w-3" /> Adjuntar
                  </Button>
                </div>
                {showActDocForm && (
                  <AddDocForm
                    onCancel={() => setShowActDocForm(false)}
                    onAdd={(d) => { setActDocs((p) => [...p, d]); setShowActDocForm(false); }}
                  />
                )}
                {actDocs.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs rounded border p-1.5 bg-background">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{d.nombre}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{d.categoria}</Badge>
                    <button onClick={() => setActDocs((p) => p.filter((x) => x.id !== d.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setActDocs([]); }}>CANCELAR</Button>
                <Button size="sm" onClick={handleAdd}>GUARDAR</Button>
              </div>
            </div>
          )}

          {item.actualizaciones.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-6">No hay actualizaciones registradas.</p>
          )}

          {/* Timeline */}
          <div className="space-y-0">
            {item.actualizaciones.map((act, idx) => {
              const prevFecha = idx === 0 ? item.fecha : item.actualizaciones[idx - 1].fecha;
              const desdeApertura = tiempoTranscurrido(item.fecha, act.fecha);
              const desdeUltima = tiempoTranscurrido(prevFecha, act.fecha);
              return (
                <div key={act.id} className="relative pl-6 pb-6 last:pb-0">
                  {idx < item.actualizaciones.length - 1 && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />
                  )}
                  <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="font-semibold">{act.fecha}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-semibold">{act.apuntadoPor}</span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{act.texto}</p>

                    {/* Docs attached to this update */}
                    {act.documentos.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-dashed">
                        <DocumentosList docs={act.documentos} label="Documentos adjuntos" icon={Paperclip} />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Desde apertura: <strong className="text-foreground">{desdeApertura}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Desde última: <strong className="text-foreground">{desdeUltima}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
