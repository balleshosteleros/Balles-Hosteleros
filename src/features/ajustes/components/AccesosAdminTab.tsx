"use client";

import { useEffect, useState } from "react";
import {
  CATEGORIAS_APP,
  type AccesoApp,
  type EstadoApp,
  type TipoIntegracion,
} from "@/features/rrhh/data/accesos-apps";
import {
  listAllAccesosApps,
  createAccesoApp,
  updateAccesoApp,
  deleteAccesoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import { getRolesEmpresaNombres } from "@/features/ajustes/actions/roles-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff, Copy, ExternalLink, Search, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

const TIPO_INTEGRACION_LABELS: Record<TipoIntegracion, string> = {
  enlace: "Abrir como página web",
  sso: "Entrar con un solo clic",
  oauth: "Conectar pidiendo permiso",
  embebido: "Verlo dentro de la app",
};

const emptyApp: Omit<AccesoApp, "id" | "ultimaActualizacion"> = {
  nombre: "",
  descripcion: "",
  url: "",
  icono: "🔗",
  logoUrl: "",
  categoria: "Sistemas de gestión",
  departamentos: [],
  rolesAutorizados: [],
  usuario: "",
  contrasena: "",
  estado: "Activo",
  responsable: "",
  notas: "",
  tipoIntegracion: "enlace",
  empresaId: "habana",
};

// Logo con fallback a inicial
function AppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string }) {
  const [error, setError] = useState(false);
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-rose-500", "bg-teal-500"];
  const color = colors[(nombre.charCodeAt(0) || 0) % colors.length];
  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={nombre}
        onError={() => setError(true)}
        className={`h-7 w-7 rounded-md object-contain p-0.5 ${logoUrl?.includes("simpleicons.org") ? "bg-transparent" : "bg-white dark:bg-white/90 border border-border/40"}`}
      />
    );
  }
  return (
    <div className={`h-7 w-7 ${color} rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {nombre[0]?.toUpperCase() || "?"}
    </div>
  );
}

function PasswordAdmin({ value }: { value: string }) {
  const [visible, setVisible] = useState(false);
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {visible ? value : "••••••••"}
      <button onClick={() => setVisible((v) => !v)} className="text-muted-foreground hover:text-foreground">
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      {visible && (
        <button onClick={() => { navigator.clipboard.writeText(value); toast.success("Contraseña copiada"); }} className="text-muted-foreground hover:text-foreground">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

export function AccesosAdminTab() {
  const { empresaActual, empresas: EMPRESAS } = useEmpresa();
  const empresaDbId = empresaActual.dbId;
  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  // Carga inicial desde Supabase
  useEffect(() => {
    let alive = true;
    listAllAccesosApps()
      .then((rows) => { if (alive) setApps(rows); })
      .catch((e) => { console.error(e); toast.error("No se pudieron cargar los accesos"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AccesoApp, "id" | "ultimaActualizacion">>(emptyApp);
  const [rolesDisponibles, setRolesDisponibles] = useState<string[]>([]);
  const [rolesPopoverOpen, setRolesPopoverOpen] = useState(false);

  useEffect(() => {
    getRolesEmpresaNombres(empresaDbId)
      .then((nombres) => setRolesDisponibles(nombres))
      .catch((e) => console.error("No se pudieron cargar roles:", e));
  }, [empresaDbId]);

  const filtered = apps.filter((a) => {
    if (filtroEmpresa !== "todas" && a.empresaId !== filtroEmpresa) return false;
    if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
    if (buscar && !a.nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const categoriasUsadas = [...new Set(apps.map((a) => a.categoria))];

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyApp);
    setModalOpen(true);
  };

  const openEdit = (app: AccesoApp) => {
    setEditingId(app.id);
    setForm({
      nombre: app.nombre,
      descripcion: app.descripcion,
      url: app.url,
      icono: app.icono,
      logoUrl: app.logoUrl || "",
      categoria: app.categoria,
      departamentos: app.departamentos,
      rolesAutorizados: app.rolesAutorizados,
      usuario: app.usuario,
      contrasena: app.contrasena,
      estado: app.estado,
      responsable: app.responsable,
      notas: app.notas,
      tipoIntegracion: app.tipoIntegracion,
      empresaId: app.empresaId,
    });
    setModalOpen(true);
  };

  const toggleRol = (rol: string) => {
    setForm((p) => {
      const set = new Set(p.rolesAutorizados);
      if (set.has(rol)) set.delete(rol);
      else set.add(rol);
      return { ...p, rolesAutorizados: Array.from(set) };
    });
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.url.trim()) {
      toast.error("Nombre y URL son obligatorios");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateAccesoApp(editingId, {
          ...form,
          logoUrl: form.logoUrl || undefined,
        });
        setApps((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
        toast.success(`Acceso "${updated.nombre}" actualizado`);
      } else {
        const created = await createAccesoApp({
          ...form,
          logoUrl: form.logoUrl || undefined,
        });
        setApps((prev) => [...prev, created]);
        toast.success(`Acceso "${created.nombre}" creado`);
      }
      setModalOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (app: AccesoApp) => {
    if (!confirm(`¿Eliminar el acceso "${app.nombre}"?`)) return;
    try {
      await deleteAccesoApp(app.id);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`Acceso "${app.nombre}" eliminado`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(msg);
    }
  };

  const empresaNombre = (id: string) => EMPRESAS.find((e) => e.id === id)?.nombre ?? id;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Desde aquí puedes añadir, editar y eliminar accesos. Los usuarios y contraseñas son visibles solo para directores.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las empresas</SelectItem>
            {EMPRESAS.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categoriasUsadas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Aplicación</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Contraseña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    No hay accesos. Crea el primero con "Nuevo acceso".
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{app.nombre}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">{app.descripcion}</div>
                  </TableCell>
                  <TableCell className="text-xs">{empresaNombre(app.empresaId)}</TableCell>
                  <TableCell className="text-xs">{app.categoria}</TableCell>
                  <TableCell className="font-mono text-xs">{app.usuario || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><PasswordAdmin value={app.contrasena} /></TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${app.estado === "Activo" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800"}`}>
                      {app.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={app.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(app)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(app)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{filtered.length} de {apps.length} accesos</p>

      {/* Modal crear / editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar acceso" : "Nuevo acceso"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Stripe" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">URL *</Label>
              <Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://…" type="url" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Breve descripción de la app" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">URL del logo</Label>
              <Input value={form.logoUrl || ""} onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://logo.clearbit.com/…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Emoji / icono fallback</Label>
              <Input value={form.icono} onChange={(e) => setForm((p) => ({ ...p, icono: e.target.value }))} placeholder="🔗" maxLength={4} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Empresa</Label>
              <Select value={form.empresaId} onValueChange={(v) => setForm((p) => ({ ...p, empresaId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_APP.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">¿Cómo se abre?</Label>
              <Select value={form.tipoIntegracion} onValueChange={(v) => setForm((p) => ({ ...p, tipoIntegracion: v as TipoIntegracion }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enlace">Abrir como página web</SelectItem>
                  <SelectItem value="sso">Entrar con un solo clic</SelectItem>
                  <SelectItem value="oauth">Conectar pidiendo permiso</SelectItem>
                  <SelectItem value="embebido">Verlo dentro de la app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm((p) => ({ ...p, estado: v as EstadoApp }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                  <SelectItem value="Archivado">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Usuario / Login</Label>
              <Input value={form.usuario} onChange={(e) => setForm((p) => ({ ...p, usuario: e.target.value }))} placeholder="usuario@empresa.es" autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Contraseña</Label>
              <Input value={form.contrasena} onChange={(e) => setForm((p) => ({ ...p, contrasena: e.target.value }))} placeholder="Contraseña visible para admin" type="text" autoComplete="new-password" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Roles autorizados</Label>
              <Popover open={rolesPopoverOpen} onOpenChange={setRolesPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full min-h-9 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-left hover:bg-accent/30"
                  >
                    <div className="flex flex-wrap gap-1 flex-1">
                      {form.rolesAutorizados.length === 0 ? (
                        <span className="text-muted-foreground">Selecciona roles…</span>
                      ) : (
                        form.rolesAutorizados.map((rol) => (
                          <Badge key={rol} variant="secondary" className="gap-1 text-xs">
                            {rol}
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); toggleRol(rol); }}
                              className="hover:text-destructive cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </span>
                          </Badge>
                        ))
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="max-h-64 overflow-y-auto py-1">
                    {rolesDisponibles.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No hay roles definidos</div>
                    ) : (
                      rolesDisponibles.map((rol) => {
                        const checked = form.rolesAutorizados.includes(rol);
                        return (
                          <label
                            key={rol}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleRol(rol)} />
                            <span>{rol}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Notas internas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} placeholder="Notas sobre este acceso…" rows={2} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre.trim() || !form.url.trim()}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
