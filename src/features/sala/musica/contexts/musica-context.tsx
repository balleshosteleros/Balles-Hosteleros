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
  avisarCancionEnCurso,
  nombreDeUsuario,
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

/**
 * Reparto al azar de las canciones que quedan por sonar (Fisher-Yates).
 *
 * `yaSonando` se EXCLUYE del reparto, no solo se aparta de la primera
 * posición. Es la diferencia entre un aleatorio bueno y uno que parece
 * estropeado: si la canción en curso siguiera dentro, volvería a salir a mitad
 * de vuelta y otra se quedaría sin sonar en todo el servicio.
 *
 * Devuelve n-1 índices (todos menos el que suena), o el único que hay si la
 * lista tiene una sola canción.
 */
function barajarIndices(n: number, yaSonando: number | null): number[] {
  const arr = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i !== yaSonando,
  );
  if (arr.length === 0) return [0]; // lista de una sola canción: se repite
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Nombre del equipo, para decir en pantalla por dónde está saliendo la música.
 *
 * Antes se guardaban 60 caracteres del `userAgent`, y en pantalla salía
 * «Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/5…», que no dice
 * nada a nadie. Con "Mac · Chrome" al menos se distingue de un iPad, que es lo
 * que hace falta para saber a qué ordenador ir.
 */
function nombreEquipoLegible(): string {
  if (typeof navigator === "undefined") return "Otro equipo";
  const ua = navigator.userAgent;

  const sistema =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "Equipo";

  // El orden importa: Edge y Opera también dicen "Chrome" en su userAgent, y
  // Chrome dice "Safari". Se comprueban los más específicos primero.
  const navegador =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : null;

  return navegador ? `${sistema} · ${navegador}` : sistema;
}

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
  /** Posición de la canción que suena dentro de la lista (para marcarla). */
  indiceActual: number;
  /** Salta directamente a una canción concreta de la lista en curso. */
  irACancion: (indice: number) => Promise<void>;
  reproduciendo: boolean;
  volumen: number;
  /** Si está puesto, al acabar una canción entra otra al azar. */
  aleatorio: boolean;
  alternarAleatorio: () => Promise<void>;

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
  ) => Promise<{
    ok: boolean;
    ocupadoPor?: string;
    ocupadoPorUsuario?: string;
    sonando?: boolean;
  }>;

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
  const [aleatorio, setAleatorio] = useState(false);
  const [localAltavoz, setLocalAltavoz] = useState<string | null>(null);
  const [altavozNombre, setAltavozNombre] = useState<string | null>(null);
  const [miniCerrado, setMiniCerrado] = useState(false);

  // El elemento de audio se crea a mano (no en el árbol de React) para que no
  // dependa de que ningún componente concreto siga montado.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<Record<string, string>>({});
  /** Hasta cuándo valen las URLs firmadas guardadas (caducan a las 2 h). */
  const urlsHastaRef = useRef(0);
  const listasRef = useRef<ListaMusica[]>([]);
  const ultimoSeqRef = useRef(0);

  /*
    Lista, índice y local en refs, para el paso automático de canción.

    El manejador de "ended" se engancha UNA vez al crear el `<audio>` y vive
    tanto como él. Si leyera `listaActual` del renderizado, se quedaría con la
    lista que hubiera en ese instante —normalmente ninguna— y al acabar la
    primera canción no sabría qué poner después. Con refs siempre ve lo vigente.
  */
  const listaActualRef = useRef<ListaMusica | null>(null);
  const indiceRef = useRef(0);
  const localIdRef = useRef<string | null>(null);
  const aleatorioRef = useRef(false);

  /*
    Orden de reproducción cuando el aleatorio está puesto.

    NO se sortea una canción cada vez: con 100 temas, el azar puro repite unas y
    deja otras sin sonar en toda la noche, y de vez en cuando pone dos veces
    seguidas la misma. Se baraja la lista entera y se recorre; al terminar, se
    vuelve a barajar. Así suenan las 100 antes de repetir ninguna.
  */
  const barajaRef = useRef<number[]>([]);
  const barajaPosRef = useRef(0);
  /** `sonarCancion` se redefine en cada render; el manejador usa la última. */
  const sonarCancionRef = useRef<
    ((lista: ListaMusica, idx: number) => Promise<void>) | null
  >(null);

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

  // Espejos en refs de lo que necesita el paso automático de canción.
  useEffect(() => {
    listaActualRef.current = listaActual;
  }, [listaActual]);
  useEffect(() => {
    indiceRef.current = indice;
  }, [indice]);
  useEffect(() => {
    localIdRef.current = localId;
  }, [localId]);
  useEffect(() => {
    aleatorioRef.current = aleatorio;
  }, [aleatorio]);

  // ─── Carga de datos ───────────────────────────────────────────────────────

  const recargar = useCallback(async () => {
    const res = await listMusica();
    if (res.ok) {
      setListas(res.listas);
      setBiblioteca(res.biblioteca);
      setUso(res.uso);
      setPuedeGestionar(res.puedeGestionar);

      /*
        La lista que se está reproduciendo es una copia en memoria: si alguien
        borra una canción o la quita de la lista, esa copia seguiría apuntando a
        algo que ya no existe y el reproductor intentaría cargar un archivo
        eliminado. Se refresca con la versión recién traída.
      */
      setListaActual((actual) => {
        if (!actual) return actual;
        const puesta = res.listas.find((l) => l.id === actual.id);
        if (!puesta) return null; // la lista entera ya no está
        // El índice se recorta para no quedar fuera de rango si la lista
        // encogió (antes iba por la 7 y ahora solo quedan 5 canciones).
        setIndice((i) => Math.min(i, Math.max(0, puesta.canciones.length - 1)));
        return puesta;
      });
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
    // Solo mientras la pestaña se está viendo: recargar el catálogo en pestañas
    // de fondo no cambia nada en pantalla y era una de las consultas más caras
    // repetidas cada minuto. Al volver se recarga en el acto, que es cuando de
    // verdad importa que la franja horaria esté al día.
    const visible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";
    const t = setInterval(() => {
      if (visible()) void recargar();
    }, 60_000);
    const onVisibility = () => {
      if (visible()) void recargar();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
        deviceNombre: nombreEquipoLegible(),
        forzar,
      });

      // Ya hay otro equipo vivo: no se releva sin preguntar.
      if (!res.ok && res.ocupadoPor) {
        return {
          ok: false,
          ocupadoPor: res.ocupadoPor,
          ocupadoPorUsuario: res.ocupadoPorUsuario,
          sonando: res.sonando,
        };
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

  /*
    Impide que el ordenador de los altavoces se duerma mientras hay música.

    El equipo del local se deja abierto todo el servicio y casi siempre en
    segundo plano (el camarero está en Reservas). Al suspenderse el Mac, la
    música se corta en seco y nadie sabe por qué: hay que ir hasta el ordenador,
    despertarlo y volver a darle a Play en plena cena.

    El bloqueo se pide SOLO mientras se está reproduciendo de verdad y se suelta
    al parar, para no dejar una pantalla encendida toda la noche sin motivo. El
    navegador lo retira solo al ocultar la pestaña, así que se vuelve a pedir
    cuando reaparece.
  */
  useEffect(() => {
    if (!esAltavoz || !reproduciendo) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelado = false;

    const pedir = async () => {
      // Pedirlo con la pestaña oculta lanza excepción: se espera a que vuelva.
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Sin permiso o no soportado: la música suena igual, solo se pierde la
        // garantía de que el equipo no se duerma.
      }
    };

    const alVolver = () => {
      if (!cancelado && document.visibilityState === "visible" && !lock) {
        void pedir();
      }
    };

    void pedir();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alVolver);
      void lock?.release().catch(() => {});
    };
  }, [esAltavoz, reproduciendo]);

  // ─── Audio real (solo en el equipo de altavoces) ──────────────────────────

  /**
   * Qué canción toca después de la actual: la siguiente del disco, o la
   * siguiente de la baraja si el aleatorio está puesto.
   *
   * Es una función normal y no un `useCallback` porque la llama el manejador de
   * "ended", que vive tanto como el `<audio>`: solo lee refs, así que no puede
   * quedarse con valores viejos.
   */
  const siguienteIndice = (total: number): number => {
    if (total <= 1) return 0;

    if (!aleatorioRef.current) {
      return (indiceRef.current + 1) % total;
    }

    /*
      Baraja nueva (lista recién puesta, canción elegida a mano, o le han
      añadido temas mientras sonaba). Reparte las que quedan por sonar y
      devuelve la primera SIN avanzar la posición: avanzar aquí se saltaría una
      canción en cada vuelta.

      El reparto tiene `total - 1` entradas porque excluye la que ya suena.
    */
    if (barajaRef.current.length !== total - 1) {
      barajaRef.current = barajarIndices(total, indiceRef.current);
      barajaPosRef.current = 0;
      return barajaRef.current[0] ?? 0;
    }

    barajaPosRef.current++;
    if (barajaPosRef.current >= barajaRef.current.length) {
      // Sonaron todas: se reparten de nuevo, dejando fuera la que acaba de
      // sonar para que la vuelta no empiece repitiéndola.
      barajaRef.current = barajarIndices(total, indiceRef.current);
      barajaPosRef.current = 0;
    }
    return barajaRef.current[barajaPosRef.current] ?? 0;
  };

  const asegurarAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      el.volume = volumen / 100;

      /*
        Encadenado automático: al acabar una canción entra la siguiente, y al
        final de la lista se vuelve a la primera. La música no debe pararse
        sola durante el servicio.

        Se engancha AQUÍ, al crear el elemento, y no en un `useEffect`. El
        efecto se ejecutaba antes de que existiera el `<audio>` (se crea al
        pulsar Play), salía por `if (!el) return` y solo volvía a intentarlo
        cuando cambiaba `listaActual`. Resultado: poner otra vez la MISMA lista
        tras un Stop, o arrancarla desde un móvil, dejaba el `<audio>` sin
        manejador y la música se paraba después de una sola canción.
      */
      el.addEventListener("ended", () => {
        const lista = listaActualRef.current;
        if (!lista || lista.canciones.length === 0) return;
        const siguiente = siguienteIndice(lista.canciones.length);
        indiceRef.current = siguiente;
        setIndice(siguiente);
        void sonarCancionRef.current?.(lista, siguiente);

        // El resto de equipos del local no se enteran solos: el paso automático
        // ocurre dentro de ESTE navegador. Sin el aviso, un móvil usado como
        // mando seguiría enseñando la canción anterior el resto del servicio.
        const local = localIdRef.current;
        if (local) {
          void avisarCancionEnCurso({
            localId: local,
            listaId: lista.id,
            cancionId: lista.canciones[siguiente]?.id ?? null,
            indice: siguiente,
          });
        }
      });

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

      /*
        Las URLs de audio van firmadas y caducan a las 2 h. Guardarlas sin más
        rompía la música justo donde peor: en un servicio la pantalla está
        abierta todo el día, así que a partir de la tercera hora cada cambio de
        canción fallaba con "No se pudo cargar" y la música se paraba.

        Se refrescan a los 90 min —bastante antes de que caduquen— y siempre que
        falte la de la canción que toca.
      */
      const caducadas = Date.now() > urlsHastaRef.current;
      let url = caducadas ? undefined : urlsRef.current[cancion.id];

      if (!url) {
        const res = await getUrlsLista(lista.id);
        if (res.ok) {
          // Si habían caducado se reemplazan enteras, no se mezclan con las
          // viejas: mantener las anteriores solo conservaría enlaces muertos.
          urlsRef.current = caducadas
            ? res.urls
            : { ...urlsRef.current, ...res.urls };
          urlsHastaRef.current = Date.now() + 90 * 60_000;
        }
        url = urlsRef.current[cancion.id];
      }
      if (!url) {
        toast.error(`No se pudo cargar «${cancion.titulo}»`);
        return;
      }

      const el = asegurarAudio();
      el.src = url;
      el.volume = volumen / 100;

      /*
        Si el archivo falla al cargar (enlace caducado por un portátil con la
        hora desfasada, corte de red), se pide una URL nueva y se reintenta UNA
        vez. Sin esto, la música del local se quedaba parada en silencio y
        alguien tenía que ir a darle a Play.
      */
      const alFallar = async () => {
        el.onerror = null;
        const res = await getUrlsLista(lista.id);
        if (!res.ok || !res.urls[cancion.id]) {
          toast.error(`No se pudo reproducir «${cancion.titulo}»`);
          return;
        }
        urlsRef.current = res.urls;
        urlsHastaRef.current = Date.now() + 90 * 60_000;
        el.src = res.urls[cancion.id];
        void el.play().catch(() => setReproduciendo(false));
      };
      el.onerror = () => void alFallar();

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

  // El manejador de "ended" (enganchado al crear el `<audio>`) llama siempre a
  // la última versión de `sonarCancion` a través de esta referencia.
  useEffect(() => {
    sonarCancionRef.current = sonarCancion;
  }, [sonarCancion]);

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
      // El aleatorio es del local: si lo cambian desde otro equipo, se refleja.
      setAleatorio(Boolean(fila.aleatorio));
      setAltavozNombre((fila.device_nombre as string | null) ?? null);

      /*
        Si otro equipo ha tomado el relevo, este deja de ser altavoz y se calla.

        Y se AVISA a quien lo estaba usando. Antes la música simplemente paraba:
        el del local veía el silencio y no tenía forma de saber si se había roto
        algo, si se había ido internet o si alguien se la había llevado a su
        ordenador. Ahora se dice qué ha pasado y quién ha sido.
      */
      const deviceFila = (fila.device_id as string | null) ?? null;
      const miId = getDeviceId();
      if (miId && deviceFila && deviceFila !== miId) {
        setLocalAltavoz((prev) => {
          if (prev === null) return prev; // no era este equipo: nada que avisar
          audioRef.current?.pause();
          try {
            localStorage.removeItem(CLAVE_LOCAL_ALTAVOZ);
          } catch {
            /* sin localStorage */
          }

          const quien = (fila.actualizado_por as string | null) ?? null;
          void (async () => {
            const nombre = quien ? await nombreDeUsuario(quien) : null;
            toast.warning(
              nombre
                ? `${nombre} ha pasado la música a su equipo`
                : "Otro equipo se ha llevado la música",
              {
                description:
                  "Este ordenador ha dejado de reproducir. Si la música tiene que sonar aquí, vuelve a activar «Sonar en este ordenador».",
                duration: 12_000,
              },
            );
          })();

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
      setAleatorio(e.aleatorio);
      setAltavozNombre(e.deviceNombre);
      const lista = listasRef.current.find((l) => l.id === e.listaId) ?? null;
      setListaActual(lista);
    })();
  }, [localId, listas.length]);

  // ─── Órdenes (las manda cualquiera, incluido el propio altavoz) ───────────

  const reproducirLista = useCallback(
    async (lista: ListaMusica, idxInicialPedido?: number) => {
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

      /*
        Con el aleatorio puesto, dar a Reproducir empieza por una canción al
        azar, no siempre por la primera: si no, cada servicio arrancaría con el
        mismo tema y el aleatorio solo se notaría a partir de la segunda.

        Pinchar una canción concreta del listado SÍ manda: ahí el usuario ha
        elegido, y se respeta aunque el aleatorio esté puesto.
      */
      let idxInicial = idxInicialPedido ?? 0;
      if (idxInicialPedido === undefined && aleatorioRef.current) {
        idxInicial = Math.floor(Math.random() * lista.canciones.length);
      }
      // La baraja se rehace en la próxima canción, ya excluyendo esta.
      barajaRef.current = [];
      barajaPosRef.current = 0;

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

  /**
   * Pone o quita el aleatorio. Se guarda por local, así que si el encargado lo
   * activa desde su móvil, el ordenador de los altavoces lo respeta.
   *
   * No cambia la canción que está sonando: solo afecta a la SIGUIENTE. Cortar
   * la música a media canción por tocar un ajuste sería lo último que se espera.
   */
  const alternarAleatorio = useCallback(async () => {
    if (!localId) return;
    const nuevo = !aleatorio;

    setAleatorio(nuevo);
    aleatorioRef.current = nuevo;
    // La baraja anterior ya no vale: se rehace en la próxima canción.
    barajaRef.current = [];
    barajaPosRef.current = 0;

    const res = await enviarComando({ localId, comando: "aleatorio", aleatorio: nuevo });
    if (!res.ok) {
      setAleatorio(!nuevo);
      aleatorioRef.current = !nuevo;
      toast.error(res.error ?? "No se pudo cambiar el modo aleatorio");
    }
  }, [localId, aleatorio]);

  /**
   * Salta a una canción concreta pinchándola en el listado. Es lo mismo que
   * "siguiente" pero a un punto elegido, así que reutiliza el mismo camino:
   * escribe la orden para que la obedezca el equipo de los altavoces, esté
   * donde esté.
   */
  const irACancion = useCallback(
    async (idx: number) => {
      if (!listaActual || !localId) return;
      const total = listaActual.canciones.length;
      if (total === 0 || idx < 0 || idx >= total) return;
      if (idx === indice && reproduciendo) return; // ya suena esa

      setIndice(idx);
      setReproduciendo(true);
      const res = await enviarComando({
        localId,
        comando: "siguiente",
        listaId: listaActual.id,
        cancionId: listaActual.canciones[idx]?.id ?? null,
        indice: idx,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cambiar de canción");
        return;
      }
      if (esAltavoz) await sonarCancion(listaActual, idx);
    },
    [listaActual, localId, indice, reproduciendo, esAltavoz, sonarCancion],
  );

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
        indiceActual: indice,
        irACancion,
        aleatorio,
        alternarAleatorio,
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
