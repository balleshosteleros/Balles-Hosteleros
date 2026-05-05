"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  Briefcase, Eye, EyeOff, Globe, Plus, Pencil, Trash2,
  Loader2, Copy, ExternalLink, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listVacantes, createVacante, updateVacante, deleteVacante,
  toggleVisibilidadVacante, publicarVacante, cerrarVacante,
  listPuestosCatalogo, listDepartamentosCatalogo,
} from "@/features/rrhh/actions/vacantes-actions";
import { DialogSnippetEmbed } from "@/features/empleo-publico/components/DialogSnippetEmbed";

type EstadoPub = "publicada" | "borrador" | "cerrada" | "archivada";
type TipoJornada = "completa" | "parcial" | "rotativa" | "fines_de_semana" | "extra";

interface PuestoRef { id: string; nombre: string; departamento_id?: string | null }
interface DepartamentoRef { id: string; nombre: string }

interface VacanteRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado_publicacion: EstadoPub;
  visible_publicamente: boolean;
  ubicacion: string | null;
  tipo_jornada: string | null;
  salario_rango: string | null;
  cuestionario: boolean;
  favorita: boolean;
  puesto_id: string | null;
  departamento_id: string | null;
  puestos?: { id: string; nombre: string } | null;
  departamentos?: { id: string; nombre: string } | null;
  created_at: string;
}

const ESTADO_LABEL: Record<EstadoPub, string> = {
  publicada: "Publicada",
  borrador: "Borrador",
  cerrada: "Cerrada",
  archivada: "Archivada",
};

const ESTADO_COLOR: Record<EstadoPub, string> = {
  publicada: "bg-emerald-100 text-emerald-700 border-emerald-200",
  borrador: "bg-amber-100 text-amber-700 border-amber-200",
  cerrada: "bg-muted text-muted-foreground border-border",
  archivada: "bg-muted text-muted-foreground border-border",
};

const JORNADA_OPCIONES: { value: TipoJornada; label: string }[] = [
  { value: "completa", label: "Jornada completa" },
  { value: "parcial", label: "Jornada parcial" },
  { value: "rotativa", label: "Rotativa" },
  { value: "fines_de_semana", label: "Fines de semana" },
  { value: "extra", label: "Horas extra" },
];

interface FormState {
  titulo: string;
  descripcion: string;
  puesto_id: string;
  departamento_id: string;
  ubicacion: string;
  tipo_jornada: string;
  salario_rango: string;
  estado_publicacion: EstadoPub;
  visible_publicamente: boolean;
}

const FORM_VACIO: FormState = {
  titulo: "",
  descripcion: "",
  puesto_id: "",
  departamento_id: "",
  ubicacion: "",
  tipo_jornada: "",
  salario_rango: "",
  estado_publicacion: "borrador",
  visible_publicamente: false,
};

export function OfertasPublicasTab({ empresaSlug }: { empresaSlug?: string | null }) {
  const [vacantes, setVacantes] = useState<VacanteRow[]>([]);
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VacanteRow | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VACIO);

  const [confirmDelete, setConfirmDelete] = useState<VacanteRow | null>(null);
  const [snippetVacante, setSnippetVacante] = useState<VacanteRow | null>(null);
  const [snippetGlobalOpen, setSnippetGlobalOpen] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [v, p, d] = await Promise.all([
      listVacantes(),
      listPuestosCatalogo(),
      listDepartamentosCatalogo(),
    ]);
    setVacantes((v.data ?? []) as VacanteRow[]);
    setPuestos((p.data ?? []) as PuestoRef[]);
    setDepartamentos((d.data ?? []) as DepartamentoRef[]);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  function abrirNueva() {
    setEditing(null);
    setForm(FORM_VACIO);
    setDialogOpen(true);
  }

  function abrirEditar(v: VacanteRow) {
    setEditing(v);
    setForm({
      titulo: v.titulo,
      descripcion: v.descripcion ?? "",
      puesto_id: v.puesto_id ?? "",
      departamento_id: v.departamento_id ?? "",
      ubicacion: v.ubicacion ?? "",
      tipo_jornada: v.tipo_jornada ?? "",
      salario_rango: v.salario_rango ?? "",
      estado_publicacion: v.estado_publicacion,
      visible_publicamente: v.visible_publicamente,
    });
    setDialogOpen(true);
  }

  function guardar() {
    if (!form.titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    startTransition(async () => {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        puesto_id: form.puesto_id || null,
        departamento_id: form.departamento_id || null,
        ubicacion: form.ubicacion.trim() || null,
        tipo_jornada: form.tipo_jornada || null,
        salario_rango: form.salario_rango.trim() || null,
        estado_publicacion: form.estado_publicacion,
        visible_publicamente: form.visible_publicamente,
      };
      const res = editing
        ? await updateVacante(editing.id, payload)
        : await createVacante(payload);
      if (res.ok) {
        toast.success(editing ? "Oferta actualizada" : "Oferta creada");
        setDialogOpen(false);
        void cargar();
      } else {
        toast.error(("error" in res && res.error) || "Error al guardar");
      }
    });
  }

  function toggleVisible(v: VacanteRow, next: boolean) {
    startTransition(async () => {
      const res = await toggleVisibilidadVacante(v.id, next);
      if (res.ok) {
        setVacantes((prev) => prev.map((x) => x.id === v.id ? { ...x, visible_publicamente: next } : x));
        toast.success(next ? "Visible públicamente" : "Oculta del portal");
      } else {
        toast.error("No se pudo cambiar la visibilidad");
      }
    });
  }

  function publicar(v: VacanteRow) {
    startTransition(async () => {
      const res = await publicarVacante(v.id);
      if (res.ok) {
        toast.success("Oferta publicada");
        void cargar();
      } else {
        toast.error("No se pudo publicar");
      }
    });
  }

  function cerrar(v: VacanteRow) {
    startTransition(async () => {
      const res = await cerrarVacante(v.id);
      if (res.ok) {
        toast.success("Oferta cerrada");
        void cargar();
      } else {
        toast.error("No se pudo cerrar");
      }
    });
  }

  function eliminar() {
    if (!confirmDelete) return;
    startTransition(async () => {
      const res = await deleteVacante(confirmDelete.id);
      if (res.ok) {
        toast.success("Oferta eliminada");
        setConfirmDelete(null);
        void cargar();
      } else {
        toast.error("No se pudo eliminar");
      }
    });
  }

  function abrirSnippet(v: VacanteRow) {
    if (!empresaSlug) {
      toast.error("La empresa no tiene slug configurado");
      return;
    }
    setSnippetVacante(v);
  }

  const totalPublicas = vacantes.filter((v) => v.visible_publicamente && v.estado_publicacion === "publicada").length;

  return (
    <div className="space-y-4">
      {/* ── Header con métrica + acción ───────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ofertas públicas de empleo</h2>
          <p className="text-sm text-muted-foreground">
            {totalPublicas} {totalPublicas === 1 ? "oferta visible" : "ofertas visibles"} en el portal público
            {empresaSlug && (
              <>
                {" · "}
                <a
                  href={`/empleo/${empresaSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver portal <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {empresaSlug && (
            <Button variant="outline" onClick={() => setSnippetGlobalOpen(true)}>
              <Globe className="h-4 w-4 mr-1.5" /> Compartir portal
            </Button>
          )}
          <Button onClick={abrirNueva}>
            <Plus className="h-4 w-4 mr-1.5" /> Nueva oferta
          </Button>
        </div>
      </div>

      {/* ── Lista ─────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando…
        </div>
      ) : vacantes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <Briefcase className="h-10 w-10 mx-auto opacity-40" />
            <div>
              <p className="font-medium">Aún no hay ofertas creadas</p>
              <p className="text-sm">Crea tu primera oferta para empezar a recibir candidaturas.</p>
            </div>
            <Button onClick={abrirNueva}>
              <Plus className="h-4 w-4 mr-1.5" /> Crear oferta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {vacantes.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{v.titulo}</h3>
                    <Badge variant="outline" className={`text-[10px] ${ESTADO_COLOR[v.estado_publicacion]}`}>
                      {ESTADO_LABEL[v.estado_publicacion]}
                    </Badge>
                    {v.visible_publicamente ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                        <Globe className="h-3 w-3 mr-1" /> Pública
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        <EyeOff className="h-3 w-3 mr-1" /> Solo interna
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {v.departamentos?.nombre && <span>{v.departamentos.nombre}</span>}
                    {v.puestos?.nombre && <span>· {v.puestos.nombre}</span>}
                    {v.ubicacion && <span>· {v.ubicacion}</span>}
                    {v.tipo_jornada && <span>· {v.tipo_jornada}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-2">
                    <Switch
                      checked={v.visible_publicamente}
                      disabled={isPending || v.estado_publicacion !== "publicada"}
                      onCheckedChange={(n) => toggleVisible(v, n)}
                      aria-label="Visible en el portal público"
                    />
                    <span className="text-xs text-muted-foreground">Pública</span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => abrirEditar(v)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      {v.estado_publicacion !== "publicada" && (
                        <DropdownMenuItem onClick={() => publicar(v)}>
                          <Eye className="h-4 w-4 mr-2" /> Publicar
                        </DropdownMenuItem>
                      )}
                      {v.estado_publicacion === "publicada" && (
                        <DropdownMenuItem onClick={() => cerrar(v)}>
                          <EyeOff className="h-4 w-4 mr-2" /> Cerrar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => abrirSnippet(v)} disabled={!empresaSlug}>
                        <Copy className="h-4 w-4 mr-2" /> Compartir / embed
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirmDelete(v)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Dialog crear/editar ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar oferta" : "Nueva oferta de empleo"}</DialogTitle>
            <DialogDescription>
              Las ofertas marcadas como visibles aparecen en el portal público de empleo de la empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. Camarero/a turno tarde"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select value={form.departamento_id} onValueChange={(v) => setForm({ ...form, departamento_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Puesto</Label>
                <Select value={form.puesto_id} onValueChange={(v) => setForm({ ...form, puesto_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {puestos.length === 0 ? (
                      <SelectItem value="__none__" disabled>Sin puestos creados</SelectItem>
                    ) : (
                      puestos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ubicación</Label>
                <Input
                  value={form.ubicacion}
                  onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                  placeholder="Ej. Madrid centro"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de jornada</Label>
                <Select value={form.tipo_jornada} onValueChange={(v) => setForm({ ...form, tipo_jornada: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {JORNADA_OPCIONES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Rango salarial (opcional)</Label>
              <Input
                value={form.salario_rango}
                onChange={(e) => setForm({ ...form, salario_rango: e.target.value })}
                placeholder="Ej. 18.000 - 22.000 € brutos/año"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={5}
                placeholder="Tareas, requisitos, beneficios…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.estado_publicacion}
                  onValueChange={(v) => setForm({ ...form, estado_publicacion: v as EstadoPub })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador (no visible)</SelectItem>
                    <SelectItem value="publicada">Publicada</SelectItem>
                    <SelectItem value="cerrada">Cerrada</SelectItem>
                    <SelectItem value="archivada">Archivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Visibilidad pública</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Switch
                    checked={form.visible_publicamente}
                    onCheckedChange={(n) => setForm({ ...form, visible_publicamente: n })}
                    disabled={form.estado_publicacion !== "publicada"}
                  />
                  <span className="text-sm">
                    {form.visible_publicamente ? "Aparece en el portal público" : "Oculta del portal"}
                  </span>
                </div>
                {form.estado_publicacion !== "publicada" && (
                  <p className="text-[11px] text-muted-foreground">
                    Activa el estado <b>Publicada</b> para poder hacer la oferta visible.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar cambios" : "Crear oferta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Snippet embed (per oferta) ─────────────────── */}
      {empresaSlug && (
        <DialogSnippetEmbed
          open={!!snippetVacante}
          onOpenChange={(o) => !o && setSnippetVacante(null)}
          empresaSlug={empresaSlug}
          empresaNombre={snippetVacante?.titulo ?? "tu empresa"}
          ofertaId={snippetVacante?.id}
          ofertaTitulo={snippetVacante?.titulo}
        />
      )}

      {/* ── Snippet embed (portal global) ─────────────────── */}
      {empresaSlug && (
        <DialogSnippetEmbed
          open={snippetGlobalOpen}
          onOpenChange={setSnippetGlobalOpen}
          empresaSlug={empresaSlug}
          empresaNombre="tu empresa"
        />
      )}

      {/* ── Confirm delete ─────────────────── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.titulo}. Esta acción es irreversible. Las candidaturas vinculadas perderán la referencia a la oferta pero se mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
