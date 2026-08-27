"use client";

/**
 * PRP-079 — Archivos: el Drive propio del software.
 *
 * Mismo patrón visual y de apertura que el resto de herramientas de la barra
 * (Agenda, Tareas, Chat): un Sheet lateral que envuelve al botón de la barra.
 *
 * Explorador de carpetas: raíz por departamento (solo las que el rol ve),
 * subcarpetas libres dentro, y cuadrícula de miniaturas de fotos y vídeos.
 * La subida va DIRECTA del navegador a R2 con URL firmada, en cola de 4 en
 * paralelo: es lo que hace que subir 200 fotos desde el iPhone sea rápido.
 */

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  Folder,
  FolderPlus,
  Upload,
  ChevronRight,
  Play,
  Trash2,
  Download,
  Pencil,
  ImageIcon,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listCarpetasRaiz,
  getContenidoCarpeta,
  createSubcarpeta,
  renameCarpeta,
  deleteCarpeta,
  presignSubida,
  registrarArchivo,
  deleteArchivo,
} from "@/features/archivos/actions/archivos-actions";
import {
  esVideo,
  MAX_BYTES_ARCHIVO,
  type Archivo,
  type Carpeta,
} from "@/features/archivos/types";
import { generarMiniatura, leerDimensiones } from "@/features/archivos/lib/miniaturas";

/** Cuántos archivos se suben a la vez. Más en paralelo satura el móvil. */
const SUBIDAS_EN_PARALELO = 4;

type EstadoSubida = {
  nombre: string;
  progreso: number;
  error?: string;
};

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

function formatearDuracion(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ArchivosDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  // null = estamos en la pantalla inicial (lista de departamentos).
  const [carpetaId, setCarpetaId] = useState<string | null>(null);
  const [raices, setRaices] = useState<Carpeta[]>([]);
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [ruta, setRuta] = useState<Carpeta[]>([]);
  const [subcarpetas, setSubcarpetas] = useState<Carpeta[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);

  const [subidas, setSubidas] = useState<EstadoSubida[]>([]);
  const [visor, setVisor] = useState<Archivo | null>(null);
  const [nuevaCarpeta, setNuevaCarpeta] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<Carpeta | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [aBorrar, setABorrar] = useState<Archivo | Carpeta | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Carga ──────────────────────────────────────────────────────────── */

  const cargarRaices = useCallback(async () => {
    setCargando(true);
    const res = await listCarpetasRaiz();
    if (res.ok) setRaices(res.data);
    else toast.error(res.error);
    setCargando(false);
  }, []);

  const cargarCarpeta = useCallback(async (id: string) => {
    setCargando(true);
    const res = await getContenidoCarpeta(id);
    if (res.ok) {
      setCarpeta(res.data.carpeta);
      setRuta(res.data.ruta);
      setSubcarpetas(res.data.subcarpetas);
      setArchivos(res.data.archivos);
    } else {
      toast.error(res.error);
      setCarpetaId(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (carpetaId) void cargarCarpeta(carpetaId);
    else void cargarRaices();
  }, [open, carpetaId, cargarCarpeta, cargarRaices]);

  /* ── Subida ─────────────────────────────────────────────────────────── */

  /** Sube un archivo a R2 con seguimiento de progreso real. */
  const subirAR2 = (url: string, file: Blob, onProgreso: (p: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Error ${xhr.status} al subir`));
      xhr.onerror = () => reject(new Error("Fallo de red"));
      xhr.send(file);
    });

  const subirUno = useCallback(
    async (file: File, indice: number, destinoId: string) => {
      const marcar = (patch: Partial<EstadoSubida>) =>
        setSubidas((prev) => prev.map((s, i) => (i === indice ? { ...s, ...patch } : s)));

      try {
        if (file.size > MAX_BYTES_ARCHIVO) {
          throw new Error(`Supera los ${formatearTamano(MAX_BYTES_ARCHIVO)}`);
        }

        const firma = await presignSubida(destinoId, file.name, file.type, file.size);
        if (!firma.ok) throw new Error(firma.error);

        // Miniatura y dimensiones se calculan en el navegador: así el servidor
        // no tiene que procesar vídeo ni añadimos dependencias nuevas.
        const [miniatura, dimensiones] = await Promise.all([
          generarMiniatura(file).catch(() => null),
          leerDimensiones(file).catch(() => null),
        ]);

        await subirAR2(firma.data.uploadUrl, file, (p) => marcar({ progreso: p }));

        if (miniatura) {
          // Sin miniatura la galería sigue funcionando: no se aborta la subida.
          await subirAR2(firma.data.miniaturaUploadUrl, miniatura, () => {}).catch(
            () => {},
          );
        }

        const reg = await registrarArchivo({
          carpetaId: destinoId,
          nombre: file.name,
          r2Key: firma.data.r2Key,
          miniaturaKey: miniatura ? firma.data.miniaturaKey : null,
          mime: file.type,
          tamanoBytes: file.size,
          ancho: dimensiones?.ancho ?? null,
          alto: dimensiones?.alto ?? null,
          duracionSeg: dimensiones?.duracionSeg ?? null,
        });
        if (!reg.ok) throw new Error(reg.error);

        marcar({ progreso: 100 });
        setArchivos((prev) => [reg.data, ...prev]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al subir";
        marcar({ error: msg });
      }
    },
    [],
  );

  const onArchivosElegidos = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !carpetaId) return;
      const lista = Array.from(files);
      const destinoId = carpetaId;

      setSubidas(lista.map((f) => ({ nombre: f.name, progreso: 0 })));

      // Cola con tope de concurrencia: 200 fotos a la vez tumbarían el móvil.
      let siguiente = 0;
      const trabajador = async () => {
        while (siguiente < lista.length) {
          const i = siguiente++;
          await subirUno(lista[i], i, destinoId);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(SUBIDAS_EN_PARALELO, lista.length) }, trabajador),
      );

      setSubidas((prev) => {
        const fallidos = prev.filter((s) => s.error);
        if (fallidos.length) {
          toast.error(`${fallidos.length} de ${lista.length} archivos no se pudieron subir`);
          return fallidos;
        }
        toast.success(
          lista.length === 1 ? "Archivo subido" : `${lista.length} archivos subidos`,
        );
        return [];
      });

      if (inputRef.current) inputRef.current.value = "";
    },
    [carpetaId, subirUno],
  );

  /* ── Carpetas ───────────────────────────────────────────────────────── */

  const onCrearCarpeta = async () => {
    if (!carpetaId || !nuevaCarpeta?.trim()) return;
    const res = await createSubcarpeta(carpetaId, nuevaCarpeta.trim());
    if (!res.ok) return toast.error(res.error);
    setSubcarpetas((prev) =>
      [...prev, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    setNuevaCarpeta(null);
    toast.success("Carpeta creada");
  };

  const onRenombrar = async () => {
    if (!renombrando || !nombreEdit.trim()) return;
    const res = await renameCarpeta(renombrando.id, nombreEdit.trim());
    if (!res.ok) return toast.error(res.error);
    setSubcarpetas((prev) =>
      prev
        .map((c) => (c.id === renombrando.id ? { ...c, nombre: nombreEdit.trim() } : c))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    setRenombrando(null);
    toast.success("Carpeta renombrada");
  };

  const onConfirmarBorrado = async () => {
    if (!aBorrar) return;
    const esCarpeta = "esRaiz" in aBorrar;
    const res = esCarpeta
      ? await deleteCarpeta(aBorrar.id)
      : await deleteArchivo(aBorrar.id);
    if (!res.ok) {
      setABorrar(null);
      return toast.error(res.error);
    }
    if (esCarpeta) setSubcarpetas((prev) => prev.filter((c) => c.id !== aBorrar.id));
    else setArchivos((prev) => prev.filter((a) => a.id !== aBorrar.id));
    setABorrar(null);
    toast.success(esCarpeta ? "Carpeta eliminada" : "Archivo eliminado");
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  const enRaiz = carpetaId === null;
  const migas = useMemo(() => (carpeta ? [...ruta, carpeta] : []), [ruta, carpeta]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b py-3 pl-5 pr-14 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4 text-cyan-600" />
              Archivos
            </SheetTitle>
            {!enRaiz && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  onClick={() => setNuevaCarpeta("")}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Carpeta
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1 bg-cyan-600 text-white hover:bg-cyan-700"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Subir
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/*
          El selector nativo: en iPhone abre directamente la galería de Fotos y
          permite marcar muchas de una vez. `multiple` es lo que hace que se
          puedan mandar 200 fotos en una sola pasada.
        */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => void onArchivosElegidos(e.target.files)}
        />

        {/* Miga de pan */}
        {!enRaiz && (
          <div className="flex items-center gap-1 overflow-x-auto border-b px-4 py-2 text-xs shrink-0">
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setCarpetaId(null)}
            >
              Departamentos
            </button>
            {migas.map((c) => (
              <span key={c.id} className="flex shrink-0 items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button
                  className={
                    c.id === carpetaId
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                  onClick={() => setCarpetaId(c.id)}
                >
                  {c.nombre}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Progreso de subida */}
        {subidas.length > 0 && (
          <div className="max-h-40 space-y-1.5 overflow-y-auto border-b bg-muted/40 px-4 py-2 shrink-0">
            {subidas.map((s, i) => (
              <div key={`${s.nombre}-${i}`} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.nombre}</span>
                  <span
                    className={
                      s.error
                        ? "shrink-0 text-destructive"
                        : "shrink-0 text-muted-foreground"
                    }
                  >
                    {s.error ?? `${s.progreso} %`}
                  </span>
                </div>
                {!s.error && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-cyan-600 transition-all"
                      style={{ width: `${s.progreso}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {cargando ? (
            <div className="flex h-40 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : enRaiz ? (
            /* Lista de departamentos. Solo los que el rol puede ver. */
            raices.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No tienes ningún departamento con archivos disponibles.
              </p>
            ) : (
              <div className="space-y-1">
                {raices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCarpetaId(c.id)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-cyan-600" />
                    <span className="truncate">{c.nombre}</span>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {/* Subcarpetas */}
              {subcarpetas.length > 0 && (
                <div className="mb-4 space-y-1">
                  {subcarpetas.map((c) => (
                    <div
                      key={c.id}
                      className="group flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                    >
                      <button
                        onClick={() => setCarpetaId(c.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Folder className="h-4 w-4 shrink-0 text-cyan-600" />
                        <span className="truncate">{c.nombre}</span>
                      </button>
                      <button
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        title="Renombrar"
                        onClick={() => {
                          setRenombrando(c);
                          setNombreEdit(c.nombre);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        title="Eliminar"
                        onClick={() => setABorrar(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Cuadrícula de fotos y vídeos */}
              {archivos.length === 0 && subcarpetas.length === 0 ? (
                <div className="py-10 text-center">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Esta carpeta está vacía.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Subir fotos o vídeos
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {archivos.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setVisor(a)}
                      className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                      title={a.nombre}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/archivos/ver?id=${a.id}&thumb=1`}
                        alt={a.nombre}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {esVideo(a.mime) && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <Play className="h-6 w-6 fill-white text-white" />
                        </span>
                      )}
                      {a.duracionSeg != null && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                          {formatearDuracion(a.duracionSeg)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>

      {/* Visor a pantalla completa */}
      <Dialog open={!!visor} onOpenChange={(v) => !v && setVisor(null)}>
        <DialogContent className="max-w-4xl gap-0 p-0">
          <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-2.5 pr-12">
            <DialogTitle className="truncate text-sm font-medium">
              {visor?.nombre}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {visor ? formatearTamano(visor.tamanoBytes) : ""}
              </span>
              <a
                href={visor ? `/api/archivos/ver?id=${visor.id}&descargar=1` : "#"}
                title="Descargar"
                className="rounded p-1.5 hover:bg-muted"
              >
                <Download className="h-4 w-4" />
              </a>
              {visor?.puedeBorrar && (
                <button
                  title="Eliminar"
                  className="rounded p-1.5 hover:bg-muted"
                  onClick={() => {
                    const objetivo = visor;
                    setVisor(null);
                    setABorrar(objetivo);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              )}
            </div>
          </DialogHeader>
          <div className="flex max-h-[75vh] items-center justify-center bg-black">
            {visor && esVideo(visor.mime) ? (
              <video
                src={`/api/archivos/ver?id=${visor.id}`}
                controls
                autoPlay
                className="max-h-[75vh] w-full"
              />
            ) : visor ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/archivos/ver?id=${visor.id}`}
                alt={visor.nombre}
                className="max-h-[75vh] w-auto object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nueva carpeta */}
      <Dialog
        open={nuevaCarpeta !== null}
        onOpenChange={(v) => !v && setNuevaCarpeta(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nuevaCarpeta ?? ""}
            placeholder="Nombre de la carpeta"
            onChange={(e) => setNuevaCarpeta(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onCrearCarpeta()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaCarpeta(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void onCrearCarpeta()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renombrar carpeta */}
      <Dialog open={!!renombrando} onOpenChange={(v) => !v && setRenombrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar carpeta</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nombreEdit}
            onChange={(e) => setNombreEdit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onRenombrar()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenombrando(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void onRenombrar()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado — UI propia, nunca confirm() del navegador */}
      <Dialog open={!!aBorrar} onOpenChange={(v) => !v && setABorrar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {aBorrar && "esRaiz" in aBorrar ? "Eliminar carpeta" : "Eliminar archivo"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {aBorrar && "esRaiz" in aBorrar
              ? "La carpeta debe estar vacía. Esta acción no se puede deshacer."
              : "El archivo se borrará definitivamente. Esta acción no se puede deshacer."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void onConfirmarBorrado()}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
