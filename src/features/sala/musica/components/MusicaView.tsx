"use client";

/**
 * Sala → Música. Pantalla principal.
 *
 * Flujo pensado para el servicio: arriba lo que suena, debajo las listas que la
 * empresa dejó preparadas. El equipo del local entra, ve las listas disponibles
 * a esta hora y pulsa Play. Todo lo demás (crear listas, subir canciones,
 * horarios) queda detrás del engranaje de Configuración y solo lo ve quien tiene
 * el permiso MÚSICA.
 */

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Play,
  Star,
  Lock,
  Music2,
  Settings,
  Plus,
  Trash2,
  Clock,
  Upload,
  Loader2,
  ListMusic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useMusica } from "@/features/sala/musica/contexts/musica-context";
import { ReproductorPrincipal } from "@/features/sala/musica/components/ReproductorPrincipal";
import { ConfiguracionMusica } from "@/features/sala/musica/components/ConfiguracionMusica";
import { AvisoLicencias } from "@/features/sala/musica/components/AvisoLicencias";
import { DetalleLista } from "@/features/sala/musica/components/DetalleLista";
import { subirCanciones } from "@/features/sala/musica/lib/subir-canciones";
import {
  crearLista,
  toggleFavorita,
  borrarLista,
} from "@/features/sala/musica/actions/musica-actions";
import { ETIQUETAS_MUSICA, type ListaMusica } from "@/features/sala/musica/types";

export function MusicaView() {
  const { listas, biblioteca, cargando, puedeGestionar, recargar, reproducirLista } =
    useMusica();

  const [busqueda, setBusqueda] = useState("");
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [detalle, setDetalle] = useState<ListaMusica | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const { confirm, dialog: dialogoConfirmacion } = useConfirmDelete();
  const inputArchivosRef = useRef<HTMLInputElement>(null);

  // Formulario de lista nueva
  const [nombre, setNombre] = useState("");
  const [etiqueta, setEtiqueta] = useState<string>("");
  const [guardando, setGuardando] = useState(false);

  const filtradas = useMemo(() => {
    let lista = listas;
    if (soloFavoritas) lista = lista.filter((l) => l.favorita);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (l) =>
          l.nombre.toLowerCase().includes(q) ||
          (l.etiqueta ?? "").toLowerCase().includes(q),
      );
    }
    // Las favoritas primero: es lo que el equipo usa a diario.
    return [...lista].sort((a, b) => Number(b.favorita) - Number(a.favorita));
  }, [listas, busqueda, soloFavoritas]);

  const totalFavoritas = listas.filter((l) => l.favorita).length;

  async function onCrearLista() {
    if (!nombre.trim()) {
      toast.error("Ponle un nombre a la lista");
      return;
    }
    setGuardando(true);
    const res = await crearLista({
      nombre,
      etiqueta: etiqueta || null,
      sinHorario: true,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear la lista");
      return;
    }
    toast.success("Lista creada");
    setNombre("");
    setEtiqueta("");
    setNuevaOpen(false);
    await recargar();
  }

  async function onFavorita(lista: ListaMusica) {
    const res = await toggleFavorita(lista.id, !lista.favorita);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar");
      return;
    }
    await recargar();
  }

  async function onBorrar(lista: ListaMusica) {
    const ok = await confirm({
      title: "Eliminar lista",
      description: `«${lista.nombre}» dejará de estar disponible. Las canciones seguirán en la biblioteca.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;

    const res = await borrarLista(lista.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    toast.success("Lista eliminada");
    await recargar();
  }

  /** Sube los archivos elegidos a la biblioteca general (sin lista concreta). */
  async function onArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (archivos.length === 0) return;

    setSubiendo(true);
    const r = await subirCanciones(archivos, null);
    setSubiendo(false);

    if (r.subidas > 0) {
      toast.success(
        r.subidas === 1 ? "1 canción añadida" : `${r.subidas} canciones añadidas`,
      );
    }
    for (const err of r.errores.slice(0, 3)) toast.error(err);
    await recargar();
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar lista"
          onNuevo={puedeGestionar ? () => setNuevaOpen(true) : undefined}
          textoNuevo="Nueva lista"
          ocultarNuevo={!puedeGestionar}
          extraDerecha={
            <>
              <Button
                size="sm"
                variant={soloFavoritas ? "default" : "outline"}
                className="h-9"
                onClick={() => setSoloFavoritas((v) => !v)}
                title="Ver solo las listas favoritas"
              >
                <Star
                  className={`h-4 w-4 mr-1.5 ${soloFavoritas ? "fill-current" : ""}`}
                />
                Favoritas
                {totalFavoritas > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">{totalFavoritas}</span>
                )}
              </Button>

              {puedeGestionar && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => inputArchivosRef.current?.click()}
                    disabled={subiendo}
                    title="Añadir canciones a la biblioteca"
                  >
                    {subiendo ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1.5" />
                    )}
                    {subiendo ? "Subiendo…" : "Subir música"}
                  </Button>

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
              )}
            </>
          }
        />

        <input
          ref={inputArchivosRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={onArchivos}
        />

        <ReproductorPrincipal />

        {/*
          Las pautas de música legal solo las ve quien puede subir archivos: al
          resto del equipo, que únicamente pulsa Play, no le aportan nada y le
          quitarían sitio a las listas.
        */}
        {puedeGestionar && <AvisoLicencias hayCanciones={biblioteca.length > 0} />}

        {showConfig && puedeGestionar && <ConfiguracionMusica />}

        {/* Listas */}
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando música…</p>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Music2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {listas.length === 0
                  ? "Todavía no hay listas de música"
                  : "Ninguna lista coincide con la búsqueda"}
              </p>
              {listas.length === 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {puedeGestionar
                    ? "Crea una lista, sube canciones y el equipo solo tendrá que pulsar Play."
                    : "Cuando la empresa prepare las listas, aparecerán aquí."}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((lista) => (
              <TarjetaLista
                key={lista.id}
                lista={lista}
                puedeGestionar={puedeGestionar}
                onPlay={() => void reproducirLista(lista)}
                onFavorita={() => void onFavorita(lista)}
                onAbrir={() => setDetalle(lista)}
                onBorrar={() => void onBorrar(lista)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Crear lista */}
      <Dialog open={nuevaOpen} onOpenChange={setNuevaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva lista</DialogTitle>
            <DialogDescription>
              Ponle nombre y, si quieres, una etiqueta según cuándo se usa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre-lista">Nombre</Label>
              <Input
                id="nombre-lista"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Comidas"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="etiqueta-lista">Etiqueta</Label>
              <Select value={etiqueta} onValueChange={setEtiqueta}>
                <SelectTrigger id="etiqueta-lista">
                  <SelectValue placeholder="Sin etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  {ETIQUETAS_MUSICA.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void onCrearLista()} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle: canciones y horarios de la lista */}
      {detalle && (
        <DetalleLista
          lista={listas.find((l) => l.id === detalle.id) ?? detalle}
          open
          onOpenChange={(v) => !v && setDetalle(null)}
        />
      )}

      {dialogoConfirmacion}
    </div>
  );
}

/** Tarjeta de una lista: lo que el equipo ve y pulsa durante el servicio. */
function TarjetaLista({
  lista,
  puedeGestionar,
  onPlay,
  onFavorita,
  onAbrir,
  onBorrar,
}: {
  lista: ListaMusica;
  puedeGestionar: boolean;
  onPlay: () => void;
  onFavorita: () => void;
  onAbrir: () => void;
  onBorrar: () => void;
}) {
  const bloqueada = !lista.disponibleAhora;
  const vacia = lista.canciones.length === 0;

  return (
    <Card className={bloqueada ? "opacity-70" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{lista.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {lista.canciones.length === 1
                ? "1 canción"
                : `${lista.canciones.length} canciones`}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onFavorita}
            title={lista.favorita ? "Quitar de favoritas" : "Marcar como favorita"}
            aria-label={lista.favorita ? "Quitar de favoritas" : "Marcar como favorita"}
          >
            <Star
              className={`h-4 w-4 ${lista.favorita ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
            />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {lista.etiqueta && (
            <Badge variant="secondary" className="text-[10px]">
              {lista.etiqueta}
            </Badge>
          )}
          {lista.sinHorario ? (
            <Badge variant="outline" className="text-[10px]">
              Siempre disponible
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="h-3 w-3" />
              {lista.horarios.map((h) => `${h.horaInicio}–${h.horaFin}`).join(", ") ||
                "Sin franjas"}
            </Badge>
          )}
        </div>

        {/*
          Fuera de horario el Play no se puede pulsar y se dice CUÁNDO sí puede
          sonar: un botón muerto sin explicación se lee como una avería.
        */}
        {bloqueada && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <Lock className="h-3 w-3 shrink-0" />
            {lista.motivoBloqueo ?? "Fuera de horario"}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="flex-1"
            onClick={onPlay}
            disabled={bloqueada || vacia}
            title={
              bloqueada
                ? lista.motivoBloqueo ?? "Fuera de horario"
                : vacia
                  ? "Esta lista no tiene canciones"
                  : "Reproducir"
            }
          >
            <Play className="h-4 w-4 mr-1.5" />
            Reproducir
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onAbrir}
            title="Ver canciones y horarios"
          >
            <ListMusic className="h-4 w-4" />
          </Button>

          {puedeGestionar && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBorrar}
              title="Eliminar lista"
              aria-label="Eliminar lista"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
