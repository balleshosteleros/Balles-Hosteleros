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
 * SOLO LECTURA: navegar, buscar, abrir en Drive y descargar. No se sube ni se
 * borra nada desde aquí.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  HardDrive,
  Loader2,
  Search,
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
type Raiz = "mi-unidad" | "compartido";

const RAICES: { clave: Raiz; nombre: string; Icono: typeof HardDrive }[] = [
  { clave: "mi-unidad", nombre: "Mi unidad", Icono: HardDrive },
  { clave: "compartido", nombre: "Compartido conmigo", Icono: Users2 },
];

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

/** Fecha en día/mes/año, norma del software. */
function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function DriveExplorador({ abierto }: { abierto: boolean }) {
  const { connected } = useGoogleConnection();

  const [raiz, setRaiz] = useState<Raiz>("mi-unidad");
  const [ruta, setRuta] = useState<Paso[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);

  // Para descartar respuestas de peticiones que ya no interesan.
  const peticion = useRef(0);

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
          setError("No se ha podido leer Google Drive.");
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

  const descargar = (item: DriveItem) => {
    // El navegador pide al software y el software a Drive: el token no sale.
    window.location.href = `/api/google/drive/ver?id=${encodeURIComponent(item.id)}&descargar=1`;
    toast.success(`Descargando ${item.nombre}`);
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
        {RAICES.map(({ clave, nombre, Icono }) => (
          <Button
            key={clave}
            variant={raiz === clave && ruta.length === 0 ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setRaiz(clave)}
          >
            <Icono className="h-3.5 w-3.5" />
            {nombre}
          </Button>
        ))}
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
            {RAICES.find((r) => r.clave === raiz)?.nombre}
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

      {/* Listado */}
      <div className="flex-1 overflow-y-auto">
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
                  onClick={() =>
                    item.esCarpeta
                      ? entrarEnCarpeta(item)
                      : window.open(
                          item.enlaceDrive ??
                            `/api/google/drive/ver?id=${encodeURIComponent(item.id)}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                  }
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
                  {item.enlaceDrive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Abrir en Drive"
                      onClick={() =>
                        window.open(
                          item.enlaceDrive!,
                          "_blank",
                          "noopener,noreferrer",
                        )
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
                      onClick={() => descargar(item)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
