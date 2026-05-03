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
import {
  CONTACTO_CATEGORIAS,
  CATEGORIA_LABELS,
  type Contacto,
  type ContactoCategoria,
  type ContactoInput,
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
  servicios: Sparkles,
  emergencias: Siren,
  otros: Tag,
};

const CATEGORIA_TINT: Record<ContactoCategoria, string> = {
  mantenimiento: "text-amber-600 bg-amber-50",
  proveedores: "text-blue-600 bg-blue-50",
  servicios: "text-violet-600 bg-violet-50",
  emergencias: "text-red-600 bg-red-50",
  otros: "text-gray-600 bg-gray-50",
};

const CATEGORIA_BORDER: Record<ContactoCategoria, string> = {
  mantenimiento: "bg-amber-100 text-amber-700 border-amber-200",
  proveedores: "bg-blue-100 text-blue-700 border-blue-200",
  servicios: "bg-violet-100 text-violet-700 border-violet-200",
  emergencias: "bg-red-100 text-red-700 border-red-200",
  otros: "bg-gray-100 text-gray-700 border-gray-200",
};

const EMPTY_FORM: ContactoInput = {
  nombre: "",
  empresa_contacto: "",
  categoria: "proveedores",
  telefono: "",
  email: "",
  whatsapp: "",
  direccion: "",
  notas: "",
};

export function AgendaDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<ContactoCategoria | "todos">("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactoInput>(EMPTY_FORM);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const data = await listContactos();
      setContactos(data);
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
      servicios: 0,
      emergencias: 0,
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
    setForm({ ...EMPTY_FORM, categoria: grupo === "todos" ? "proveedores" : grupo });
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
              className="h-7 gap-1 bg-teal-600 hover:bg-teal-700"
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
          {cargando && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Cargando contactos…
            </div>
          )}
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
              return (
                <li
                  key={c.id}
                  className="bg-background px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-lg p-2 ${CATEGORIA_TINT[c.categoria]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {c.nombre}
                          </p>
                          {c.empresa_contacto && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {c.empresa_contacto}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${CATEGORIA_BORDER[c.categoria]}`}
                        >
                          {CATEGORIA_LABELS[c.categoria]}
                        </Badge>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {c.telefono && (
                          <a
                            href={`tel:${c.telefono}`}
                            className="inline-flex items-center gap-1 text-foreground hover:text-teal-700"
                          >
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {c.telefono}
                          </a>
                        )}
                        {c.whatsapp && (
                          <a
                            href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-foreground hover:text-teal-700"
                          >
                            <MessageCircle className="h-3 w-3 text-muted-foreground" />
                            WhatsApp
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1 text-foreground hover:text-teal-700 truncate max-w-full"
                          >
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        )}
                        {c.direccion && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {c.direccion}
                          </span>
                        )}
                      </div>

                      {c.notas && (
                        <p className="mt-2 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                          {c.notas}
                        </p>
                      )}

                      <div className="mt-1 flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => abrirEditar(c)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => eliminar(c.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>

      {/* Dialog crear / editar */}
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
    </Sheet>
  );
}
