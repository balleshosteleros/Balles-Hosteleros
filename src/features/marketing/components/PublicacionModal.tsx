import { useState } from "react";
import {
  ItemCalendario, Publicacion, EventoMarketing, RedSocial, TipoContenido, TipoEvento, EstadoPublicacion,
  REDES_SOCIALES, TIPOS_CONTENIDO, TIPOS_EVENTO, ESTADOS_PUBLICACION,
} from "@/features/marketing/data/marketing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (item: ItemCalendario) => void;
  editItem?: ItemCalendario | null;
  empresaId: string;
}

const defaultPub: Omit<Publicacion, "id"> = {
  tipo: "publicacion", redSocial: "instagram", empresaId: "", cuentaConectada: "",
  tipoContenido: "imagen", titulo: "", texto: "", descripcion: "", fecha: "", hora: "12:00",
  imagenUrl: "", enlace: "", hashtags: "", responsable: "", estado: "borrador",
  campaña: "", comentarios: [], miniatura: "", etiquetas: "",
};

const defaultEvt: Omit<EventoMarketing, "id"> = {
  tipo: "evento", tipoEvento: "reunion", redSocialRelacionada: "", empresaId: "",
  titulo: "", fecha: "", hora: "10:00", descripcion: "", responsable: "",
  estado: "borrador", campaña: "", comentarios: [],
};

export function PublicacionModal({ open, onClose, onSave, editItem, empresaId }: Props) {
  const isEdit = !!editItem;
  const [tipoTab, setTipoTab] = useState<"publicacion" | "evento">(editItem?.tipo ?? "publicacion");

  const [pub, setPub] = useState<Omit<Publicacion, "id">>(() =>
    editItem?.tipo === "publicacion" ? { ...editItem } : { ...defaultPub, empresaId }
  );
  const [evt, setEvt] = useState<Omit<EventoMarketing, "id">>(() =>
    editItem?.tipo === "evento" ? { ...editItem } : { ...defaultEvt, empresaId }
  );

  const guardar = () => {
    if (tipoTab === "publicacion") {
      if (!pub.titulo.trim() || !pub.fecha) { toast.error("Completa título y fecha"); return; }
      const item: Publicacion = { ...pub, id: editItem?.id ?? `pub-${Date.now()}`, empresaId };
      onSave(item);
    } else {
      if (!evt.titulo.trim() || !evt.fecha) { toast.error("Completa título y fecha"); return; }
      const item: EventoMarketing = { ...evt, id: editItem?.id ?? `evt-${Date.now()}`, empresaId };
      onSave(item);
    }
    onClose();
  };

  // Dynamic fields based on selected social network
  const renderCamposRed = () => {
    const commonFields = (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={pub.fecha} onChange={(e) => setPub((p) => ({ ...p, fecha: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hora</Label>
            <Input type="time" value={pub.hora} onChange={(e) => setPub((p) => ({ ...p, hora: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Responsable</Label>
            <Input value={pub.responsable} onChange={(e) => setPub((p) => ({ ...p, responsable: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={pub.estado} onValueChange={(v) => setPub((p) => ({ ...p, estado: v as EstadoPublicacion }))}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS_PUBLICACION.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Campaña o evento</Label>
          <Input value={pub.campaña} onChange={(e) => setPub((p) => ({ ...p, campaña: e.target.value }))} placeholder="Opcional" />
        </div>
      </>
    );

    if (pub.redSocial === "youtube") {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Título del vídeo</Label>
            <Input value={pub.titulo} onChange={(e) => setPub((p) => ({ ...p, titulo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea value={pub.descripcion} onChange={(e) => setPub((p) => ({ ...p, descripcion: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL del vídeo</Label>
            <Input value={pub.imagenUrl} onChange={(e) => setPub((p) => ({ ...p, imagenUrl: e.target.value }))} placeholder="Enlace al archivo de vídeo" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Miniatura</Label>
            <Input value={pub.miniatura} onChange={(e) => setPub((p) => ({ ...p, miniatura: e.target.value }))} placeholder="URL de la miniatura" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Etiquetas</Label>
            <Input value={pub.etiquetas} onChange={(e) => setPub((p) => ({ ...p, etiquetas: e.target.value }))} placeholder="Separadas por coma" />
          </div>
          {commonFields}
        </>
      );
    }

    if (pub.redSocial === "tiktok") {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={pub.titulo} onChange={(e) => setPub((p) => ({ ...p, titulo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL del vídeo</Label>
            <Input value={pub.imagenUrl} onChange={(e) => setPub((p) => ({ ...p, imagenUrl: e.target.value }))} placeholder="Enlace al archivo de vídeo" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto corto</Label>
            <Input value={pub.texto} onChange={(e) => setPub((p) => ({ ...p, texto: e.target.value }))} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hashtags</Label>
            <Input value={pub.hashtags} onChange={(e) => setPub((p) => ({ ...p, hashtags: e.target.value }))} />
          </div>
          {commonFields}
        </>
      );
    }

    if (pub.redSocial === "instagram") {
      return (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={pub.titulo} onChange={(e) => setPub((p) => ({ ...p, titulo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Copy</Label>
            <Textarea value={pub.texto} onChange={(e) => setPub((p) => ({ ...p, texto: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Formato</Label>
              <Select value={pub.tipoContenido} onValueChange={(v) => setPub((p) => ({ ...p, tipoContenido: v as TipoContenido }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["imagen", "video", "carrusel", "story", "reel"].map((t) => (
                    <SelectItem key={t} value={t}>{TIPOS_CONTENIDO.find((x) => x.value === t)?.label ?? t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Imagen/Vídeo URL</Label>
              <Input value={pub.imagenUrl} onChange={(e) => setPub((p) => ({ ...p, imagenUrl: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hashtags</Label>
            <Input value={pub.hashtags} onChange={(e) => setPub((p) => ({ ...p, hashtags: e.target.value }))} />
          </div>
          {commonFields}
        </>
      );
    }

    // Facebook default
    return (
      <>
        <div className="space-y-1.5">
          <Label className="text-xs">Título</Label>
          <Input value={pub.titulo} onChange={(e) => setPub((p) => ({ ...p, titulo: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Texto de publicación</Label>
          <Textarea value={pub.texto} onChange={(e) => setPub((p) => ({ ...p, texto: e.target.value }))} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Imagen/Vídeo URL</Label>
            <Input value={pub.imagenUrl} onChange={(e) => setPub((p) => ({ ...p, imagenUrl: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Enlace</Label>
            <Input value={pub.enlace} onChange={(e) => setPub((p) => ({ ...p, enlace: e.target.value }))} />
          </div>
        </div>
        {commonFields}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar elemento" : "Nuevo contenido"}</DialogTitle>
        </DialogHeader>

        {!isEdit && (
          <Tabs value={tipoTab} onValueChange={(v) => setTipoTab(v as "publicacion" | "evento")} className="mb-2">
            <TabsList className="w-full">
              <TabsTrigger value="publicacion" className="flex-1 text-xs">Publicación en red social</TabsTrigger>
              <TabsTrigger value="evento" className="flex-1 text-xs">Evento de marketing</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {tipoTab === "publicacion" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Red social</Label>
                <Select value={pub.redSocial} onValueChange={(v) => setPub((p) => ({ ...p, redSocial: v as RedSocial }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{REDES_SOCIALES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta conectada</Label>
                <Input value={pub.cuentaConectada} onChange={(e) => setPub((p) => ({ ...p, cuentaConectada: e.target.value }))} placeholder="@cuenta" className="text-xs" />
              </div>
            </div>
            {renderCamposRed()}
            <div className="space-y-1.5">
              <Label className="text-xs">Comentarios internos</Label>
              <Textarea value={pub.descripcion} onChange={(e) => setPub((p) => ({ ...p, descripcion: e.target.value }))} rows={2} placeholder="Notas para el equipo..." />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título del evento</Label>
              <Input value={evt.titulo} onChange={(e) => setEvt((p) => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de evento</Label>
                <Select value={evt.tipoEvento} onValueChange={(v) => setEvt((p) => ({ ...p, tipoEvento: v as TipoEvento }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_EVENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Red social relacionada</Label>
                <Select value={evt.redSocialRelacionada || "__NONE__"} onValueChange={(v) => setEvt((p) => ({ ...p, redSocialRelacionada: v === "__NONE__" ? "" : v as RedSocial }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">Ninguna</SelectItem>
                    {REDES_SOCIALES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={evt.fecha} onChange={(e) => setEvt((p) => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={evt.hora} onChange={(e) => setEvt((p) => ({ ...p, hora: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={evt.descripcion} onChange={(e) => setEvt((p) => ({ ...p, descripcion: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Responsable</Label>
                <Input value={evt.responsable} onChange={(e) => setEvt((p) => ({ ...p, responsable: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={evt.estado} onValueChange={(v) => setEvt((p) => ({ ...p, estado: v as EstadoPublicacion }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_PUBLICACION.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Campaña</Label>
              <Input value={evt.campaña} onChange={(e) => setEvt((p) => ({ ...p, campaña: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar}>{isEdit ? "Guardar cambios" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
