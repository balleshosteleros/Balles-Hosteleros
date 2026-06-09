// @deprecated PRP-043: sustituido por src/features/accesos/components/AccesosView.tsx
// (modelo 3-tablas con cifrado AES-256 y permisos por rol).
// Conservado temporalmente hasta confirmar la migración completa de accesos_apps → apps_externas.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { CATEGORIAS_APP, DEPARTAMENTOS, type AccesoApp, type EstadoApp } from "@/features/rrhh/data/accesos-apps";
import { listAccesosApps } from "@/features/rrhh/actions/accesos-apps-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Eye, EyeOff, Copy, Settings, Settings2, LayoutGrid, List, Globe, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  SubmoduleToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { accesosIO } from "@/features/rrhh/io/accesos.io";

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

// Componente de logo con fallback a avatar de letra
function AppLogo({ nombre, logoUrl, icono: _icono, size = "sm" }: {
  nombre: string;
  logoUrl?: string;
  icono: string;
  size?: "sm" | "lg";
}) {
  const [imgError, setImgError] = useState(false);
  const dim = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
    "bg-rose-500", "bg-teal-500", "bg-sky-500", "bg-amber-600",
  ];
  const color = colors[(nombre.charCodeAt(0) || 0) % colors.length];

  if (logoUrl && !imgError) {
    // SVGs de Simple Icons (cdn.simpleicons.org): fondo transparente para respetar el color de la marca
    const isSVG = logoUrl.includes("simpleicons.org");
    return (
      <img
        src={logoUrl}
        alt={nombre}
        onError={() => setImgError(true)}
        className={`${dim} rounded-md object-contain p-1 ${isSVG ? "bg-transparent" : "bg-white dark:bg-white/90 border border-border/40"}`}
      />
    );
  }

  // Fallback: avatar de letra coloreado
  return (
    <div className={`${dim} ${color} rounded-md flex items-center justify-center text-white font-bold ${size === "lg" ? "text-base" : "text-sm"} shrink-0`}>
      {nombre[0]?.toUpperCase()}
    </div>
  );
}

function PasswordCell({ value, canView }: { value: string; canView: boolean }) {
  const [visible, setVisible] = useState(false);
  if (!canView || !value || value === "—") return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
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

export function AccesosView() {
  const { empresaActual } = useEmpresa();
  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listAccesosApps(empresaActual.id)
      .then((rows) => { if (alive) setApps(rows); })
      .catch((e) => { console.error(e); toast.error("No se pudieron cargar los accesos"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [empresaActual.id]);

  const [buscar, setBuscar] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tarjetas");
  const [detalle, setDetalle] = useState<AccesoApp | null>(null);
  const [tab, setTab] = useTabQuery(["apps", "config"] as const, "apps");
  const [showConfig, setShowConfig] = useState(false);

  const filteredAdvanced = apps.filter((a) => {
    if (
      buscar &&
      !a.nombre.toLowerCase().includes(buscar.toLowerCase()) &&
      !a.descripcion.toLowerCase().includes(buscar.toLowerCase())
    )
      return false;
    return true;
  });

  const columnasDef: ToolbarColumna[] = [
    { campo: "aplicacion", label: "Aplicación" },
    { campo: "categoria", label: "Categoría" },
    { campo: "departamentos", label: "Departamentos" },
    { campo: "usuario", label: "Usuario" },
    { campo: "contrasena", label: "Contraseña" },
    { campo: "estado", label: "Estado" },
    { campo: "tipo", label: "Tipo" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (app: AccesoApp) => ReactNode }> = {
    aplicacion: {
      th: <TableHead key="aplicacion">Aplicación</TableHead>,
      td: (app) => (
        <TableCell key="aplicacion">
          <div className="font-medium text-sm">{app.nombre}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{app.descripcion}</div>
        </TableCell>
      ),
    },
    categoria: {
      th: <TableHead key="categoria">Categoría</TableHead>,
      td: (app) => (
        <TableCell key="categoria" className="text-xs">{app.categoria}</TableCell>
      ),
    },
    departamentos: {
      th: <TableHead key="departamentos">Departamentos</TableHead>,
      td: (app) => (
        <TableCell key="departamentos">
          <div className="flex flex-wrap gap-1">
            {app.departamentos.slice(0, 2).map((d) => <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">{d}</Badge>)}
            {app.departamentos.length > 2 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{app.departamentos.length - 2}</Badge>}
          </div>
        </TableCell>
      ),
    },
    usuario: {
      th: <TableHead key="usuario">Usuario</TableHead>,
      td: (app) => (
        <TableCell key="usuario" className="font-mono text-xs">{app.usuario || <span className="text-muted-foreground">—</span>}</TableCell>
      ),
    },
    contrasena: {
      th: <TableHead key="contrasena">Contraseña</TableHead>,
      td: (app) => (
        <TableCell key="contrasena" onClick={(e) => e.stopPropagation()}><PasswordCell value={app.contrasena} canView={true} /></TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (app) => (
        <TableCell key="estado"><Badge className={`${estadoBadge[app.estado]} text-[10px]`}>{app.estado}</Badge></TableCell>
      ),
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (app) => (
        <TableCell key="tipo"><Badge variant="outline" className={`${tipoBadge[app.tipoIntegracion]} text-[10px]`}>{app.tipoIntegracion.toUpperCase()}</Badge></TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "apps" | "config")}>
        <TabsList>
          <TabsTrigger value="apps" className="gap-1.5"><Globe className="h-4 w-4" /> Aplicaciones</TabsTrigger>
<TabsTrigger value="config" aria-label="Configuración" className="ml-auto"><Settings2 className="h-4 w-4" strokeWidth={1.75} /></TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="space-y-4 mt-4">
          <SubmoduleToolbar
            busqueda={buscar}
            onBusquedaChange={setBuscar}
            placeholderBusqueda="Buscar"
            columnas={columnasDef}
            columnasVisibles={columnasVisibles}
            onColumnasVisiblesChange={setColumnasVisibles}
            columnasOrden={columnasOrden}
            onColumnasOrdenChange={setColumnasOrden}
            extraDerecha={
              <>
                <IOActions config={accesosIO} context={{ empresaId: empresaActual.id }} onSuccess={() => window.location.reload()} />
                <Button
                  size="icon"
                  variant={showConfig ? "default" : "outline"}
                  className="h-9 w-9"
                  onClick={() => setShowConfig((v) => !v)}
                  title="Configuración"
                  aria-label="Configuración"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </>
            }
          />

          <div className="flex justify-end">
            <div className="flex border rounded-md overflow-hidden h-9">
              <button onClick={() => setVista("tabla")} className={`px-2 ${vista === "tabla" ? "bg-accent" : "hover:bg-accent/50"}`} aria-label="Vista tabla"><List className="h-4 w-4" /></button>
              <button onClick={() => setVista("tarjetas")} className={`px-2 ${vista === "tarjetas" ? "bg-accent" : "hover:bg-accent/50"}`} aria-label="Vista tarjetas"><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>

          {vista === "tabla" ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                      <TableHead className="text-right">Abrir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdvanced.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No se encontraron aplicaciones</TableCell></TableRow>
                    )}
                    {filteredAdvanced.map((app) => (
                      <TableRow key={app.id} className="cursor-pointer" onClick={() => setDetalle(app)}>
                        <TableCell>
                          <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} icono={app.icono} size="sm" />
                        </TableCell>
                        {columnasRender.map((c) => columnDefs[c.campo]?.td(app))}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredAdvanced.map((app) => (
                <Card
                  key={app.id}
                  className="hover:shadow-md transition-all cursor-pointer hover:border-primary/30 group"
                  onClick={() => setDetalle(app)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className="relative">
                      <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} icono={app.icono} size="lg" />
                      <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background ${app.estado === "Activo" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-xs leading-tight">{app.nombre}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{app.categoria}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a href={app.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{filteredAdvanced.length} de {apps.length} aplicaciones</div>
        </TabsContent>


<TabsContent value="config" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categorías</CardTitle>
                <CardDescription className="text-xs">Categorías disponibles para clasificar aplicaciones.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {CATEGORIAS_APP.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Departamentos</CardTitle>
                <CardDescription className="text-xs">Departamentos para asignar accesos.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {DEPARTAMENTOS.map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
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

      {/* Modal de detalle */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        {detalle && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg">
                <AppLogo nombre={detalle.nombre} logoUrl={detalle.logoUrl} icono={detalle.icono} size="lg" />
                {detalle.nombre}
              </DialogTitle>
              <DialogDescription>{detalle.descripcion}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="text-muted-foreground">Categoría:</span> {detalle.categoria}</div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge className={`${estadoBadge[detalle.estado]} text-[10px] ml-1`}>{detalle.estado}</Badge></div>
                <div><span className="text-muted-foreground">Tipo:</span> <Badge variant="outline" className={`${tipoBadge[detalle.tipoIntegracion]} text-[10px] ml-1`}>{detalle.tipoIntegracion.toUpperCase()}</Badge></div>
                <div><span className="text-muted-foreground">Responsable:</span> {detalle.responsable || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Departamentos:</span> {detalle.departamentos.join(", ")}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Roles:</span> {detalle.rolesAutorizados.join(", ")}</div>
              </div>
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-medium"><KeyRound className="h-4 w-4" /> Credenciales</div>
                <div className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
                  <span className="text-muted-foreground">URL:</span>
                  <a href={detalle.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{detalle.url}</a>
                  <span className="text-muted-foreground">Usuario:</span>
                  <span className="font-mono">{detalle.usuario || <span className="text-muted-foreground">—</span>}</span>
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
                {detalle.usuario && (
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(detalle.usuario); toast.success("Usuario copiado"); }}>Copiar usuario</Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
