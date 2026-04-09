import { useState } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getAccesosAppsPorEmpresa, CATEGORIAS_APP, DEPARTAMENTOS, type AccesoApp, type EstadoApp } from "@/data/accesos-apps";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, ExternalLink, Eye, EyeOff, Copy, Settings2, Shield, LayoutGrid, List, Globe, KeyRound } from "lucide-react";
import { toast } from "sonner";

const estadoBadge: Record<EstadoApp, string> = {
  Activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Inactivo: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Archivado: "bg-muted text-muted-foreground",
};

const tipoBadge: Record<string, string> = {
  enlace: "border-border",
  sso: "border-primary/40 bg-primary/5",
  oauth: "border-blue-400/40 bg-blue-50 dark:bg-blue-900/20",
  embebido: "border-violet-400/40 bg-violet-50 dark:bg-violet-900/20",
};

function PasswordCell({ value, canView }: { value: string; canView: boolean }) {
  const [visible, setVisible] = useState(false);
  if (!canView || value === "—") return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      {visible ? value : "••••••••"}
      <button onClick={() => setVisible((v) => !v)} className="text-muted-foreground hover:text-foreground">
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      {visible && (
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Contraseña copiada"); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

export default function Accesos() {
  const { empresaActual } = useEmpresa();
  const apps = getAccesosAppsPorEmpresa(empresaActual.id);

  const [buscar, setBuscar] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroDep, setFiltroDep] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const [detalle, setDetalle] = useState<AccesoApp | null>(null);
  const [tab, setTab] = useState("apps");

  const filtered = apps.filter((a) => {
    if (buscar && !a.nombre.toLowerCase().includes(buscar.toLowerCase()) && !a.descripcion.toLowerCase().includes(buscar.toLowerCase())) return false;
    if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
    if (filtroDep !== "todos" && !a.departamentos.includes(filtroDep) && !a.departamentos.includes("Todos")) return false;
    if (filtroEstado !== "todos" && a.estado !== filtroEstado) return false;
    return true;
  });

  const categoriasUsadas = [...new Set(apps.map((a) => a.categoria))];
  const depsUsados = [...new Set(apps.flatMap((a) => a.departamentos))];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accesos y Herramientas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Centro de credenciales y accesos rápidos a aplicaciones externas — {empresaActual.nombre}
          </p>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo acceso</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="apps" className="gap-1.5"><Globe className="h-4 w-4" /> Aplicaciones</TabsTrigger>
          <TabsTrigger value="permisos" className="gap-1.5"><Shield className="h-4 w-4" /> Permisos</TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5"><Settings2 className="h-4 w-4" /> Configuración</TabsTrigger>
        </TabsList>

        {/* ---- APPS TAB ---- */}
        <TabsContent value="apps" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar app…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categoriasUsadas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroDep} onValueChange={setFiltroDep}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los dept.</SelectItem>
                {depsUsados.filter((d) => d !== "Todos").map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
                <SelectItem value="Archivado">Archivado</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md overflow-hidden">
              <button onClick={() => setVista("tabla")} className={`p-2 ${vista === "tabla" ? "bg-accent" : "hover:bg-accent/50"}`}><List className="h-4 w-4" /></button>
              <button onClick={() => setVista("tarjetas")} className={`p-2 ${vista === "tarjetas" ? "bg-accent" : "hover:bg-accent/50"}`}><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>

          {vista === "tabla" ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Aplicación</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Departamentos</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Contraseña</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No se encontraron aplicaciones</TableCell></TableRow>
                    )}
                    {filtered.map((app) => (
                      <TableRow key={app.id} className="cursor-pointer" onClick={() => setDetalle(app)}>
                        <TableCell className="text-xl text-center">{app.icono}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{app.nombre}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{app.descripcion}</div>
                        </TableCell>
                        <TableCell className="text-xs">{app.categoria}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {app.departamentos.map((d) => <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">{d}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{app.usuario}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}><PasswordCell value={app.contrasena} canView={true} /></TableCell>
                        <TableCell><Badge className={`${estadoBadge[app.estado]} text-[10px]`}>{app.estado}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={`${tipoBadge[app.tipoIntegracion]} text-[10px]`}>{app.tipoIntegracion.toUpperCase()}</Badge></TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" asChild><a href={app.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((app) => (
                <Card key={app.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetalle(app)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{app.icono}</span>
                      <Badge className={`${estadoBadge[app.estado]} text-[10px]`}>{app.estado}</Badge>
                    </div>
                    <CardTitle className="text-base mt-1">{app.nombre}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">{app.descripcion}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {app.departamentos.map((d) => <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">{d}</Badge>)}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className={`${tipoBadge[app.tipoIntegracion]} text-[10px]`}>{app.tipoIntegracion.toUpperCase()}</Badge>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild onClick={(e) => e.stopPropagation()}>
                        <a href={app.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{filtered.length} de {apps.length} aplicaciones</div>
        </TabsContent>

        {/* ---- PERMISOS TAB ---- */}
        <TabsContent value="permisos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Permisos por rol</CardTitle>
              <CardDescription>Define qué roles pueden ver credenciales, enlaces o editar accesos.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-center">Ver enlace</TableHead>
                    <TableHead className="text-center">Ver usuario</TableHead>
                    <TableHead className="text-center">Ver contraseña</TableHead>
                    <TableHead className="text-center">Editar</TableHead>
                    <TableHead className="text-center">Crear</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { rol: "Administrador", enlace: true, user: true, pass: true, edit: true, create: true },
                    { rol: "Director", enlace: true, user: true, pass: true, edit: true, create: false },
                    { rol: "Gerencia", enlace: true, user: true, pass: true, edit: false, create: false },
                    { rol: "Responsable", enlace: true, user: true, pass: false, edit: false, create: false },
                    { rol: "Empleado", enlace: true, user: false, pass: false, edit: false, create: false },
                    { rol: "Solo lectura", enlace: true, user: false, pass: false, edit: false, create: false },
                  ].map((r) => (
                    <TableRow key={r.rol}>
                      <TableCell className="font-medium text-sm">{r.rol}</TableCell>
                      {[r.enlace, r.user, r.pass, r.edit, r.create].map((v, i) => (
                        <TableCell key={i} className="text-center">{v ? "✅" : "❌"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- CONFIG TAB ---- */}
        <TabsContent value="config" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categorías</CardTitle>
                <CardDescription className="text-xs">Categorías disponibles para clasificar aplicaciones.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS_APP.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Departamentos</CardTitle>
                <CardDescription className="text-xs">Departamentos para asignar accesos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DEPARTAMENTOS.map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tipos de integración</CardTitle>
                <CardDescription className="text-xs">Cómo se conecta la app con el SaaS.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { t: "ENLACE", d: "Abre la app en nueva pestaña. El usuario inicia sesión manualmente." },
                  { t: "SSO", d: "Single Sign-On. El usuario entra con sus credenciales corporativas." },
                  { t: "OAUTH", d: "Autorización delegada. El SaaS se conecta vía token." },
                  { t: "EMBEBIDO", d: "La app se muestra dentro del SaaS en un iframe." },
                ].map((i) => (
                  <div key={i.t} className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] mt-0.5 shrink-0">{i.t}</Badge>
                    <span className="text-xs text-muted-foreground">{i.d}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estados</CardTitle>
                <CardDescription className="text-xs">Estados disponibles para los accesos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(["Activo", "Inactivo", "Archivado"] as EstadoApp[]).map((e) => (
                  <div key={e} className="flex items-center gap-2">
                    <Badge className={`${estadoBadge[e]} text-[10px]`}>{e}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ---- DETAIL DIALOG ---- */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        {detalle && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">{detalle.icono}</span> {detalle.nombre}
              </DialogTitle>
              <DialogDescription>{detalle.descripcion}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="text-muted-foreground">Categoría:</span> {detalle.categoria}</div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge className={`${estadoBadge[detalle.estado]} text-[10px] ml-1`}>{detalle.estado}</Badge></div>
                <div><span className="text-muted-foreground">Tipo:</span> <Badge variant="outline" className={`${tipoBadge[detalle.tipoIntegracion]} text-[10px] ml-1`}>{detalle.tipoIntegracion.toUpperCase()}</Badge></div>
                <div><span className="text-muted-foreground">Responsable:</span> {detalle.responsable}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Departamentos:</span> {detalle.departamentos.join(", ")}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Roles:</span> {detalle.rolesAutorizados.join(", ")}</div>
              </div>
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-medium"><KeyRound className="h-4 w-4" /> Credenciales</div>
                <div className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
                  <span className="text-muted-foreground">URL:</span>
                  <a href={detalle.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{detalle.url}</a>
                  <span className="text-muted-foreground">Usuario:</span>
                  <span className="font-mono">{detalle.usuario}</span>
                  <span className="text-muted-foreground">Contraseña:</span>
                  <PasswordCell value={detalle.contrasena} canView={true} />
                </div>
              </div>
              {detalle.notas && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  <span className="font-medium text-foreground">Notas:</span> {detalle.notas}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground">Última actualización: {detalle.ultimaActualizacion}</div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="gap-1.5" asChild>
                  <a href={detalle.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir aplicación</a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(detalle.usuario); toast.success("Usuario copiado"); }}>Copiar usuario</Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
