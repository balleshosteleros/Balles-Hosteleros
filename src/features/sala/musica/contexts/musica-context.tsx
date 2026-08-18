"use client";

/**
 * Estado de la música, compartido por toda la aplicación.
 *
 * Vive en el layout (no en la vista de Sala → Música) por dos motivos:
 *
 *  1. La música NO puede parar al cambiar de pantalla. Si el `<audio>` viviera
 *     dentro de la vista, navegar a Reservas la desmontaría y el local se
 *     quedaría en silencio a media canción.
 *
 *  2. El mini reproductor de la barra superior necesita el mismo estado que la
 *     pantalla grande. Con un único contexto, los dos miran la misma verdad y no
 *     hay forma de que se desincronicen.
 *
 * MODO ALTAVOZ: el ordenador conectado a los altavoces se marca una vez como
 * reproductor del local. Solo ESE navegador tiene audio real; los demás son
 * mandos a distancia — pintan lo que suena y envían órdenes, pero no reproducen
 * nada (si no, la misma canción sonaría a la vez en cinco sitios distintos).
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getDeviceId } from "@/features/mi-panel/mobile/lib/push-client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listMusica,
  getUrlsLista,
  enviarComando,
  getEstadoReproductor,
  marcarComoReproductor,
} from "@/features/sala/musica/actions/musica-actions";
import type { ListaMusica, Cancion } from "@/features/sala/musica/types";

/** Clave de localStorage: ¿este navegador es el equipo de los altavoces? */
const CLAVE_MODO_ALTAVOZ = "bh_musica_altavoz";
/** Clave de localStorage: el usuario cerró el mini reproductor a mano. */
const CLAVE_MINI_OCULTO = "bh_musica_mini_oculto";

interface MusicaContextValue {
  listas: ListaMusica[];
  biblioteca: Cancion[];
  cargando: boolean;
  puedeGestionar: boolean;
  uso: { bytesUsados: number; bytesLimite: number };
  recargar: () => Promise<void>;

  listaActual: ListaMusica | null;
  cancionActual: Cancion | null;
  reproduciendo: boolean;
  volumen: number;

  /** ¿Este navegador es el que está conectado a los altavoces? */
  esAltavoz: boolean;
  activarModoAltavoz: (activar: boolean) => Promise<void>;

  reproducirLista: (lista: ListaMusica, indice?: number) => Promise<void>;
  alternarPlay: () => Promise<void>;
  siguiente: () => Promise<void>;
  anterior: () => Promise<void>;
  parar: () => Promise<void>;
  cambiarVolumen: (v: number) => Promise<void>;

  /** El mini reproductor solo se ve si hay música activa y no se cerró. */
  miniVisible: boolean;
  cerrarMini: () => void;
}

const MusicaContext = createContext<MusicaContextValue | null>(null);

export function MusicaProvider({ children }: { children: ReactNode }) {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.dbId ?? null;

  const [listas, setListas] = useState<ListaMusica[]>([]);
  const [biblioteca, setBiblioteca] = useState<Cancion[]>([]);
  const [uso, setUso] = useState({ bytesUsados: 0, bytesLimite: 5 * 1024 ** 3 });
  const [puedeGestionar, setPuedeGestionar] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [listaActual, setListaActual] = useState<ListaMusica | null>(null);
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [volumen, setVolumen] = useState(70);
  const [esAltavoz, setEsAltavoz] = useState(false);
  const [miniCerrado, setMiniCerrado] = useState(false);

  // El elemento de audio se crea a mano (no en el árbol de React) para que no
  // dependa de que ningún componente concreto siga montado.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<Record<string, string>>({});
  const listasRef = useRef<ListaMusica[]>([]);
  const ultimoSeqRef = useRef(0);

  const cancionActual = listaActual?.canciones[indice] ?? null;

  useEffect(() => {
    listasRef.current = listas;
  }, [listas]);

  // ─── Carga de datos ───────────────────────────────────────────────────────

  const recargar = useCallback(async () => {
    const res = await listMusica();
    if (res.ok) {
      setListas(res.listas);
      setBiblioteca(res.biblioteca);
      setUso(res.uso);
      setPuedeGestionar(res.puedeGestionar);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar, empresaId]);

  /*
    La disponibilidad depende de la HORA, así que una lista bloqueada se
    desbloquea sola al entrar en su franja. Sin este refresco, quien dejara la
    pantalla abierta a las 12:55 seguiría viendo "Comidas" bloqueada a las 13:05.
    Cada minuto es suficiente y el coste es una consulta ligera.
  */
  useEffect(() => {
    const t = setInterval(() => void recargar(), 60_000);
    return () => clearInterval(t);
  }, [recargar]);

  // ─── Modo altavoz ─────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      setEsAltavoz(localStorage.getItem(CLAVE_MODO_ALTAVOZ) === "1");
      setMiniCerrado(localStorage.getItem(CLAVE_MINI_OCULTO) === "1");
    } catch {
      /* almacenamiento bloqueado: se queda como mando a distancia */
    }
  }, []);

  const activarModoAltavoz = useCallback(async (activar: boolean) => {
    setEsAltavoz(activar);
    try {
      if (activar) localStorage.setItem(CLAVE_MODO_ALTAVOZ, "1");
      else localStorage.removeItem(CLAVE_MODO_ALTAVOZ);
    } catch {
      /* sin localStorage el modo dura solo esta sesión */
    }

    if (activar) {
      const id = getDeviceId() ?? "sin-id";
      await marcarComoReproductor(id, navigator.userAgent.slice(0, 60));
    } else {
      // Al dejar de ser altavoz, se calla: si no, seguiría sonando aquí además
      // de en el equipo que tome el relevo.
      audioRef.current?.pause();
      setReproduciendo(false);
    }
  }, []);

  // ─── Audio real (solo en el equipo de altavoces) ──────────────────────────

  const asegurarAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      el.volume = volumen / 100;
      audioRef.current = el;
    }
    return audioRef.current;
  }, [volumen]);

  /** Carga y suena la canción que toca según lista + índice. */
  const sonarCancion = useCallback(
    async (lista: ListaMusica, idx: number) => {
      if (!esAltavoz) return; // los mandos no reproducen nada
      const cancion = lista.canciones[idx];
      if (!cancion) return;

      let url = urlsRef.current[cancion.id];
      if (!url) {
        const res = await getUrlsLista(lista.id);
        if (res.ok) urlsRef.current = { ...urlsRef.current, ...res.urls };
        url = urlsRef.current[cancion.id];
      }
      if (!url) {
        toast.error(`No se pudo cargar «${cancion.titulo}»`);
        return;
      }

      const el = asegurarAudio();
      el.src = url;
      el.volume = volumen / 100;
      try {
        await el.play();
        setReproduciendo(true);
      } catch {
        // Los navegadores bloquean el audio hasta que el usuario interactúa con
        // la página. Se avisa en vez de fallar en silencio.
        setReproduciendo(false);
        toast.error("El navegador bloqueó el sonido. Pulsa Play otra vez.");
      }
    },
    [esAltavoz, asegurarAudio, volumen],
  );

  // Al acabar una canción, pasa sola a la siguiente y vuelve a empezar al final
  // de la lista: la música no debe pararse durante el servicio.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      setIndice((prev) => {
        const lista = listaActual;
        if (!lista || lista.canciones.length === 0) return prev;
        const siguiente = (prev + 1) % lista.canciones.length;
        void sonarCancion(lista, siguiente);
        return siguiente;
      });
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [listaActual, sonarCancion]);

  // ─── Realtime: el equipo de altavoces obedece las órdenes ─────────────────

  useEffect(() => {
    if (!empresaId) return;
    const supabase = createClient();
    const canal = supabase
      .channel(`musica-${empresaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "musica_reproductor",
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { new: unknown }) => {
          const fila = payload.new as Record<string, unknown> | null;
          if (!fila) return;
          aplicarEstadoRemoto(fila);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, esAltavoz]);

  /**
   * Refleja el estado que viene de la BD. En el equipo de altavoces, además,
   * EJECUTA la orden. `comando_seq` evita reaccionar dos veces a lo mismo (y
   * que el propio equipo obedezca el eco de su escritura).
   */
  const aplicarEstadoRemoto = useCallback(
    (fila: Record<string, unknown>) => {
      const seq = Number(fila.comando_seq ?? 0);
      const listaId = (fila.lista_id as string | null) ?? null;
      const idx = Number(fila.indice ?? 0);
      const vol = Number(fila.volumen ?? 70);
      const comando = (fila.comando as string | null) ?? null;

      const lista = listasRef.current.find((l) => l.id === listaId) ?? null;

      // Todos (altavoz y mandos) pintan lo mismo.
      setListaActual(lista);
      setIndice(idx);
      setVolumen(vol);
      setReproduciendo(Boolean(fila.reproduciendo));

      // Una orden nueva reabre el mini reproductor aunque alguien lo cerrara.
      if (seq > ultimoSeqRef.current && comando === "play") {
        setMiniCerrado(false);
        try {
          localStorage.removeItem(CLAVE_MINI_OCULTO);
        } catch {
          /* sin localStorage: el mini se comporta igual esta sesión */
        }
      }

      if (!esAltavoz || seq <= ultimoSeqRef.current) {
        ultimoSeqRef.current = Math.max(ultimoSeqRef.current, seq);
        return;
      }
      ultimoSeqRef.current = seq;

      const el = audioRef.current;
      switch (comando) {
        case "play":
          if (lista) void sonarCancion(lista, idx);
          break;
        case "pause":
          el?.pause();
          break;
        case "siguiente":
        case "anterior":
          if (lista) void sonarCancion(lista, idx);
          break;
        case "stop":
          if (el) {
            el.pause();
            el.currentTime = 0;
          }
          break;
        case "volumen":
          if (el) el.volume = vol / 100;
          break;
      }
    },
    [esAltavoz, sonarCancion],
  );

  // Al abrir la app, recupera lo que ya estuviera sonando en el local.
  useEffect(() => {
    if (!empresaId) return;
    void (async () => {
      const res = await getEstadoReproductor();
      if (!res.ok || !res.estado) return;
      const e = res.estado;
      ultimoSeqRef.current = e.comandoSeq;
      setIndice(e.indice);
      setVolumen(e.volumen);
      setReproduciendo(e.reproduciendo);
      const lista = listasRef.current.find((l) => l.id === e.listaId) ?? null;
      setListaActual(lista);
    })();
  }, [empresaId, listas.length]);

  // ─── Órdenes (las manda cualquiera, incluido el propio altavoz) ───────────

  const reproducirLista = useCallback(
    async (lista: ListaMusica, idxInicial = 0) => {
      if (!lista.disponibleAhora) {
        toast.error(lista.motivoBloqueo ?? "Esta lista está fuera de su horario");
        return;
      }
      if (lista.canciones.length === 0) {
        toast.error("Esta lista todavía no tiene canciones");
        return;
      }

      // Se pinta ya (sin esperar al servidor) para que el botón responda al
      // instante; si el servidor rechaza, se revierte con el aviso.
      setListaActual(lista);
      setIndice(idxInicial);
      setMiniCerrado(false);
      try {
        localStorage.removeItem(CLAVE_MINI_OCULTO);
      } catch {
        /* sin localStorage */
      }

      const res = await enviarComando({
        comando: "play",
        listaId: lista.id,
        cancionId: lista.canciones[idxInicial]?.id ?? null,
        indice: idxInicial,
      });
      if (!res.ok) {
        setReproduciendo(false);
        toast.error(res.error ?? "No se pudo iniciar la música");
        return;
      }
      setReproduciendo(true);
      if (esAltavoz) await sonarCancion(lista, idxInicial);
    },
    [esAltavoz, sonarCancion],
  );

  const alternarPlay = useCallback(async () => {
    if (!listaActual) return;
    if (reproduciendo) {
      setReproduciendo(false);
      audioRef.current?.pause();
      await enviarComando({ comando: "pause" });
    } else {
      const res = await enviarComando({
        comando: "play",
        listaId: listaActual.id,
        indice,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo reanudar");
        return;
      }
      setReproduciendo(true);
      // Si el audio ya tenía la canción cargada, se reanuda donde estaba en vez
      // de empezarla otra vez desde el principio.
      const el = audioRef.current;
      if (esAltavoz && el?.src) {
        void el.play().catch(() => setReproduciendo(false));
      } else if (esAltavoz) {
        await sonarCancion(listaActual, indice);
      }
    }
  }, [listaActual, reproduciendo, indice, esAltavoz, sonarCancion]);

  const saltar = useCallback(
    async (delta: number) => {
      if (!listaActual || listaActual.canciones.length === 0) return;
      const total = listaActual.canciones.length;
      const nuevo = (indice + delta + total) % total;
      setIndice(nuevo);
      await enviarComando({
        comando: delta > 0 ? "siguiente" : "anterior",
        listaId: listaActual.id,
        cancionId: listaActual.canciones[nuevo]?.id ?? null,
        indice: nuevo,
      });
      if (esAltavoz) await sonarCancion(listaActual, nuevo);
    },
    [listaActual, indice, esAltavoz, sonarCancion],
  );

  const siguiente = useCallback(() => saltar(1), [saltar]);
  const anterior = useCallback(() => saltar(-1), [saltar]);

  const parar = useCallback(async () => {
    setReproduciendo(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    await enviarComando({ comando: "stop" });
  }, []);

  const cambiarVolumen = useCallback(async (v: number) => {
    const vol = Math.max(0, Math.min(100, Math.round(v)));
    setVolumen(vol);
    if (audioRef.current) audioRef.current.volume = vol / 100;
    await enviarComando({ comando: "volumen", volumen: vol });
  }, []);

  const cerrarMini = useCallback(() => {
    setMiniCerrado(true);
    try {
      localStorage.setItem(CLAVE_MINI_OCULTO, "1");
    } catch {
      /* sin localStorage: se oculta solo esta sesión */
    }
  }, []);

  // El mini solo existe si hay reproducción activa y nadie lo cerró.
  const miniVisible = Boolean(listaActual && cancionActual) && !miniCerrado;

  return (
    <MusicaContext.Provider
      value={{
        listas,
        biblioteca,
        cargando,
        puedeGestionar,
        uso,
        recargar,
        listaActual,
        cancionActual,
        reproduciendo,
        volumen,
        esAltavoz,
        activarModoAltavoz,
        reproducirLista,
        alternarPlay,
        siguiente,
        anterior,
        parar,
        cambiarVolumen,
        miniVisible,
        cerrarMini,
      }}
    >
      {children}
    </MusicaContext.Provider>
  );
}

export function useMusica(): MusicaContextValue {
  const ctx = useContext(MusicaContext);
  if (!ctx) {
    throw new Error("useMusica debe usarse dentro de MusicaProvider");
  }
  return ctx;
}

/**
 * Variante segura para la barra superior: si el proveedor no está montado
 * (pantallas públicas, login…), devuelve null en vez de romper la app entera.
 */
export function useMusicaOpcional(): MusicaContextValue | null {
  return useContext(MusicaContext);
}
