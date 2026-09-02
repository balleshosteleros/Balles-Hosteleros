"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGoogleConnection } from "./useGoogleConnection";
import { contarPendientesHoy } from "@/features/tareas/actions/tareas-actions";
import { getTareasValidacionPendientes } from "@/features/mi-panel/actions/mi-panel-actions";
import { contarMensajesSinLeer } from "@/features/comunicacion/actions/comunicacion-actions";
import { contarContactosNuevos } from "@/features/agenda/actions/contactos-actions";
import { contarLlamadasPerdidasNoVistas } from "@/features/llamadas-internas/actions/llamadas-actions";
import { LLAMADAS_VISTAS_KEY } from "./TelefonoDrawer";
import { loadCalendariosSeleccionados } from "../lib/calendar-prefs";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

/**
 * Día "de hoy" EN LA ZONA DE LA EMPRESA, no en la del navegador.
 *
 * Importa: el usuario puede estar físicamente en otro huso (Indonesia, +8) y la
 * empresa operar en España (+2). Con `getFullYear/getMonth/getDate` el badge
 * pedía el día del NAVEGADOR mientras el endpoint contaba el día de la EMPRESA
 * (`hoyEnZona(tz)`), así que durante esas horas de desfase cada uno miraba una
 * fecha distinta y los números no podían coincidir.
 */
function ymdEnZona(d: Date, tz: string): string {
  // en-CA da directamente el formato YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Resuelve QUÉ calendarios debe contar el badge, con la misma regla que aplica
 * el panel al pintarlos: **solo cuentan los que el usuario tiene seleccionados**.
 *
 * `guardados` es la selección persistida (o `null` si nunca eligió). Se filtra
 * contra los calendarios que Google devuelve HOY, porque una selección antigua
 * puede arrastrar IDs de calendarios que ya no están compartidos con el usuario
 * (departamentos que se quitaron, cuentas que dejaron de compartir...). Esos IDs
 * muertos no se pueden consultar: si los mandáramos, el badge pediría eventos de
 * calendarios inexistentes. El panel ya los descarta al pintar, así que el badge
 * tiene que descartarlos igual para no desviarse de lo que se ve.
 *
 * Si el usuario nunca eligió, se arranca con los que Google trae marcados más el
 * principal — idéntico a la primera apertura de `CalendarDrawer`.
 */
async function resolverCalendarios(
  guardados: string[] | null,
): Promise<string[]> {
  try {
    const data = await fetch("/api/google/calendar/list").then((r) => r.json());
    if (!data?.connected || !Array.isArray(data.calendarios)) {
      // Sin lista no podemos validar nada: respetamos la selección tal cual.
      return guardados ?? [];
    }
    const cals: Array<{ id: string; seleccionado?: boolean; primary?: boolean }> =
      data.calendarios;

    if (guardados !== null) {
      // Selección explícita del usuario: se respeta, quitando solo lo que ya no
      // existe. Si TODO lo guardado ha desaparecido devolvemos [] a propósito —
      // "no cuentes nada" es la respuesta correcta, y coincide con el panel,
      // que en ese caso tampoco pinta nada.
      const vivos = new Set(cals.map((c) => c.id));
      return guardados.filter((id) => vivos.has(id));
    }

    const ids = cals
      .filter((c) => c.seleccionado || c.primary)
      .map((c) => c.id);
    if (ids.length === 0 && cals.length > 0) return [cals[0].id];
    return ids;
  } catch {
    return guardados ?? [];
  }
}

/** Evento del día reducido a lo que el badge necesita para contarlo. */
type EventoContable = { finMs: number | null; tieneMeet: boolean };

/**
 * Cuenta los eventos que TODAVÍA NO HAN TERMINADO en este instante. Es una
 * función pura de la hora actual, así que se puede reevaluar cada minuto sin
 * volver a preguntar a Google: el badge va bajando solo según acaban.
 */
function contarVigentes(eventos: EventoContable[]): {
  events: number;
  meetings: number;
} {
  const ahora = Date.now();
  const vigentes = eventos.filter((e) => e.finMs === null || e.finMs > ahora);
  return {
    events: vigentes.length,
    meetings: vigentes.filter((e) => e.tieneMeet).length,
  };
}

export interface DailyCounts {
  emails: number;     // correos no leídos hoy
  events: number;     // eventos de calendario hoy
  meetings: number;   // reuniones con Meet hoy
  tasks: number;      // tareas pendientes hoy
  chatGroups: number; // canales/grupos con mensajes sin leer
  missedCalls: number; // llamadas entrantes nuevas no vistas
  newContacts: number; // contactos añadidos a la agenda dentro de la ventana de anuncio
}

const REFRESH_MS = 60 * 1000; // 1 minuto
// La 1ª carga se difiere un poco para no competir con el arranque crítico
// (permisos del menú, contexto de empresa). Eran 2 s, pero ese retardo se
// SUMABA a lo que tardaban las consultas, y los badges aparecían varios
// segundos después de la pantalla. Con el conteo de correo ya barato, 400 ms
// bastan para ceder el arranque sin que se note la espera.
const INITIAL_DELAY_MS = 400;
// Reevaluación LOCAL de qué eventos siguen vigentes (sin tocar la red).
const TICK_VIGENCIA_MS = 15 * 1000;

// Evento global para forzar un refresco inmediato de los contadores (p. ej. al
// leer un correo o archivarlo, sin esperar al siguiente tick de 1 minuto).
export const DAILY_COUNTS_REFRESH_EVENT = "daily-counts:refresh";

/**
 * Fuerza un recálculo inmediato de los contadores.
 *
 * `calendarios` es la selección que el usuario ACABA de dejar marcada en el
 * panel. Hay que pasarla a mano porque persistirla es asíncrono (lee y escribe
 * en BD): si el badge fuera a buscarla, leería la selección ANTERIOR y se
 * quedaría un paso por detrás — al ocultar un calendario el número seguía
 * incluyendo sus eventos hasta el siguiente ciclo. Con la lista en la mano el
 * número cambia en el acto.
 */
export function refreshDailyCounts(calendarios?: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DAILY_COUNTS_REFRESH_EVENT, {
      detail: calendarios ? { calendarios } : undefined,
    }),
  );
}

export function useDailyCounts(): DailyCounts {
  // `email` es la CUENTA DE GOOGLE ACTIVA. Es dependencia obligatoria: al
  // cambiar de cuenta (Bacanal → Habana) `connected` sigue siendo true, así que
  // sin mirar el email el badge se quedaba con los eventos de la cuenta
  // anterior. Cada cuenta tiene sus propios calendarios y sus propios eventos.
  const { connected, email: cuentaGoogle } = useGoogleConnection();
  const { empresaActual, ajustes } = useEmpresa();
  const empresaSlug = empresaActual.id;
  const tzEmpresa = empresaActual.zonaHoraria;
  const diasAnuncio = ajustes.notificaciones.agenda.diasAnuncio;
  const [counts, setCounts] = useState<DailyCounts>({
    emails: 0,
    events: 0,
    meetings: 0,
    tasks: 0,
    chatGroups: 0,
    missedCalls: 0,
    newContacts: 0,
  });
  // Eventos de HOY tal como los devolvió Google en la última consulta. El
  // recuento por "ya terminado" se recalcula en local cada minuto sobre esta
  // lista, para que el badge baje al acabar un evento sin esperar a la red.
  const eventosHoyRef = useRef<EventoContable[]>([]);

  // `calendariosAhora` llega cuando el usuario acaba de marcar/desmarcar en el
  // panel: se usa TAL CUAL en vez de releer la preferencia (que aún se está
  // guardando). Sin esto el badge iba un paso por detrás de las casillas.
  const fetchCounts = useCallback(async (calendariosAhora?: string[]) => {
    // Las 5 consultas de BD son INDEPENDIENTES entre sí → en PARALELO.
    // (Antes iban en serie con `await` encadenados = 5 idas de red secuenciales.)
    let vistasAt: string | null = null;
    try {
      vistasAt = localStorage.getItem(LLAMADAS_VISTAS_KEY);
    } catch {
      /* localStorage no disponible */
    }

    const [pendRes, valRes, canalesRes, missedRes, contactsRes] =
      await Promise.allSettled([
        contarPendientesHoy(),
        getTareasValidacionPendientes(),
        contarMensajesSinLeer(),
        contarLlamadasPerdidasNoVistas(vistasAt),
        contarContactosNuevos(diasAnuncio),
      ]);

    // Tareas de BD + tareas de validación (validador).
    let tasks = 0;
    if (pendRes.status === "fulfilled" && pendRes.value.ok) {
      tasks = pendRes.value.data;
    }
    if (
      valRes.status === "fulfilled" &&
      valRes.value.ok &&
      valRes.value.data.activo
    ) {
      // Cuenta como 1 tarea por tipo con pendientes (igual que el drawer).
      tasks +=
        (valRes.value.data.ausencia > 0 ? 1 : 0) +
        (valRes.value.data.trabajo > 0 ? 1 : 0);
    }

    // Chat: nº total de mensajes sin leer (posteriores al last_read_at de cada
    // canal, excluyendo los propios). El badge lo topa a 9+.
    let chatGroups = 0;
    if (canalesRes.status === "fulfilled" && canalesRes.value.ok) {
      chatGroups = canalesRes.value.data.totalMensajes;
    }

    // Llamadas: perdidas internas posteriores a la última vez que se vio Recientes.
    const missedCalls = missedRes.status === "fulfilled" ? missedRes.value : 0;

    // Agenda: contactos nuevos dentro de la ventana de anuncio configurada.
    const newContacts =
      contactsRes.status === "fulfilled" ? contactsRes.value : 0;

    if (!connected) {
      // Sin cuenta de Google no hay eventos que contar: vaciamos también la
      // lista cacheada para que el tick local no siga contando los de antes.
      eventosHoyRef.current = [];
      setCounts({
        emails: 0,
        events: 0,
        meetings: 0,
        tasks,
        chatGroups,
        missedCalls,
        newContacts,
      });
      return;
    }

    // Los contadores que NO dependen de Google (tareas, chat, llamadas,
    // agenda) ya están resueltos: se pintan YA. Antes había un único
    // `setCounts` al final, así que estos esperaban a Gmail y Calendar y todos
    // los iconos aparecían tarde a la vez, aunque su dato estuviera listo.
    // Los de Google se completan abajo en cuanto respondan.
    setCounts((prev) => ({
      ...prev,
      tasks,
      chatGroups,
      missedCalls,
      newContacts,
    }));

    try {
      const ref = ymdEnZona(new Date(), tzEmpresa);
      // El badge debe contar SOLO los calendarios que el usuario tiene
      // seleccionados en el panel de Calendar/Meet, no todos los de la cuenta de
      // Google. Sin este filtro el endpoint cae a "todos los calendarios
      // marcados en Google" (DIRECCION, PERSONAL, Bacanal, Habana...) y el badge
      // decía 4 mientras el drawer mostraba 2.
      const guardados =
        calendariosAhora ??
        (await loadCalendariosSeleccionados(cuentaGoogle));
      // Si mandáramos la petición sin `calendarIds`, el endpoint cae a "todos los
      // calendarios de la cuenta" (17 en el caso real: los de Bacanal, los de
      // Habana por departamento, PERSONAL, MARKETING...) y el badge sumaría
      // eventos de calendarios que el usuario NO tiene seleccionados.
      const seleccionados = await resolverCalendarios(guardados);
      // `[]` = no hay ningún calendario seleccionado válido → nada que contar
      // EN CALENDARIO. El correo no depende del calendario: antes este `return`
      // temprano ponía también `emails: 0`, así que quien desmarcaba todos sus
      // calendarios se quedaba sin badge de correo aunque tuviera sin leer.
      if (seleccionados.length === 0) {
        eventosHoyRef.current = [];
        const unread = await fetch("/api/google/gmail/unread-count")
          .then((r) => r.json())
          .then((d) => d?.unread ?? 0)
          .catch(() => 0);
        setCounts({
          emails: unread,
          events: 0,
          meetings: 0,
          tasks,
          chatGroups,
          missedCalls,
          newContacts,
        });
        return;
      }
      const calParams = new URLSearchParams({
        view: "day",
        date: ref,
        calendarIds: seleccionados.join(","),
      });
      const [emailRes, calRes] = await Promise.allSettled([
        // Cuenta las CONVERSACIONES sin leer con UNA sola llamada. Antes esto
        // pedía la bandeja entera (`/gmail/messages`), que trae el detalle de
        // cada hilo: ~51 peticiones a Google para obtener un número. Tardaba
        // segundos y, como el `setCounts` es único al final, el retraso se
        // llevaba por delante a los demás iconos.
        fetch("/api/google/gmail/unread-count").then((r) => r.json()),
        fetch(`/api/google/calendar/events?${calParams}`).then((r) =>
          r.json()
        ),
      ]);

      let emails = 0;
      if (emailRes.status === "fulfilled") {
        emails = emailRes.value?.unread ?? 0;
      }

      // Guardamos los eventos CANDIDATOS del día (ya sin all-day ni declinados,
      // que no dependen de la hora) y dejamos que el conteo por "ya terminado"
      // lo haga el tick local de abajo. Así el badge baja EN CUANTO acaba un
      // evento, sin esperar a la siguiente consulta a Google.
      if (calRes.status === "fulfilled") {
        const eventos: Array<{
          meetLink?: string | null;
          fin?: string;
          allDay?: boolean;
          miRespuesta?: string;
        }> = calRes.value?.eventos ?? [];
        // El badge cuenta solo los EVENTOS REALES del día del usuario, no todo
        // lo que Google devuelve para hoy. Se excluye:
        //  - eventos "todo el día" (festivos, cumpleaños, calendarios
        //    compartidos all-day) → inflaban el número sin ser citas propias;
        //  - eventos que el usuario ha declinado (responseStatus "declined").
        eventosHoyRef.current = eventos
          .filter((e) => !e.allDay && e.miRespuesta !== "declined")
          .map((e) => ({
            finMs: e.fin ? new Date(e.fin).getTime() : null,
            tieneMeet: !!e.meetLink,
          }));
      }
      const { events, meetings } = contarVigentes(eventosHoyRef.current);

      setCounts({ emails, events, meetings, tasks, chatGroups, missedCalls, newContacts });
    } catch {
      setCounts((prev) => ({ ...prev, tasks, chatGroups, missedCalls, newContacts }));
    }
    // `empresaSlug` NO se usa dentro del callback, pero es una dependencia
    // NECESARIA: las server actions de arriba (tareas, chat, llamadas, agenda)
    // resuelven la empresa activa por cookie en el servidor, así que al cambiar
    // de empresa cambia el resultado sin que cambie ningún argumento visible.
    // Sin esta dependencia los badges se quedarían con los números de la
    // empresa anterior hasta el siguiente tick de 1 minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, cuentaGoogle, empresaSlug, tzEmpresa, diasAnuncio]);

  useEffect(() => {
    // Los badges solo interesan en la pestaña que se está MIRANDO. Sin esta
    // guarda, cada pestaña abierta del software repetía las 5 consultas cada
    // minuto para siempre — de madrugada, con nadie delante. Con varias
    // pestañas abiertas (lo normal aquí) eso multiplicaba la carga sobre la
    // base de datos, y como cada consulta tarda segundos, las rondas acababan
    // solapándose: el arranque de cualquier pantalla competía contra una cola
    // de conteos de pestañas que nadie está viendo.
    const visible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";
    const fetchSiVisible = () => {
      if (visible()) fetchCounts();
    };

    // 1ª carga diferida ~2 s (no compite con el arranque). Además, como el efecto se
    // re-ejecuta al cambiar empresaSlug/connected durante la hidratación, el
    // clearTimeout de la limpieza COALESCE esas 2-3 re-ejecuciones en una sola.
    const firstLoad = setTimeout(fetchSiVisible, INITIAL_DELAY_MS);
    const id = setInterval(fetchSiVisible, REFRESH_MS);
    // Al volver a la pestaña se refresca en el acto: los números que se dejaron
    // de pedir mientras estaba oculta se ponen al día sin esperar al minuto.
    const onVisibility = () => {
      if (visible()) fetchCounts();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Tick local: NO llama a Google, solo vuelve a mirar el reloj sobre los
    // eventos ya descargados. Es lo que hace que el badge vaya bajando (5 → 4 →
    // 3…) a medida que terminan, en vez de quedarse clavado hasta el siguiente
    // refresco de red. Va a 15 s para que el cambio se note casi al instante.
    const tick = setInterval(() => {
      if (!visible()) return;
      setCounts((prev) => {
        const { events, meetings } = contarVigentes(eventosHoyRef.current);
        if (prev.events === events && prev.meetings === meetings) return prev;
        return { ...prev, events, meetings };
      });
    }, TICK_VIGENCIA_MS);
    const onRefresh = (e: Event) => {
      // Si el disparador adjuntó la selección recién marcada, se usa esa.
      const detail = (e as CustomEvent<{ calendarios?: string[] }>).detail;
      fetchCounts(detail?.calendarios);
    };
    window.addEventListener(DAILY_COUNTS_REFRESH_EVENT, onRefresh);
    return () => {
      clearTimeout(firstLoad);
      clearInterval(id);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(DAILY_COUNTS_REFRESH_EVENT, onRefresh);
    };
  }, [fetchCounts]);

  return counts;
}
