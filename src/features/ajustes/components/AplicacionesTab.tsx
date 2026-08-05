"use client";

// APLICACIONES (Ajustes → Herramientas → Aplicaciones)
//
// Solo el ENLACE: nombre, logo, URL, categoría, estado y qué departamentos ven
// la app en el panel del cohete. Las CONTRASEÑAS viven en el apartado «Accesos»
// (AccesosTab.tsx) — aquí no se muestran ni se editan.

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
  ExternalLink,
  Search,
  ChevronDown,
  X,
  Upload,
  Loader2,
} from "lucide-react";
import {
  CATEGORIAS_APP,
  DEPARTAMENTOS,
  faviconDesdeUrl,
  type AccesoApp,
  type EstadoApp,
} from "@/features/rrhh/data/accesos-apps";
import {
  listAllAccesosApps,
  createAccesoApp,
  updateAccesoApp,
  deleteAccesoApp,
  subirLogoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { AppLogo } from "@/features/ajustes/components/AppLogo";
import { tieneEnlaceWeb } from "@/features/layout/components/AccesosDrawers";

const emptyApp: Omit<AccesoApp, "id" | "ultimaActualizacion"> = {
  nombre: "",
  descripcion: "",
  url: "",
  icono: "🔗",
  logoUrl: "",
  categoria: "Otros",
  departamentos: [],
  rolesAutorizados: [],
  accesos: [{ etiqueta: "", usuario: "", contrasena: "", roles: [], datosExtra: [] }],
  usuario: "",
  contrasena: "",
  estado: "Activo",
  responsable: "",
  notas: "",
  tipoIntegracion: "enlace",
  empresaId: "",
};

export function AplicacionesTab() {
  const { empresaActual } = useEmpresa();

  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingApp, setSavingApp] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Solo la empresa activa (aislamiento multiempresa, igual que en Accesos).
    listAllAccesosApps(empresaActual.id)
      .then((rows) => {
        if (alive) setApps(rows);
      })
      .catch((e) => {
        console.error(e);
        toast.error("No se pudieron cargar las aplicaciones");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaActual.id]);

  const [buscar, setBuscar] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AccesoApp, "id" | "ultimaActualizacion">>(emptyApp);
  // Popover de departamentos (quién ve la app en el panel).
  const [deptosPopoverOpen, setDeptosPopoverOpen] = useState(false);
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

  // Activa/desactiva un departamento que puede VER la app en el panel.
  // "Todos" es excluyente: al marcarlo, se limpia el resto (y viceversa).
  const toggleDepartamento = (depto: string) => {
    setForm((p) => {
      const set = new Set(p.departamentos ?? []);
      if (depto === "Todos") {
        return { ...p, departamentos: set.has("Todos") ? [] : ["Todos"] };
      }
      set.delete("Todos");
      if (set.has(depto)) set.delete(depto);
      else set.add(depto);
      return { ...p, departamentos: Array.from(set) };
    });
  };

  // Universo real de esta pantalla: solo las entradas con enlace web. El resto
  // (caja fuerte, PIN de TPV, wifi…) vive en «Accesos y contraseñas», así que
  // el contador no debe compararlas contra el total o parecerá que faltan apps.
  const appsConEnlace = apps.filter(tieneEnlaceWeb);
  const sinEnlace = apps.length - appsConEnlace.length;

  const filteredApps = apps.filter((a) => {
    // Solo son APLICACIONES las que tienen enlace web real. Las entradas sin
    // URL (caja fuerte, PIN de TPV, wifi, SIM…) son credenciales sueltas y
    // viven en «Accesos y contraseñas», no aquí.
    if (!tieneEnlaceWeb(a)) return false;
    if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
    if (buscar) {
      const q = buscar.toLowerCase();
      // Coincide por nombre de app, categoría o descripción (nunca por credencial).
      const enNombre = a.nombre.toLowerCase().includes(q);
      const enCategoria = (a.categoria ?? "").toLowerCase().includes(q);
      const enDescripcion = (a.descripcion ?? "").toLowerCase().includes(q);
      if (!enNombre && !enCategoria && !enDescripcion) return false;
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
    // Las credenciales NO se editan aquí (viven en «Accesos»), pero hay que
    // mandarlas de vuelta intactas en el payload: valor vacío = "no cambiar",
    // así la action preserva la contraseña cifrada previa.
    const accesos = app.accesos.map((a) => ({
      ...a,
      contrasena: "",
      datosExtra: (a.datosExtra ?? []).map((d) => ({
        nombre: d.nombre,
        valor: "",
        tiene: d.tiene,
      })),
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
      // Logo: prioriza el que el usuario subió a mano (bucket app-logos). Si no
      // hay, se deriva automáticamente del nombre/URL (marca conocida o favicon).
      // rolesAutorizados y accesos se pasan tal cual: se gestionan en «Accesos».
      const logoAuto = faviconDesdeUrl(form.url, form.nombre);
      const payload = {
        ...form,
        logoUrl: form.logoUrl || logoAuto || undefined,
      };
      if (editingId) {
        const updated = await updateAccesoApp(editingId, payload);
        setApps((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
        toast.success(`Aplicación "" actualizada`);
      } else {
        const created = await createAccesoApp(payload);
        setApps((prev) => [...prev, created]);
        toast.success(`Aplicación "" creada`);
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
      title: "Eliminar aplicación",
      description: `¿Eliminar la aplicación "${app.nombre}"?`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await deleteAccesoApp(app.id);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`Aplicación "" eliminada`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

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
            <TableHead>Categoría</TableHead>
            <TableHead>Enlace</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                <LoadingSpinner />
              </TableCell>
            </TableRow>
          )}
          {!loading && filteredApps.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                No hay aplicaciones. Crea la primera con &quot;Nuevo&quot;.
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
              <TableCell className="text-xs">{app.categoria}</TableCell>
              <TableCell className="max-w-[220px]">
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-primary hover:underline"
                  title={app.url}
                >
                  {app.url}
                </a>
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
        {filteredApps.length} de {appsConEnlace.length} aplicaciones
        {sinEnlace > 0 && (
          <>
            {" "}· {sinEnlace} entrada{sinEnlace === 1 ? "" : "s"} sin enlace (caja
            fuerte, PIN, wifi…) se {sinEnlace === 1 ? "gestiona" : "gestionan"} en
            «Accesos y contraseñas»
          </>
        )}
      </p>

      {/* Modal crear / editar aplicación */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar aplicación" : "Nueva aplicación"}</DialogTitle>
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
                  logoUrl={form.logoUrl || faviconDesdeUrl(form.url, form.nombre) || undefined}
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
                Al poner la URL se coge el logo automáticamente. Puedes subir una imagen propia (JPG/PNG, máx 2 MB) si prefieres otra.
              </p>
            </div>

            {/* Departamentos que VEN la app en el panel de aplicaciones */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Quién ve esta app</Label>
              <Popover open={deptosPopoverOpen} onOpenChange={setDeptosPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full min-h-9 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-left hover:bg-accent/30"
                  >
                    <div className="flex flex-wrap gap-1 flex-1">
                      {(form.departamentos ?? []).length === 0 ? (
                        <span className="text-muted-foreground text-xs">
                          Selecciona departamentos (o «Todos»)…
                        </span>
                      ) : (
                        (form.departamentos ?? []).map((dep) => (
                          <Badge key={dep} variant="secondary" className="gap-1 text-[10px]">
                            {dep}
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDepartamento(dep);
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
                    {DEPARTAMENTOS.map((dep) => {
                      const checked = (form.departamentos ?? []).includes(dep);
                      return (
                        <label
                          key={dep}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleDepartamento(dep)} />
                          <span className={dep === "Todos" ? "font-semibold" : ""}>{dep}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-[11px] text-muted-foreground">
                Solo los empleados de estos departamentos verán la app en el panel. «Todos» = visible para toda la empresa.
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveApp} disabled={savingApp || !form.nombre.trim() || !form.url.trim()}>
              {savingApp ? "Guardando…" : editingId ? "Guardar" : "Crear aplicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
