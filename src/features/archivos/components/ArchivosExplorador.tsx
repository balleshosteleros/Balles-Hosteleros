"use client";

/**
 * PRP-079 — Explorador de Archivos: TODA la lógica del Drive propio.
 *
 * Se usa desde dos sitios y por eso vive aparte, sin duplicarse:
 *  · escritorio → `ArchivosDrawer`, el panel lateral de la barra superior.
 *  · móvil      → `/m/archivos`, una pantalla completa.
 *
 * Carpeta raíz por departamento (solo las que el rol ve), subcarpetas libres
 * dentro, y cuadrícula de archivos: miniatura para fotos y vídeos, icono del
 * tipo para el resto (PDF, hojas de cálculo…). Admite CUALQUIER tipo y tamaño;
 * el único límite es la cuota de la empresa.
 *
 * La subida va DIRECTA del navegador a R2 con URL firmada, en cola de 4 en
 * paralelo: es lo que hace que subir 200 archivos desde el iPhone sea rápido.
 */

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Folder,
  FolderPlus,
  Upload,
  ChevronRight,
  Play,
  Trash2,
  Download,
  Pencil,
  ImageIcon,
  MoreVertical,
  Share2,
  X,
  Loader2,
  FolderInput,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileAudio,
  FileVideo,
  File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
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
  renameArchivo,
  moverArchivo,
  moverCarpeta,
  listDestinosMover,
} from "@/features/archivos/actions/archivos-actions";
import {
  esVideo,
  esImagenPintable,
  tieneVistaPrevia,
  type Archivo,
  type Carpeta,
} from "@/features/archivos/types";
import { generarMiniatura, leerDimensiones } from "@/features/archivos/lib/miniaturas";
import {
  compartirArchivo,
  descargarArchivo,
  puedeCompartirArchivos,
} from "@/features/archivos/lib/compartir";
import { allSections } from "@/features/layout/data/nav-routes";

/** Cuántos archivos se suben a la vez. Más en paralelo satura el móvil. */
const SUBIDAS_EN_PARALELO = 4;

/**
 * Las carpetas de departamento se listan en el MISMO orden que el menú
 * lateral. `allSections` es la fuente única de ese orden: si allí cambia, aquí
 * cambia solo. Se compara por clave canónica, que es lo que guarda la carpeta.
 */
const sinAcentos = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

const ORDEN_DEPARTAMENTOS = allSections.map((s) => sinAcentos(s.modulo));

/**
 * Posición en el menú lateral. Lo desconocido va al final.
 *
 * Se compara por el NOMBRE de la carpeta ("RECURSOS HUMANOS"), que es idéntico
 * al del menú, y no por su clave canónica ("RRHH"), que no coincide con nada:
 * ordenando por la clave, RRHH no se encontraba y caía al final de la lista.
 */
function ordenDepartamento(carpeta: Carpeta): number {
  const i = ORDEN_DEPARTAMENTOS.indexOf(sinAcentos(carpeta.nombre));
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

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

/**
 * Icono para los archivos SIN vista previa (PDF, hojas de cálculo, ZIP…).
 * Las fotos y los vídeos se pintan con su miniatura, no con un icono.
 */
function iconoArchivo(mime: string, nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("audio/")) return FileAudio;
  // Un vídeo SIN miniatura (los importados de Drive no la tienen) llega aquí:
  // sin este caso caía en el icono genérico y no se distinguía de un ZIP.
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("pdf") || ext === "pdf") return FileText;
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    ["xls", "xlsx", "csv", "numbers"].includes(ext)
  ) {
    return FileSpreadsheet;
  }
  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return FileArchive;
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    mime.startsWith("text/") ||
    ["doc", "docx", "txt", "rtf", "pages"].includes(ext)
  ) {
    return FileText;
  }
  return FileIcon;
}

function formatearDuracion(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  /**
   * Sitio desde el que se abre. En "drawer" el explorador solo carga cuando el
   * panel está abierto; en "pagina" (móvil) carga de entrada.
   */
  variante: "drawer" | "pagina";
  /** Solo para "drawer": si el panel está abierto. */
  abierto?: boolean;
  /**
   * Acciones de la cabecera (Carpeta / Subir). El envoltorio decide dónde
   * pintarlas: en el título del Sheet, o en la cabecera de la pantalla móvil.
   */
  renderAcciones?: (acciones: ReactNode) => ReactNode;
}

export function ArchivosExplorador({ variante, abierto = true, renderAcciones }: Props) {
  // En el móvil no existe el "pasar por encima": los menús de acciones se ven
  // siempre. En escritorio aparecen al pasar el ratón para no ensuciar la vista.
  const accionSiempreVisible = variante === "pagina";
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
  // Mover: qué se mueve, a dónde puede ir y qué destino se ha elegido.
  const [aMover, setAMover] = useState<Archivo | Carpeta | null>(null);
  const [destinos, setDestinos] = useState<
    Array<{ id: string; etiqueta: string; departamento: string }>
  >([]);
  const [destinoElegido, setDestinoElegido] = useState<string>("");
  const [cargandoDestinos, setCargandoDestinos] = useState(false);
  const [renombrandoArchivo, setRenombrandoArchivo] = useState<Archivo | null>(null);

  /*
   * Guardar / compartir (reporte de Iván, 01-sep-2026).
   *
   * `soportaCompartir` se resuelve DESPUÉS de montar, nunca al renderizar: en
   * el servidor no existe `navigator`, y decidirlo durante el render daría un
   * HTML distinto al del cliente (error de hidratación).
   */
  const [soportaCompartir, setSoportaCompartir] = useState(false);
  const [ocupado, setOcupado] = useState<"compartir" | "descargar" | null>(null);

  useEffect(() => {
    setSoportaCompartir(puedeCompartirArchivos());
  }, []);

  /*
   * El gesto "atrás" cierra la foto (y no la app).
   *
   * La app instalada va en `standalone`: no hay barra del navegador, así que el
   * único "atrás" es el deslizamiento desde el borde. Sin esto, ese gesto sobre
   * una foto abierta te sacaba de la pantalla de Archivos entera, con la foto
   * todavía puesta encima: la sensación era que la app se quedaba colgada.
   *
   * Se añade una entrada al historial al abrir el visor y se consume al cerrar,
   * de modo que el gesto solo deshace la foto.
   */
  useEffect(() => {
    if (!visor) return;

    window.history.pushState({ visorArchivos: true }, "");
    const alVolver = () => setVisor(null);
    window.addEventListener("popstate", alVolver);

    return () => {
      window.removeEventListener("popstate", alVolver);
      // Si el visor se cerró con el botón (no con el gesto), la entrada que se
      // metió sigue en el historial: se retira para no dejar un "atrás" muerto
      // que obligue a pulsar dos veces para salir de la carpeta.
      if (window.history.state?.visorArchivos) window.history.back();
    };
  }, [visor]);

  /**
   * Entrega el archivo al sistema: hoja nativa en el móvil, descarga en el
   * ordenador. Es lo que hace que "Guardar imagen" llegue de verdad a la
   * galería del iPhone y que WhatsApp reciba la foto en vez de un enlace.
   */
  const onCompartir = useCallback(async (a: Archivo) => {
    setOcupado("compartir");
    try {
      const res = await compartirArchivo(a.id, a.nombre, a.mime);
      // Si el sistema no sabe compartir ficheros, se descarga: mejor eso que
      // dejar el botón sin hacer nada.
      if (res === "no-soportado") await descargarArchivo(a.id, a.nombre, a.mime);
    } catch {
      toast.error("No se pudo compartir el archivo.");
    } finally {
      setOcupado(null);
    }
  }, []);

  const onDescargar = useCallback(async (a: Archivo) => {
    setOcupado("descargar");
    try {
      await descargarArchivo(a.id, a.nombre, a.mime);
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setOcupado(null);
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  // Carpeta activa "en vivo": los callbacks de subida se crean una vez y
  // capturarían un `carpetaId` congelado.
  const carpetaIdRef = useRef<string | null>(null);
  carpetaIdRef.current = carpetaId;

  /* ── Carga ──────────────────────────────────────────────────────────── */

  const cargarRaices = useCallback(async () => {
    setCargando(true);
    const res = await listCarpetasRaiz();
    if (res.ok)
      setRaices(
        [...res.data].sort((a, b) => ordenDepartamento(a) - ordenDepartamento(b)),
      );
    else toast.error(res.error);
    setCargando(false);
  }, []);

  // Carpetas cuya carga ya falló: no se vuelve a intentar en esta sesión de la
  // vista. Sin esto, el fallo entraba en bucle (ver el comentario del efecto).
  const carpetasFallidas = useRef<Set<string>>(new Set());

  const cargarCarpeta = useCallback(async (id: string) => {
    setCargando(true);
    const res = await getContenidoCarpeta(id);
    if (res.ok) {
      carpetasFallidas.current.delete(id);
      setCarpeta(res.data.carpeta);
      setRuta(res.data.ruta);
      setSubcarpetas(res.data.subcarpetas);
      setArchivos(res.data.archivos);
    } else {
      // Volver a la raíz al fallar cambia `carpetaId`, que es dependencia del
      // efecto de abajo: se recargaba, volvía a fallar y vuelta a empezar. En
      // los logs eran 60 POST a /m/archivos en pocos segundos, con ráfagas de
      // más de 50 peticiones por segundo que acababan matando la pestaña
      // ("This page couldn't load"). Se anota la carpeta como fallida para no
      // reintentarla y se sale a la raíz una sola vez.
      carpetasFallidas.current.add(id);
      toast.error(res.error);
      setCarpetaId(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    if (carpetaId) {
      // Ya falló antes: no se reintenta (evita el bucle error → raíz → error).
      if (carpetasFallidas.current.has(carpetaId)) return;
      void cargarCarpeta(carpetaId);
    } else {
      void cargarRaices();
    }
  }, [abierto, carpetaId, cargarCarpeta, cargarRaices]);

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
        // Solo se pinta si seguimos en la carpeta a la que se subió: si el
        // usuario navegó a otra mientras subía, aparecería un archivo que no
        // pertenece a la carpeta que está viendo.
        setArchivos((prev) =>
          reg.data.carpetaId === carpetaIdRef.current ? [reg.data, ...prev] : prev,
        );
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

  /** Abre el diálogo de mover y pide los destinos permitidos al servidor. */
  const abrirMover = async (item: Archivo | Carpeta) => {
    setAMover(item);
    setDestinoElegido("");
    setCargandoDestinos(true);
    // Para un archivo no hay descendencia que excluir: se pide con su carpeta
    // actual, que ya queda fuera de la lista por ser el origen.
    const res = await listDestinosMover(
      "esRaiz" in item ? item.id : item.carpetaId,
    );
    if (res.ok) {
      setDestinos(
        "esRaiz" in item
          ? res.data
          : // Un archivo sí puede volver a su propia carpeta padre, pero no
            // tiene sentido ofrecer la carpeta en la que ya está.
            res.data.filter((d) => d.id !== item.carpetaId),
      );
    } else {
      toast.error(res.error);
      setDestinos([]);
    }
    setCargandoDestinos(false);
  };

  const onConfirmarMover = async () => {
    if (!aMover || !destinoElegido) return;
    const esCarpeta = "esRaiz" in aMover;
    const res = esCarpeta
      ? await moverCarpeta(aMover.id, destinoElegido)
      : await moverArchivo(aMover.id, destinoElegido);
    if (!res.ok) return toast.error(res.error);

    // Sale de la vista actual: se quita de la lista sin recargar todo.
    if (esCarpeta) setSubcarpetas((prev) => prev.filter((c) => c.id !== aMover.id));
    else setArchivos((prev) => prev.filter((a) => a.id !== aMover.id));
    setAMover(null);
    toast.success(esCarpeta ? "Carpeta movida" : "Archivo movido");
  };

  const onRenombrarArchivo = async () => {
    if (!renombrandoArchivo || !nombreEdit.trim()) return;
    const res = await renameArchivo(renombrandoArchivo.id, nombreEdit.trim());
    if (!res.ok) return toast.error(res.error);
    setArchivos((prev) =>
      prev.map((a) =>
        a.id === renombrandoArchivo.id ? { ...a, nombre: nombreEdit.trim() } : a,
      ),
    );
    setRenombrandoArchivo(null);
    toast.success("Archivo renombrado");
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

  const acciones = !enRaiz ? (
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
  ) : null;

  return (
    <>
      {renderAcciones?.(acciones)}


        {/*
          El selector nativo. `multiple` es lo que permite mandar 200 archivos
          en una sola pasada. Sin `accept`, en el iPhone ofrece tanto la galería
          de Fotos como la app Archivos (PDF, hojas de cálculo…).
        */}
        <input
          ref={inputRef}
          type="file"
          /* Sin `accept`: cabe cualquier documento. En el iPhone esto muestra
             el selector con Fotos Y Archivos, no solo la galería. */
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`rounded p-0.5 transition-opacity hover:bg-muted-foreground/10 data-[state=open]:opacity-100 ${
                              accionSiempreVisible
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            title="Acciones"
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenombrando(c);
                              setNombreEdit(c.nombre);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Renombrar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void abrirMover(c)}>
                            <FolderInput className="mr-2 h-3.5 w-3.5" />
                            Mover a…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setABorrar(c)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}

              {/* Cuadrícula de archivos: miniatura si la hay, icono si no */}
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
                    Subir
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {archivos.map((a) => (
                    <div
                      key={a.id}
                      className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                      title={a.nombre}
                    >
                      {/* Menú de acciones del archivo. Va fuera del botón que
                          abre el visor: un botón dentro de otro no es válido. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`absolute right-1 top-1 z-10 rounded bg-black/50 p-1 transition-opacity hover:bg-black/70 data-[state=open]:opacity-100 ${
                              accionSiempreVisible
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            title="Acciones"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-white" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {soportaCompartir && (
                            <DropdownMenuItem onClick={() => void onCompartir(a)}>
                              <Share2 className="mr-2 h-3.5 w-3.5" />
                              Compartir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => void onDescargar(a)}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Descargar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenombrandoArchivo(a);
                              setNombreEdit(a.nombre);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Renombrar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void abrirMover(a)}>
                            <FolderInput className="mr-2 h-3.5 w-3.5" />
                            Mover a…
                          </DropdownMenuItem>
                          {a.puedeBorrar && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setABorrar(a)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <button
                        onClick={() => setVisor(a)}
                        className="block h-full w-full"
                      >
                      {/*
                          Se pide la miniatura si ya existe O si es una foto
                          que el servidor puede reducir al vuelo: los archivos
                          traídos de Drive no traen `miniaturaKey` y sin esto
                          seguirían saliendo como cuadrados grises.
                       */}
                      {a.miniaturaKey || esImagenPintable(a.mime) ? (
                        <>
                          {/*
                            Icono de fondo: se ve mientras la miniatura carga y
                            se queda si no llegara a generarse. Va DETRÁS de la
                            imagen, que lo tapa al aparecer.
                          */}
                          {(() => {
                            const Icono = iconoArchivo(a.mime, a.nombre);
                            return (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <Icono className="h-8 w-8 text-muted-foreground/40" />
                              </span>
                            );
                          })()}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/archivos/ver?id=${a.id}&thumb=1`}
                            alt={a.nombre}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            /*
                             * Si la miniatura no se puede generar (un formato
                             * que el servidor no entienda, un original
                             * corrupto), se esconde la imagen rota y asoma el
                             * icono que ya está pintado debajo.
                             */
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          {esVideo(a.mime) && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Play className="h-6 w-6 fill-white text-white" />
                            </span>
                          )}
                        </>
                      ) : (
                        // Sin miniatura (PDF, hoja de cálculo, ZIP…): icono del
                        // tipo y el nombre, que aquí es lo único que identifica
                        // el archivo.
                        (() => {
                          const Icono = iconoArchivo(a.mime, a.nombre);
                          return (
                            <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                              <Icono className="h-8 w-8 shrink-0 text-muted-foreground" />
                              <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">
                                {a.nombre}
                              </span>
                            </span>
                          );
                        })()
                      )}
                        {a.duracionSeg != null && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                            {formatearDuracion(a.duracionSeg)}
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>


      {/* Visor a pantalla completa */}
      <Dialog open={!!visor} onOpenChange={(v) => !v && setVisor(null)}>
        {/*
          `[&>button]:hidden` esconde la X por defecto del Dialog: es diminuta y
          en el móvil quedaba pegada al borde, encima de la imagen. Se sustituye
          por el botón "Volver" de la izquierda, del tamaño de un dedo.
        */}
        <DialogContent className="max-w-4xl gap-0 p-0 [&>button]:hidden">
          <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2 sm:px-4">
            {/*
              VOLVER (reporte de Iván, 01-sep-2026): antes, desde la vista previa
              del móvil no había forma de regresar y había que cerrar la app
              entera. Va el primero, donde se espera el "atrás", y con área de
              pulsación de 40px.
            */}
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                onClick={() => setVisor(null)}
                aria-label="Volver"
                className="-ml-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <DialogTitle className="truncate text-sm font-medium">
                {visor?.nombre}
              </DialogTitle>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {visor ? formatearTamano(visor.tamanoBytes) : ""}
              </span>
              {/*
                COMPARTIR: solo donde el sistema sabe hacerlo (móvil). Entrega el
                archivo, no un enlace, que es lo que rompía el envío por WhatsApp
                y lo que impedía que "Guardar imagen" llegara a la galería.
              */}
              {soportaCompartir && (
                <button
                  title="Compartir"
                  aria-label="Compartir"
                  disabled={ocupado !== null}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted active:bg-muted disabled:opacity-50"
                  onClick={() => visor && void onCompartir(visor)}
                >
                  {ocupado === "compartir" ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <Share2 className="h-[18px] w-[18px]" />
                  )}
                </button>
              )}
              <button
                title="Descargar"
                aria-label="Descargar"
                disabled={ocupado !== null}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted active:bg-muted disabled:opacity-50"
                onClick={() => visor && void onDescargar(visor)}
              >
                {ocupado === "descargar" ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Download className="h-[18px] w-[18px]" />
                )}
              </button>
              {visor?.puedeBorrar && (
                <button
                  title="Eliminar"
                  aria-label="Eliminar"
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted active:bg-muted"
                  onClick={() => {
                    const objetivo = visor;
                    setVisor(null);
                    setABorrar(objetivo);
                  }}
                >
                  <Trash2 className="h-[18px] w-[18px] text-destructive" />
                </button>
              )}
            </div>
          </DialogHeader>
          <div
            className={`flex max-h-[75vh] items-center justify-center ${
              visor && tieneVistaPrevia(visor.mime) ? "bg-black" : "bg-muted"
            }`}
          >
            {visor && esVideo(visor.mime) ? (
              <video
                src={`/api/archivos/ver?id=${visor.id}`}
                controls
                autoPlay
                className="max-h-[75vh] w-full"
              />
            ) : visor && esImagenPintable(visor.mime) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/archivos/ver?id=${visor.id}`}
                alt={visor.nombre}
                className="max-h-[75vh] w-auto object-contain"
              />
            ) : visor ? (
              // PDF, hojas de cálculo, documentos… no se pintan aquí: el
              // navegador los abre en su propia pestaña (los PDF los enseña
              // nativamente) o los descarga.
              (() => {
                const Icono = iconoArchivo(visor.mime, visor.nombre);
                return (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    <Icono className="h-14 w-14 text-muted-foreground" />
                    <p className="max-w-xs break-all text-sm font-medium">
                      {visor.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatearTamano(visor.tamanoBytes)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={`/api/archivos/ver?id=${visor.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center rounded-md bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
                      >
                        Abrir
                      </a>
                      <button
                        disabled={ocupado !== null}
                        onClick={() => void onDescargar(visor)}
                        className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-background disabled:opacity-50"
                      >
                        {ocupado === "descargar" ? "Descargando…" : "Descargar"}
                      </button>
                    </div>
                  </div>
                );
              })()
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

      {/* Renombrar archivo */}
      <Dialog
        open={!!renombrandoArchivo}
        onOpenChange={(v) => !v && setRenombrandoArchivo(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar archivo</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nombreEdit}
            onChange={(e) => setNombreEdit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onRenombrarArchivo()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenombrandoArchivo(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void onRenombrarArchivo()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mover a otra carpeta — solo salen destinos que el rol puede ver */}
      <Dialog open={!!aMover} onOpenChange={(v) => !v && setAMover(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {aMover && "esRaiz" in aMover ? "Mover carpeta" : "Mover archivo"}
            </DialogTitle>
          </DialogHeader>

          {cargandoDestinos ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : destinos.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No hay ninguna otra carpeta a la que puedas mover esto.
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto">
              {destinos.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDestinoElegido(d.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                    destinoElegido === d.id
                      ? "bg-cyan-600/10 font-medium text-cyan-700 dark:text-cyan-400"
                      : "hover:bg-muted"
                  }`}
                >
                  <Folder className="h-4 w-4 shrink-0 text-cyan-600" />
                  <span className="truncate">{d.etiqueta}</span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAMover(null)}>
              Cancelar
            </Button>
            <Button disabled={!destinoElegido} onClick={() => void onConfirmarMover()}>
              Mover
            </Button>
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
    </>
  );
}
