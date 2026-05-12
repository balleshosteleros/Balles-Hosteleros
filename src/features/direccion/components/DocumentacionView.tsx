"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listCarpetas,
  createCarpeta as createCarpetaAction,
  listDocumentosByCarpeta,
  prepareUpload,
  confirmDocumento,
  deleteDocumento,
  getUsoEmpresa,
  type Carpeta,
  type DocumentoRow,
  type UsoEmpresa,
} from "@/features/direccion/actions/documentacion-actions";
import {
  ACCEPT_FILE_EXTS,
  MAX_FILE_BYTES,
  formatBytes,
  isAllowedMime,
} from "@/features/direccion/lib/documentos-config";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  SubmoduleToolbar,
  type ToolbarFiltroActivo,
} from "@/shared/components/SubmoduleToolbar";
import {
  FileText, FileSpreadsheet, FileImage, File, Download, Trash2,
  FolderOpen, Folder, Settings, ChevronLeft, Upload, FolderPlus,
} from "lucide-react";

const BUCKET = "documentacion";

function iconForMime(mime: string | null): ReactNode {
  if (!mime) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mime === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.includes("word") || mime.includes("opendocument.text"))
    return <FileText className="h-5 w-5 text-blue-500" />;
  if (mime.includes("excel") || mime.includes("spreadsheet"))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (mime.includes("powerpoint") || mime.includes("presentation"))
    return <FileText className="h-5 w-5 text-orange-500" />;
  if (mime.startsWith("image/")) return <FileImage className="h-5 w-5 text-purple-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export function DocumentacionView() {
  // Navegación: path [] = raíz, [a] = nivel 1, [a, b] = nivel 2
  const [path, setPath] = useState<Carpeta[]>([]);
  const nivel = path.length; // 0 | 1 | 2
  const carpetaActual = path[path.length - 1] ?? null;

  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);    // carpetas en el nivel actual
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [loadingCarpetas, setLoadingCarpetas] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uso, setUso] = useState<UsoEmpresa | null>(null);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);

  const [showNuevaCarpeta, setShowNuevaCarpeta] = useState(false);
  const [nuevoNombreCarpeta, setNuevoNombreCarpeta] = useState("");
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);

  const [showElegirNivel1, setShowElegirNivel1] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── data loaders ─────────────────────────────────────── */
  const loadCarpetas = useCallback(async (parentId: string | null) => {
    setLoadingCarpetas(true);
    try {
      const res = await listCarpetas(parentId);
      if (res.ok) setCarpetas(res.data);
      else if (res.error) toast.error(res.error);
    } finally {
      setLoadingCarpetas(false);
    }
  }, []);

  const loadDocumentos = useCallback(async (carpetaId: string) => {
    setLoadingDocs(true);
    try {
      const res = await listDocumentosByCarpeta(carpetaId);
      if (res.ok) setDocumentos(res.data);
      else if (res.error) toast.error(res.error);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const loadUso = useCallback(async () => {
    const res = await getUsoEmpresa();
    if (res.ok && res.data) setUso(res.data);
  }, []);

  // Recargar al cambiar de nivel
  useEffect(() => {
    if (nivel === 0) {
      loadCarpetas(null);
      setDocumentos([]);
    } else if (nivel === 1 && carpetaActual) {
      loadCarpetas(carpetaActual.id);   // subcarpetas
      loadDocumentos(carpetaActual.id); // y documentos directos
    } else if (nivel === 2 && carpetaActual) {
      setCarpetas([]);                  // nivel 2 no tiene carpetas
      loadDocumentos(carpetaActual.id);
    }
  }, [nivel, carpetaActual, loadCarpetas, loadDocumentos]);

  useEffect(() => {
    loadUso();
  }, [loadUso]);

  /* ── derived ──────────────────────────────────────────── */
  const carpetasVisibles = useMemo(() => {
    if (!search) return carpetas;
    const s = search.toLowerCase();
    return carpetas.filter((c) => c.nombre.toLowerCase().includes(s));
  }, [carpetas, search]);

  const documentosVisibles = useMemo(() => {
    if (!search) return documentos;
    const s = search.toLowerCase();
    return documentos.filter(
      (d) =>
        d.nombre.toLowerCase().includes(s) ||
        (d.descripcion ?? "").toLowerCase().includes(s),
    );
  }, [documentos, search]);

  /* ── acciones ─────────────────────────────────────────── */
  const abrirCrearCarpeta = () => {
    setNuevoNombreCarpeta("");
    setShowNuevaCarpeta(true);
  };

  const abrirSubirDocumento = () => {
    fileInputRef.current?.click();
  };

  const handleNuevo = () => {
    if (nivel === 0) {
      // Raíz → crea carpeta raíz
      abrirCrearCarpeta();
    } else if (nivel === 1) {
      // Dentro de raíz → preguntar: subcarpeta o documento
      setShowElegirNivel1(true);
    } else {
      // Nivel 2 → solo documentos
      abrirSubirDocumento();
    }
  };

  const crearCarpeta = async () => {
    const nombre = nuevoNombreCarpeta.trim();
    if (!nombre) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    setCreandoCarpeta(true);
    try {
      // En nivel 0 → raíz; en nivel 1 → subcarpeta de carpetaActual.
      // Nivel 2 nunca llega aquí (showNuevaCarpeta no se abre).
      const parentId = nivel === 1 && carpetaActual ? carpetaActual.id : null;
      const res = await createCarpetaAction(nombre, parentId);
      if (!res.ok) {
        toast.error(res.error ?? "Error al crear la carpeta");
        return;
      }
      if (res.data) {
        setCarpetas((prev) =>
          [...prev, res.data!].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        );
      }
      setNuevoNombreCarpeta("");
      setShowNuevaCarpeta(false);
      toast.success(`Carpeta "${nombre}" creada`);
    } finally {
      setCreandoCarpeta(false);
    }
  };

  const onFileSelected = async (file: File) => {
    if (!carpetaActual) return;
    if (file.size <= 0) return toast.error("Archivo vacío");
    if (file.size > MAX_FILE_BYTES) {
      return toast.error(`Máximo ${formatBytes(MAX_FILE_BYTES)} por archivo`);
    }
    if (!isAllowedMime(file.type)) {
      return toast.error("Tipo de archivo no permitido");
    }

    setUploading(true);
    try {
      const prep = await prepareUpload({
        carpetaId: carpetaActual.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      if (!prep.ok) {
        toast.error(prep.error);
        return;
      }

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(prep.storagePath, file, {
          upsert: false,
          contentType: file.type,
        });
      if (upErr) {
        toast.error(`No se pudo subir: ${upErr.message}`);
        return;
      }

      const conf = await confirmDocumento({
        carpetaId: carpetaActual.id,
        storagePath: prep.storagePath,
        nombre: prep.nombre,
        tipoMime: file.type,
        tamanoBytes: file.size,
      });
      if (!conf.ok) {
        toast.error(conf.error);
        return;
      }

      setDocumentos((prev) => [conf.data, ...prev]);
      loadUso();
      toast.success(`"${prep.nombre}" subido`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onBorrarDocumento = async (doc: DocumentoRow) => {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    const res = await deleteDocumento(doc.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
    loadUso();
    toast.success("Documento eliminado");
  };

  const onClickCarpeta = (c: Carpeta) => {
    if (nivel >= 2) return; // no más niveles
    setPath((prev) => [...prev, c]);
    setSearch("");
  };

  const navegarA = (idx: number) => {
    // idx = -1 → raíz; idx = 0 → primera carpeta del path; etc.
    setPath((prev) => prev.slice(0, idx + 1));
    setSearch("");
  };

  /* ── render helpers ───────────────────────────────────── */
  const usoPct = uso ? Math.min(100, Math.round((uso.bytes_total / uso.max_bytes) * 100)) : 0;
  const usoColor = usoPct >= 90 ? "bg-red-500" : usoPct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  const totalActual = nivel === 0
    ? carpetasVisibles.length
    : carpetasVisibles.length + documentosVisibles.length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      {nivel > 0 && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navegarA(-1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />Carpetas
          </Button>
          {path.map((c, i) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <span className="text-muted-foreground">/</span>
              {i < path.length - 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  onClick={() => navegarA(i)}
                >
                  <FolderOpen className="h-4 w-4 mr-1.5 text-blue-500" />
                  {c.nombre}
                </Button>
              ) : (
                <span className="font-medium inline-flex items-center gap-1.5 ml-1">
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                  {c.nombre}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={handleNuevo}
        textoNuevo="Nuevo"
        filtros={filtros}
        onFiltrosChange={setFiltros}
        extraDerecha={
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FILE_EXTS}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
        }}
      />

      {/* Rejilla de carpetas (raíz o subcarpetas en nivel 1) */}
      {(nivel === 0 || (nivel === 1 && carpetasVisibles.length > 0)) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {loadingCarpetas && carpetas.length === 0 && (
            <p className="col-span-full text-center py-8 text-muted-foreground text-sm">Cargando…</p>
          )}
          {carpetasVisibles.map((c) => (
            <button
              key={c.id}
              onClick={() => onClickCarpeta(c)}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/40 transition-colors text-center"
            >
              <Folder
                className="h-16 w-16 text-blue-500 group-hover:text-blue-600 transition-colors"
                strokeWidth={1.5}
                fill="currentColor"
                fillOpacity={0.15}
              />
              <div className="min-w-0 w-full">
                <p className="text-sm font-medium truncate">{c.nombre}</p>
              </div>
            </button>
          ))}
          {nivel === 0 && !loadingCarpetas && carpetasVisibles.length === 0 && (
            <p className="col-span-full text-center py-16 text-muted-foreground text-sm">
              No hay carpetas todavía. Crea una con &quot;+ Nueva carpeta&quot;.
            </p>
          )}
        </div>
      )}

      {/* Rejilla de documentos (nivel 1 con docs, o nivel 2) */}
      {nivel >= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loadingDocs && documentos.length === 0 && (
            <p className="col-span-full text-center py-8 text-muted-foreground text-sm">Cargando…</p>
          )}
          {!loadingDocs && documentosVisibles.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">{iconForMime(d.tipo_mime)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={d.nombre}>{d.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.tamano_bytes ? formatBytes(d.tamano_bytes) : "—"}
                      {" · "}{d.created_at?.slice(0, 10)}
                    </p>
                  </div>
                </div>
                {d.descripcion && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{d.descripcion}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-7 px-2" asChild>
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5 mr-1" />Abrir
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-red-600"
                    onClick={() => onBorrarDocumento(d)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loadingDocs && documentosVisibles.length === 0 && carpetasVisibles.length === 0 && (
            <div className="col-span-full text-center py-12 space-y-3">
              <p className="text-muted-foreground text-sm">
                {nivel === 1 ? "Carpeta vacía. Crea una subcarpeta o sube un documento." : "No hay documentos."}
              </p>
              <div className="flex justify-center gap-2">
                {nivel === 1 && (
                  <Button onClick={abrirCrearCarpeta} variant="outline" size="sm">
                    <FolderPlus className="h-4 w-4 mr-2" />Nueva subcarpeta
                  </Button>
                )}
                <Button onClick={abrirSubirDocumento} variant="outline" size="sm" disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Subiendo…" : "Subir documento"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-xs text-muted-foreground">
          {nivel === 0 && `${carpetasVisibles.length} carpeta${carpetasVisibles.length !== 1 ? "s" : ""}`}
          {nivel === 1 && `${carpetasVisibles.length} subcarpeta${carpetasVisibles.length !== 1 ? "s" : ""} · ${documentosVisibles.length} documento${documentosVisibles.length !== 1 ? "s" : ""}`}
          {nivel === 2 && `${documentosVisibles.length} documento${documentosVisibles.length !== 1 ? "s" : ""}`}
        </div>
        {uso && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {formatBytes(uso.bytes_total)} / {formatBytes(uso.max_bytes)}
              {" · "}{uso.docs_total}/{uso.max_docs} docs
            </span>
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${usoColor}`} style={{ width: `${usoPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Dialog: nueva carpeta / subcarpeta */}
      <Dialog open={showNuevaCarpeta} onOpenChange={setShowNuevaCarpeta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nivel === 0 ? "Nueva carpeta" : `Nueva subcarpeta en "${carpetaActual?.nombre}"`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <Input
              autoFocus
              value={nuevoNombreCarpeta}
              onChange={(e) => setNuevoNombreCarpeta(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") crearCarpeta(); }}
              placeholder="Ej. Empleados"
              maxLength={80}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNuevaCarpeta(false)} disabled={creandoCarpeta}>
              Cancelar
            </Button>
            <Button onClick={crearCarpeta} disabled={creandoCarpeta}>
              {creandoCarpeta ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: elegir qué crear en nivel 1 */}
      <Dialog open={showElegirNivel1} onOpenChange={setShowElegirNivel1}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Qué quieres añadir?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={() => { setShowElegirNivel1(false); abrirCrearCarpeta(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <FolderPlus className="h-8 w-8 text-blue-500" />
              <span className="text-sm font-medium">Subcarpeta</span>
            </button>
            <button
              onClick={() => { setShowElegirNivel1(false); abrirSubirDocumento(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-emerald-500" />
              <span className="text-sm font-medium">Documento</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overlay subiendo */}
      {uploading && (
        <Dialog open onOpenChange={() => {}}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 animate-pulse" />Subiendo…
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">No cierres la ventana hasta que termine.</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
