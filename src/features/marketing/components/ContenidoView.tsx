"use client";

import { useState, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { listPublicaciones, createPublicacion } from "@/features/marketing/actions/publicaciones-actions";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Film, Camera, FileText, ImageIcon, Clock, Plus, Search, ExternalLink, Trash2, Edit, Video, BookOpen } from "lucide-react";

type TipoContenido = "guion" | "grabacion" | "reel" | "post" | "historia";
type EstadoContenido = "borrador" | "en_produccion" | "listo" | "publicado" | "archivado";

interface ContenidoItem {
  id: string; tipo: TipoContenido; titulo: string; descripcion: string;
  estado: EstadoContenido; responsable: string; fecha: string;
  enlaceExterno: string; etiquetas: string[]; empresaId: string;
}

const SECCIONES: { value: TipoContenido; label: string; icon: React.ElementType }[] = [
  { value: "guion", label: "GUIONES", icon: BookOpen },
  { value: "grabacion", label: "GRABACIONES", icon: Video },
  { value: "reel", label: "REELS", icon: Film },
  { value: "post", label: "POST", icon: ImageIcon },
  { value: "historia", label: "HISTORIAS", icon: Camera },
];

const ESTADOS: { value: EstadoContenido; label: string; variant: "default" | "secondary" | "outline" | "destructive" }[] = [
  { value: "borrador", label: "Borrador", variant: "secondary" },
  { value: "en_produccion", label: "En producción", variant: "outline" },
  { value: "listo", label: "Listo", variant: "default" },
  { value: "publicado", label: "Publicado", variant: "default" },
  { value: "archivado", label: "Archivado", variant: "destructive" },
];

function buildSampleData(empresaId: string): ContenidoItem[] {
  const base: Omit<ContenidoItem, "id" | "empresaId">[] = [
    { tipo: "guion", titulo: "Guion promo verano", descripcion: "Script para vídeo promocional de la carta de verano", estado: "borrador", responsable: "María López", fecha: "2026-04-01", enlaceExterno: "", etiquetas: ["verano", "promo"] },
    { tipo: "guion", titulo: "Guion entrevista chef", descripcion: "Preguntas y estructura para entrevista con el chef principal", estado: "listo", responsable: "Carlos", fecha: "2026-03-28", enlaceExterno: "", etiquetas: ["entrevista", "chef"] },
    { tipo: "grabacion", titulo: "Grabación cocina en vivo", descripcion: "Sesión de grabación del proceso de elaboración del plato estrella", estado: "en_produccion", responsable: "Carlos", fecha: "2026-04-03", enlaceExterno: "", etiquetas: ["cocina", "making-of"] },
    { tipo: "grabacion", titulo: "Tour restaurante", descripcion: "Grabación del recorrido completo por las instalaciones", estado: "listo", responsable: "Admin", fecha: "2026-03-20", enlaceExterno: "", etiquetas: ["tour", "branding"] },
    { tipo: "reel", titulo: "Reel plato del día", descripcion: "Reel corto mostrando la presentación del plato del día", estado: "publicado", responsable: "María López", fecha: "2026-04-05", enlaceExterno: "", etiquetas: ["foodie", "reel"] },
    { tipo: "reel", titulo: "Reel equipo de sala", descripcion: "Presentación dinámica del equipo de sala", estado: "borrador", responsable: "Carlos", fecha: "2026-04-06", enlaceExterno: "", etiquetas: ["equipo", "sala"] },
    { tipo: "post", titulo: "Post nueva carta", descripcion: "Imagen y copy para anunciar la nueva carta de temporada", estado: "listo", responsable: "María López", fecha: "2026-04-02", enlaceExterno: "", etiquetas: ["carta", "temporada"] },
    { tipo: "post", titulo: "Post horario festivos", descripcion: "Información de horarios especiales en festivos", estado: "publicado", responsable: "Admin", fecha: "2026-03-30", enlaceExterno: "", etiquetas: ["horarios", "festivos"] },
    { tipo: "historia", titulo: "Historia detrás del plato", descripcion: "Story con el proceso de creación de un plato especial", estado: "en_produccion", responsable: "Carlos", fecha: "2026-04-04", enlaceExterno: "", etiquetas: ["story", "cocina"] },
    { tipo: "historia", titulo: "Historia evento privado", descripcion: "Cobertura en stories de un evento privado en el restaurante", estado: "borrador", responsable: "María López", fecha: "2026-04-07", enlaceExterno: "", etiquetas: ["evento", "privado"] },
  ];
  return base.map((b, i) => ({ ...b, id: `${empresaId}-cont-${i + 1}`, empresaId }));
}

const allData: Record<string, ContenidoItem[]> = {};
function getData(empresaId: string) {
  if (!allData[empresaId]) allData[empresaId] = buildSampleData(empresaId);
  return allData[empresaId];
}

function estadoBadge(estado: EstadoContenido) {
  const e = ESTADOS.find((s) => s.value === estado);
  return <Badge variant={e?.variant ?? "secondary"}>{e?.label ?? estado}</Badge>;
}

function ContenidoModal({ open, onClose, onSave, item, tipo, empresaId }: {
  open: boolean; onClose: () => void; onSave: (i: ContenidoItem) => void;
  item: ContenidoItem | null; tipo: TipoContenido; empresaId: string;
}) {
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [estado, setEstado] = useState<EstadoContenido>(item?.estado ?? "borrador");
  const [responsable, setResponsable] = useState(item?.responsable ?? "");
  const [enlace, setEnlace] = useState(item?.enlaceExterno ?? "");
  const [etiquetas, setEtiquetas] = useState(item?.etiquetas.join(", ") ?? "");
  const [lastItem, setLastItem] = useState(item);

  if (item !== lastItem) {
    setTitulo(item?.titulo ?? ""); setDescripcion(item?.descripcion ?? "");
    setEstado(item?.estado ?? "borrador"); setResponsable(item?.responsable ?? "");
    setEnlace(item?.enlaceExterno ?? ""); setEtiquetas(item?.etiquetas.join(", ") ?? "");
    setLastItem(item);
  }

  function handleSubmit() {
    const now = new Date().toISOString().slice(0, 10);
    onSave({
      id: item?.id ?? `${empresaId}-cont-${Date.now()}`,
      tipo: item?.tipo ?? tipo, titulo, descripcion, estado, responsable,
      fecha: item?.fecha ?? now, enlaceExterno: enlace,
      etiquetas: etiquetas.split(",").map((t) => t.trim()).filter(Boolean), empresaId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Editar contenido" : "Nuevo contenido"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div><Label>Descripción</Label><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoContenido)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Responsable</Label><Input value={responsable} onChange={(e) => setResponsable(e.target.value)} /></div>
          </div>
          <div><Label>Enlace externo</Label><Input value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Etiquetas (separadas por coma)</Label><Input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!titulo.trim()}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContenidoView() {
  const { empresaActual } = useEmpresa();
  const [items, setItems] = useState<ContenidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TipoContenido>("guion");
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContenidoItem | null>(null);

  const loadContenido = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPublicaciones();
      if (res.ok && res.data.length > 0) {
        setItems(getData(empresaActual.id));
      } else {
        setItems(getData(empresaActual.id));
      }
    } catch {
      setItems(getData(empresaActual.id));
    } finally {
      setLoading(false);
    }
  }, [empresaActual.id]);

  useEffect(() => {
    loadContenido();
  }, [loadContenido]);

  const filtered = items.filter((i) => {
    if (i.tipo !== tab) return false;
    if (filtroEstado !== "todos" && i.estado !== filtroEstado) return false;
    if (search && !i.titulo.toLowerCase().includes(search.toLowerCase()) && !i.descripcion.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = SECCIONES.map((s) => ({ ...s, count: items.filter((i) => i.tipo === s.value).length }));

  async function handleSave(item: ContenidoItem) {
    const isNew = !items.find((p) => p.id === item.id);
    setItems((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [...prev, item];
    });
    setModalOpen(false);
    setEditItem(null);
    if (isNew) {
      const res = await createPublicacion({ titulo: item.titulo, plataforma: item.tipo, estado: item.estado, contenido: item.descripcion });
      if (res.ok) toast.success("Contenido guardado");
      else toast.error(res.error ?? "Error al guardar contenido");
    }
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header removed — title shown in top bar */}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {counts.map((s) => (
          <Card key={s.value} className={`cursor-pointer transition-colors ${tab === s.value ? "border-primary bg-primary/5" : ""}`} onClick={() => setTab(s.value)}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TipoContenido)}>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <TabsList>
            {SECCIONES.map((s) => <TabsTrigger key={s.value} value={s.value} className="text-xs">{s.label}</TabsTrigger>)}
          </TabsList>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 h-8 w-48" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => { setEditItem(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo
            </Button>
          </div>
        </div>

        {SECCIONES.map((s) => (
          <TabsContent key={s.value} value={s.value}>
            {filtered.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No hay contenido en esta sección</CardContent></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold leading-tight">{item.titulo}</CardTitle>
                        {estadoBadge(item.estado)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.descripcion}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {item.fecha}
                        <span className="ml-auto">{item.responsable}</span>
                      </div>
                      {item.etiquetas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.etiquetas.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                      )}
                      <div className="flex items-center gap-1 pt-1">
                        {item.enlaceExterno && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                            <a href={item.enlaceExterno} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Enlace</a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => { setEditItem(item); setModalOpen(true); }}>
                          <Edit className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ContenidoModal
        open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave} item={editItem} tipo={tab} empresaId={empresaActual.id}
      />
    </div>
  );
}
