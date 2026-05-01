"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  Documento, CATEGORIAS_DOCUMENTALES, NIVELES_ACCESO,
  ESTADOS_DOCUMENTO, CARPETAS, NivelAcceso, EstadoDocumento, TipoArchivo,
} from "@/features/direccion/data/documentacion";
import { listDocumentos, createDocumento, deleteDocumento } from "@/features/direccion/actions/documentacion-actions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Upload, FolderPlus, List, LayoutGrid, FileText, FileSpreadsheet,
  FileImage, File, Download, Eye, Pencil, Archive, FolderOpen, Shield,
  Clock, User, Tag, HardDrive, Settings, Link2, X, ChevronRight,
  Lock, Users, Building2, Filter,
} from "lucide-react";

/* ── helpers ── */
const tipoIcono = (t: TipoArchivo) => {
  switch (t) {
    case "pdf": return <FileText className="h-5 w-5 text-red-500" />;
    case "docx": return <FileText className="h-5 w-5 text-blue-500" />;
    case "xlsx": return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    case "pptx": return <FileText className="h-5 w-5 text-orange-500" />;
    case "jpg": case "png": return <FileImage className="h-5 w-5 text-purple-500" />;
    default: return <File className="h-5 w-5 text-muted-foreground" />;
  }
};

const estadoBadge = (e: EstadoDocumento) => {
  const map: Record<EstadoDocumento, string> = {
    vigente: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    borrador: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    archivado: "bg-muted text-muted-foreground",
    caducado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    en_revision: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };
  const label = ESTADOS_DOCUMENTO.find((x) => x.value === e)?.label ?? e;
  return <Badge variant="outline" className={map[e]}>{label}</Badge>;
};

const accesoIcon = (n: NivelAcceso) => {
  if (n === "privado" || n === "solo_direccion") return <Lock className="h-3.5 w-3.5" />;
  if (n === "solo_gerencia") return <Building2 className="h-3.5 w-3.5" />;
  return <Users className="h-3.5 w-3.5" />;
};

const accesoLabel = (n: NivelAcceso) => NIVELES_ACCESO.find((x) => x.value === n)?.label ?? n;

function mapDbToDocumento(row: Record<string, unknown>): Documento {
  return {
    id: row.id as string,
    nombre: (row.titulo as string) ?? "",
    descripcion: (row.descripcion as string) ?? "",
    categoria: (row.categoria as string) ?? "",
    etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas as string[] : [],
    empresa: (row.empresa_id as string) ?? "",
    creador: (row.created_by as string) ?? "",
    fechaSubida: (row.created_at as string) ?? "",
    ultimaActualizacion: (row.updated_at as string) ?? (row.created_at as string) ?? "",
    tipoArchivo: ((row.tipo_archivo as string) ?? "pdf") as TipoArchivo,
    tamano: (row.tamano as string) ?? "",
    estado: ((row.estado as string) ?? "vigente") as EstadoDocumento,
    nivelAcceso: ((row.nivel_acceso as string) ?? "lectura") as NivelAcceso,
    permisos: Array.isArray(row.permisos) ? row.permisos as { rol: string; accion: string }[] : [],
    driveFileId: (row.drive_file_id as string) ?? undefined,
    driveUrl: (row.drive_url as string) ?? undefined,
    carpeta: (row.carpeta as string) ?? "General",
  };
}

/* ── component ── */
export function DocumentacionView() {
  const { empresaActual } = useEmpresa();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDocumentos();
      if (res.ok) {
        setDocs(res.data.map(mapDbToDocumento));
      } else {
        toast.error("Error al cargar documentos");
      }
    } catch {
      toast.error("Error de conexion al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocumentos();
  }, [loadDocumentos]);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("todas");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [carpetaFilter, setCarpetaFilter] = useState("todas");
  const [vista, setVista] = useState<"lista" | "tarjetas">("lista");
  const [selected, setSelected] = useState<Documento | null>(null);
  const [mainTab, setMainTab] = useState("biblioteca");

  const filtered = useMemo(() => {
    let r = docs;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((d) => d.nombre.toLowerCase().includes(s) || d.descripcion.toLowerCase().includes(s) || d.etiquetas.some((t) => t.toLowerCase().includes(s)));
    }
    if (catFilter !== "todas") r = r.filter((d) => d.categoria === catFilter);
    if (estadoFilter !== "todos") r = r.filter((d) => d.estado === estadoFilter);
    if (carpetaFilter !== "todas") r = r.filter((d) => d.carpeta === carpetaFilter);
    return r;
  }, [docs, search, catFilter, estadoFilter, carpetaFilter]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm"><FolderPlus className="h-4 w-4 mr-1.5" />Nueva carpeta</Button>
        <Button size="sm"><Upload className="h-4 w-4 mr-1.5" />Subir documento</Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="biblioteca"><FolderOpen className="h-4 w-4 mr-1.5" />Biblioteca</TabsTrigger>
          <TabsTrigger value="permisos"><Shield className="h-4 w-4 mr-1.5" />Permisos</TabsTrigger>
          <TabsTrigger value="drive"><HardDrive className="h-4 w-4 mr-1.5" />Conexión Drive</TabsTrigger>
          <TabsTrigger value="config" aria-label="Configuración" className="ml-auto"><Settings className="h-4 w-4" strokeWidth={1.75} /></TabsTrigger>
        </TabsList>

        {/* ─── BIBLIOTECA ─── */}
        <TabsContent value="biblioteca" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar documentos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {CATEGORIAS_DOCUMENTALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_DOCUMENTO.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={carpetaFilter} onValueChange={setCarpetaFilter}>
              <SelectTrigger className="w-[160px]"><FolderOpen className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Carpeta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las carpetas</SelectItem>
                {CARPETAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-1">
              <Button variant={vista === "lista" ? "secondary" : "ghost"} size="icon" onClick={() => setVista("lista")}><List className="h-4 w-4" /></Button>
              <Button variant={vista === "tarjetas" ? "secondary" : "ghost"} size="icon" onClick={() => setVista("tarjetas")}><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Counter */}
          <p className="text-xs text-muted-foreground">{filtered.length} documento{filtered.length !== 1 ? "s" : ""}</p>

          {/* List view */}
          {vista === "lista" && (
            <Card>
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Carpeta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acceso</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => (
                      <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(d)}>
                        <TableCell>{tipoIcono(d.tipoArchivo)}</TableCell>
                        <TableCell className="font-medium max-w-[260px] truncate">{d.nombre}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.categoria}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.carpeta}</TableCell>
                        <TableCell>{estadoBadge(d.estado)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{accesoIcon(d.nivelAcceso)} {accesoLabel(d.nivelAcceso)}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{d.ultimaActualizacion}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.tamano}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelected(d); }}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No se encontraron documentos</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}

          {/* Grid view */}
          {vista === "tarjetas" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((d) => (
                <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(d)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">{tipoIcono(d.tipoArchivo)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{d.nombre}</p>
                        <p className="text-xs text-muted-foreground">{d.categoria}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.descripcion}</p>
                    <div className="flex items-center justify-between">
                      {estadoBadge(d.estado)}
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{accesoIcon(d.nivelAcceso)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{d.tamano}</span>
                      <span>{d.ultimaActualizacion}</span>
                    </div>
                    {d.driveFileId && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><HardDrive className="h-3 w-3" />En Drive</span>}
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && <p className="col-span-full text-center py-12 text-muted-foreground">No se encontraron documentos</p>}
            </div>
          )}
        </TabsContent>

        {/* ─── PERMISOS ─── */}
        <TabsContent value="permisos" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Permisos y visibilidad</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">Configura quién puede ver, descargar, editar, mover o eliminar cada documento. Los permisos se aplican por empresa, rol o usuario individual.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {NIVELES_ACCESO.map((n) => (
                  <Card key={n.value} className="border">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">{accesoIcon(n.value)}</div>
                      <div>
                        <p className="font-medium text-sm">{n.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {n.value === "solo_direccion" && "Solo usuarios con rol Dirección pueden acceder"}
                          {n.value === "solo_gerencia" && "Accesible para Gerencia y Dirección"}
                          {n.value === "lectura" && "Todos los usuarios autorizados pueden leer"}
                          {n.value === "edicion" && "Permite lectura y modificación del documento"}
                          {n.value === "privado" && "Solo el creador y administradores"}
                          {n.value === "compartido_interno" && "Visible para todos los empleados de la empresa"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Resumen de acceso por documento</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Roles con acceso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.slice(0, 6).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-sm">{d.nombre}</TableCell>
                        <TableCell><span className="inline-flex items-center gap-1 text-xs">{accesoIcon(d.nivelAcceso)} {accesoLabel(d.nivelAcceso)}</span></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.permisos.map((p) => p.rol).join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DRIVE ─── */}
        <TabsContent value="drive" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><HardDrive className="h-5 w-5" />Conexión con Google Drive</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">Los documentos se almacenan en Google Drive pero se gestionan visualmente desde el SaaS. Conecta tu cuenta de Drive para habilitar la sincronización.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-dashed border-2">
                  <CardContent className="p-5 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center"><Link2 className="h-6 w-6 text-muted-foreground" /></div>
                    <p className="font-medium text-sm">Estado de conexión</p>
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Pendiente de conexión</Badge>
                    <Button variant="outline" size="sm" className="w-full">Conectar Google Drive</Button>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-5 space-y-2">
                    <p className="font-medium text-sm">Archivos sincronizados</p>
                    <p className="text-3xl font-bold text-foreground">{docs.filter((d) => d.driveFileId).length}</p>
                    <p className="text-xs text-muted-foreground">de {docs.length} documentos totales</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-5 space-y-2">
                    <p className="font-medium text-sm">Carpeta Drive</p>
                    <p className="text-sm text-muted-foreground">BALLES / {empresaActual?.nombre} / Documentación</p>
                    <Button variant="ghost" size="sm" className="px-0 text-primary">Configurar carpeta</Button>
                  </CardContent>
                </Card>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Documentos en Drive</h3>
                <div className="space-y-2">
                  {docs.filter((d) => d.driveFileId).map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      {tipoIcono(d.tipoArchivo)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.nombre}</p>
                        <p className="text-xs text-muted-foreground">ID: {d.driveFileId}</p>
                      </div>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px]">Sincronizado</Badge>
                    </div>
                  ))}
                  {docs.filter((d) => d.driveFileId).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No hay documentos sincronizados con Drive</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CONFIGURACIÓN ─── */}
        <TabsContent value="config" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Categorías documentales</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {CATEGORIAS_DOCUMENTALES.map((c) => (
                  <div key={c} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                    <span className="text-sm">{c}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2">+ Añadir categoría</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Carpetas lógicas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {CARPETAS.map((c) => (
                  <div key={c} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                    <span className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4 text-muted-foreground" />{c}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2">+ Añadir carpeta</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Estados de documento</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {ESTADOS_DOCUMENTO.map((e) => (
                  <div key={e.value} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                    <span className="text-sm">{e.label}</span>
                    {estadoBadge(e.value)}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Niveles de acceso</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {NIVELES_ACCESO.map((n) => (
                  <div key={n.value} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                    <span className="text-sm flex items-center gap-2">{accesoIcon(n.value)} {n.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── DETALLE MODAL ─── */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">{tipoIcono(selected.tipoArchivo)}{selected.nombre}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Categoría</span><p className="font-medium">{selected.categoria}</p></div>
                  <div><span className="text-muted-foreground">Carpeta</span><p className="font-medium">{selected.carpeta}</p></div>
                  <div><span className="text-muted-foreground">Estado</span><div className="mt-0.5">{estadoBadge(selected.estado)}</div></div>
                  <div><span className="text-muted-foreground">Acceso</span><p className="font-medium flex items-center gap-1">{accesoIcon(selected.nivelAcceso)} {accesoLabel(selected.nivelAcceso)}</p></div>
                  <div><span className="text-muted-foreground">Creador</span><p className="font-medium">{selected.creador}</p></div>
                  <div><span className="text-muted-foreground">Tamaño</span><p className="font-medium">{selected.tamano}</p></div>
                  <div><span className="text-muted-foreground">Subido</span><p className="font-medium">{selected.fechaSubida}</p></div>
                  <div><span className="text-muted-foreground">Última actualización</span><p className="font-medium">{selected.ultimaActualizacion}</p></div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm">{selected.descripcion}</p>
                </div>

                {/* Tags */}
                {selected.etiquetas.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Etiquetas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.etiquetas.map((t) => <Badge key={t} variant="secondary" className="text-xs"><Tag className="h-3 w-3 mr-1" />{t}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Drive info */}
                {selected.driveFileId && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" />Google Drive</p>
                    <p className="text-xs text-muted-foreground">ID: {selected.driveFileId}</p>
                  </div>
                )}

                {/* Preview placeholder */}
                <div className="rounded-lg border-2 border-dashed bg-muted/20 flex flex-col items-center justify-center py-10 gap-2">
                  <Eye className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Vista previa del documento</p>
                  <p className="text-xs text-muted-foreground">Disponible con conexión a Google Drive</p>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1.5" />Ver</Button>
                  <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" />Descargar</Button>
                  <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1.5" />Editar metadatos</Button>
                  <Button variant="outline" size="sm"><FolderOpen className="h-4 w-4 mr-1.5" />Mover</Button>
                  <Button variant="outline" size="sm"><Archive className="h-4 w-4 mr-1.5" />Archivar</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
