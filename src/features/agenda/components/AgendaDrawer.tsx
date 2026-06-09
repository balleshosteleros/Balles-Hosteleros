"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Notebook,
  Search,
  Plus,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Pencil,
  Trash2,
  Wrench,
  Truck,
  Sparkles,
  Siren,
  Tag,
  X,
  Users,
  Check,
  MoreVertical,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  CONTACTO_CATEGORIAS,
  CATEGORIA_LABELS,
  ETIQUETA_COLORES,
  type Contacto,
  type ContactoCategoria,
  type ContactoInput,
  type Etiqueta,
  type EtiquetaColor,
} from "@/features/agenda/types";
import {
  listContactos,
  createContacto,
  updateContacto,
  deleteContacto,
  listEtiquetas,
  createEtiqueta,
  updateEtiqueta,
  deleteEtiqueta,
} from "@/features/agenda/actions/contactos-actions";

const CATEGORIA_ICON: Record<ContactoCategoria, React.ElementType> = {
  mantenimiento: Wrench,
  proveedores: Truck,
  servicios: Sparkles,
  emergencias: Siren,
  empleados: Users,
  otros: Tag,
};

const CATEGORIA_TINT: Record<ContactoCategoria, string> = {
  mantenimiento: "text-amber-600 bg-amber-50",
  proveedores: "text-blue-600 bg-blue-50",
  servicios: "text-violet-600 bg-violet-50",
  emergencias: "text-red-600 bg-red-50",
  empleados: "text-emerald-600 bg-emerald-50",
  otros: "text-gray-600 bg-gray-50",
};

const CATEGORIA_BORDER: Record<ContactoCategoria, string> = {
  mantenimiento: "bg-amber-100 text-amber-700 border-amber-200",
  proveedores: "bg-blue-100 text-blue-700 border-blue-200",
  servicios: "bg-violet-100 text-violet-700 border-violet-200",
  emergencias: "bg-red-100 text-red-700 border-red-200",
  empleados: "bg-emerald-100 text-emerald-700 border-emerald-200",
  otros: "bg-gray-100 text-gray-700 border-gray-200",
};

const COLOR_CHIP: Record<EtiquetaColor, { dot: string; chip: string; chipActivo: string }> = {
  slate: { dot: "bg-slate-400", chip: "border-slate-200 text-slate-700 bg-slate-50", chipActivo: "border-slate-500 bg-slate-100 text-slate-800" },
  amber: { dot: "bg-amber-400", chip: "border-amber-200 text-amber-700 bg-amber-50", chipActivo: "border-amber-500 bg-amber-100 text-amber-800" },
  blue: { dot: "bg-blue-400", chip: "border-blue-200 text-blue-700 bg-blue-50", chipActivo: "border-blue-500 bg-blue-100 text-blue-800" },
  violet: { dot: "bg-violet-400", chip: "border-violet-200 text-violet-700 bg-violet-50", chipActivo: "border-violet-500 bg-violet-100 text-violet-800" },
  red: { dot: "bg-red-400", chip: "border-red-200 text-red-700 bg-red-50", chipActivo: "border-red-500 bg-red-100 text-red-800" },
  emerald: { dot: "bg-emerald-400", chip: "border-emerald-200 text-emerald-700 bg-emerald-50", chipActivo: "border-emerald-500 bg-emerald-100 text-emerald-800" },
  pink: { dot: "bg-pink-400", chip: "border-pink-200 text-pink-700 bg-pink-50", chipActivo: "border-pink-500 bg-pink-100 text-pink-800" },
  orange: { dot: "bg-orange-400", chip: "border-orange-200 text-orange-700 bg-orange-50", chipActivo: "border-orange-500 bg-orange-100 text-orange-800" },
};

const EMPTY_FORM: ContactoInput = {
  nombre: "",
  empresa_contacto: "",
  categoria: "proveedores",
  etiqueta_id: null,
  telefono: "",
  email: "",
  whatsapp: "",
  direccion: "",
  notas: "",
};

export function AgendaDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [cargando, setCargando] = useState(false);
  useGlobalLoadingSync(cargando);
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<ContactoCategoria | "todos">("todos");
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactoInput>(EMPTY_FORM);

  // Etiqueta dialog (crear / editar)
  const [etDialogOpen, setEtDialogOpen] = useState(false);
  const [etEditId, setEtEditId] = useState<string | null>(null);
  const [etNombre, setEtNombre] = useState("");
  const [etColor, setEtColor] = useState<EtiquetaColor>("slate");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [c, e] = await Promise.all([listContactos(), listEtiquetas()]);
      setContactos(c);
      setEtiquetas(e);
    } catch {
      toast.error("Error al cargar contactos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  // Reset filtro de etiqueta al cambiar de categoría
  useEffect(() => {
    setEtiquetaFiltro(null);
  }, [grupo]);

  const conteos = useMemo(() => {
    const c: Record<ContactoCategoria, number> = {
      mantenimiento: 0,
      proveedores: 0,
      servicios: 0,
      emergencias: 0,
      empleados: 0,
      otros: 0,
    };
    contactos.forEach((x) => (c[x.categoria] += 1));
    return c;
  }, [contactos]);

  const etiquetasGrupo = useMemo(() => {
    if (grupo === "todos") return [];
    return etiquetas.filter((e) => e.categoria === grupo);
  }, [etiquetas, grupo]);

  const conteoEtiquetas = useMemo(() => {
    const map = new Map<string, number>();
    contactos.forEach((c) => {
      if (c.etiqueta_id) map.set(c.etiqueta_id, (map.get(c.etiqueta_id) ?? 0) + 1);
    });
    return map;
  }, [contactos]);

  const filtrados = useMemo(() => {
    let lista = contactos;
    if (grupo !== "todos") lista = lista.filter((c) => c.categoria === grupo);
    if (etiquetaFiltro) lista = lista.filter((c) => c.etiqueta_id === etiquetaFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.empresa_contacto ?? "").toLowerCase().includes(q) ||
          (c.telefono ?? "").includes(q),
      );
    }
    return lista;
  }, [contactos, grupo, etiquetaFiltro, busqueda]);

  const etiquetaById = useMemo(() => {
    const map = new Map<string, Etiqueta>();
    etiquetas.forEach((e) => map.set(e.id, e));
    return map;
  }, [etiquetas]);

  function abrirNuevo() {
    setEditId(null);
    setForm({
      ...EMPTY_FORM,
      categoria: grupo === "todos" ? "proveedores" : grupo,
      etiqueta_id: etiquetaFiltro,
    });
    setDialogOpen(true);
  }

  function abrirEditar(c: Contacto) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      empresa_contacto: c.empresa_contacto,
      categoria: c.categoria,
      etiqueta_id: c.etiqueta_id,
      telefono: c.telefono,
      email: c.email,
      whatsapp: c.whatsapp,
      direccion: c.direccion,
      notas: c.notas,
    });
    setDialogOpen(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      if (editId) {
        const res = await updateContacto(editId, form);
        if (!res.ok) { toast.error(res.error ?? "Error al actualizar"); return; }
        toast.success("Contacto actualizado");
      } else {
        const res = await createContacto(form);
        if (!res.ok) { toast.error(res.error ?? "Error al crear"); return; }
        toast.success("Contacto creado");
      }
      setDialogOpen(false);
      await cargar();
    } catch {
      toast.error("Error al guardar contacto");
    }
  }

  async function eliminar(id: string) {
    try {
      const res = await deleteContacto(id);
      if (!res.ok) { toast.error(res.error ?? "Error al eliminar"); return; }
      setContactos((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contacto eliminado");
    } catch {
      toast.error("Error al eliminar contacto");
    }
  }

  // ───────── Etiquetas ─────────
  function abrirNuevaEtiqueta() {
    setEtEditId(null);
    setEtNombre("");
    setEtColor("slate");
    setEtDialogOpen(true);
  }

  function abrirEditarEtiqueta(e: Etiqueta) {
    setEtEditId(e.id);
    setEtNombre(e.nombre);
    setEtColor(e.color);
    setEtDialogOpen(true);
  }

  async function guardarEtiqueta() {
    if (grupo === "todos") return;
    const nombre = etNombre.trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      const payload = { nombre, color: etColor, categoria: grupo };
      const res = etEditId
        ? await updateEtiqueta(etEditId, payload)
        : await createEtiqueta(payload);
      if (!res.ok) { toast.error(res.error ?? "Error al guardar etiqueta"); return; }
      toast.success(etEditId ? "Etiqueta actualizada" : "Etiqueta creada");
      setEtDialogOpen(false);
      await cargar();
    } catch {
      toast.error("Error al guardar etiqueta");
    }
  }

  async function eliminarEtiqueta(id: string) {
    try {
      const res = await deleteEtiqueta(id);
      if (!res.ok) { toast.error(res.error ?? "Error al eliminar etiqueta"); return; }
      if (etiquetaFiltro === id) setEtiquetaFiltro(null);
      toast.success("Etiqueta eliminada");
      await cargar();
    } catch {
      toast.error("Error al eliminar etiqueta");
    }
  }

  const grupos: Array<ContactoCategoria | "todos"> = ["todos", ...CONTACTO_CATEGORIAS];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b py-3 pl-5 pr-14 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Notebook className="h-4 w-4 text-yellow-500" />
              Agenda
            </SheetTitle>
            <Button
              size="sm"
              className="h-7 gap-1 bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
              onClick={abrirNuevo}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo
            </Button>
          </div>
        </SheetHeader>

        {/* Buscador */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, empresa o teléfono…"
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Grupos por categoría */}
        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b bg-muted/20 shrink-0">
          {grupos.map((g) => {
            const total = g === "todos" ? contactos.length : conteos[g];
            const activo = grupo === g;
            const Icon = g === "todos" ? Notebook : CATEGORIA_ICON[g];
            return (
              <button
                key={g}
                onClick={() => setGrupo(g)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activo
                    ? "border-teal-600 bg-teal-50 text-teal-700"
                    : "border-border text-muted-foreground hover:border-teal-300 hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {g === "todos" ? "Todos" : CATEGORIA_LABELS[g]}
                <span className={`tabular-nums ${activo ? "text-teal-600" : "text-muted-foreground"}`}>
                  {total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Etiquetas de la categoría seleccionada */}
        {grupo !== "todos" && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b shrink-0">
            <button
              onClick={() => setEtiquetaFiltro(null)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                etiquetaFiltro === null
                  ? "border-teal-600 bg-teal-50 text-teal-700"
                  : "border-border text-muted-foreground hover:border-teal-300"
              }`}
            >
              Todas
              <span className="tabular-nums text-[10px]">{conteos[grupo]}</span>
            </button>
            {etiquetasGrupo.map((e) => {
              const activo = etiquetaFiltro === e.id;
              const colors = COLOR_CHIP[e.color] ?? COLOR_CHIP.slate;
              const total = conteoEtiquetas.get(e.id) ?? 0;
              return (
                <div key={e.id} className="inline-flex items-center">
                  <button
                    onClick={() => setEtiquetaFiltro(activo ? null : e.id)}
                    className={`inline-flex items-center gap-1 rounded-l-full border border-r-0 px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      activo ? colors.chipActivo : colors.chip
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                    {e.nombre}
                    <span className="tabular-nums opacity-70">{total}</span>
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`inline-flex items-center rounded-r-full border px-1 py-0.5 transition-colors ${
                          activo ? colors.chipActivo : colors.chip
                        }`}
                        title="Opciones"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-36 p-1">
                      <button
                        onClick={() => abrirEditarEtiqueta(e)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarEtiqueta(e.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })}
            <button
              onClick={abrirNuevaEtiqueta}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-teal-500 hover:text-teal-700"
            >
              <Plus className="h-3 w-3" />
              Etiqueta
            </button>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {cargando && <LoadingSpinner className="py-16" />}
          {!cargando && filtrados.length === 0 && (
            <div className="py-16 px-6 text-center text-sm text-muted-foreground">
              {contactos.length === 0
                ? "Aún no tienes contactos. Crea el primero con el botón Nuevo."
                : "No hay contactos que coincidan."}
            </div>
          )}
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border/50">
            {filtrados.map((c) => {
              const Icon = CATEGORIA_ICON[c.categoria];
              const et = c.etiqueta_id ? etiquetaById.get(c.etiqueta_id) : null;
              const etColors = et ? COLOR_CHIP[et.color] ?? COLOR_CHIP.slate : null;
              // Edición solo de contactos manuales: empleados/proveedores se
              // editan en su ficha original; emergencias son fijas. Aquí, el
              // resto es solo consulta + acción rápida (llamar / email).
              const editable = c.origen === "manual";
              const esAutomatico = !editable;
              return (
                <li
                  key={c.id}
                  className="bg-background px-3 py-2 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`shrink-0 rounded-md p-1.5 ${CATEGORIA_TINT[c.categoria]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold leading-tight truncate text-foreground">
                            {c.nombre}
                          </p>
                          {c.empresa_contacto && c.empresa_contacto !== c.nombre && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {c.empresa_contacto}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {!c.activo && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-gray-100 text-gray-600 border-gray-200"
                            >
                              {c.estado_origen ?? "Inactivo"}
                            </Badge>
                          )}
                          {et && etColors && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${etColors.chip}`}
                            >
                              <span className={`mr-1 h-1.5 w-1.5 rounded-full ${etColors.dot}`} />
                              {et.nombre}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${CATEGORIA_BORDER[c.categoria]}`}
                          >
                            {CATEGORIA_LABELS[c.categoria]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              esAutomatico
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }`}
                          >
                            {esAutomatico ? "Automático" : "Manual"}
                          </Badge>
                        </div>
                      </div>

                      {c.direccion && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {c.direccion}
                        </p>
                      )}

                      {/* Acciones rápidas: llamar / email / WhatsApp */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {c.telefono && (
                          <a
                            href={`tel:${c.telefono}`}
                            title={`Llamar a ${c.telefono}`}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                          >
                            <Phone className="h-3 w-3" />
                            {c.telefono}
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            title={`Enviar email a ${c.email}`}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                          >
                            <Mail className="h-3 w-3" />
                            Email
                          </a>
                        )}
                        {c.whatsapp && (
                          <a
                            href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir WhatsApp"
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                        )}

                        {editable && (
                          <span className="ml-auto inline-flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => abrirEditar(c)}
                              title="Editar"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => eliminar(c.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </span>
                        )}
                      </div>

                      {c.notas && (
                        <p className="mt-1.5 rounded-md bg-muted/50 p-1.5 text-[11px] text-muted-foreground">
                          {c.notas}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>

      {/* Dialog crear / editar contacto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar contacto" : "Nuevo contacto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Juan García"
                />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input
                  value={form.empresa_contacto ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, empresa_contacto: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Categoría</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) =>
                    setForm({ ...form, categoria: v as ContactoCategoria, etiqueta_id: null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACTO_CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORIA_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Etiqueta</Label>
                <Select
                  value={form.etiqueta_id ?? "__none__"}
                  onValueChange={(v) =>
                    setForm({ ...form, etiqueta_id: v === "__none__" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin etiqueta</SelectItem>
                    {etiquetas
                      .filter((e) => e.categoria === form.categoria)
                      .map((e) => {
                        const colors = COLOR_CHIP[e.color] ?? COLOR_CHIP.slate;
                        return (
                          <SelectItem key={e.id} value={e.id}>
                            <span className="inline-flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                              {e.nombre}
                            </span>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono ?? ""}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+34 600 000 000"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp ?? ""}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={form.direccion ?? ""}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Calle, ciudad…"
              />
            </div>
            <div>
              <Label>Notas</Label>
              <textarea
                value={form.notas ?? ""}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Horario de atención, observaciones…"
                className="mt-1 min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={guardar}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog crear / editar etiqueta */}
      <Dialog open={etDialogOpen} onOpenChange={setEtDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {etEditId ? "Editar etiqueta" : "Nueva etiqueta"}
              {grupo !== "todos" && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {CATEGORIA_LABELS[grupo]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input
                autoFocus
                value={etNombre}
                onChange={(e) => setEtNombre(e.target.value)}
                placeholder="Ej: Fontanería, Comercial, Limpieza…"
                onKeyDown={(e) => { if (e.key === "Enter") guardarEtiqueta(); }}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ETIQUETA_COLORES.map((c) => {
                  const colors = COLOR_CHIP[c];
                  const sel = etColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEtColor(c)}
                      className={`relative h-7 w-7 rounded-full border-2 transition-transform ${
                        sel ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                      } ${colors.dot}`}
                      title={c}
                    >
                      {sel && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEtDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={guardarEtiqueta}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
