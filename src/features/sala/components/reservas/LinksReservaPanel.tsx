"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Check, Power, Trash2, Link2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SubmoduleToolbar, coincideBusquedaUniversal, type ToolbarColumna, type ToolbarColumnaVisible } from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { toast } from "sonner";
import { PALABRA_CLAVE_MAX, validarPalabraClave, type ReservaLink } from "@/features/sala/data/reserva-links";
import {
  listReservaLinks,
  createReservaLink,
  toggleReservaLink,
  deleteReservaLink,
} from "@/features/sala/actions/reserva-links-actions";

const COLUMNAS: ToolbarColumna[] = [
  { campo: "palabraClave", label: "Palabra clave", bloqueada: true },
  { campo: "urlGenerada", label: "URL" },
  { campo: "activo", label: "Estado" },
  { campo: "createdAt", label: "Creado" },
];

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function LinksReservaPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [links, setLinks] = useState<ReservaLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevaPalabra, setNuevaPalabra] = useState("");
  const [creando, startCreate] = useTransition();
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({
    palabraClave: true, urlGenerada: true, activo: true, createdAt: true,
  });
  const [columnasOrden, setColumnasOrden] = useState<string[]>(["palabraClave","urlGenerada","activo","createdAt"]);

  async function refrescar() {
    setLoading(true);
    const r = await listReservaLinks();
    if (r.ok) setLinks(r.data);
    else toast.error(r.error ?? "Error al cargar links");
    setLoading(false);
  }

  useEffect(() => { refrescar(); }, []);

  const palabraValidacion = useMemo(() => {
    if (!nuevaPalabra) return null;
    return validarPalabraClave(nuevaPalabra);
  }, [nuevaPalabra]);

  const filtrados = useMemo(() => {
    if (!busqueda) return links;
    return links.filter((l) => coincideBusquedaUniversal(l, busqueda));
  }, [links, busqueda]);

  function copiar(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoId(id);
      toast.success("URL copiada");
      setTimeout(() => setCopiadoId((cur) => (cur === id ? null : cur)), 1500);
    });
  }

  function onCrear() {
    if (!palabraValidacion?.ok) return;
    startCreate(async () => {
      const r = await createReservaLink(nuevaPalabra);
      if (!r.ok) {
        toast.error(r.error ?? "Error al crear link");
        return;
      }
      toast.success(`Link "${r.data!.palabraClave}" creado`);
      setNuevaPalabra("");
      setDialogOpen(false);
      refrescar();
    });
  }

  async function onToggle(link: ReservaLink) {
    const r = await toggleReservaLink(link.id, !link.activo);
    if (!r.ok) {
      toast.error(r.error ?? "Error al actualizar");
      return;
    }
    refrescar();
  }

  async function onEliminar(link: ReservaLink) {
    if (!confirm(`¿Eliminar el link "${link.palabraClave}"? Las reservas históricas conservarán el badge.`)) return;
    const r = await deleteReservaLink(link.id);
    if (!r.ok) {
      toast.error(r.error ?? "Error al eliminar");
      return;
    }
    toast.success("Link eliminado");
    refrescar();
  }

  const ordenVisible = columnasOrden.filter((c) => columnasVisibles[c] ?? true);

  return (
    <div className={embedded ? "space-y-4" : "p-4 md:p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center gap-3">
          <Link href="/sala/reservas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a Reservas
          </Link>
        </div>
      )}

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar palabra clave..."
        onNuevo={() => setDialogOpen(true)}
        textoNuevo="Nuevo link"
        columnas={COLUMNAS}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <ResizableColumnsProvider storageKey="sala-reserva-links">
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {ordenVisible.includes("palabraClave") && (
                  <th className="text-left px-3 py-2"><TableColumnHeader label="Palabra clave" /></th>
                )}
                {ordenVisible.includes("urlGenerada") && (
                  <th className="text-left px-3 py-2"><TableColumnHeader label="URL" /></th>
                )}
                {ordenVisible.includes("activo") && (
                  <th className="text-left px-3 py-2"><TableColumnHeader label="Estado" /></th>
                )}
                {ordenVisible.includes("createdAt") && (
                  <th className="text-left px-3 py-2"><TableColumnHeader label="Creado" /></th>
                )}
                <th className="text-right px-3 py-2 w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={ordenVisible.length + 1} className="text-center text-muted-foreground py-6">Cargando...</td></tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr>
                  <td colSpan={ordenVisible.length + 1} className="text-center text-muted-foreground py-10">
                    <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <div>Sin links de reserva creados.</div>
                    <div className="text-xs">Crea uno para atribuir reservas por origen (SMS, Instagram, etc.).</div>
                  </td>
                </tr>
              )}
              {!loading && filtrados.map((l) => (
                <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  {ordenVisible.includes("palabraClave") && (
                    <td className="px-3 py-2">
                      <Badge variant={l.activo ? "default" : "outline"} className="font-mono">{l.palabraClave}</Badge>
                    </td>
                  )}
                  {ordenVisible.includes("urlGenerada") && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 max-w-[460px]">
                        <code className="text-xs text-muted-foreground truncate">{l.urlGenerada}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copiar(l.urlGenerada, l.id)} title="Copiar">
                          {copiadoId === l.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  )}
                  {ordenVisible.includes("activo") && (
                    <td className="px-3 py-2">
                      {l.activo
                        ? <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/15">Activo</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                    </td>
                  )}
                  {ordenVisible.includes("createdAt") && (
                    <td className="px-3 py-2 text-muted-foreground">{formatFecha(l.createdAt)}</td>
                  )}
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
      </ResizableColumnsProvider>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo link de reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="palabra-clave">Palabra clave</Label>
              <Input
                id="palabra-clave"
                value={nuevaPalabra}
                onChange={(e) => setNuevaPalabra(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="INSTAGRAM_MAYO"
                maxLength={PALABRA_CLAVE_MAX}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Solo mayúsculas, números y guion bajo. Máx {PALABRA_CLAVE_MAX} caracteres.
              </p>
              {palabraValidacion && !palabraValidacion.ok && (
                <p className="text-xs text-destructive mt-1">{palabraValidacion.error}</p>
              )}
              {palabraValidacion?.ok && (
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  URL: <code className="text-foreground">.../r/&lt;empresa&gt;/{palabraValidacion.valor.toLowerCase()}</code>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={onCrear} disabled={!palabraValidacion?.ok || creando}>
              {creando ? "Creando..." : "Crear link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
