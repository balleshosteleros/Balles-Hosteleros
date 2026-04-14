import { useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { type DatosGenerales, type ConfigOperativa } from "@/features/ajustes/data/ajustes";
import { Upload, Trash2, Info, ImageIcon, Plus, Pencil, Eye, EyeOff, Copy, ExternalLink, Search } from "lucide-react";
import {
  getAllAccesosApps,
  CATEGORIAS_APP,
  type AccesoApp,
  type EstadoApp,
  type TipoIntegracion,
} from "@/features/rrhh/data/accesos-apps";

const EMPRESAS_ACC = [
  { id: "habana", nombre: "La Habana" },
  { id: "bacanal", nombre: "Bacanal" },
];

const emptyApp: Omit<AccesoApp, "id" | "ultimaActualizacion"> = {
  nombre: "", descripcion: "", url: "", icono: "🔗", logoUrl: "",
  categoria: "Sistemas de gestión", departamentos: ["Dirección"],
  rolesAutorizados: ["Dirección"], usuario: "", contrasena: "",
  estado: "Activo", responsable: "", notas: "", tipoIntegracion: "enlace", empresaId: "habana",
};

function AppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string }) {
  const [err, setErr] = useState(false);
  const colors = ["bg-blue-500","bg-emerald-500","bg-violet-500","bg-orange-500","bg-rose-500","bg-teal-500"];
  const color = colors[(nombre.charCodeAt(0) || 0) % colors.length];
  if (logoUrl && !err)
    return <img src={logoUrl} alt={nombre} onError={() => setErr(true)} className={`h-7 w-7 rounded-md object-contain p-0.5 ${logoUrl.includes("simpleicons.org") ? "bg-transparent" : "bg-white dark:bg-white/90 border border-border/40"}`} />;
  return <div className={`h-7 w-7 ${color} rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0`}>{nombre[0]?.toUpperCase() || "?"}</div>;
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

function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  );
}

export function ConfiguracionTab() {
  const { ajustes, setAjustes } = useEmpresa();
  const d = ajustes.datosGenerales;
  const c = ajustes.configOperativa;
  const fileRef = useRef<HTMLInputElement>(null);

  const setD = (k: keyof DatosGenerales, v: string) =>
    setAjustes((prev) => ({ ...prev, datosGenerales: { ...prev.datosGenerales, [k]: v } }));

  const setC = (k: keyof ConfigOperativa, v: string) =>
    setAjustes((prev) => ({ ...prev, configOperativa: { ...prev.configOperativa, [k]: v } }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setD("logoUrl", reader.result as string); toast.success("Logotipo actualizado"); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = () => toast.success("Configuración guardada correctamente");

  // ── Estado módulo accesos a aplicaciones ──
  const [apps, setApps] = useState<AccesoApp[]>(() => getAllAccesosApps());
  const [buscar, setBuscar] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AccesoApp, "id" | "ultimaActualizacion">>(emptyApp);
  const [depsInput, setDepsInput] = useState("");
  const [rolesInput, setRolesInput] = useState("");

  const filteredApps = apps.filter((a) => {
    if (filtroEmpresa !== "todas" && a.empresaId !== filtroEmpresa) return false;
    if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
    if (buscar && !a.nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });
  const categoriasUsadas = [...new Set(apps.map((a) => a.categoria))];

  const openCreate = () => {
    setEditingId(null); setForm(emptyApp); setDepsInput("Dirección"); setRolesInput("Dirección"); setModalOpen(true);
  };
  const openEdit = (app: AccesoApp) => {
    setEditingId(app.id);
    setForm({ nombre: app.nombre, descripcion: app.descripcion, url: app.url, icono: app.icono,
      logoUrl: app.logoUrl || "", categoria: app.categoria, departamentos: app.departamentos,
      rolesAutorizados: app.rolesAutorizados, usuario: app.usuario, contrasena: app.contrasena,
      estado: app.estado, responsable: app.responsable, notas: app.notas,
      tipoIntegracion: app.tipoIntegracion, empresaId: app.empresaId });
    setDepsInput(app.departamentos.join(", ")); setRolesInput(app.rolesAutorizados.join(", ")); setModalOpen(true);
  };
  const handleSaveApp = () => {
    if (!form.nombre.trim() || !form.url.trim()) { toast.error("Nombre y URL son obligatorios"); return; }
    const departamentos = depsInput.split(",").map((dep) => dep.trim()).filter(Boolean);
    const rolesAutorizados = rolesInput.split(",").map((r) => r.trim()).filter(Boolean);
    const today = new Date().toISOString().slice(0, 10);
    if (editingId) {
      setApps((prev) => prev.map((a) => a.id === editingId
        ? { ...a, ...form, departamentos, rolesAutorizados, logoUrl: form.logoUrl || undefined, ultimaActualizacion: today }
        : a));
      toast.success(`Acceso "${form.nombre}" actualizado`);
    } else {
      setApps((prev) => [...prev, { ...form, id: `app-${Date.now()}`, departamentos, rolesAutorizados, logoUrl: form.logoUrl || undefined, ultimaActualizacion: today }]);
      toast.success(`Acceso "${form.nombre}" creado`);
    }
    setModalOpen(false);
  };
  const handleDeleteApp = (app: AccesoApp) => {
    if (!confirm(`¿Eliminar el acceso "${app.nombre}"?`)) return;
    setApps((prev) => prev.filter((a) => a.id !== app.id));
    toast.success(`Acceso "${app.nombre}" eliminado`);
  };
  const empresaNombre = (id: string) => EMPRESAS_ACC.find((e) => e.id === id)?.nombre ?? id;

  return (
    <div className="space-y-2">

      {/* ── DATOS GENERALES ─────────────────────────────── */}
      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Información de la empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <Field label="Nombre comercial"   value={d.nombreComercial}   onChange={(v) => setD("nombreComercial", v)} />
          <Field label="Razón social"        value={d.razonSocial}        onChange={(v) => setD("razonSocial", v)} />
          <Field label="CIF"                 value={d.cif}                onChange={(v) => setD("cif", v)} />
          <Field label="Dirección fiscal"    value={d.direccionFiscal}    onChange={(v) => setD("direccionFiscal", v)} />
          <Field label="Dirección del local" value={d.direccionLocal}     onChange={(v) => setD("direccionLocal", v)} />
          <Field label="Ciudad"              value={d.ciudad}             onChange={(v) => setD("ciudad", v)} />
          <Field label="Provincia"           value={d.provincia}          onChange={(v) => setD("provincia", v)} />
          <Field label="País"                value={d.pais}               onChange={(v) => setD("pais", v)} />
          <Field label="Código postal"       value={d.codigoPostal}       onChange={(v) => setD("codigoPostal", v)} />
          <Field label="Gerente"             value={d.gerente}            onChange={(v) => setD("gerente", v)} />
          <Field label="Horario general"     value={d.horarioGeneral}     onChange={(v) => setD("horarioGeneral", v)} />
          <div>
            <Label className="text-xs font-bold uppercase">Estado de la empresa</Label>
            <Select value={d.estado} onValueChange={(v) => setD("estado", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activa">Activa</SelectItem>
                <SelectItem value="Inactiva">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Contacto y correos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <Field label="Teléfono principal"    value={d.telefonoPrincipal}   onChange={(v) => setD("telefonoPrincipal", v)} />
          <Field label="Teléfono secundario"   value={d.telefonoSecundario}  onChange={(v) => setD("telefonoSecundario", v)} />
          <Field label="Correo general"        value={d.correoGeneral}       onChange={(v) => setD("correoGeneral", v)}      type="email" />
          <Field label="Correo administración" value={d.correoAdmin}         onChange={(v) => setD("correoAdmin", v)}        type="email" />
          <Field label="Correo RRHH"           value={d.correoRrhh}          onChange={(v) => setD("correoRrhh", v)}         type="email" />
          <Field label="Correo contabilidad"   value={d.correoContabilidad}  onChange={(v) => setD("correoContabilidad", v)} type="email" />
          <Field label="Correo marketing"      value={d.correoMarketing}     onChange={(v) => setD("correoMarketing", v)}    type="email" />
          <Field label="Correo jurídico"       value={d.correoJuridico}      onChange={(v) => setD("correoJuridico", v)}     type="email" />
          <Field label="Correo reservas"       value={d.correoReservas}      onChange={(v) => setD("correoReservas", v)}     type="email" />
          <Field label="Correo incidencias"    value={d.correoIncidencias}   onChange={(v) => setD("correoIncidencias", v)}  type="email" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Web y redes sociales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <Field label="Web"             value={d.web}       onChange={(v) => setD("web", v)} />
          <Field label="WhatsApp empresa" value={d.whatsapp} onChange={(v) => setD("whatsapp", v)} />
          <Field label="Instagram"        value={d.instagram} onChange={(v) => setD("instagram", v)} />
          <Field label="Facebook"         value={d.facebook}  onChange={(v) => setD("facebook", v)} />
          <Field label="TikTok"           value={d.tiktok}    onChange={(v) => setD("tiktok", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Logotipo de la empresa</CardTitle></CardHeader>
        <CardContent className="space-y-3 px-4 pb-3 pt-0">
          <div className="flex items-start gap-6">
            <div className="shrink-0 w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex items-center justify-center overflow-hidden">
              {d.logoUrl ? (
                <img src={d.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {d.logoUrl ? "CAMBIAR LOGOTIPO" : "SUBIR LOGOTIPO"}
                </Button>
                {d.logoUrl && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => { setD("logoUrl", ""); toast.success("Logotipo eliminado"); }}>
                    <Trash2 className="h-3.5 w-3.5" /> ELIMINAR
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              <p className="text-xs text-muted-foreground">Formatos aceptados: PNG, JPG, SVG. Tamaño máximo recomendado: 1 MB.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Recomendación:</strong> se aconseja utilizar el isotipo o una versión simple del logotipo para una mejor visualización dentro del sistema.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Observaciones internas</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={d.observaciones} onChange={(e) => setD("observaciones", e.target.value)} rows={4} placeholder="Notas internas sobre la empresa..." />
        </CardContent>
      </Card>

      <Separator />

      {/* ── CONFIG OPERATIVA ────────────────────────────── */}
      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Configuración regional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <div>
            <Label className="text-xs font-bold uppercase">Moneda</Label>
            <Select value={c.moneda} onValueChange={(v) => setC("moneda", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR (€)">EUR (€)</SelectItem>
                <SelectItem value="USD ($)">USD ($)</SelectItem>
                <SelectItem value="GBP (£)">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Idioma</Label>
            <Select value={c.idioma} onValueChange={(v) => setC("idioma", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Español">Español</SelectItem>
                <SelectItem value="English">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Zona horaria</Label>
            <Select value={c.zonaHoraria} onValueChange={(v) => setC("zonaHoraria", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Formato de fecha</Label>
            <Select value={c.formatoFecha} onValueChange={(v) => setC("formatoFecha", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/AAAA">DD/MM/AAAA</SelectItem>
                <SelectItem value="MM/DD/AAAA">MM/DD/AAAA</SelectItem>
                <SelectItem value="AAAA-MM-DD">AAAA-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Primer día de la semana</Label>
            <Select value={c.primerDiaSemana} onValueChange={(v) => setC("primerDiaSemana", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Lunes">Lunes</SelectItem>
                <SelectItem value="Domingo">Domingo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Personalización</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 pb-3 pt-0">
          <div>
            <Label className="text-xs font-bold uppercase">Locales o sedes asociados</Label>
            <Input value={c.localesAsociados} onChange={(e) => setC("localesAsociados", e.target.value)} placeholder="Ej: Local 1, Local 2..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Etiquetas internas</Label>
            <Input value={c.etiquetasInternas} onChange={(e) => setC("etiquetasInternas", e.target.value)} placeholder="Ej: VIP, Franquicia..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Color primario de la empresa</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={c.colorPrimario} onChange={(e) => setC("colorPrimario", e.target.value)} className="h-9 w-12 rounded cursor-pointer border" />
              <Input value={c.colorPrimario} onChange={(e) => setC("colorPrimario", e.target.value)} className="flex-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>GUARDAR CONFIGURACIÓN</Button>
      </div>

      <Separator />

      {/* ── ACCESOS A APLICACIONES ─────────────────────────── */}
      <Card>
        <CardHeader className="px-4 pt-3 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Accesos a aplicaciones</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo acceso
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            Gestiona los accesos y credenciales a todas las aplicaciones y herramientas externas de la empresa.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las empresas</SelectItem>
                {EMPRESAS_ACC.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categoriasUsadas.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border overflow-hidden">
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
                {filteredApps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No hay accesos. Crea el primero con "Nuevo acceso".
                    </TableCell>
                  </TableRow>
                )}
                {filteredApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell><AppLogo nombre={app.nombre} logoUrl={app.logoUrl} /></TableCell>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteApp(app)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{filteredApps.length} de {apps.length} accesos</p>
        </CardContent>
      </Card>

      {/* Modal crear / editar acceso */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar acceso" : "Nuevo acceso"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
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
                  {EMPRESAS_ACC.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_APP.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo integración</Label>
              <Select value={form.tipoIntegracion} onValueChange={(v) => setForm((p) => ({ ...p, tipoIntegracion: v as TipoIntegracion }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enlace">Enlace</SelectItem>
                  <SelectItem value="sso">SSO</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                  <SelectItem value="embebido">Embebido</SelectItem>
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
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Departamentos <span className="font-normal text-muted-foreground">(separados por coma)</span></Label>
              <Input value={depsInput} onChange={(e) => setDepsInput(e.target.value)} placeholder="Dirección, Marketing" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Roles autorizados <span className="font-normal text-muted-foreground">(separados por coma)</span></Label>
              <Input value={rolesInput} onChange={(e) => setRolesInput(e.target.value)} placeholder="Dirección, Gerencia" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Responsable</Label>
              <Input value={form.responsable} onChange={(e) => setForm((p) => ({ ...p, responsable: e.target.value }))} placeholder="Nombre del responsable" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Notas internas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} placeholder="Notas sobre este acceso…" rows={2} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveApp} disabled={!form.nombre.trim() || !form.url.trim()}>
              {editingId ? "Guardar cambios" : "Crear acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
