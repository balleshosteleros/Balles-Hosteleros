"use client";

/**
 * PRP-087 · Fases 3 y 4 — El Administrador de anuncios dentro del software.
 *
 * Un árbol de tres niveles, como en Meta:
 *   Campaña  →  qué se quiere conseguir y con cuánto dinero
 *     Conjunto  →  a quién, dónde (Facebook / Instagram) y cuándo
 *       Anuncio  →  qué se le enseña (imagen, vídeo o carrusel)
 *
 * Sale TODO lo de la cuenta publicitaria, también lo que se haya creado
 * directamente en Meta: el objetivo es que no quede publicidad invisible.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Play,
  Pause,
  RefreshCw,
  Layers,
  Megaphone,
  Image as ImagenIcono,
  Video,
  GalleryHorizontal,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getArbolMetaAction,
  refrescarMetaAction,
  type ArbolMeta,
  type CampanaArbol,
  type ConjuntoArbol,
  type AnuncioArbol,
  type NumerosNivel,
} from "@/features/marketing/meta-ads/actions/lectura-actions";
import { cambiarEstadoMetaAction } from "@/features/marketing/meta-ads/actions/escritura-actions";
import { AsistenteCampana } from "@/features/marketing/meta-ads/components/AsistenteCampana";
import { centimosAEuros } from "@/features/marketing/meta-ads/lib/meta-api";
import {
  SubmoduleToolbar,
  type ToolbarFiltroActivo,
} from "@/shared/components/SubmoduleToolbar";

/** Estados de Meta en cristiano. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  ACTIVE: { texto: "Activa", clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  PAUSED: { texto: "En pausa", clase: "bg-muted text-muted-foreground" },
  ARCHIVED: { texto: "Archivada", clase: "bg-muted text-muted-foreground" },
  DELETED: { texto: "Borrada", clase: "bg-muted text-muted-foreground" },
  IN_PROCESS: { texto: "Procesando", clase: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  WITH_ISSUES: { texto: "Con incidencia", clase: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  PENDING_REVIEW: { texto: "En revisión", clase: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  DISAPPROVED: { texto: "Rechazada", clase: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  CAMPAIGN_PAUSED: { texto: "Campaña en pausa", clase: "bg-muted text-muted-foreground" },
  ADSET_PAUSED: { texto: "Conjunto en pausa", clase: "bg-muted text-muted-foreground" },
};

const OBJETIVOS_LEGIBLES: Record<string, string> = {
  OUTCOME_AWARENESS: "Que me conozcan",
  OUTCOME_TRAFFIC: "Visitas a la web",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_LEADS: "Conseguir contactos",
  OUTCOME_SALES: "Reservas y ventas",
  OUTCOME_APP_PROMOTION: "Promoción de app",
};

function EtiquetaEstado({ estado, efectivo }: { estado: string | null; efectivo: string | null }) {
  // Manda el estado EFECTIVO: una campaña "activa" puede estar frenada por la
  // cuenta o en revisión, y enseñar solo "activa" haría creer que está saliendo.
  const clave = efectivo && efectivo !== estado ? efectivo : estado;
  const info = clave ? ESTADOS[clave] : null;
  if (!info) return <Badge variant="outline" className="text-[10px]">{clave ?? "—"}</Badge>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${info.clase}`}>{info.texto}</span>;
}

const ICONO_FORMATO: Record<string, React.ElementType> = {
  imagen: ImagenIcono,
  video: Video,
  carrusel: GalleryHorizontal,
};

/** Los números de una fila, siempre en el mismo orden para poder compararlos. */
function Numeros({ n, moneda }: { n: NumerosNivel; moneda: string }) {
  const simbolo = moneda === "EUR" ? "€" : moneda;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
      <div>
        <span className="text-muted-foreground">Gasto </span>
        <span className="font-semibold">{centimosAEuros(n.gastoCent)} {simbolo}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Veces visto </span>
        <span className="font-semibold">{n.impresiones.toLocaleString("es-ES")}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Clics </span>
        <span className="font-semibold">{n.clics.toLocaleString("es-ES")}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Coste por resultado </span>
        <span className="font-semibold">
          {n.costeResultadoCent != null ? `${centimosAEuros(n.costeResultadoCent)} ${simbolo}` : "—"}
        </span>
      </div>
    </div>
  );
}

export function MetaAdsView() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id;
  const { confirm, dialog } = useConfirmDelete();

  const [datos, setDatos] = useState<ArbolMeta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);

  /** Recarga a mano (tras activar, pausar o refrescar). */
  const cargar = useCallback(async () => {
    const res = await getArbolMetaAction();
    if (res.ok) setDatos(res.data);
    else toast.error(res.error);
  }, []);

  // Carga inicial y cada vez que se cambia de empresa: la publicidad de HABANA
  // no es la de BACANAL. `vivo` evita pintar la respuesta de la empresa anterior
  // si se cambia rápido de una a otra.
  useEffect(() => {
    let vivo = true;
    getArbolMetaAction().then((res) => {
      if (!vivo) return;
      if (res.ok) setDatos(res.data);
      else toast.error(res.error);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  const refrescar = async () => {
    setRefrescando(true);
    const res = await refrescarMetaAction();
    setRefrescando(false);
    if (res.ok) {
      toast.success(
        `Actualizado desde Meta: ${res.data.campanas} campañas, ${res.data.conjuntos} conjuntos y ${res.data.anuncios} anuncios.`,
      );
      void cargar();
    } else {
      toast.error(res.error);
    }
  };

  const alternar = (id: string) => {
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.add(id);
      return nuevas;
    });
  };

  /**
   * Activar pide confirmación siempre, porque empieza a gastar dinero de
   * verdad. Pausar no la pide: parar de gastar tiene que ser inmediato.
   */
  const cambiarEstado = async (
    nivel: "campana" | "conjunto" | "anuncio",
    metaId: string,
    nombre: string,
    activar: boolean,
  ) => {
    if (activar) {
      const ok = await confirm({
        tono: "normal",
        title: "Activar y empezar a gastar",
        description: `«${nombre}» empezará a mostrarse y a gastar del presupuesto de tu cuenta de Meta. ¿Lo activo?`,
        confirmLabel: "Aceptar",
      });
      if (!ok) return;
    }

    setCambiando(metaId);
    const res = await cambiarEstadoMetaAction({
      nivel,
      metaId,
      estado: activar ? "ACTIVE" : "PAUSED",
      confirmado: activar,
    });
    setCambiando(null);

    if (res.ok) {
      toast.success(activar ? "Activada en Meta." : "Pausada en Meta.");
      if (res.data.avisoGasto) toast.warning(res.data.avisoGasto);
      void cargar();
    } else {
      toast.error(res.error);
    }
  };

  const campanasFiltradas = useMemo(() => {
    if (!datos) return [];
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return datos.campanas;
    // Busca también dentro: una campaña se queda si alguno de sus conjuntos o
    // anuncios encaja, porque si no, buscar el nombre de un anuncio no daría nada.
    return datos.campanas.filter((c) => {
      if (c.nombre.toLowerCase().includes(texto)) return true;
      return c.conjuntos.some(
        (s) =>
          s.nombre.toLowerCase().includes(texto) ||
          s.anuncios.some((a) => a.nombre.toLowerCase().includes(texto)),
      );
    });
  }, [datos, busqueda]);

  if (cargando) return <LoadingSpinner size="lg" className="py-16" />;

  if (!datos?.conectado) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="mb-4 text-xl font-bold tracking-tight">Publicidad en Facebook e Instagram</h1>
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Meta todavía no está conectado</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Conecta la cuenta publicitaria de {empresaActual?.nombre} en Ajustes → Integraciones → Meta.
            Después verás aquí todos tus anuncios de Facebook e Instagram, aunque los hayas creado desde Meta.
          </p>
        </div>
      </div>
    );
  }

  const { gasto, moneda } = datos;
  const porcentaje =
    gasto.topeCent && gasto.topeCent > 0
      ? Math.min(100, Math.round((gasto.gastadoCent / gasto.topeCent) * 100))
      : 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Publicidad en Facebook e Instagram</h1>
        <p className="text-sm text-muted-foreground">
          {datos.nombreCuenta ? `${datos.nombreCuenta} · ` : ""}Últimos 30 días
        </p>
      </div>

      {/* Gasto del mes contra el tope: siempre visible, aunque falte mucho. */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Gasto de este mes</p>
          <p className="text-sm">
            <span className="font-bold">{centimosAEuros(gasto.gastadoCent)} €</span>
            {gasto.topeCent != null && (
              <span className="text-muted-foreground"> de {centimosAEuros(gasto.topeCent)} € de tope</span>
            )}
          </p>
        </div>
        {gasto.topeCent != null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                gasto.bloqueado ? "bg-red-500" : porcentaje > 80 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        )}
        {gasto.bloqueado && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Tope del mes alcanzado. No se pueden activar campañas nuevas hasta el mes que viene o hasta que
              subas el tope en Ajustes → Integraciones → Meta. Lo que ya está en marcha sigue funcionando.
            </p>
          </div>
        )}
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        filtros={filtros}
        onFiltrosChange={setFiltros}
        onNuevo={() => setAsistenteAbierto(true)}
        extraDerecha={
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={refrescar}
            disabled={refrescando}
            title="Actualizar desde Meta"
            aria-label="Actualizar desde Meta"
          >
            <RefreshCw className={`h-4 w-4 ${refrescando ? "animate-spin" : ""}`} strokeWidth={1.75} />
          </Button>
        }
      />

      {campanasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            {busqueda ? "No hay nada que coincida con la búsqueda" : "Esta cuenta no tiene campañas todavía"}
          </p>
          {!busqueda && (
            <Button size="sm" className="mt-4" onClick={() => setAsistenteAbierto(true)}>
              Crear la primera campaña
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {campanasFiltradas.map((campana) => (
            <FilaCampana
              key={campana.metaId}
              campana={campana}
              moneda={moneda}
              abiertas={abiertas}
              onAlternar={alternar}
              onCambiarEstado={cambiarEstado}
              cambiando={cambiando}
            />
          ))}
        </div>
      )}

      <AsistenteCampana
        abierto={asistenteAbierto}
        onCerrar={() => setAsistenteAbierto(false)}
        onCreada={() => void cargar()}
        hayInstagram={datos.hayInstagram}
      />

      {dialog}
    </div>
  );
}

// ─── Nivel 1: campaña ───────────────────────────────────────────────

interface PropsCambio {
  onCambiarEstado: (
    nivel: "campana" | "conjunto" | "anuncio",
    metaId: string,
    nombre: string,
    activar: boolean,
  ) => void;
  cambiando: string | null;
}

function BotonEstado({
  nivel,
  metaId,
  nombre,
  estado,
  onCambiarEstado,
  cambiando,
}: PropsCambio & { nivel: "campana" | "conjunto" | "anuncio"; metaId: string; nombre: string; estado: string | null }) {
  const activa = estado === "ACTIVE";
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5"
      disabled={cambiando === metaId}
      onClick={(e) => {
        e.stopPropagation();
        onCambiarEstado(nivel, metaId, nombre, !activa);
      }}
    >
      {activa ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {activa ? "Pausar" : "Activar"}
    </Button>
  );
}

function FilaCampana({
  campana,
  moneda,
  abiertas,
  onAlternar,
  onCambiarEstado,
  cambiando,
}: PropsCambio & {
  campana: CampanaArbol;
  moneda: string;
  abiertas: Set<string>;
  onAlternar: (id: string) => void;
}) {
  const abierta = abiertas.has(campana.metaId);

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => onAlternar(campana.metaId)}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40"
      >
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierta ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{campana.nombre}</span>
            <EtiquetaEstado estado={campana.estado} efectivo={campana.estadoEfectivo} />
            {campana.creadaEnSoftware && (
              <Badge variant="secondary" className="text-[10px]">Creada aquí</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {campana.objetivo ? OBJETIVOS_LEGIBLES[campana.objetivo] ?? campana.objetivo : "Sin objetivo"}
            {campana.presupuestoDiarioCent
              ? ` · ${centimosAEuros(campana.presupuestoDiarioCent)} € al día`
              : campana.presupuestoTotalCent
                ? ` · ${centimosAEuros(campana.presupuestoTotalCent)} € en total`
                : ""}
            {` · ${campana.conjuntos.length} conjunto(s)`}
          </p>
          <Numeros n={campana.numeros} moneda={moneda} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <BotonEstado
            nivel="campana"
            metaId={campana.metaId}
            nombre={campana.nombre}
            estado={campana.estado}
            onCambiarEstado={onCambiarEstado}
            cambiando={cambiando}
          />
        </div>
      </button>

      {abierta && (
        <div className="space-y-2 border-t bg-muted/20 p-3">
          {campana.conjuntos.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Esta campaña no tiene conjuntos de anuncios.
            </p>
          ) : (
            campana.conjuntos.map((conjunto) => (
              <FilaConjunto
                key={conjunto.metaId}
                conjunto={conjunto}
                moneda={moneda}
                abiertas={abiertas}
                onAlternar={onAlternar}
                onCambiarEstado={onCambiarEstado}
                cambiando={cambiando}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Nivel 2: conjunto de anuncios ──────────────────────────────────

function FilaConjunto({
  conjunto,
  moneda,
  abiertas,
  onAlternar,
  onCambiarEstado,
  cambiando,
}: PropsCambio & {
  conjunto: ConjuntoArbol;
  moneda: string;
  abiertas: Set<string>;
  onAlternar: (id: string) => void;
}) {
  const abierto = abiertas.has(conjunto.metaId);

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => onAlternar(conjunto.metaId)}
        className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/40"
      >
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-90" : ""}`}
        />
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{conjunto.nombre}</span>
            <EtiquetaEstado estado={conjunto.estado} efectivo={conjunto.estadoEfectivo} />
            {/* Dónde sale: esto es lo que responde "¿y en Instagram sale?" */}
            {conjunto.plataformas.map((p) => (
              <Badge key={p} variant="outline" className="text-[10px] capitalize">
                {p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : p}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {conjunto.presupuestoDiarioCent
              ? `${centimosAEuros(conjunto.presupuestoDiarioCent)} € al día`
              : conjunto.presupuestoTotalCent
                ? `${centimosAEuros(conjunto.presupuestoTotalCent)} € en total`
                : "Presupuesto en la campaña"}
            {` · ${conjunto.anuncios.length} anuncio(s)`}
          </p>
          <Numeros n={conjunto.numeros} moneda={moneda} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <BotonEstado
            nivel="conjunto"
            metaId={conjunto.metaId}
            nombre={conjunto.nombre}
            estado={conjunto.estado}
            onCambiarEstado={onCambiarEstado}
            cambiando={cambiando}
          />
        </div>
      </button>

      {abierto && (
        <div className="space-y-2 border-t bg-background/60 p-2">
          {conjunto.anuncios.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Este conjunto no tiene anuncios.</p>
          ) : (
            conjunto.anuncios.map((anuncio) => (
              <FilaAnuncio
                key={anuncio.metaId}
                anuncio={anuncio}
                moneda={moneda}
                onCambiarEstado={onCambiarEstado}
                cambiando={cambiando}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Nivel 3: anuncio ───────────────────────────────────────────────

function FilaAnuncio({
  anuncio,
  moneda,
  onCambiarEstado,
  cambiando,
}: PropsCambio & { anuncio: AnuncioArbol; moneda: string }) {
  const Icono = ICONO_FORMATO[anuncio.formato ?? ""] ?? ImagenIcono;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <Icono className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{anuncio.nombre}</span>
          <EtiquetaEstado estado={anuncio.estado} efectivo={anuncio.estadoEfectivo} />
          {anuncio.formato && (
            <Badge variant="outline" className="text-[10px] capitalize">
              {anuncio.formato === "video" ? "Vídeo" : anuncio.formato}
            </Badge>
          )}
        </div>
        <Numeros n={anuncio.numeros} moneda={moneda} />
        {anuncio.vistaPreviaUrl && (
          <a
            href={anuncio.vistaPreviaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-primary underline underline-offset-2"
          >
            Ver el anuncio
          </a>
        )}
      </div>
      <BotonEstado
        nivel="anuncio"
        metaId={anuncio.metaId}
        nombre={anuncio.nombre}
        estado={anuncio.estado}
        onCambiarEstado={onCambiarEstado}
        cambiando={cambiando}
      />
    </div>
  );
}
