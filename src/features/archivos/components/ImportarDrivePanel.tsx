"use client";

/**
 * PRP-081 — Importar desde Google Drive.
 *
 * Cuatro pasos: elegir unidad compartida → inventario → mapear cada carpeta a
 * su departamento → importar con progreso.
 *
 * La importación se relanza sola hasta terminar: cada llamada copia lo que le
 * da tiempo y la siguiente sigue donde lo dejó, saltando lo ya copiado. Con
 * miles de archivos es la única forma de que no se corte a medias.
 */

import { useCallback, useEffect, useState } from "react";
import { HardDriveDownload, ChevronRight, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import {
  listarUnidades,
  inventariarUnidad,
  importarUnidad,
  getImportaciones,
} from "@/features/archivos/actions/importar-drive-actions";
import type {
  Inventario,
  EstadoImportacion,
  UnidadCompartidaUI,
} from "@/features/archivos/types/paneles";
import { listCarpetasRaiz } from "@/features/archivos/actions/archivos-actions";
import type { Carpeta } from "@/features/archivos/types";

function tamano(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

/** Empareja "1.DIRECCIÓN" con la carpeta Dirección, ignorando números y acentos. */
function proponerDestino(nombreDrive: string, raices: Carpeta[]): string {
  const limpio = nombreDrive
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^[\d.\s-]+/, "")
    .toUpperCase()
    .trim();
  const match = raices.find((r) => {
    const n = r.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    return n === limpio || n.startsWith(limpio) || limpio.startsWith(n);
  });
  return match?.id ?? "";
}

export function ImportarDrivePanel() {
  const [unidades, setUnidades] = useState<UnidadCompartidaUI[] | null>(null);
  const [raices, setRaices] = useState<Carpeta[]>([]);
  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  // El permiso de Drive se añadió después de que muchas cuentas se
  // conectaran: sus tokens no lo llevan y hay que rehacer la conexión.
  const [faltaPermiso, setFaltaPermiso] = useState(false);
  const [historial, setHistorial] = useState<EstadoImportacion[]>([]);

  const cargarHistorial = useCallback(async () => {
    const res = await getImportaciones();
    if (res.ok) setHistorial(res.data);
  }, []);

  useEffect(() => {
    void cargarHistorial();
    void listCarpetasRaiz().then((r) => r.ok && setRaices(r.data));
  }, [cargarHistorial]);

  // Vuelta de Google tras dar el permiso. Sin esto se regresaba a Ajustes sin
  // ningún mensaje y con el panel cerrado: parecía que no había pasado nada y
  // había que volver a buscar la pantalla a mano.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") !== "vinculada") return;

    // Se limpia de la URL para que no se repita al recargar.
    params.delete("google");
    const limpia = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", limpia);

    toast.success("Permiso de Drive concedido");
    // Se reintenta solo: el usuario ya dijo lo que quería hacer.
    void onConectar();
    // Solo al montar, con lo que traiga la URL.
  }, []);

  const onConectar = async () => {
    setCargando(true);
    setFaltaPermiso(false);
    const res = await listarUnidades();
    if (res.ok) {
      setUnidades(res.data);
      if (!res.data.length) toast.info("Esta cuenta no ve ninguna unidad compartida.");
    } else if (res.error.includes("anterior al permiso de Drive")) {
      setFaltaPermiso(true);
    } else {
      toast.error(res.error);
    }
    setCargando(false);
  };

  /** Rehace la conexión con Google para que el token incluya Drive. */
  const reconectar = () => {
    window.location.href = `/api/google/connect?next=${encodeURIComponent(
      "/ajustes?tab=herramientas",
    )}`;
  };

  const onElegirUnidad = async (u: UnidadCompartidaUI) => {
    setCargando(true);
    const res = await inventariarUnidad(u.id, u.nombre);
    if (res.ok) {
      setInventario(res.data);
      // Propuesta automática: el usuario solo corrige lo que no encaje.
      const propuesto: Record<string, string> = {};
      for (const c of res.data.carpetas) {
        const destino = proponerDestino(c.nombre, raices);
        if (destino) propuesto[c.id] = destino;
      }
      setMapeo(propuesto);
    } else {
      toast.error(res.error);
    }
    setCargando(false);
  };

  const onImportar = async () => {
    if (!inventario) return;
    const asignadas = Object.entries(mapeo).filter(([, v]) => v);
    if (!asignadas.length) {
      return toast.error("Asigna al menos una carpeta a un departamento.");
    }

    setImportando(true);
    let impId: string | undefined;
    try {
      // Se relanza hasta terminar: cada pasada copia lo que le da tiempo.
      for (let vuelta = 0; vuelta < 200; vuelta++) {
        const res = await importarUnidad(
          inventario.unidadId,
          inventario.unidadNombre,
          Object.fromEntries(asignadas),
          impId,
        );
        if (!res.ok) {
          toast.error(res.error);
          break;
        }
        impId = res.data.importacionId;
        await cargarHistorial();
        if (res.data.terminada) {
          toast.success("Importación terminada");
          break;
        }
      }
    } finally {
      setImportando(false);
      void cargarHistorial();
    }
  };

  const sinAsignar = inventario
    ? inventario.carpetas.filter((c) => !mapeo[c.id]).length
    : 0;

  return (
    <div className="space-y-5 py-2">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <HardDriveDownload className="h-4 w-4 text-cyan-600" />
          <span className="text-sm font-medium">Importar desde Google Drive</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Trae una unidad compartida completa a Archivos, respetando carpetas y
          nombres. Los documentos de Google se convierten a Excel y Word
          editables. No se borra ni se modifica nada en Drive.
        </p>
      </div>

      {faltaPermiso && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tu cuenta de Google ya está conectada para el correo y el
            calendario, pero le falta el permiso para leer Drive. Se pide una
            sola vez: Google te preguntará y volverás aquí.
          </p>
          <Button size="sm" className="mt-2" onClick={reconectar}>
            Dar permiso de Drive
          </Button>
        </div>
      )}

      {/* Paso 1 — elegir unidad */}
      {!inventario && !faltaPermiso && (
        <div>
          {!unidades ? (
            <Button size="sm" onClick={() => void onConectar()} disabled={cargando}>
              {cargando ? "Buscando…" : "Ver unidades compartidas"}
            </Button>
          ) : (
            <div className="space-y-1">
              {unidades.map((u) => (
                <button
                  key={u.id}
                  onClick={() => void onElegirUnidad(u)}
                  disabled={cargando}
                  className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <HardDriveDownload className="h-4 w-4 shrink-0 text-cyan-600" />
                  <span className="truncate">{u.nombre}</span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          {cargando && (
            <div className="flex items-center gap-2 pt-3 text-xs text-muted-foreground">
              <LoadingSpinner />
              Leyendo Drive… con muchas carpetas puede tardar un rato.
            </div>
          )}
        </div>
      )}

      {/* Pasos 2 y 3 — inventario y mapeo */}
      {inventario && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{inventario.unidadNombre}</p>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setInventario(null);
                setMapeo({});
              }}
            >
              Cambiar unidad
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {inventario.totalArchivos} archivos · {tamano(inventario.totalBytes)}
            {inventario.sueltos > 0 &&
              ` · ${inventario.sueltos} sueltos en la raíz (no se importan)`}
          </p>

          <div className="space-y-1.5">
            {inventario.carpetas.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{c.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.archivos} archivos · {tamano(c.bytes)}
                  </p>
                </div>
                <select
                  value={mapeo[c.id] ?? ""}
                  onChange={(e) =>
                    setMapeo((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">No importar</option>
                  {raices.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {sinAsignar > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {sinAsignar}{" "}
              {sinAsignar === 1 ? "carpeta se quedará" : "carpetas se quedarán"} sin
              importar. Asígnales un departamento si las necesitas.
            </p>
          )}

          <Button
            size="sm"
            className="gap-1 bg-cyan-600 text-white hover:bg-cyan-700"
            onClick={() => void onImportar()}
            disabled={importando}
          >
            {importando ? "Importando…" : "Importar"}
          </Button>

          {importando && (
            <p className="text-xs text-muted-foreground">
              No cierres esta pantalla. Puede tardar bastante con mucho contenido;
              si se corta, vuelve a darle y sigue donde se quedó.
            </p>
          )}
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Importaciones</p>
          <div className="space-y-2">
            {historial.map((h) => (
              <div key={h.id} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{h.unidadNombre}</span>
                  <span
                    className={
                      h.estado === "terminada"
                        ? "flex shrink-0 items-center gap-1 text-emerald-600"
                        : "shrink-0 text-muted-foreground"
                    }
                  >
                    {h.estado === "terminada" && <Check className="h-3 w-3" />}
                    {h.estado === "terminada" ? "Terminada" : h.estado}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {h.copiados} copiados ({tamano(h.copiadosBytes)})
                  {h.omitidos > 0 && ` · ${h.omitidos} ya estaban`}
                  {h.fallidos > 0 && ` · ${h.fallidos} fallidos`}
                </p>
                {h.errores.length > 0 && (
                  <details className="mt-0.5">
                    <summary className="cursor-pointer text-destructive">
                      Ver errores
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {h.errores.slice(0, 20).map((e, i) => (
                        <li key={i} className="text-muted-foreground">
                          {e.archivo}: {e.motivo}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No canceles Google Drive hasta comprobar aquí que está todo copiado y
            se abre bien. Google borra el contenido pasado un plazo y no hay
            marcha atrás.
          </p>
        </div>
      )}
    </div>
  );
}
