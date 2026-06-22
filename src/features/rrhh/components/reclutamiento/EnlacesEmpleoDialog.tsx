"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, Check, Power, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function EnlacesEmpleoDialog({ open, onOpenChange }: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [links, setLinks] = useState<EmpleoLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, startCreate] = useTransition();
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

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

  const codigoValidacion = useMemo(() => {
    if (!nuevoCodigo) return null;
    return validarCodigo(nuevoCodigo);
  }, [nuevoCodigo]);

  function copiar(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoId(id);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiadoId((cur) => (cur === id ? null : cur)), 1500);
    });
  }

  function onCrear() {
    if (!codigoValidacion?.ok) return;
    if (!nuevoNombre.trim()) {
      toast.error("Ponle un nombre al enlace");
      return;
    }
    startCreate(async () => {
      const r = await createEmpleoLink({
        codigo: nuevoCodigo,
        nombre: nuevoNombre.trim(),
      });
      if (!r.ok) {
        toast.error(r.error ?? "Error al crear enlace");
        return;
      }
      toast.success(`Enlace "${r.data!.nombre}" creado`);
      setNuevoCodigo("");
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
      title: "Eliminar enlace",
      description: `¿Eliminar el enlace "${link.nombre}"? Las candidaturas históricas conservarán el canal.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const r = await deleteEmpleoLink(link.id);
    if (!r.ok) {
      toast.error(r.error ?? "Error al eliminar");
      return;
    }
    toast.success("Enlace eliminado");
    refrescar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {confirmDeleteDialog}
        <DialogHeader>
          <DialogTitle>Enlaces de empleo por canal</DialogTitle>
          <DialogDescription>
            El mismo portal con un enlace por canal (Instagram, InfoJobs, cartel…). Cada CV que
            llegue por un enlace queda etiquetado con su canal, para saber por dónde entró.
          </DialogDescription>
        </DialogHeader>

        {/* Alta */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="enlace-nombre">Nombre</Label>
              <Input
                id="enlace-nombre"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Instagram, InfoJobs…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enlace-codigo">Código</Label>
              <Input
                id="enlace-codigo"
                value={nuevoCodigo}
                onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="INSTAGRAM"
                maxLength={CODIGO_MAX}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {codigoValidacion && !codigoValidacion.ok
                ? <span className="text-destructive">{codigoValidacion.error}</span>
                : <>Solo mayúsculas, números y guion bajo. Máx {CODIGO_MAX} caracteres.</>}
            </p>
            <Button
              size="sm"
              onClick={onCrear}
              disabled={!codigoValidacion?.ok || !nuevoNombre.trim() || creando}
            >
              {creando ? "Creando…" : "Crear enlace"}
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2">Enlace</th>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Creado</th>
                <th className="px-3 py-2 text-right w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Cargando…</td></tr>
              )}
              {!loading && links.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-10">
                    <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <div>Sin enlaces creados.</div>
                    <div className="text-xs">Crea uno para diferenciar por dónde llegan los CV.</div>
                  </td>
                </tr>
              )}
              {!loading && links.map((l) => (
                <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{l.nombre}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{l.codigo}</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 max-w-[320px]">
                      <code className="text-xs text-muted-foreground truncate">{l.urlGenerada}</code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copiar(l.urlGenerada, l.id)} title="Copiar">
                        {copiadoId === l.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
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
      </DialogContent>
    </Dialog>
  );
}
