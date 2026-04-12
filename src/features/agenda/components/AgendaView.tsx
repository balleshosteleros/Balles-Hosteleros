"use client";

import { useMemo, useState } from "react";
import {
  ContactRound,
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CONTACTO_CATEGORIAS,
  CATEGORIA_LABELS,
  type Contacto,
  type ContactoCategoria,
  type ContactoInput,
} from "@/features/agenda/types";
import { toast } from "sonner";

const CATEGORIA_ICON: Record<ContactoCategoria, React.ElementType> = {
  mantenimiento: Wrench,
  proveedores: Truck,
  servicios: Sparkles,
  emergencias: Siren,
  otros: Tag,
};

const CATEGORIA_COLOR: Record<ContactoCategoria, string> = {
  mantenimiento: "bg-amber-100 text-amber-700 border-amber-200",
  proveedores: "bg-blue-100 text-blue-700 border-blue-200",
  servicios: "bg-violet-100 text-violet-700 border-violet-200",
  emergencias: "bg-red-100 text-red-700 border-red-200",
  otros: "bg-gray-100 text-gray-700 border-gray-200",
};

const SEED: Contacto[] = [
  {
    id: "c-1",
    empresa_id: null,
    nombre: "Frigoríficos Costa",
    empresa_contacto: "Costa SL",
    categoria: "mantenimiento",
    telefono: "+34 600 123 456",
    email: "averias@frigoscosta.es",
    whatsapp: "+34 600 123 456",
    direccion: "Madrid",
    notas: "Servicio 24h. Pedir presupuesto antes de aceptar.",
    created_at: "2026-01-12",
    updated_at: "2026-01-12",
    created_by: null,
  },
  {
    id: "c-2",
    empresa_id: null,
    nombre: "Distribuciones Hermanos Ruiz",
    empresa_contacto: "Hermanos Ruiz S.A.",
    categoria: "proveedores",
    telefono: "+34 911 555 222",
    email: "pedidos@hruiz.com",
    whatsapp: null,
    direccion: "Polígono Sur, nave 4",
    notas: "Reparto martes y viernes. Cierre pedidos: día anterior 18h.",
    created_at: "2026-01-15",
    updated_at: "2026-01-15",
    created_by: null,
  },
];

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

export function AgendaView() {
  const [contactos, setContactos] = useState<Contacto[]>(SEED);
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState<ContactoCategoria | "todos">("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactoInput>(EMPTY_FORM);

  const filtrados = useMemo(() => {
    let lista = contactos;
    if (tab !== "todos") lista = lista.filter((c) => c.categoria === tab);
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
  }, [contactos, tab, busqueda]);

  const conteoPorCategoria = useMemo(() => {
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

  function abrirNuevo() {
    setEditId(null);
    setForm(EMPTY_FORM);
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

  function guardar() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const ahora = new Date().toISOString().slice(0, 10);
    if (editId) {
      setContactos((prev) =>
        prev.map((c) =>
          c.id === editId
            ? {
                ...c,
                ...form,
                empresa_contacto: form.empresa_contacto?.trim() || null,
                telefono: form.telefono?.trim() || null,
                email: form.email?.trim() || null,
                whatsapp: form.whatsapp?.trim() || null,
                direccion: form.direccion?.trim() || null,
                notas: form.notas?.trim() || null,
                updated_at: ahora,
              }
            : c,
        ),
      );
      toast.success("Contacto actualizado");
    } else {
      const nuevo: Contacto = {
        id: `c-${Date.now()}`,
        empresa_id: null,
        nombre: form.nombre.trim(),
        empresa_contacto: form.empresa_contacto?.trim() || null,
        categoria: form.categoria,
        telefono: form.telefono?.trim() || null,
        email: form.email?.trim() || null,
        whatsapp: form.whatsapp?.trim() || null,
        direccion: form.direccion?.trim() || null,
        notas: form.notas?.trim() || null,
        created_at: ahora,
        updated_at: ahora,
        created_by: null,
      };
      setContactos((prev) => [nuevo, ...prev]);
      toast.success("Contacto creado");
    }
    setDialogOpen(false);
  }

  function eliminar(id: string) {
    setContactos((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contacto eliminado");
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <ContactRound className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AGENDA</h1>
            <p className="text-sm text-muted-foreground">
              Base de contactos compartida del holding (mantenimiento, proveedores, servicios…)
            </p>
          </div>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo contacto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="todos">Todos ({contactos.length})</TabsTrigger>
            {CONTACTO_CATEGORIAS.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="capitalize">
                {CATEGORIA_LABELS[cat]} ({conteoPorCategoria[cat]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar nombre, empresa o teléfono…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtrados.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No hay contactos que coincidan con tu búsqueda.
            </CardContent>
          </Card>
        )}
        {filtrados.map((c) => {
          const Icon = CATEGORIA_ICON[c.categoria];
          return (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold leading-tight text-foreground">
                        {c.nombre}
                      </p>
                      {c.empresa_contacto && (
                        <p className="text-xs text-muted-foreground">
                          {c.empresa_contacto}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${CATEGORIA_COLOR[c.categoria]}`}
                  >
                    {CATEGORIA_LABELS[c.categoria]}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-sm">
                  {c.telefono && (
                    <a
                      href={`tel:${c.telefono}`}
                      className="flex items-center gap-2 text-foreground hover:text-primary"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.telefono}
                    </a>
                  )}
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-foreground hover:text-primary"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      WhatsApp
                    </a>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-2 text-foreground hover:text-primary"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.email}
                    </a>
                  )}
                  {c.direccion && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.direccion}
                    </div>
                  )}
                </div>

                {c.notas && (
                  <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {c.notas}
                  </p>
                )}

                <div className="flex justify-end gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => abrirEditar(c)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => eliminar(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog */}
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
              Cancelar
            </Button>
            <Button onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
