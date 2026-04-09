import { useState } from "react";
import { ItemCalendario, Comentario, REDES_SOCIALES, ESTADOS_PUBLICACION } from "@/data/marketing";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, Send, Calendar, Clock, User, Tag, MessageSquare } from "lucide-react";

interface Props {
  item: ItemCalendario | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: ItemCalendario) => void;
  onDelete: (id: string) => void;
  onAddComment: (itemId: string, comment: Comentario) => void;
}

export function DetallePanel({ item, open, onClose, onEdit, onDelete, onAddComment }: Props) {
  const [commentText, setCommentText] = useState("");

  if (!item) return null;

  const red = item.tipo === "publicacion" ? item.redSocial : item.redSocialRelacionada;
  const redInfo = REDES_SOCIALES.find((r) => r.id === red);
  const estadoLabel = ESTADOS_PUBLICACION.find((e) => e.value === item.estado)?.label ?? item.estado;

  const sendComment = () => {
    if (!commentText.trim()) return;
    onAddComment(item.id, {
      id: `comment-${Date.now()}`,
      autor: "Admin",
      texto: commentText.trim(),
      fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
    setCommentText("");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {redInfo && (
              <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center text-white shrink-0" style={{ backgroundColor: redInfo.color }}>
                {redInfo.icon}
              </span>
            )}
            {item.titulo}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[10px]">{item.tipo === "publicacion" ? "Publicación" : "Evento"}</Badge>
            <Badge className="text-[10px]">{estadoLabel}</Badge>
            {redInfo && <Badge variant="secondary" className="text-[10px]">{redInfo.label}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> {item.fecha}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {item.hora}
            </div>
            {item.responsable && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" /> {item.responsable}
              </div>
            )}
            {item.campaña && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> {item.campaña}
              </div>
            )}
          </div>

          {item.tipo === "publicacion" && (
            <>
              {item.texto && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Texto</p>
                  <p className="text-sm text-foreground">{item.texto}</p>
                </div>
              )}
              {item.descripcion && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm text-foreground">{item.descripcion}</p>
                </div>
              )}
              {item.hashtags && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Hashtags</p>
                  <p className="text-sm text-primary">{item.hashtags}</p>
                </div>
              )}
              {item.enlace && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Enlace</p>
                  <a href={item.enlace} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{item.enlace}</a>
                </div>
              )}
            </>
          )}

          {item.tipo === "evento" && item.descripcion && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Descripción</p>
              <p className="text-sm text-foreground">{item.descripcion}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { onDelete(item.id); onClose(); }}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Comentarios internos ({item.comentarios.length})
            </p>
            <div className="space-y-2 mb-3">
              {item.comentarios.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin comentarios.</p>
              )}
              {item.comentarios.map((c) => (
                <div key={c.id} className="bg-muted/50 rounded p-2">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{c.autor}</span>
                    <span className="text-[10px] text-muted-foreground">{c.fecha}</span>
                  </div>
                  <p className="text-xs text-foreground">{c.texto}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={commentText} onChange={(e) => setCommentText(e.target.value)}
                placeholder="Añadir comentario..." className="text-xs flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") sendComment(); }}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendComment}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
