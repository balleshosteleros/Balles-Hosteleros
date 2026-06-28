"use client";

import { useEffect, useState, useRef } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Pencil,
  Eye,
  Copy,
  ExternalLink,
  Search,
  ChevronDown,
  X,
  Upload,
  Loader2,
} from "lucide-react";
import {
  CATEGORIAS_APP,
  MAX_ACCESOS_POR_APP,
  faviconDesdeUrl,
  type AccesoApp,
  type AccesoCredencial,
  type EstadoApp,
} from "@/features/rrhh/data/accesos-apps";
import {
  listAllAccesosApps,
  createAccesoApp,
  updateAccesoApp,
  deleteAccesoApp,
  revelarAccesoApp,
  subirLogoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import {
  VerificacionAccesosProvider,
  useVerificacionAccesos,
} from "@/features/rrhh/components/useVerificacionAccesos";
import { getRolesEmpresaNombres } from "@/features/ajustes/actions/roles-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const emptyApp: Omit<AccesoApp, "id" | "ultimaActualizacion"> = {
  nombre: "",
  descripcion: "",
  url: "",
  icono: "🔗",
  logoUrl: "",
  categoria: "Otros",
  departamentos: [],
  rolesAutorizados: [],
  accesos: [{ etiqueta: "", usuario: "", contrasena: "", roles: [] }],
  usuario: "",
  contrasena: "",
  estado: "Activo",
  responsable: "",
  notas: "",
  tipoIntegracion: "enlace",
  empresaId: "",
};

function AppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string }) {
  const [err, setErr] = useState(false);
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-rose-500", "bg-teal-500"];
  const color = colors[(nombre.charCodeAt(0) || 0) % colors.length];
  if (logoUrl && !err)
    return (
      <img
        src={logoUrl}
        alt={nombre}
        onError={() => setErr(true)}
        className={`h-7 w-7 rounded-md object-contain p-0.5 ${
          logoUrl.includes("simpleicons.org")
            ? "bg-transparent"
            : "bg-white dark:bg-white/90 border border-border/40"
        }`}
      />
    );
  return (
    <div className={`h-7 w-7 ${color} rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {nombre[0]?.toUpperCase() || "?"}
    </div>
  );
}

function PasswordAdmin({ appId, indice, tiene }: { appId: string; indice: number; tiene: boolean }) {
  const { ensureVerificado } = useVerificacionAccesos();
  const [valor, setValor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Oculta la contraseña revelada tras 10s.
  useEffect(() => {
    if (valor === null) return;
    const t = setTimeout(() => setValor(null), 10_000);
    return () => clearTimeout(t);
  }, [valor]);

  if (!tiene) return <span className="text-muted-foreground text-xs">—</span>;

  const revelar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const ok = await ensureVerificado();
      if (!ok) return;
      const res = await revelarAccesoApp(appId, indice);
      if (res.ok) {
        setValor(res.contrasena);
      } else {
        toast.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {valor !== null ? valor : "••••••••"}
      {valor !== null ? (
        <button
          onClick={() => {
            navigator.clipboard.writeText(valor);
            toast.success("Contraseña copiada");
          }}
          className="text-muted-foreground hover:text-foreground"
          title="Copiar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={revelar}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Ver contraseña"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

export function AplicacionesTab() {
  return (
    <VerificacionAccesosProvider>
      <AplicacionesTabInner />
    </VerificacionAccesosProvider>
  );
}

function AplicacionesTabInner() {
  const { empresas, empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;
  const empresasOptions = empresas.map((e) => ({ id: e.id, nombre: e.nombre }));

  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingApp, setSavingApp] = useState(false);

  useEffect(() => {
    let alive = true;
    listAllAccesosApps()
      .then((rows) => {
        if (alive) setApps(rows);
      })
      .catch((e) => {
        console.error(e);
        toast.error("No se pudieron cargar los accesos");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const [buscar, setBuscar] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AccesoApp, "id" | "ultimaActualizacion">>(emptyApp);
  const [rolesDisponibles, setRolesDisponibles] = useState<string[]>([]);
  // Popover de roles abierto por índice de acceso (-1 = ninguno).
  const [rolesPopoverIdx, setRolesPopoverIdx] = useState<number>(-1);
  // Subida de logo manual.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  async function handleSubirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoLogo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await subirLogoApp(fd);
    setSubiendoLogo(false);
    if (e.target) e.target.value = "";
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setForm((p) => ({ ...p, logoUrl: res.url }));
    toast.success("Logo subido");
  }

  useEffect(() => {
    getRolesEmpresaNombres(empresaDbId)
      .then((nombres) => setRolesDisponibles(nombres))
      .catch((e) => console.error("No se pudieron cargar roles:", e));
  }, [empresaDbId]);

  // Activa/desactiva un rol para UN acceso concreto (visibilidad por acceso).
  const toggleRolAcceso = (idx: number, rol: string) => {
    setForm((p) => ({
      ...p,
      accesos: p.accesos.map((a, i) => {
        if (i !== idx) return a;
        const set = new Set(a.roles ?? []);
        if (set.has(rol)) set.delete(rol);
        else set.add(rol);
        return { ...a, roles: Array.from(set) };
      }),
    }));
  };

  const updateAcceso = (idx: number, patch: Partial<AccesoCredencial>) => {
    setForm((p) => ({
      ...p,
      accesos: p.accesos.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  };
  const addAcceso = () => {
    setForm((p) =>
      p.accesos.length >= MAX_ACCESOS_POR_APP
        ? p
        : { ...p, accesos: [...p.accesos, { etiqueta: "", usuario: "", contrasena: "", roles: [] }] },
    );
  };
  const removeAcceso = (idx: number) => {
    setForm((p) => {
      const next = p.accesos.filter((_, i) => i !== idx);
      return {
        ...p,
        accesos: next.length ? next : [{ etiqueta: "", usuario: "", contrasena: "", roles: [] }],
      };
    });
  };

  const filteredApps = apps.filter((a) => {
    if (filtroEmpresa !== "todas" && a.empresaId !== filtroEmpresa) return false;
    if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
    if (buscar) {
      const q = buscar.toLowerCase();
      // Coincide por nombre de app, categoría, o usuario/etiqueta de cualquier acceso.
      const enNombre = a.nombre.toLowerCase().includes(q);
      const enCategoria = (a.categoria ?? "").toLowerCase().includes(q);
      const enAccesos = a.accesos.some(
        (acc) =>
          (acc.usuario ?? "").toLowerCase().includes(q) ||
          (acc.etiqueta ?? "").toLowerCase().includes(q),
      );
      if (!enNombre && !enCategoria && !enAccesos) return false;
    }
    return true;
  });
  const categoriasUsadas = [...new Set(apps.map((a) => a.categoria))];

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyApp, empresaId: empresaActual.id });
    setModalOpen(true);
  };
  const openEdit = (app: AccesoApp) => {
    setEditingId(app.id);
    // Compat: apps antiguas tenían roles a nivel de app. Si un acceso no tiene
    // roles propios, hereda los roles globales de la app para no perder permisos.
    const accesosBase = app.accesos.length
      ? app.accesos
      : [{ etiqueta: "", usuario: "", contrasena: "", roles: [] }];
    const accesos = accesosBase.map((a) => ({
      ...a,
      // La contraseña NUNCA viaja al cliente (viene oculta/cifrada). Al editar
      // se muestra vacía; si se deja vacía, la action preserva la cifrada previa.
      contrasena: "",
      roles: a.roles?.length ? a.roles : [...(app.rolesAutorizados ?? [])],
    }));
    setForm({
      nombre: app.nombre,
      descripcion: app.descripcion,
      url: app.url,
      icono: app.icono,
      logoUrl: app.logoUrl || "",
      categoria: app.categoria,
      departamentos: app.departamentos,
      rolesAutorizados: app.rolesAutorizados,
      accesos,
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

  const handleSaveApp = async () => {
    if (!form.nombre.trim() || !form.url.trim()) {
      toast.error("Nombre y URL son obligatorios");
      return;
    }
    setSavingApp(true);
    try {
      // rolesAutorizados (nivel app) = unión de los roles de cada acceso.
      // Se usa como pre-filtro de visibilidad de la app; el filtrado fino de
      // qué acceso ve cada quien se hace por acceso.
      const rolesUnion = Array.from(
        new Set(form.accesos.flatMap((a) => a.roles ?? [])),
      );
      // Logo: si el usuario subió uno manual (vive en el bucket app-logos), se
      // respeta. Si no, se genera automáticamente (marca conocida o favicon).
      const esLogoManual = (form.logoUrl ?? "").includes("/app-logos/");
      const logoFinal = esLogoManual
        ? form.logoUrl
        : faviconDesdeUrl(form.url, form.nombre) || undefined;
      const payload = {
        ...form,
        rolesAutorizados: rolesUnion,
        logoUrl: logoFinal,
      };
      if (editingId) {
        const updated = await updateAccesoApp(editingId, payload);
        setApps((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
        toast.success(`Acceso "${updated.nombre}" actualizado`);
      } else {
        const created = await createAccesoApp(payload);
        setApps((prev) => [...prev, created]);
        toast.success(`Acceso "${created.nombre}" creado`);
      }
      setModalOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingApp(false);
    }
  };

  const handleDeleteApp = async (app: AccesoApp) => {
    const ok = await confirmDelete({
      title: "Eliminar acceso",
      description: `¿Eliminar el acceso "${app.nombre}"?`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await deleteAccesoApp(app.id);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`Acceso "${app.nombre}" eliminado`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const empresaNombre = (id: string) => empresasOptions.find((e) => e.id === id)?.nombre ?? id;

  return (
    <div className="space-y-2">
      {confirmDeleteDialog}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 -mt-10">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aplicación, usuario o categoría..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las empresas</SelectItem>
            {empresasOptions.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categoriasUsadas.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
          {!loading && filteredApps.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                No hay accesos. Crea el primero con &quot;Nuevo&quot;.
              </TableCell>
            </TableRow>
          )}
          {filteredApps.map((app) => (
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
              <TableCell className="font-mono text-xs">
                {app.usuario || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <PasswordAdmin
                  appId={app.id}
                  indice={0}
                  tiene={app.accesos[0]?.tieneContrasena ?? false}
                />
              </TableCell>
              <TableCell>
                <Badge
                  className={`text-[10px] ${
                    app.estado === "Activo"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {app.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={app.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(app)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteApp(app)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {filteredApps.length} de {apps.length} accesos
      </p>

      {/* Modal crear / editar acceso */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar acceso" : "Nuevo acceso"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Stripe"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">URL *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://…"
                type="url"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Descripción</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Breve descripción de la app"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_APP.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm((p) => ({ ...p, estado: v as EstadoApp }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Logo: automático (favicon/marca) o subido a mano */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Logo</Label>
              <div className="flex items-center gap-3">
                <AppLogo
                  nombre={form.nombre || "?"}
                  logoUrl={
                    ((form.logoUrl ?? "").includes("/app-logos/")
                      ? form.logoUrl
                      : faviconDesdeUrl(form.url, form.nombre)) || undefined
                  }
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSubirLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={subiendoLogo}
                >
                  {subiendoLogo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  Subir imagen
                </Button>
                {(form.logoUrl ?? "").includes("/app-logos/") && (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, logoUrl: "" }))}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se obtiene automáticamente del nombre o la URL. Si falla, sube tu propia imagen (máx 2 MB).
              </p>
            </div>

            {/* Accesos: varias parejas usuario/contraseña, cada una con sus roles */}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold">
                Accesos (usuario, contraseña y quién lo ve)
              </Label>
              <p className="text-xs text-muted-foreground">
                Cada acceso es visible solo para los roles que elijas. Sin roles, solo lo ven los directores.
              </p>
              <div className="space-y-2">
                {form.accesos.map((acc, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-md border border-border/60 p-2">
                    <div className="grid flex-1 gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          value={acc.etiqueta}
                          onChange={(e) => updateAcceso(idx, { etiqueta: e.target.value })}
                          placeholder="Etiqueta (ej: Contabilidad)"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={acc.usuario}
                          onChange={(e) => updateAcceso(idx, { usuario: e.target.value })}
                          placeholder="usuario@empresa.es"
                          autoComplete="off"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={acc.contrasena}
                          onChange={(e) => updateAcceso(idx, { contrasena: e.target.value })}
                          placeholder={editingId ? "Dejar vacío = no cambiar" : "Contraseña"}
                          type="password"
                          autoComplete="new-password"
                          className="h-8 text-xs"
                        />
                      </div>
                      {/* Roles que pueden ver este acceso */}
                      <Popover
                        open={rolesPopoverIdx === idx}
                        onOpenChange={(o) => setRolesPopoverIdx(o ? idx : -1)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full min-h-8 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-left hover:bg-accent/30"
                          >
                            <div className="flex flex-wrap gap-1 flex-1">
                              {(acc.roles ?? []).length === 0 ? (
                                <span className="text-muted-foreground">Quién lo ve — selecciona roles…</span>
                              ) : (
                                (acc.roles ?? []).map((rol) => (
                                  <Badge key={rol} variant="secondary" className="gap-1 text-[10px]">
                                    {rol}
                                    <span
                                      role="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRolAcceso(idx, rol);
                                      }}
                                      className="hover:text-destructive cursor-pointer"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </span>
                                  </Badge>
                                ))
                              )}
                            </div>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="max-h-64 overflow-y-auto py-1">
                            {rolesDisponibles.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">No hay roles definidos</div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between px-3 py-1.5 border-b">
                                  <button
                                    type="button"
                                    onClick={() => updateAcceso(idx, { roles: [...rolesDisponibles] })}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Seleccionar todos
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateAcceso(idx, { roles: [] })}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Limpiar
                                  </button>
                                </div>
                                {rolesDisponibles.map((rol) => {
                                  const checked = (acc.roles ?? []).includes(rol);
                                  return (
                                    <label
                                      key={rol}
                                      className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                                    >
                                      <Checkbox checked={checked} onCheckedChange={() => toggleRolAcceso(idx, rol)} />
                                      <span>{rol}</span>
                                    </label>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAcceso(idx)}
                      title="Quitar acceso"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {form.accesos.length < MAX_ACCESOS_POR_APP && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addAcceso}>
                  <Plus className="h-3.5 w-3.5" />Añadir acceso
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveApp} disabled={savingApp || !form.nombre.trim() || !form.url.trim()}>
              {savingApp ? "Guardando…" : editingId ? "Guardar cambios" : "Crear acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
