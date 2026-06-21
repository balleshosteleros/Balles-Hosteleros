"use client";

import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Cctv,
  Plus,
  Lock,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Trash2,
  Pencil,
  Check,
  X,
  Router,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AuthContext } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listCamaras,
  createCamara,
  updateCamara,
  deleteCamara,
} from "@/features/camaras/actions/camaras-actions";
import { ConectorPairingDialog } from "@/features/camaras/components/ConectorPairingDialog";

type Camara = {
  id: string;
  nombre: string;
  ubicacion: string;
};

type LayoutKey = "1" | "2x2" | "3x3" | "2x3" | "1+5";

const LAYOUTS: Array<{ key: LayoutKey; label: string; capacity: number }> = [
  { key: "1", label: "1 cámara", capacity: 1 },
  { key: "2x2", label: "Mosaico 2×2", capacity: 4 },
  { key: "2x3", label: "Mosaico 2×3", capacity: 6 },
  { key: "3x3", label: "Mosaico 3×3", capacity: 9 },
  { key: "1+5", label: "1 grande + 5", capacity: 6 },
];

export function CamarasDrawer({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const puedeVer = auth?.puedeVer("CÁMARAS") ?? false;
  const permisosLoaded = auth?.permisosLoaded ?? false;
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  const [open, setOpen] = useState(false);
  const [camaras, setCamaras] = useState<Camara[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<LayoutKey>("2x2");
  const [fullscreen, setFullscreen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conectoresOpen, setConectoresOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formUbicacion, setFormUbicacion] = useState("");

  const viewerRef = useRef<HTMLDivElement | null>(null);

  // Carga inicial desde BD al abrir el drawer
  useEffect(() => {
    if (!open || !empresaDbId) return;
    let cancelado = false;
    setCargando(true);
    listCamaras()
      .then((res) => {
        if (cancelado) return;
        if (res.ok) {
          setCamaras(
            res.data.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              ubicacion: c.ubicacion ?? "",
            })),
          );
        } else if (res.error) {
          toast.error(res.error);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, empresaDbId]);

  // Si la selección queda vacía y hay cámaras, marcamos la primera por defecto
  useEffect(() => {
    if (camaras.length > 0 && seleccionadas.size === 0) {
      setSeleccionadas(new Set([camaras[0].id]));
    }
  }, [camaras, seleccionadas.size]);

  // Sincroniza fullscreen con la API del navegador (escape sale de fullscreen)
  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const layoutMeta = useMemo(
    () => LAYOUTS.find((l) => l.key === layout) ?? LAYOUTS[1],
    [layout],
  );

  const camarasMostradas = useMemo(() => {
    const lista = camaras.filter((c) => seleccionadas.has(c.id));
    return lista.slice(0, layoutMeta.capacity);
  }, [camaras, seleccionadas, layoutMeta.capacity]);

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const seleccionarTodas = useCallback(() => {
    setSeleccionadas(new Set(camaras.map((c) => c.id)));
  }, [camaras]);

  const limpiarSeleccion = useCallback(() => {
    setSeleccionadas(new Set());
  }, []);

  function abrirNueva() {
    setEditId(null);
    setFormNombre("");
    setFormUbicacion("");
    setDialogOpen(true);
  }

  function abrirEditar(c: Camara) {
    setEditId(c.id);
    setFormNombre(c.nombre);
    setFormUbicacion(c.ubicacion);
    setDialogOpen(true);
  }

  async function guardarCamara() {
    const nombre = formNombre.trim();
    const ubicacion = formUbicacion.trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      if (editId) {
        const res = await updateCamara(editId, { nombre, ubicacion });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setCamaras((prev) =>
          prev.map((c) => (c.id === editId ? { ...c, nombre, ubicacion } : c)),
        );
        toast.success("Cámara actualizada");
      } else {
        const res = await createCamara({ nombre, ubicacion });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        const nueva: Camara = {
          id: res.data.id,
          nombre: res.data.nombre,
          ubicacion: res.data.ubicacion ?? "",
        };
        setCamaras((prev) => [...prev, nueva]);
        setSeleccionadas((prev) => new Set(prev).add(nueva.id));
        toast.success("Cámara añadida");
      }
      setDialogOpen(false);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCamara(id: string) {
    const res = await deleteCamara(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCamaras((prev) => prev.filter((c) => c.id !== id));
    setSeleccionadas((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    toast.success("Cámara eliminada");
  }

  async function togglePantallaCompleta() {
    if (!viewerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await viewerRef.current.requestFullscreen();
    }
  }

  // ─────────────── Render ───────────────

  // Mientras carga permisos, no renderizamos nada del cuerpo — evitamos un
  // parpadeo "no tienes permisos" antes de que llegue la respuesta.
  const denegado = permisosLoaded && !puedeVer;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <SheetHeader className="border-b py-3 pl-5 pr-14 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Cctv className="h-4 w-4 text-slate-700" />
              Videovigilancia
            </SheetTitle>
            {!denegado && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  onClick={() => setConectoresOpen(true)}
                >
                  <Router className="h-3.5 w-3.5" />
                  Conectores
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1 bg-teal-600 hover:bg-teal-700"
                  onClick={abrirNueva}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva cámara
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {denegado ? (
          <div className="flex-1 overflow-y-auto px-6 py-16">
            <div className="mx-auto max-w-sm text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No tienes permisos para ver las cámaras
              </h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                El acceso a videovigilancia está restringido para tu rol.
                Habla con la dirección si necesitas acceso.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[200px_minmax(0,1fr)]">
            {/* Sidebar — lista de cámaras */}
            <aside className="border-r overflow-y-auto bg-muted/20">
              <div className="px-3 py-2 border-b flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cámaras
                </span>
                {camaras.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={seleccionarTodas}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      Todas
                    </button>
                    <span className="text-muted-foreground/50">·</span>
                    <button
                      type="button"
                      onClick={limpiarSeleccion}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      Ninguna
                    </button>
                  </div>
                )}
              </div>

              {cargando ? (
                <p className="px-3 py-4 text-[11px] text-muted-foreground">
                  Cargando cámaras…
                </p>
              ) : camaras.length === 0 ? (
                <p className="px-3 py-4 text-[11px] text-muted-foreground leading-relaxed">
                  Aún no hay cámaras configuradas en este local. Usa
                  «Nueva cámara» para añadir la primera.
                </p>
              ) : (
                <ul className="divide-y">
                  {camaras.map((c) => {
                    const activa = seleccionadas.has(c.id);
                    return (
                      <li
                        key={c.id}
                        className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/40"
                      >
                        <Switch
                          checked={activa}
                          onCheckedChange={() => toggleSeleccion(c.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {c.nombre}
                          </p>
                          {c.ubicacion && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {c.ubicacion}
                            </p>
                          )}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex">
                          <button
                            type="button"
                            onClick={() => abrirEditar(c)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarCamara(c.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            {/* Visor */}
            <section ref={viewerRef} className="flex flex-col min-w-0 bg-black">
              {/* Toolbar visor */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-zinc-900 px-3 py-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-white hover:bg-white/10 hover:text-white"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="text-xs">{layoutMeta.label}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {LAYOUTS.map((l) => (
                      <DropdownMenuItem
                        key={l.key}
                        onSelect={() => setLayout(l.key)}
                        className="text-xs"
                      >
                        {l.key === layout && (
                          <Check className="mr-1.5 h-3 w-3" />
                        )}
                        <span className={l.key === layout ? "" : "ml-[18px]"}>
                          {l.label}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/60">
                    {camarasMostradas.length} / {layoutMeta.capacity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white hover:bg-white/10 hover:text-white"
                    onClick={togglePantallaCompleta}
                    title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  >
                    {fullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Grid de tiles */}
              <div className="flex-1 min-h-0 overflow-hidden p-2">
                {camarasMostradas.length === 0 ? (
                  <EmptyViewer hayCamaras={camaras.length > 0} />
                ) : (
                  <MosaicoGrid layout={layout} camaras={camarasMostradas} />
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>

      {/* Dialog crear / editar cámara */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar cámara" : "Nueva cámara"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Nombre *</Label>
              <Input
                autoFocus
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Cámara entrada"
                onKeyDown={(e) => e.key === "Enter" && guardarCamara()}
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Ubicación</Label>
              <Input
                value={formUbicacion}
                onChange={(e) => setFormUbicacion(e.target.value)}
                placeholder="Ej: Comedor, Cocina, Barra…"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-2">
              La conexión con el grabador (RTSP / ONVIF) se configurará en
              una siguiente fase, cuando confirmemos el modelo del NVR.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={guardando}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={guardarCamara}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gestor de conectores (cajita push) + emparejamiento por QR */}
      <ConectorPairingDialog open={conectoresOpen} onOpenChange={setConectoresOpen} />
    </Sheet>
  );
}

function EmptyViewer({ hayCamaras }: { hayCamaras: boolean }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <div className="max-w-xs">
        <Cctv className="mx-auto h-10 w-10 text-white/30" />
        <p className="mt-3 text-sm text-white/80">
          {hayCamaras
            ? "Selecciona al menos una cámara"
            : "Aún no hay cámaras"}
        </p>
        <p className="mt-1 text-[11px] text-white/50 leading-relaxed">
          {hayCamaras
            ? "Marca las cámaras que quieres ver desde el panel lateral."
            : "Añade tu primera cámara con el botón «Nueva cámara»."}
        </p>
      </div>
    </div>
  );
}

function MosaicoGrid({
  layout,
  camaras,
}: {
  layout: LayoutKey;
  camaras: Camara[];
}) {
  if (layout === "1+5") {
    return (
      <div className="h-full grid grid-cols-3 grid-rows-3 gap-1.5">
        <div className="col-span-2 row-span-3">
          {camaras[0] && <Tile camara={camaras[0]} />}
        </div>
        {camaras.slice(1, 6).map((c) => (
          <Tile key={c.id} camara={c} />
        ))}
      </div>
    );
  }

  const gridClass: Record<Exclude<LayoutKey, "1+5">, string> = {
    "1": "grid-cols-1 grid-rows-1",
    "2x2": "grid-cols-2 grid-rows-2",
    "2x3": "grid-cols-3 grid-rows-2",
    "3x3": "grid-cols-3 grid-rows-3",
  };

  return (
    <div className={`h-full grid gap-1.5 ${gridClass[layout]}`}>
      {camaras.map((c) => (
        <Tile key={c.id} camara={c} />
      ))}
    </div>
  );
}

function Tile({ camara }: { camara: Camara }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-zinc-950 border border-white/10">
      {/* Vídeo placeholder — el stream RTSP/ONVIF se conectará aquí. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white/40">
          <Cctv className="mx-auto h-8 w-8" />
          <p className="mt-2 text-[10px] uppercase tracking-wider">
            Esperando grabador
          </p>
        </div>
      </div>

      {/* Etiqueta */}
      <div className="absolute left-0 bottom-0 right-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white truncate">
            {camara.nombre}
          </p>
          {camara.ubicacion && (
            <p className="text-[9px] text-white/70 truncate">
              {camara.ubicacion}
            </p>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Pendiente
        </span>
      </div>
    </div>
  );
}
