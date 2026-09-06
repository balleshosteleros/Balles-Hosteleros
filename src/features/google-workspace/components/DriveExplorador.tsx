"use client";

/**
 * PRP-084 — Explorador de Google Drive en vivo.
 *
 * No guarda nada: cada carpeta se pide a Drive en el momento. Lo que cambie
 * en Drive aparece aquí al volver a entrar.
 *
 * Dos secciones, como en Drive:
 *   - "Mi unidad"          → lo que la cuenta conectada posee
 *   - "Compartido conmigo" → lo que le han compartido
 * Quién ve qué lo decide Google según el correo con el que se hizo login.
 *
 * Navegar, buscar, abrir en Drive, descargar y SUBIR a la carpeta abierta
 * (botón «Subir» o soltando archivos encima). No se borra, mueve ni renombra
 * nada: Drive sigue siendo la única fuente de verdad y el software no guarda
 * copia de lo que se sube.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Upload,
  Users2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleReauthBanner } from "./GoogleReauthBanner";
import { useGoogleConnection } from "./useGoogleConnection";

type DriveItem = {
  id: string;
  nombre: string;
  esCarpeta: boolean;
  mimeType: string;
  tamano: number | null;
  modificado: string | null;
  icono: string | null;
  miniatura: string | null;
  enlaceDrive: string | null;
  esNativoGoogle: boolean;
};

/** Un escalón de la ruta: dónde estamos y cómo volver. */
type Paso = { id: string | null; nombre: string; raiz: Raiz };

/**
 * "mi-unidad", "compartido" o "unidad:<id>" para cada Unidad compartida, que
 * solo existen en cuentas de Google Workspace.
 */
type Raiz = string;

/** Una sección del lateral: las dos de siempre y, si las hay, las unidades. */
type Seccion = { clave: string; nombre: string; driveId?: string };

/** Cómo se pintan los archivos: en filas o en cuadrícula, como en Drive. */
type Vista = "lista" | "iconos";

/**
 * La vista elegida se recuerda en este navegador. Es una comodidad de cada
 * uno, no un dato del negocio: no viaja a la base de datos.
 */
const MEMORIA_VISTA = "drive:vista";

/** Mientras Google contesta, las dos que tiene cualquier cuenta. */
const SECCIONES_BASE: Seccion[] = [
  { clave: "mi-unidad", nombre: "Mi unidad" },
  { clave: "compartido", nombre: "Compartido conmigo" },
];

/** Cada sección con su dibujo: unidad propia, compartida conmigo, o de empresa. */
function iconoDe(clave: string) {
  if (clave === "mi-unidad") return HardDrive;
  if (clave === "compartido") return Users2;
  return Building2;
}

/** Tamaño legible con coma decimal, como el resto del software. */
function tamanoLegible(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1).replace(".", ",")} ${u[i]}`;
}

/**
 * Trozo de subida: 8 MB. Google exige múltiplos de 256 KB y recomienda no
 * bajar de 8 MB, que es el equilibrio entre número de peticiones y lo que se
 * repite si una falla.
 */
const TROZO = 8 * 1024 * 1024;

/**
 * Sube un archivo a Google en trozos, contra la URL de sesión reanudable.
 *
 * Va por trozos y no de una vez para poder ir contando el avance y para que
 * una subida larga no dependa de una única petición gigante: si un trozo
 * falla, se reintenta ese y no el archivo entero.
 *
 * Devuelve `true` si Google lo dio por completado.
 */
async function subirPorTrozos(
  uploadUrl: string,
  archivo: File,
  avance: (hecho: number) => void,
): Promise<boolean> {
  const total = archivo.size;
  let desde = 0;

  // Un archivo vacío no tiene trozos: se manda una sola petición sin cuerpo.
  if (total === 0) {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": "bytes */0" },
    });
    return res.ok;
  }

  while (desde < total) {
    const hasta = Math.min(desde + TROZO, total);
    const trozo = archivo.slice(desde, hasta);

    let res: Response;
    try {
      res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes ${desde}-${hasta - 1}/${total}`,
        },
        body: trozo,
      });
    } catch {
      // Corte de red: se corta la subida. Google guarda la sesión abierta una
      // semana, pero aquí no se reanuda: se vuelve a subir el archivo.
      return false;
    }

    // 200/201 = terminado. 308 = trozo aceptado, sigue pidiendo el siguiente.
    if (res.status === 200 || res.status === 201) {
      avance(total);
      return true;
    }
    if (res.status !== 308) return false;

    // Google confirma en `Range` hasta dónde tiene de verdad. Nos fiamos de
    // eso y no de nuestra cuenta: si recibió menos, se sigue desde ahí.
    const rango = res.headers.get("range");
    const confirmado = rango?.match(/bytes=0-(\d+)/);
    desde = confirmado ? Number(confirmado[1]) + 1 : hasta;
    avance(desde);
  }

  return true;
}

/** Fecha en día/mes/año, norma del software. */
function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Abrir en Drive y descargar. Vive aparte porque lista y cuadrícula ofrecen
 * exactamente lo mismo: si cambia el comportamiento, cambia en los dos sitios.
 */
function Acciones({
  item,
  onDescargar,
}: {
  item: DriveItem;
  onDescargar: (item: DriveItem) => void;
}) {
  return (
    <>
      {item.enlaceDrive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Abrir en Drive"
          onClick={() =>
            window.open(item.enlaceDrive!, "_blank", "noopener,noreferrer")
          }
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
      {!item.esCarpeta && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Descargar"
          onClick={() => onDescargar(item)}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  );
}

export function DriveExplorador({ abierto }: { abierto: boolean }) {
  const { connected } = useGoogleConnection();

  const [secciones, setSecciones] = useState<Seccion[]>(SECCIONES_BASE);
  const [raiz, setRaiz] = useState<Raiz>("mi-unidad");
  const [ruta, setRuta] = useState<Paso[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);

  // Arranca siempre en lista y, ya montado, adopta lo que el navegador
  // recuerde: leer localStorage en el primer render rompe la hidratación.
  const [vista, setVista] = useState<Vista>("lista");
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(MEMORIA_VISTA);
      if (guardada === "iconos" || guardada === "lista") setVista(guardada);
    } catch {
      // Navegador sin acceso al almacenamiento: nos quedamos con la lista.
    }
  }, []);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem(MEMORIA_VISTA, v);
    } catch {
      // Si no se puede recordar, la vista sigue funcionando igual.
    }
  };

  // Para descartar respuestas de peticiones que ya no interesan.
  const peticion = useRef(0);

  // Subida a Drive: el input va oculto y lo dispara el botón «Subir».
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);

  /** Qué se está subiendo ahora: para la barra de avance. */
  const [progreso, setProgreso] = useState<{
    nombre: string;
    hecho: number;
    total: number;
    indice: number;
    de: number;
  } | null>(null);

  const cargar = useCallback(
    async (destino: Paso) => {
      const mia = ++peticion.current;
      setCargando(true);
      setError(null);
      try {
        const qs = destino.id
          ? `folderId=${encodeURIComponent(destino.id)}`
          : `raiz=${destino.raiz}`;
        const res = await fetch(`/api/google/drive/listar?${qs}`);
        if (peticion.current !== mia) return;

        if (res.status === 401) {
          setError("reauth");
          setItems([]);
          return;
        }
        if (!res.ok) {
          // Si Google rechaza por permisos, la cuenta esta conectada pero sin
          // el permiso de Drive: hay que volver a autorizar, no reintentar.
          const cuerpo = (await res.json().catch(() => null)) as {
            motivo?: number | null;
          } | null;
          if (cuerpo?.motivo === 403) {
            setError("reauth");
          } else {
            setError(
              "Google no ha devuelto los archivos. Vuelve a intentarlo en unos segundos.",
            );
          }
          setItems([]);
          return;
        }
        const data = (await res.json()) as { items?: DriveItem[] };
        setItems(data.items ?? []);
      } catch {
        if (peticion.current === mia) {
          setError("No se ha podido leer Google Drive.");
          setItems([]);
        }
      } finally {
        if (peticion.current === mia) setCargando(false);
      }
    },
    [],
  );

  /**
   * Qué secciones tiene esta cuenta. Google decide: si es de Workspace y tiene
   * Unidades compartidas, aparecen; si no, se queda con las dos de siempre.
   * Nadie elige el tipo de cuenta a mano.
   */
  useEffect(() => {
    if (!abierto || !connected) return;
    let vivo = true;
    fetch("/api/google/drive/secciones")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { secciones?: Seccion[] } | null) => {
        if (vivo && d?.secciones?.length) setSecciones(d.secciones);
      })
      .catch(() => {
        // Si falla, las dos secciones base siguen sirviendo.
      });
    return () => {
      vivo = false;
    };
  }, [abierto, connected]);

  // Al abrir el panel, cargamos la raíz activa.
  useEffect(() => {
    if (!abierto || !connected) return;
    setRuta([]);
    setBusqueda("");
    void cargar({ id: null, nombre: "", raiz });
  }, [abierto, connected, raiz, cargar]);

  const entrarEnCarpeta = (item: DriveItem) => {
    const paso: Paso = { id: item.id, nombre: item.nombre, raiz };
    setRuta((r) => [...r, paso]);
    setBusqueda("");
    void cargar(paso);
  };

  /** Vuelve a un punto de la ruta. `-1` es la raíz. */
  const volverA = (indice: number) => {
    const nueva = ruta.slice(0, indice + 1);
    setRuta(nueva);
    setBusqueda("");
    void cargar(nueva[indice] ?? { id: null, nombre: "", raiz });
  };

  const buscar = async (texto: string) => {
    if (texto.trim().length < 2) {
      setBuscando(false);
      volverA(ruta.length - 1);
      return;
    }
    const mia = ++peticion.current;
    setBuscando(true);
    setCargando(true);
    try {
      const res = await fetch(
        `/api/google/drive/buscar?q=${encodeURIComponent(texto)}`,
      );
      if (peticion.current !== mia) return;
      if (!res.ok) {
        setError("No se ha podido buscar en Google Drive.");
        return;
      }
      const data = (await res.json()) as { items?: DriveItem[] };
      setItems(data.items ?? []);
    } finally {
      if (peticion.current === mia) setCargando(false);
    }
  };

  /** Una carpeta se entra; un archivo se abre en Drive, en pestaña nueva. */
  const abrir = (item: DriveItem) => {
    if (item.esCarpeta) {
      entrarEnCarpeta(item);
      return;
    }
    window.open(
      item.enlaceDrive ??
        `/api/google/drive/ver?id=${encodeURIComponent(item.id)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const descargar = (item: DriveItem) => {
    // El navegador pide al software y el software a Drive: el token no sale.
    window.location.href = `/api/google/drive/ver?id=${encodeURIComponent(item.id)}&descargar=1`;
    toast.success(`Descargando ${item.nombre}`);
  };
  /**
   * Sube a la carpeta abierta, DIRECTAMENTE a Google.
   *
   * El archivo no pasa por el software: se pide a Google una URL de subida y
   * el navegador manda el archivo allí en trozos. Por eso no hay tope de
   * tamaño — un vídeo de 1 GB o más sube igual. Si pasara por el servidor,
   * chocaría con el límite de cuerpo de Vercel (unos 4,5 MB).
   *
   * Drive es la fuente de verdad: el software no guarda copia de nada.
   */
  const subir = async (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []);
    if (archivos.length === 0) return;

    // Buscando no hay carpeta donde dejarlo: la ruta no dice dónde estamos.
    const destino = buscando ? null : (ruta[ruta.length - 1]?.id ?? null);

    setSubiendo(true);
    const subidos: string[] = [];
    const fallidos: string[] = [];

    try {
      for (let i = 0; i < archivos.length; i++) {
        const archivo = archivos[i];
        setProgreso({
          nombre: archivo.name,
          hecho: 0,
          total: archivo.size,
          indice: i + 1,
          de: archivos.length,
        });

        // 1) El software pide permiso a Google y recibe una URL temporal.
        const sesion = await fetch("/api/google/drive/subir-sesion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: archivo.name,
            mime: archivo.type || "application/octet-stream",
            carpetaId: destino,
          }),
        });

        if (sesion.status === 401) {
          setError("reauth");
          return;
        }
        if (!sesion.ok) {
          fallidos.push(archivo.name);
          continue;
        }

        const { uploadUrl } = (await sesion.json()) as { uploadUrl?: string };
        if (!uploadUrl) {
          fallidos.push(archivo.name);
          continue;
        }

        // 2) El navegador sube el archivo a Google, trozo a trozo. Se trocea
        //    para poder ir contando el avance y para que una subida larga no
        //    dependa de una sola petición gigante.
        const ok = await subirPorTrozos(uploadUrl, archivo, (hecho) =>
          setProgreso((p) => (p ? { ...p, hecho } : p)),
        );
        if (ok) subidos.push(archivo.name);
        else fallidos.push(archivo.name);
      }

      if (subidos.length > 0) {
        toast.success(
          subidos.length === 1
            ? `${subidos[0]} subido`
            : `${subidos.length} archivos subidos`,
        );
      }
      if (fallidos.length > 0) {
        toast.error(
          fallidos.length === 1
            ? `No se ha podido subir ${fallidos[0]}`
            : `${fallidos.length} archivos no se han podido subir`,
        );
      }

      // Volvemos a preguntar a Drive para que aparezca lo recién subido.
      if (subidos.length > 0 && !buscando) {
        void cargar(ruta[ruta.length - 1] ?? { id: null, nombre: "", raiz });
      }
    } catch {
      toast.error("No se ha podido subir a Google Drive.");
    } finally {
      setSubiendo(false);
      setProgreso(null);
    }
  };

  if (!connected) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <GoogleConnectBanner servicio="Google Drive" />
      </div>
    );
  }
  if (error === "reauth") {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <GoogleReauthBanner servicio="los archivos de Drive" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Selector de sección: Mi unidad / Compartido conmigo */}
      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
        {/* Scroll horizontal: una empresa puede tener muchas unidades. */}
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {secciones.map(({ clave, nombre }) => {
            const Icono = iconoDe(clave);
            return (
              <Button
                key={clave}
                variant={
                  raiz === clave && ruta.length === 0 ? "secondary" : "ghost"
                }
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={() => setRaiz(clave)}
                title={nombre}
              >
                <Icono className="h-3.5 w-3.5" />
                <span className="max-w-[10rem] truncate">{nombre}</span>
              </Button>
            );
          })}
        </div>

        {/* Subir a la carpeta abierta. Buscando no se ofrece: no hay dónde. */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1.5 text-xs"
          disabled={subiendo || buscando}
          onClick={() => inputArchivo.current?.click()}
        >
          {subiendo ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Subir
        </Button>
        <input
          ref={inputArchivo}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void subir(e.target.files);
            // Se limpia para poder volver a elegir el mismo archivo.
            e.target.value = "";
          }}
        />

        {/* Lista o cuadrícula. Solo iconos: el dibujo ya dice cuál es cuál. */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <Button
            variant={vista === "lista" ? "default" : "ghost"}
            size="icon"
            className="h-6 w-6"
            title="Ver en lista"
            onClick={() => cambiarVista("lista")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={vista === "iconos" ? "default" : "ghost"}
            size="icon"
            className="h-6 w-6"
            title="Ver en iconos"
            onClick={() => cambiarVista("iconos")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative shrink-0 border-b px-3 py-2">
        <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            void buscar(e.target.value);
          }}
          placeholder="Buscar en Drive"
          className="h-8 pl-8 text-sm"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              void buscar("");
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Ruta de carpetas */}
      {!buscando && (
        <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b px-3 py-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => volverA(-1)}
            className="shrink-0 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
          >
            {secciones.find((r) => r.clave === raiz)?.nombre ?? "Mi unidad"}
          </button>
          {ruta.map((p, i) => (
            <span key={p.id} className="flex shrink-0 items-center gap-0.5">
              <ChevronRight className="h-3 w-3 opacity-50" />
              <button
                type="button"
                onClick={() => volverA(i)}
                className={cn(
                  "rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground",
                  i === ruta.length - 1 && "font-medium text-foreground",
                )}
              >
                {p.nombre}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Avance de la subida. Un vídeo tarda: hay que ver que avanza. */}
      {progreso && (
        <div className="shrink-0 border-b px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">
              {progreso.de > 1 && `(${progreso.indice}/${progreso.de}) `}
              {progreso.nombre}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {tamanoLegible(progreso.hecho)} de {tamanoLegible(progreso.total)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${progreso.total ? Math.round((progreso.hecho / progreso.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Listado. Soltar archivos encima los sube a la carpeta abierta. */}
      <div
        className={cn(
          "relative flex-1 overflow-y-auto",
          arrastrando && "bg-muted/40",
        )}
        onDragOver={(e) => {
          if (buscando || subiendo) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={(e) => {
          // Solo al salir del contenedor, no al pasar entre sus hijos.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setArrastrando(false);
        }}
        onDrop={(e) => {
          if (buscando || subiendo) return;
          e.preventDefault();
          setArrastrando(false);
          void subir(e.dataTransfer.files);
        }}
      >
        {arrastrando && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-background/80">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" />
              Suelta para subir a{" "}
              {ruta[ruta.length - 1]?.nombre ??
                secciones.find((r) => r.clave === raiz)?.nombre}
            </span>
          </div>
        )}
        {cargando ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          </div>
        ) : error ? (
          <div className="p-5 text-sm text-muted-foreground">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <Folder className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {buscando
                ? "Ningún archivo coincide con la búsqueda."
                : "Esta carpeta está vacía."}
            </p>
            {!buscando && raiz === "compartido" && (
              <p className="max-w-xs text-xs text-muted-foreground/70">
                Aquí aparece lo que otras cuentas comparten con tu correo en
                Google Drive.
              </p>
            )}
          </div>
        ) : vista === "iconos" ? (
          <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <li key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => abrir(item)}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border p-3 text-center hover:bg-muted/40"
                >
                  {/* La miniatura si Drive la da; si no, el icono del tipo. */}
                  {item.miniatura && !item.esCarpeta ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.miniatura}
                      alt=""
                      className="h-20 w-full rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-full items-center justify-center rounded bg-muted/50">
                      {item.esCarpeta ? (
                        <Folder className="h-8 w-8 text-[#5f6368]" />
                      ) : item.icono ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.icono} alt="" className="h-8 w-8" />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      )}
                    </span>
                  )}
                  <span className="w-full">
                    <span className="block truncate text-xs font-medium">
                      {item.nombre}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {fechaLegible(item.modificado)}
                      {!item.esCarpeta && item.tamano !== null && (
                        <> · {tamanoLegible(item.tamano)}</>
                      )}
                    </span>
                  </span>
                </button>

                <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  <Acciones item={item} onDescargar={descargar} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-3 px-4 py-2 hover:bg-muted/40"
              >
                {/* Icono: el de Drive si lo hay, si no uno genérico */}
                {item.esCarpeta ? (
                  <Folder className="h-4 w-4 shrink-0 text-[#5f6368]" />
                ) : item.icono ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.icono} alt="" className="h-4 w-4 shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <button
                  type="button"
                  onClick={() => abrir(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {fechaLegible(item.modificado)}
                    {!item.esCarpeta && item.tamano !== null && (
                      <> · {tamanoLegible(item.tamano)}</>
                    )}
                  </p>
                </button>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Acciones item={item} onDescargar={descargar} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
