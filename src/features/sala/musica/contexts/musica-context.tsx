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
 * LA MÚSICA ES POR LOCAL, NO POR EMPRESA. Una empresa con dos locales necesita
 * dos músicas sonando a la vez, aunque usen la misma lista: el restaurante puede
 * ir por la canción 3 y la coctelería por la 7. Cada local tiene su propia fila
 * de estado y su propio equipo de altavoces.
 *
 * MODO ALTAVOZ: el ordenador conectado a los altavoces de un local se marca una
 * vez. Solo ESE navegador tiene audio real; los demás son mandos a distancia —
 * pintan lo que suena y envían órdenes, pero no reproducen nada. Y solo puede
 * haber uno por local: dos equipos sonando a la vez con unos segundos de desfase
 * es peor que no tener música.
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
  listLocales,
  getUrlsLista,
  enviarComando,
  getEstadoReproductor,
  marcarComoReproductor,
  latidoReproductor,
  liberarReproductor,
} from "@/features/sala/musica/actions/musica-actions";
import type {
  ListaMusica,
  Cancion,
  LocalMusica,
} from "@/features/sala/musica/types";

/** Clave de localStorage: en qué local es altavoz este navegador (id del local). */
const CLAVE_LOCAL_ALTAVOZ = "bh_musica_altavoz_local";
/** Clave de localStorage: último local elegido en el selector. */
const CLAVE_LOCAL_ELEGIDO = "bh_musica_local";
/** Clave de localStorage: el usuario cerró el mini reproductor a mano. */
const CLAVE_MINI_OCULTO = "bh_musica_mini_oculto";

/** Cada cuánto el equipo de altavoces avisa de que sigue vivo. */
const MS_LATIDO = 60_000;

interface MusicaContextValue {
  listas: ListaMusica[];
  biblioteca: Cancion[];
  cargando: boolean;
  puedeGestionar: boolean;
  uso: { bytesUsados: number; bytesLimite: number };
  recargar: () => Promise<void>;

  /** Locales de la empresa; cada uno con su música independiente. */
  locales: LocalMusica[];
  /** Local que se está viendo/controlando ahora mismo. */
  localId: string | null;
  setLocalId: (id: string) => void;

  listaActual: ListaMusica | null;
  cancionActual: Cancion | null;
  reproduciendo: boolean;
  volumen: number;

  /** ¿Este navegador es el altavoz DEL LOCAL seleccionado? */
  esAltavoz: boolean;
  /** Nombre del equipo que hace de altavoz en este local (si lo hay). */
  altavozNombre: string | null;
  /**
   * Activa o desactiva el modo altavoz. Si ya hay otro equipo vivo, no lo releva
   * por su cuenta: devuelve `ocupadoPor` para que la pantalla pregunte primero.
   * Con `forzar` toma el relevo.
   */
  activarModoAltavoz: (
    activar: boolean,
    forzar?: boolean,
  ) => Promise<{ ok: boolean; ocupadoPor?: string }>;

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

  const [locales, setLocales] = useState<LocalMusica[]>([]);
  const [localId, setLocalIdState] = useState<string | null>(null);

  const [listaActual, setListaActual] = useState<ListaMusica | null>(null);
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [volumen, setVolumen] = useState(70);
  const [localAltavoz, setLocalAltavoz] = useState<string | null>(null);
  const [altavozNombre, setAltavozNombre] = useState<string | null>(null);
  const [miniCerrado, setMiniCerrado] = useState(false);

  // El elemento de audio se crea a mano (no en el árbol de React) para que no
  // dependa de que ningún componente concreto siga montado.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<Record<string, string>>({});
  const listasRef = useRef<ListaMusica[]>([]);
  const ultimoSeqRef = useRef(0);

  /*
    Volumen: hasta cuándo NO hacer caso a lo que llega de la BD.

    Arrastrar la barra escribía el volumen en la base de datos, ese valor volvía
    por realtime y pisaba la posición donde el usuario tenía el dedo: la barra
    saltaba sola arriba y abajo mientras se movía.

    Durante los 2 s siguientes a tocarla, manda lo que hace el usuario aquí y se
    ignoran los ecos. Pasado ese rato vuelve a obedecer a la BD, para que un
    cambio hecho desde otro equipo sí se refleje.
  */
  const volumenLocalHastaRef = useRef(0);
  /** Escritura de volumen aplazada, para no mandar una por cada píxel movido. */
  const volumenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancionActual = listaActual?.canciones[indice] ?? null;
  // Este navegador solo es altavoz del local que está mirando.
  const esAltavoz = Boolean(localId && localAltavoz === localId);

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
    Locales de la empresa + local elegido por defecto.

    NO se condiciona a `empresaId`: ese valor viene de `empresaActual.dbId`, que
    solo existe cuando la empresa se ha hidratado desde la BD. Si tardaba o no
    llegaba, los locales no se cargaban NUNCA, `localId` se quedaba vacío y al
    pulsar Play saltaba "Elige primero el local" — sin selector donde elegirlo,
    porque con un solo local está oculto a propósito. Bloqueo total.

    El servidor ya sabe cuál es la empresa activa (cookie del selector), así que
    la acción se puede pedir directamente. `empresaId` queda solo como disparador
    para recargar al cambiar de empresa.
  */
  useEffect(() => {
    void (async () => {
      const res = await listLocales();
      if (!res.ok) return;
      setLocales(res.locales);

      let guardado: string | null = null;
      try {
        guardado = localStorage.getItem(CLAVE_LOCAL_ELEGIDO);
      } catch {
        /* sin localStorage: se elige el primero */
      }
      // El guardado solo vale si sigue perteneciendo a esta empresa (al cambiar
      // de empresa, el local anterior ya no existe aquí).
      const valido = res.locales.some((l) => l.id === guardado);
      setLocalIdState(valido ? guardado : (res.locales[0]?.id ?? null));
    })();
  }, [empresaId]);

  const setLocalId = useCallback((id: string) => {
    setLocalIdState(id);
    try {
      localStorage.setItem(CLAVE_LOCAL_ELEGIDO, id);
    } catch {
      /* sin localStorage: la elección dura solo esta sesión */
    }
    // Al cambiar de local se limpia lo que se estaba pintando: el estado del
    // nuevo local llega enseguida y mientras tanto no debe verse el del otro.
    setListaActual(null);
    setIndice(0);
    setReproduciendo(false);
    ultimoSeqRef.current = 0;
  }, []);

  /*
    La disponibilidad depende de la HORA, así que una lista bloqueada se
    desbloquea sola al entrar en su franja. Sin este refresco, quien dejara la
    pantalla abierta a las 12:55 seguiría viendo "Comidas" bloqueada a las 13:05.
  */
  useEffect(() => {
    const t = setInterval(() => void recargar(), 60_000);
    return () => clearInterval(t);
  }, [recargar]);

  // ─── Modo altavoz ─────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      setLocalAltavoz(localStorage.getItem(CLAVE_LOCAL_ALTAVOZ));
      setMiniCerrado(localStorage.getItem(CLAVE_MINI_OCULTO) === "1");
    } catch {
      /* almacenamiento bloqueado: se queda como mando a distancia */
    }
  }, []);

  const activarModoAltavoz = useCallback(
    async (activar: boolean, forzar = false) => {
      if (!localId) return { ok: false };
      const deviceId = getDeviceId() ?? "sin-id";

      if (!activar) {
        await liberarReproductor(localId, deviceId);
        setLocalAltavoz(null);
        try {
          localStorage.removeItem(CLAVE_LOCAL_ALTAVOZ);
        } catch {
          /* sin localStorage */
        }
        // Al dejar de ser altavoz se calla: si no, seguiría sonando aquí además
        // de en el equipo que tome el relevo.
        audioRef.current?.pause();
        setReproduciendo(false);
        return { ok: true };
      }

      const res = await marcarComoReproductor({
        localId,
        deviceId,
        deviceNombre: navigator.userAgent.slice(0, 60),
        forzar,
      });

      // Ya hay otro equipo vivo: no se releva sin preguntar.
      if (!res.ok && res.ocupadoPor) {
        return { ok: false, ocupadoPor: res.ocupadoPor };
      }
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo activar este equipo");
        return { ok: false };
      }

      setLocalAltavoz(localId);
      try {
        localStorage.setItem(CLAVE_LOCAL_ALTAVOZ, localId);
      } catch {
        /* sin localStorage: el modo dura solo esta sesión */
      }
      return { ok: true };
    },
    [localId],
  );

  // Señal de vida mientras este equipo sea el altavoz. Sin ella, un ordenador
  // apagado seguiría constando como altavoz del local para siempre.
  useEffect(() => {
    if (!esAltavoz || !localId) return;
    const deviceId = getDeviceId() ?? "sin-id";
    void latidoReproductor(localId, deviceId);
    const t = setInterval(() => {
      void latidoReproductor(localId, deviceId);
    }, MS_LATIDO);
    return () => clearInterval(t);
  }, [esAltavoz, localId]);

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
      // El volumen NO se pisa si el usuario acaba de tocar la barra: sería su
      // propio eco volviendo y la barra saltaría mientras la arrastra.
      if (Date.now() >= volumenLocalHastaRef.current) setVolumen(vol);
      setReproduciendo(Boolean(fila.reproduciendo));
      setAltavozNombre((fila.device_nombre as string | null) ?? null);

      // Si otro equipo ha tomado el relevo, este deja de ser altavoz y se calla.
      const deviceFila = (fila.device_id as string | null) ?? null;
      const miId = getDeviceId();
      if (miId && deviceFila && deviceFila !== miId) {
        setLocalAltavoz((prev) => {
          if (prev === null) return prev;
          audioRef.current?.pause();
          try {
            localStorage.removeItem(CLAVE_LOCAL_ALTAVOZ);
          } catch {
            /* sin localStorage */
          }
          return null;
        });
      }

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

  // Se escucha SOLO la fila del local seleccionado: si se escuchara toda la
  // empresa, el estado de un local pisaría al del otro.
  useEffect(() => {
    if (!localId) return;
    const supabase = createClient();
    const canal = supabase
      .channel(`musica-local-${localId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "musica_reproductor",
          filter: `local_id=eq.${localId}`,
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
  }, [localId, aplicarEstadoRemoto]);

  // Al abrir la app (o al cambiar de local), recupera lo que ya estuviera
  // sonando en ese local.
  useEffect(() => {
    if (!localId) return;
    void (async () => {
      const res = await getEstadoReproductor(localId);
      if (!res.ok || !res.estado) return;
      const e = res.estado;
      ultimoSeqRef.current = e.comandoSeq;
      setIndice(e.indice);
      setVolumen(e.volumen);
      setReproduciendo(e.reproduciendo);
      setAltavozNombre(e.deviceNombre);
      const lista = listasRef.current.find((l) => l.id === e.listaId) ?? null;
      setListaActual(lista);
    })();
  }, [localId, listas.length]);

  // ─── Órdenes (las manda cualquiera, incluido el propio altavoz) ───────────

  const reproducirLista = useCallback(
    async (lista: ListaMusica, idxInicial = 0) => {
      if (!localId) {
        // Con los locales ya cargados esto solo pasa si la empresa no tiene
        // ninguno dado de alta. Se dice QUÉ hacer: un "elige el local" a secas
        // deja al usuario buscando un selector que, con un solo local, ni existe.
        toast.error(
          locales.length === 0
            ? "Esta empresa no tiene locales dados de alta. Créalo en Ajustes → Locales."
            : "Elige primero el local",
        );
        return;
      }
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
        localId,
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
    [localId, locales.length, esAltavoz, sonarCancion],
  );

  const alternarPlay = useCallback(async () => {
    if (!listaActual || !localId) return;
    if (reproduciendo) {
      setReproduciendo(false);
      audioRef.current?.pause();
      await enviarComando({ localId, comando: "pause" });
    } else {
      const res = await enviarComando({
        localId,
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
  }, [listaActual, localId, reproduciendo, indice, esAltavoz, sonarCancion]);

  const saltar = useCallback(
    async (delta: number) => {
      if (!listaActual || !localId || listaActual.canciones.length === 0) return;
      const total = listaActual.canciones.length;
      const nuevo = (indice + delta + total) % total;
      setIndice(nuevo);
      await enviarComando({
        localId,
        comando: delta > 0 ? "siguiente" : "anterior",
        listaId: listaActual.id,
        cancionId: listaActual.canciones[nuevo]?.id ?? null,
        indice: nuevo,
      });
      if (esAltavoz) await sonarCancion(listaActual, nuevo);
    },
    [listaActual, localId, indice, esAltavoz, sonarCancion],
  );

  const siguiente = useCallback(() => saltar(1), [saltar]);
  const anterior = useCallback(() => saltar(-1), [saltar]);

  const parar = useCallback(async () => {
    if (!localId) return;
    setReproduciendo(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    await enviarComando({ localId, comando: "stop" });
  }, [localId]);

  const cambiarVolumen = useCallback(
    async (v: number) => {
      if (!localId) return;
      const vol = Math.max(0, Math.min(100, Math.round(v)));

      // Manda lo que hace el usuario: se pinta y se aplica al audio al momento,
      // y durante 2 s se ignora lo que llegue de la BD (sería su propio eco).
      setVolumen(vol);
      volumenLocalHastaRef.current = Date.now() + 2000;
      if (audioRef.current) audioRef.current.volume = vol / 100;

      // Arrastrar la barra dispara decenas de valores. Si cada uno escribiera en
      // la BD, llegarían desordenados y el último en aplicarse podría no ser el
      // que el usuario dejó puesto. Se guarda solo cuando suelta (250 ms sin
      // moverse).
      if (volumenTimerRef.current) clearTimeout(volumenTimerRef.current);
      volumenTimerRef.current = setTimeout(() => {
        void enviarComando({ localId, comando: "volumen", volumen: vol });
      }, 250);
    },
    [localId],
  );

  // Si se cierra la pantalla justo tras mover el volumen, el guardado aplazado
  // se cancela: no debe escribir cuando ya no hay nadie mirando.
  useEffect(() => {
    return () => {
      if (volumenTimerRef.current) clearTimeout(volumenTimerRef.current);
    };
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
        locales,
        localId,
        setLocalId,
        listaActual,
        cancionActual,
        reproduciendo,
        volumen,
        esAltavoz,
        altavozNombre,
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
