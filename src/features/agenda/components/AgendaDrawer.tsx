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
  UserX,
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
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  CONTACTO_CATEGORIAS,
  CATEGORIA_LABELS,
  type Contacto,
  type ContactoCategoria,
  type ContactoInput,
  whatsappDesdeTelefono,
} from "@/features/agenda/types";
import {
  listContactos,
  createContacto,
  updateContacto,
  deleteContacto,
} from "@/features/agenda/actions/contactos-actions";

const CATEGORIA_ICON: Record<ContactoCategoria, React.ElementType> = {
  mantenimiento: Wrench,
  proveedores: Truck,
  proveedores_inactivos: Truck,
  servicios: Sparkles,
  emergencias: Siren,
  empleados: Users,
  empleados_inactivos: UserX,
  otros: Tag,
};

const CATEGORIA_TINT: Record<ContactoCategoria, string> = {
  mantenimiento: "text-amber-600 bg-amber-50",
  proveedores: "text-blue-600 bg-blue-50",
  proveedores_inactivos: "text-gray-500 bg-gray-100",
  servicios: "text-violet-600 bg-violet-50",
  emergencias: "text-red-600 bg-red-50",
  empleados: "text-emerald-600 bg-emerald-50",
  empleados_inactivos: "text-gray-500 bg-gray-100",
  otros: "text-gray-600 bg-gray-50",
};

const EMPTY_FORM: ContactoInput = {
  nombre: "",
  empresa_contacto: "",
  categoria: "proveedores",
  telefono: "",
  email: "",
  direccion: "",
  notas: "",
};

export function AgendaDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(false);
  useGlobalLoadingSync(cargando);
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<ContactoCategoria | "todos">("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactoInput>(EMPTY_FORM);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setContactos(await listContactos());
    } catch {
      toast.error("Error al cargar contactos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  const conteos = useMemo(() => {
    const c: Record<ContactoCategoria, number> = {
      mantenimiento: 0,
      proveedores: 0,
      proveedores_inactivos: 0,
      servicios: 0,
      emergencias: 0,
      empleados: 0,
      empleados_inactivos: 0,
      otros: 0,
    };
    contactos.forEach((x) => (c[x.categoria] += 1));
    return c;
  }, [contactos]);

  const filtrados = useMemo(() => {
    let lista = contactos;
    if (grupo !== "todos") lista = lista.filter((c) => c.categoria === grupo);
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
  }, [contactos, grupo, busqueda]);

  function abrirNuevo() {
    setEditId(null);
    setForm({
      ...EMPTY_FORM,
      categoria: grupo === "todos" ? "proveedores" : grupo,
    });
    setDialogOpen(true);
  }

  function abrirEditar(c: Contacto) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      empresa_contacto: c.empresa_contacto,
      categoria: c.categoria,
      telefono: c.telefono,
      email: c.email,
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

  const grupos: Array<ContactoCategoria | "todos"> = ["todos", ...CONTACTO_CATEGORIAS];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        maximizable
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
                        {whatsappDesdeTelefono(c.telefono) && (
                          <a
                            href={`https://wa.me/${whatsappDesdeTelefono(c.telefono)}`}
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
            {filtrados.length % 2 === 1 && (
              <li aria-hidden className="hidden bg-background lg:block" />
            )}
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
            <div>
              <Label>Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) =>
                  setForm({ ...form, categoria: v as ContactoCategoria })
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
              <Label>Teléfono</Label>
              <Input
                value={form.telefono ?? ""}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+34 600 000 000"
              />
              {whatsappDesdeTelefono(form.telefono ?? null) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <MessageCircle className="h-3 w-3" />
                  Se podrá enviar WhatsApp a este número
                </p>
              )}
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

    </Sheet>
  );
}
