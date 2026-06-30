"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ListChecks, Plus, Pencil, Trash2, FolderPlus, Video, FileUp, Loader2, GripVertical,
  FileText, CheckCircle2, Eye, EyeOff, ImagePlus, ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useFormacionStore, leccionesDeCurso } from "@/features/formacion/store/use-formacion-store";
import { uploadFormacionDoc, dbSetSeccionPublicada } from "@/features/formacion/actions/formacion-actions";
import {
  listCuestionario, guardarPreguntaCuestionario, borrarPreguntaCuestionario,
  type PreguntaCuestionario, type OpcionCuestionario,
} from "@/features/formacion/actions/formacion-interaccion-actions";
import type { Leccion, Seccion } from "@/features/formacion/types";

interface Props {
  cursoId: string;
  activaId: string | null;
  onSelect: (leccionId: string) => void;
}

/**
 * Sidebar EDITABLE del curso (modo admin). Acordeón de módulos (secciones) con
 * sus lecciones; botones discretos para crear/editar/borrar módulo y lección.
 * El formulario de lección permite subir vídeo a R2, texto libre y documento.
 */
export function CursoEditorSidebar({ cursoId, activaId, onSelect }: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const addSeccion = useFormacionStore((s) => s.addSeccion);
  const updateSeccion = useFormacionStore((s) => s.updateSeccion);
  const removeSeccion = useFormacionStore((s) => s.removeSeccion);
  const addLeccion = useFormacionStore((s) => s.addLeccion);
  const updateLeccion = useFormacionStore((s) => s.updateLeccion);
  const removeLeccion = useFormacionStore((s) => s.removeLeccion);
  const hydrate = useFormacionStore((s) => s.hydrate);

  const { secciones: cs, leccionesPorSeccion } = leccionesDeCurso(secciones, lecciones, cursoId);

  // Publicar/despublicar TEMA con cascada a sus lecciones (persiste en BD).
  async function toggleTemaPublicado(sec: Seccion) {
    const nuevo = !sec.publicado;
    updateSeccion(sec.id, { publicado: nuevo });
    for (const l of leccionesPorSeccion.get(sec.id) ?? []) updateLeccion(l.id, { publicado: nuevo });
    await dbSetSeccionPublicada(sec.id, nuevo);
    toast.success(nuevo ? "Tema publicado (y sus lecciones)" : "Tema oculto (y sus lecciones)");
  }
  // Publicar/despublicar una LECCIÓN suelta.
  function toggleLeccionPublicada(l: Leccion) {
    updateLeccion(l.id, { publicado: !l.publicado });
  }
  // Mover una lección a otro tema.
  function moverLeccion(l: Leccion, nuevaSeccionId: string) {
    if (nuevaSeccionId === l.seccionId) return;
    const orden = (leccionesPorSeccion.get(nuevaSeccionId) ?? []).length;
    updateLeccion(l.id, { seccionId: nuevaSeccionId, orden });
    toast.success("Lección movida de tema");
  }

  // ── Diálogo de módulo ──
  const [moduloOpen, setModuloOpen] = useState(false);
  const [moduloEdit, setModuloEdit] = useState<Seccion | null>(null);
  const [moduloTitulo, setModuloTitulo] = useState("");

  function abrirNuevoModulo() {
    setModuloEdit(null);
    setModuloTitulo("");
    setModuloOpen(true);
  }
  function abrirEditarModulo(sec: Seccion) {
    setModuloEdit(sec);
    setModuloTitulo(sec.titulo);
    setModuloOpen(true);
  }
  function guardarModulo() {
    const t = moduloTitulo.trim();
    if (!t) return;
    if (moduloEdit) {
      updateSeccion(moduloEdit.id, { titulo: t });
    } else {
      const orden = cs.length;
      addSeccion({ cursoId, titulo: t, orden, publicado: true });
    }
    setModuloOpen(false);
  }
  async function borrarModulo(sec: Seccion) {
    const ok = await confirmDelete({
      title: `¿Eliminar el módulo "${sec.titulo}"?`,
      description: "Se borrarán también sus lecciones. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
    });
    if (ok) removeSeccion(sec.id);
  }

  // ── Diálogo de lección ──
  const [leccionOpen, setLeccionOpen] = useState(false);
  const [leccionEdit, setLeccionEdit] = useState<Leccion | null>(null);
  const [seccionDestino, setSeccionDestino] = useState<string>("");
  const [lecTitulo, setLecTitulo] = useState("");
  const [lecVideoUrl, setLecVideoUrl] = useState("");
  const [lecContenido, setLecContenido] = useState("");
  const [lecDuracion, setLecDuracion] = useState(0);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Documento adjunto (PDF/imagen incrustable)
  const [lecDocPath, setLecDocPath] = useState<string | undefined>(undefined);
  const [lecDocNombre, setLecDocNombre] = useState<string | undefined>(undefined);
  const [lecDocTipo, setLecDocTipo] = useState<string | undefined>(undefined);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Cuestionario tipo test
  const [cuestionario, setCuestionario] = useState<PreguntaCuestionario[]>([]);

  // Portada del vídeo (imagen miniatura) — sube a formacion-docs y guarda URL pública.
  const [lecCover, setLecCover] = useState<string | undefined>(undefined);
  const [subiendoCover, setSubiendoCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function abrirNuevaLeccion(seccionId: string) {
    setLeccionEdit(null);
    setSeccionDestino(seccionId);
    setLecTitulo(""); setLecVideoUrl(""); setLecContenido(""); setLecDuracion(0);
    setLecDocPath(undefined); setLecDocNombre(undefined); setLecDocTipo(undefined);
    setLecCover(undefined);
    setCuestionario([]);
    setLeccionOpen(true);
  }
  async function abrirEditarLeccion(l: Leccion) {
    setLeccionEdit(l);
    setSeccionDestino(l.seccionId);
    setLecTitulo(l.titulo); setLecVideoUrl(l.url); setLecContenido(l.contenido ?? "");
    setLecDuracion(l.duracionMin);
    setLecCover(l.cover);
    setLecDocPath(l.documentoPath); setLecDocNombre(l.documentoNombre); setLecDocTipo(l.documentoTipo);
    setCuestionario(await listCuestionario(l.id));
    setLeccionOpen(true);
  }

  async function handleSubirCover(file: File) {
    setSubiendoCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", `portada-${lecTitulo || "leccion"}`);
      fd.append("mimeType", file.type);
      const res = await fetch("/api/formacion/video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "No se pudo subir la portada"); return; }
      setLecCover(data.url);
      toast.success("Portada subida");
    } finally {
      setSubiendoCover(false);
    }
  }

  async function handleSubirDoc(file: File) {
    setSubiendoDoc(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadFormacionDoc(fd);
      if (!r.ok || !r.path) { toast.error(r.error ?? "No se pudo subir el documento"); return; }
      const tipo = file.type.startsWith("image/") ? "imagen" : "pdf";
      setLecDocPath(r.path); setLecDocNombre(r.nombre ?? file.name); setLecDocTipo(tipo);
      toast.success("Documento subido");
    } finally {
      setSubiendoDoc(false);
    }
  }

  async function handleSubirVideo(file: File) {
    setSubiendoVideo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", lecTitulo || file.name);
      fd.append("mimeType", file.type);
      const res = await fetch("/api/formacion/video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo subir el vídeo", { description: data.detail });
        return;
      }
      setLecVideoUrl(data.url);
      toast.success("Vídeo subido correctamente");
    } catch {
      toast.error("Error al subir el vídeo");
    } finally {
      setSubiendoVideo(false);
    }
  }

  async function guardarLeccion() {
    const t = lecTitulo.trim();
    if (!t) { toast.error("Pon un título"); return; }
    let leccionId: string;
    if (leccionEdit) {
      leccionId = leccionEdit.id;
      updateLeccion(leccionId, {
        titulo: t, url: lecVideoUrl, contenido: lecContenido, duracionMin: lecDuracion,
        cover: lecCover,
        documentoPath: lecDocPath, documentoNombre: lecDocNombre, documentoTipo: lecDocTipo,
      });
    } else {
      const orden = (leccionesPorSeccion.get(seccionDestino) ?? []).length;
      leccionId = addLeccion({
        cursoId, seccionId: seccionDestino, titulo: t, descripcion: "",
        url: lecVideoUrl, contenido: lecContenido, duracionMin: lecDuracion,
        publicado: true, cover: lecCover,
        documentoPath: lecDocPath, documentoNombre: lecDocNombre, documentoTipo: lecDocTipo,
        orden, fechaSubida: "",
      });
    }
    if (cuestionario.length > 0) await persistirCuestionario(leccionId);
    setLeccionOpen(false);
  }

  async function borrarLeccion(l: Leccion) {
    const ok = await confirmDelete({
      title: `¿Eliminar la lección "${l.titulo}"?`,
      confirmLabel: "Eliminar",
    });
    if (ok) removeLeccion(l.id);
  }

  // ── Cuestionario: gestión local + persistencia (solo para lección ya creada) ──
  function nuevaPreguntaCuest() {
    setCuestionario((c) => [
      ...c,
      { id: `nueva-${Date.now()}`, leccionId: leccionEdit?.id ?? "", enunciado: "", orden: c.length,
        opciones: [{ texto: "", correcta: true }, { texto: "", correcta: false }] },
    ]);
  }
  function setEnunciado(idx: number, val: string) {
    setCuestionario((c) => c.map((q, i) => (i === idx ? { ...q, enunciado: val } : q)));
  }
  function setOpcionTexto(qi: number, oi: number, val: string) {
    setCuestionario((c) => c.map((q, i) => i === qi
      ? { ...q, opciones: q.opciones.map((o, j) => (j === oi ? { ...o, texto: val } : o)) } : q));
  }
  function setOpcionCorrecta(qi: number, oi: number) {
    setCuestionario((c) => c.map((q, i) => i === qi
      ? { ...q, opciones: q.opciones.map((o, j) => ({ ...o, correcta: j === oi })) } : q));
  }
  function addOpcion(qi: number) {
    setCuestionario((c) => c.map((q, i) => i === qi
      ? { ...q, opciones: [...q.opciones, { texto: "", correcta: false }] } : q));
  }
  function removePreguntaCuest(qi: number) {
    const q = cuestionario[qi];
    setCuestionario((c) => c.filter((_, i) => i !== qi));
    if (q && !q.id.startsWith("nueva-")) void borrarPreguntaCuestionario(q.id);
  }

  // Persiste el cuestionario al guardar la lección.
  async function persistirCuestionario(leccionId: string) {
    for (const q of cuestionario) {
      const opcionesValidas = q.opciones.filter((o: OpcionCuestionario) => o.texto.trim());
      if (!q.enunciado.trim() || opcionesValidas.length < 2) continue;
      await guardarPreguntaCuestionario(
        leccionId, q.enunciado, q.opciones,
        q.id.startsWith("nueva-") ? undefined : q.id,
      );
    }
  }

  return (
    <Card className="lg:sticky lg:top-4 lg:self-start">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-primary" />
            Contenido del curso
          </div>
          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={abrirNuevoModulo}>
            <FolderPlus className="h-3.5 w-3.5" /> Módulo
          </Button>
        </div>

        <ul className="space-y-3 pr-1 max-h-[70vh] overflow-auto">
          {cs.map((sec) => {
            const ls = leccionesPorSeccion.get(sec.id) ?? [];
            return (
              <li key={sec.id} className="space-y-1">
                <div className="flex items-center gap-1 px-2 group">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className={`flex-1 text-[11px] font-bold uppercase tracking-widest truncate ${sec.publicado ? "text-muted-foreground" : "text-amber-600/70 line-through"}`}>
                    {sec.titulo}
                  </span>
                  <button onClick={() => toggleTemaPublicado(sec)}
                    title={sec.publicado ? "Tema publicado — ocultar (y sus lecciones)" : "Tema oculto — publicar (y sus lecciones)"}
                    className={`p-1 ${sec.publicado ? "text-emerald-600" : "text-amber-500"} hover:opacity-70`}>
                    {sec.publicado ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => abrirEditarModulo(sec)} title="Editar módulo"
                    className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => borrarModulo(sec)} title="Borrar módulo"
                    className="p-1 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="space-y-0.5">
                  {ls.map((l, i) => (
                    <li key={l.id} className="group flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onSelect(l.id)}
                        className={`flex flex-1 items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                          activaId === l.id ? "bg-primary/10" : "hover:bg-muted"
                        }`}
                      >
                        <Video className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                        <span className={`line-clamp-2 text-[13px] font-medium leading-snug ${!l.publicado && "text-amber-600/70 line-through"}`}>
                          {i + 1}. {l.titulo}
                        </span>
                      </button>
                      <button onClick={() => toggleLeccionPublicada(l)}
                        title={l.publicado ? "Publicada — ocultar" : "Oculta — publicar"}
                        className={`p-1 ${l.publicado ? "text-emerald-600" : "text-amber-500"} hover:opacity-70`}>
                        {l.publicado ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      {cs.length > 1 && (
                        <Select value={l.seccionId} onValueChange={(v) => moverLeccion(l, v)}>
                          <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent opacity-0 group-hover:opacity-100 [&>svg]:hidden justify-center"
                            title="Mover a otro tema">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                          </SelectTrigger>
                          <SelectContent>
                            {cs.map((s2) => (
                              <SelectItem key={s2.id} value={s2.id} disabled={s2.id === l.seccionId}>
                                {s2.titulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <button onClick={() => abrirEditarLeccion(l)} title="Editar"
                        className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => borrarLeccion(l)} title="Borrar"
                        className="p-1 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => abrirNuevaLeccion(sec.id)}
                  className="ml-7 flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1"
                >
                  <Plus className="h-3 w-3" /> Añadir lección
                </button>
              </li>
            );
          })}
          {cs.length === 0 && (
            <li className="px-2 py-4 text-center text-sm text-muted-foreground">
              Aún no hay módulos. Pulsa <strong>Módulo</strong> para crear el primero.
            </li>
          )}
        </ul>
      </CardContent>

      {/* Diálogo de MÓDULO */}
      <Dialog open={moduloOpen} onOpenChange={setModuloOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moduloEdit ? "Editar módulo" : "Nuevo módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mod-titulo">Título del módulo</Label>
            <Input id="mod-titulo" value={moduloTitulo} onChange={(e) => setModuloTitulo(e.target.value)}
              placeholder="Ej. Bienvenida, Fundamentos…" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuloOpen(false)}>Cancelar</Button>
            <Button onClick={guardarModulo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de LECCIÓN */}
      <Dialog open={leccionOpen} onOpenChange={setLeccionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{leccionEdit ? "Editar lección" : "Nueva lección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lec-titulo">Título</Label>
              <Input id="lec-titulo" value={lecTitulo} onChange={(e) => setLecTitulo(e.target.value)} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>Vídeo</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5"
                  onClick={() => videoInputRef.current?.click()} disabled={subiendoVideo}>
                  {subiendoVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {subiendoVideo ? "Subiendo…" : "Subir vídeo"}
                </Button>
                {lecVideoUrl && <Badge variant="outline" className="text-[10px] gap-1"><Video className="h-3 w-3" /> Vídeo listo</Badge>}
              </div>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSubirVideo(f); }} />
              <Input value={lecVideoUrl} onChange={(e) => setLecVideoUrl(e.target.value)}
                placeholder="…o pega una URL de vídeo" className="text-xs" />
            </div>

            {/* Portada del vídeo (imagen miniatura) */}
            <div className="space-y-1.5">
              <Label>Portada del vídeo (opcional)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5"
                  onClick={() => coverInputRef.current?.click()} disabled={subiendoCover}>
                  {subiendoCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {subiendoCover ? "Subiendo…" : "Subir portada"}
                </Button>
                {lecCover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lecCover} alt="portada" className="h-10 w-16 rounded object-cover border" />
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSubirCover(f); }} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lec-contenido">Texto libre (opcional)</Label>
              <Textarea id="lec-contenido" value={lecContenido} onChange={(e) => setLecContenido(e.target.value)}
                rows={4} placeholder="Acerca de esta lección…" />
            </div>

            {/* Documento incrustable (PDF / imagen) */}
            <div className="space-y-1.5">
              <Label>Documento (PDF o imagen)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5"
                  onClick={() => docInputRef.current?.click()} disabled={subiendoDoc}>
                  {subiendoDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {subiendoDoc ? "Subiendo…" : "Subir documento"}
                </Button>
                {lecDocPath && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <FileText className="h-3 w-3" /> {lecDocNombre ?? "Documento"}
                  </Badge>
                )}
              </div>
              <input ref={docInputRef} type="file" accept="application/pdf,image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSubirDoc(f); }} />
            </div>

            <div className="space-y-1.5 w-32">
              <Label htmlFor="lec-dur">Duración (min)</Label>
              <Input id="lec-dur" type="number" min={0} value={lecDuracion}
                onChange={(e) => setLecDuracion(parseInt(e.target.value) || 0)} />
            </div>

            {/* Editor de cuestionario tipo test */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Cuestionario (opcional)
                </Label>
                <Button type="button" variant="outline" size="sm" className="gap-1 h-7" onClick={nuevaPreguntaCuest}>
                  <Plus className="h-3.5 w-3.5" /> Pregunta
                </Button>
              </div>
              {cuestionario.map((q, qi) => (
                <div key={q.id} className="rounded-md border p-2.5 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Input value={q.enunciado} onChange={(e) => setEnunciado(qi, e.target.value)}
                      placeholder={`Pregunta ${qi + 1}`} className="text-sm" />
                    <button onClick={() => removePreguntaCuest(qi)} className="p-1 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1 pl-1">
                    {q.opciones.map((op, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" checked={op.correcta} onChange={() => setOpcionCorrecta(qi, oi)}
                          title="Marcar como correcta" className="accent-emerald-600" />
                        <Input value={op.texto} onChange={(e) => setOpcionTexto(qi, oi, e.target.value)}
                          placeholder={`Opción ${oi + 1}`} className="text-sm h-8" />
                      </div>
                    ))}
                    <button onClick={() => addOpcion(qi)} className="text-xs text-primary hover:underline pl-6">
                      + Añadir opción
                    </button>
                  </div>
                </div>
              ))}
              {cuestionario.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Marca el círculo de la opción correcta de cada pregunta.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeccionOpen(false)}>Cancelar</Button>
            <Button onClick={guardarLeccion} disabled={subiendoVideo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDeleteDialog}
    </Card>
  );
}
