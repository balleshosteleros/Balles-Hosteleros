"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  Wand2,
  Sparkles,
  Link2,
  Eye,
  Users,
  Wine,
  Shield,
  Star,
  Award,
  Lightbulb,
  Coffee,
  Heart,
  Target,
  ThumbsUp,
  BookOpen,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { SlideRenderer } from "./SlideRenderer";
import { ImageInputOrUpload } from "./ImageInputOrUpload";
import {
  savePresentacion,
  iaReescribirTexto,
  iaGenerarSlide,
} from "../actions";
import type { Slide, SlideBlock, SlideLayout, EmpresaTheme } from "../types";

interface PresentacionEditorProps {
  slidesInitial: Slide[];
  theme: EmpresaTheme;
  empresaId: string;
}

const ICON_CATALOG: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "users", label: "Personas", Icon: Users },
  { value: "wine", label: "Bebidas", Icon: Wine },
  { value: "shield", label: "Privacidad", Icon: Shield },
  { value: "star", label: "Estrella", Icon: Star },
  { value: "award", label: "Premio", Icon: Award },
  { value: "lightbulb", label: "Idea", Icon: Lightbulb },
  { value: "coffee", label: "Café", Icon: Coffee },
  { value: "heart", label: "Corazón", Icon: Heart },
  { value: "sparkles", label: "Destacado", Icon: Sparkles },
  { value: "target", label: "Objetivo", Icon: Target },
  { value: "eye", label: "Observación", Icon: Eye },
  { value: "thumbs-up", label: "Aprobado", Icon: ThumbsUp },
  { value: "book-open", label: "Manual", Icon: BookOpen },
];

const BLOCK_TYPE_LABELS: Record<SlideBlock["type"], string> = {
  title: "Título",
  subtitle: "Subtítulo",
  paragraph: "Párrafo",
  bullets: "Viñetas",
  numbered: "Lista numerada",
  cards: "Tarjetas",
  "icon-row": "Fila de iconos",
  buttons: "Botones",
  image: "Imagen",
  note: "Nota",
  divider: "Separador",
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function emptyBlockOfType(type: SlideBlock["type"]): SlideBlock {
  const id = uid("b");
  switch (type) {
    case "title":
      return { id, type, text: "Título" };
    case "subtitle":
      return { id, type, text: "Subtítulo" };
    case "paragraph":
      return { id, type, text: "Texto del párrafo." };
    case "bullets":
      return { id, type, items: ["Primer punto"] };
    case "numbered":
      return {
        id,
        type,
        items: [{ titulo: "Título", descripcion: "Descripción" }],
      };
    case "cards":
      return {
        id,
        type,
        columns: 3,
        items: [{ titulo: "Tarjeta", descripcion: "Texto", imagen: null }],
      };
    case "icon-row":
      return {
        id,
        type,
        items: [
          { icono: "star", titulo: "Punto", descripcion: "Descripción" },
        ],
      };
    case "buttons":
      return { id, type, items: [{ label: "Botón", href: "#" }] };
    case "image":
      return { id, type, src: null, alt: "" };
    case "note":
      return { id, type, text: "Nota informativa" };
    case "divider":
      return { id, type };
  }
}

function emptySlide(): Slide {
  return {
    id: uid("s"),
    layout: "default",
    background: "primary",
    image: null,
    blocks: [emptyBlockOfType("title")],
  };
}

export function PresentacionEditor({ slidesInitial, theme, empresaId }: PresentacionEditorProps) {
  const [slides, setSlides] = useState<Slide[]>(slidesInitial);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [iaOpen, setIaOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selected = slides[selectedIdx];

  useEffect(() => {
    if (selectedIdx >= slides.length) setSelectedIdx(Math.max(0, slides.length - 1));
  }, [slides.length, selectedIdx]);

  function patchSlide(patch: Partial<Slide>) {
    setSlides((prev) => prev.map((s, i) => (i === selectedIdx ? { ...s, ...patch } : s)));
    setDirty(true);
  }

  function patchBlock(blockId: string, patch: Partial<SlideBlock>) {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === selectedIdx
          ? {
              ...s,
              blocks: s.blocks.map((b) =>
                b.id === blockId ? ({ ...b, ...patch } as SlideBlock) : b,
              ),
            }
          : s,
      ),
    );
    setDirty(true);
  }

  function addBlock(type: SlideBlock["type"]) {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === selectedIdx
          ? { ...s, blocks: [...s.blocks, emptyBlockOfType(type)] }
          : s,
      ),
    );
    setDirty(true);
  }

  function removeBlock(blockId: string) {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === selectedIdx
          ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }
          : s,
      ),
    );
    setDirty(true);
  }

  function moveBlock(blockId: string, dir: -1 | 1) {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== selectedIdx) return s;
        const idx = s.blocks.findIndex((b) => b.id === blockId);
        if (idx < 0) return s;
        const target = idx + dir;
        if (target < 0 || target >= s.blocks.length) return s;
        const next = [...s.blocks];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...s, blocks: next };
      }),
    );
    setDirty(true);
  }

  function addSlide() {
    setSlides((prev) => [...prev, emptySlide()]);
    setSelectedIdx(slides.length);
    setDirty(true);
  }

  function removeSlide() {
    if (!confirm("¿Eliminar esta slide?")) return;
    setSlides((prev) => prev.filter((_, i) => i !== selectedIdx));
    setDirty(true);
  }

  function moveSlide(dir: -1 | 1) {
    const target = selectedIdx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[selectedIdx], next[target]] = [next[target], next[selectedIdx]];
      return next;
    });
    setSelectedIdx(target);
    setDirty(true);
  }

  function handleSave() {
    startSave(async () => {
      const res = await savePresentacion(slides);
      if (res.ok) {
        toast.success("Presentación guardada");
        setDirty(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={addSlide}>
            <Plus className="h-4 w-4" /> Slide
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIaOpen(true)}>
            <Sparkles className="h-4 w-4" /> IA: nueva slide
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Vista previa
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-3 min-h-[600px]">
        <SlideList
          slides={slides}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
        {selected ? (
          <SlideWorkspace
            slide={selected}
            theme={theme}
            empresaId={empresaId}
            onPatchSlide={patchSlide}
            onPatchBlock={patchBlock}
            onAddBlock={addBlock}
            onRemoveBlock={removeBlock}
            onMoveBlock={moveBlock}
            onRemoveSlide={removeSlide}
            onMoveSlide={moveSlide}
            isFirst={selectedIdx === 0}
            isLast={selectedIdx === slides.length - 1}
          />
        ) : (
          <div className="rounded-xl border bg-card flex items-center justify-center text-sm text-muted-foreground">
            Añade una slide para empezar
          </div>
        )}
      </div>

      <IADialog
        open={iaOpen}
        onOpenChange={setIaOpen}
        onCreate={(slide) => {
          setSlides((prev) => [...prev, slide]);
          setSelectedIdx(slides.length);
          setDirty(true);
          setIaOpen(false);
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa de la presentación</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {slides.map((s) => (
              <SlideRenderer key={s.id} slide={s} theme={theme} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SlideList({
  slides,
  selectedIdx,
  onSelect,
}: {
  slides: Slide[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-y-auto max-h-[600px] p-2 space-y-1">
      {slides.map((s, i) => {
        const titleBlock = s.blocks.find((b) => b.type === "title") as
          | { text: string }
          | undefined;
        const label = titleBlock?.text ?? `Slide ${i + 1}`;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(i)}
            className={`w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors border ${
              i === selectedIdx
                ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                : "border-transparent hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] opacity-50">{i + 1}</span>
              <span className="truncate flex-1">{label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SlideWorkspace({
  slide,
  theme,
  empresaId,
  onPatchSlide,
  onPatchBlock,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock,
  onRemoveSlide,
  onMoveSlide,
  isFirst,
  isLast,
}: {
  slide: Slide;
  theme: EmpresaTheme;
  empresaId: string;
  onPatchSlide: (p: Partial<Slide>) => void;
  onPatchBlock: (id: string, p: Partial<SlideBlock>) => void;
  onAddBlock: (type: SlideBlock["type"]) => void;
  onRemoveBlock: (id: string) => void;
  onMoveBlock: (id: string, dir: -1 | 1) => void;
  onRemoveSlide: () => void;
  onMoveSlide: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={slide.layout} onValueChange={(v) => onPatchSlide({ layout: v as SlideLayout })}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Por defecto</SelectItem>
            <SelectItem value="split-right">Imagen a la derecha</SelectItem>
            <SelectItem value="split-left">Imagen a la izquierda</SelectItem>
            <SelectItem value="cover">Portada centrada</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMoveSlide(-1)} disabled={isFirst} title="Subir slide">
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMoveSlide(1)} disabled={isLast} title="Bajar slide">
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onRemoveSlide} title="Eliminar slide">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
        <Label className="text-xs font-medium">Imagen de fondo de la slide</Label>
        <ImageInputOrUpload
          value={slide.image ?? null}
          onChange={(url) => onPatchSlide({ image: url })}
          empresaId={empresaId}
          kind="slide"
        />
      </div>

      <SlideRenderer slide={slide} theme={theme} />

      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bloques
          </div>
          <BlockTypeAdder onAdd={onAddBlock} />
        </div>
        <div className="space-y-2">
          {slide.blocks.map((b, i) => (
            <BlockEditor
              key={b.id}
              block={b}
              empresaId={empresaId}
              isFirst={i === 0}
              isLast={i === slide.blocks.length - 1}
              onPatch={(p) => onPatchBlock(b.id, p)}
              onRemove={() => onRemoveBlock(b.id)}
              onMove={(d) => onMoveBlock(b.id, d)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockTypeAdder({ onAdd }: { onAdd: (t: SlideBlock["type"]) => void }) {
  return (
    <Select onValueChange={(v) => onAdd(v as SlideBlock["type"])}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder="+ Añadir bloque" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="title">Título</SelectItem>
        <SelectItem value="subtitle">Subtítulo</SelectItem>
        <SelectItem value="paragraph">Párrafo</SelectItem>
        <SelectItem value="bullets">Viñetas</SelectItem>
        <SelectItem value="numbered">Lista numerada</SelectItem>
        <SelectItem value="cards">Tarjetas</SelectItem>
        <SelectItem value="icon-row">Fila de iconos</SelectItem>
        <SelectItem value="buttons">Botones</SelectItem>
        <SelectItem value="image">Imagen</SelectItem>
        <SelectItem value="note">Nota</SelectItem>
        <SelectItem value="divider">Separador</SelectItem>
      </SelectContent>
    </Select>
  );
}

function BlockEditor({
  block,
  empresaId,
  isFirst,
  isLast,
  onPatch,
  onRemove,
  onMove,
}: {
  block: SlideBlock;
  empresaId: string;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (p: Partial<SlideBlock>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2 bg-background">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {BLOCK_TYPE_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(-1)} disabled={isFirst}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(1)} disabled={isLast}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <BlockBody block={block} empresaId={empresaId} onPatch={onPatch} />
    </div>
  );
}

function BlockBody({
  block,
  empresaId,
  onPatch,
}: {
  block: SlideBlock;
  empresaId: string;
  onPatch: (p: Partial<SlideBlock>) => void;
}) {
  switch (block.type) {
    case "title":
    case "subtitle":
    case "paragraph":
      return (
        <div className="space-y-2">
          <Textarea
            value={block.text}
            onChange={(e) => onPatch({ text: e.target.value } as Partial<SlideBlock>)}
            rows={block.type === "paragraph" ? 3 : 2}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={block.href ?? ""}
              onChange={(e) => onPatch({ href: e.target.value || null } as Partial<SlideBlock>)}
              placeholder="Enlace (opcional)"
              className="h-7 text-xs"
            />
            <IARewriteButton texto={block.text} onResult={(t) => onPatch({ text: t } as Partial<SlideBlock>)} />
          </div>
        </div>
      );
    case "note":
      return (
        <Textarea
          value={block.text}
          onChange={(e) => onPatch({ text: e.target.value } as Partial<SlideBlock>)}
          rows={2}
          className="text-sm"
        />
      );
    case "bullets":
      return (
        <ListEditor
          items={block.items.map((t) => ({ valor: t }))}
          onChange={(items) => onPatch({ items: items.map((i) => i.valor) } as Partial<SlideBlock>)}
          render={(item, onUpd) => (
            <Input
              value={item.valor}
              onChange={(e) => onUpd({ valor: e.target.value })}
              className="h-8 text-sm"
            />
          )}
          empty={{ valor: "Nuevo punto" }}
        />
      );
    case "numbered":
      return (
        <ListEditor
          items={block.items}
          onChange={(items) => onPatch({ items } as Partial<SlideBlock>)}
          render={(item, onUpd) => (
            <div className="space-y-1.5">
              <Input value={item.titulo} onChange={(e) => onUpd({ titulo: e.target.value })} placeholder="Título" className="h-8 text-sm font-medium" />
              <Textarea value={item.descripcion} onChange={(e) => onUpd({ descripcion: e.target.value })} placeholder="Descripción" rows={2} className="text-sm" />
            </div>
          )}
          empty={{ titulo: "Título", descripcion: "Descripción" }}
        />
      );
    case "cards":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Label>Columnas:</Label>
            <Select value={String(block.columns)} onValueChange={(v) => onPatch({ columns: Number(v) as 2 | 3 | 4 } as Partial<SlideBlock>)}>
              <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ListEditor
            items={block.items}
            onChange={(items) => onPatch({ items } as Partial<SlideBlock>)}
            render={(item, onUpd) => (
              <div className="space-y-1.5">
                <Input value={item.titulo} onChange={(e) => onUpd({ titulo: e.target.value })} placeholder="Título" className="h-8 text-sm font-medium" />
                <Textarea value={item.descripcion} onChange={(e) => onUpd({ descripcion: e.target.value })} placeholder="Descripción" rows={2} className="text-sm" />
                <ImageInputOrUpload
                  value={item.imagen ?? null}
                  onChange={(url) => onUpd({ imagen: url })}
                  empresaId={empresaId}
                  kind="card"
                  compact
                />
              </div>
            )}
            empty={{ titulo: "Tarjeta", descripcion: "Texto", imagen: null }}
          />
        </div>
      );
    case "icon-row":
      return (
        <ListEditor
          items={block.items}
          onChange={(items) => onPatch({ items } as Partial<SlideBlock>)}
          render={(item, onUpd) => (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <IconPicker value={item.icono} onChange={(v) => onUpd({ icono: v })} />
                <Input value={item.titulo} onChange={(e) => onUpd({ titulo: e.target.value })} placeholder="Título" className="h-8 text-sm font-medium" />
              </div>
              <Textarea value={item.descripcion} onChange={(e) => onUpd({ descripcion: e.target.value })} placeholder="Descripción" rows={2} className="text-sm" />
            </div>
          )}
          empty={{ icono: "star", titulo: "Título", descripcion: "Descripción" }}
        />
      );
    case "buttons":
      return (
        <ListEditor
          items={block.items}
          onChange={(items) => onPatch({ items } as Partial<SlideBlock>)}
          render={(item, onUpd) => (
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <Input value={item.label} onChange={(e) => onUpd({ label: e.target.value })} placeholder="Texto del botón" className="h-8 text-sm" />
              <Input value={item.href} onChange={(e) => onUpd({ href: e.target.value })} placeholder="https://… o #formulario" className="h-8 text-sm" />
            </div>
          )}
          empty={{ label: "Botón", href: "#" }}
        />
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImageInputOrUpload
            value={block.src ?? null}
            onChange={(url) => onPatch({ src: url } as Partial<SlideBlock>)}
            empresaId={empresaId}
            kind="image-block"
          />
          <Input value={block.alt ?? ""} onChange={(e) => onPatch({ alt: e.target.value } as Partial<SlideBlock>)} placeholder="Texto alternativo" className="h-8 text-sm" />
        </div>
      );
    case "divider":
      return <div className="text-xs text-muted-foreground">Separador visual</div>;
  }
}

function ListEditor<T>({
  items,
  onChange,
  render,
  empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, onUpd: (p: Partial<T>) => void) => React.ReactNode;
  empty: T;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5 rounded border p-2">
          <div className="flex-1">
            {render(it, (p) => {
              const next = [...items];
              next[i] = { ...next[i], ...p };
              onChange(next);
            })}
          </div>
          <div className="flex flex-col gap-0.5">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
              if (i === 0) return;
              const next = [...items];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              onChange(next);
            }}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
              if (i === items.length - 1) return;
              const next = [...items];
              [next[i + 1], next[i]] = [next[i], next[i + 1]];
              onChange(next);
            }}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="w-full" onClick={() => onChange([...items, { ...empty }])}>
        <Plus className="h-3.5 w-3.5" /> Añadir
      </Button>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = ICON_CATALOG.find((i) => i.value === value) ?? ICON_CATALOG[0];
  const SelectedIcon = selected.Icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-32 justify-between gap-2 px-2 text-xs"
          title={selected.label}
        >
          <span className="flex items-center gap-1.5 truncate">
            <SelectedIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{selected.label}</span>
          </span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {ICON_CATALOG.map(({ value: v, label, Icon }) => {
            const active = v === value;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
                title={label}
                className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function IARewriteButton({ texto, onResult }: { texto: string; onResult: (t: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [tono, setTono] = useState<"formal" | "cercano" | "corto" | "largo" | "motivacional">("formal");

  async function run() {
    if (!texto.trim()) return;
    setLoading(true);
    const res = await iaReescribirTexto({ texto, tono });
    setLoading(false);
    if (res.ok) {
      onResult(res.texto);
      toast.success(`Reescrito en tono ${tono}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={tono} onValueChange={(v) => setTono(v as typeof tono)}>
        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="formal">Formal</SelectItem>
          <SelectItem value="cercano">Cercano</SelectItem>
          <SelectItem value="corto">Más corto</SelectItem>
          <SelectItem value="largo">Más largo</SelectItem>
          <SelectItem value="motivacional">Motivacional</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={run} disabled={loading || !texto.trim()}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
        IA
      </Button>
    </div>
  );
}

function IADialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (slide: Slide) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await iaGenerarSlide({ prompt });
    setLoading(false);
    if (res.ok) {
      onCreate(res.slide);
      setPrompt("");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Generar slide con IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">¿Sobre qué quieres la slide?</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej. Explica brevemente cómo se calcula la nota final de la inspección..."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={run} disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
