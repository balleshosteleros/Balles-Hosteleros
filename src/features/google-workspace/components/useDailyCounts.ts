"use client";

import { useState, useEffect, useCallback } from "react";
import { useGoogleConnection } from "./useGoogleConnection";
import { contarPendientesHoy } from "@/features/tareas/actions/tareas-actions";
import { getTareasValidacionPendientes } from "@/features/mi-panel/actions/mi-panel-actions";
import { contarMensajesSinLeer } from "@/features/comunicacion/actions/comunicacion-actions";
import { contarContactosNuevos } from "@/features/agenda/actions/contactos-actions";
import { contarLlamadasPerdidasNoVistas } from "@/features/llamadas-internas/actions/llamadas-actions";
import { LLAMADAS_VISTAS_KEY } from "./TelefonoDrawer";
import { loadCalendariosSeleccionados } from "../lib/calendar-prefs";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
// La 1ª carga se difiere ~2 s para no competir con el arranque crítico (permisos
// del menú, contexto de empresa) — los badges de contadores no son urgentes.
const INITIAL_DELAY_MS = 2000;

// Evento global para forzar un refresco inmediato de los contadores (p. ej. al
// leer un correo o archivarlo, sin esperar al siguiente tick de 1 minuto).
export const DAILY_COUNTS_REFRESH_EVENT = "daily-counts:refresh";
export function refreshDailyCounts(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DAILY_COUNTS_REFRESH_EVENT));
  }
}

export function useDailyCounts(): DailyCounts {
  const { connected } = useGoogleConnection();
  const { empresaActual, ajustes } = useEmpresa();
  const empresaSlug = empresaActual.id;
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

  const fetchCounts = useCallback(async () => {
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

    try {
      const ref = ymd(new Date());
      // El badge debe contar SOLO los calendarios que el usuario tiene
      // seleccionados en el panel de Calendar/Meet, no todos los de la cuenta de
      // Google. Sin este filtro el endpoint cae a "todos los calendarios
      // marcados en Google" (DIRECCION, PERSONAL, Bacanal, Habana...) y el badge
      // decía 4 mientras el drawer mostraba 2.
      const seleccionados = await loadCalendariosSeleccionados();
      // `null` = el usuario nunca eligió → dejamos que el endpoint aplique su
      // criterio por defecto (los marcados en Google / el principal), igual que
      // hace el drawer en su primera apertura.
      // `[]` = deseleccionó todo → no hay nada que contar.
      if (seleccionados !== null && seleccionados.length === 0) {
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
      const calParams = new URLSearchParams({ view: "day", date: ref });
      if (seleccionados !== null) {
        calParams.set("calendarIds", seleccionados.join(","));
      }
      const [emailRes, calRes] = await Promise.allSettled([
        // Cargamos el inbox completo (no solo is:unread) y contamos las
        // CONVERSACIONES no leídas, igual que la bandeja del drawer. El
        // endpoint agrupa por hilo, así que contar mensajes con q=is:unread
        // daba un número distinto al que se ve en la bandeja (p. ej. 2 hilos
        // con 3 mensajes no leídos → badge 3 vs bandeja 2).
        fetch(
          "/api/google/gmail/messages?carpeta=inbox&maxResults=50",
        ).then((r) => r.json()),
        fetch(`/api/google/calendar/events?${calParams}`).then((r) =>
          r.json()
        ),
      ]);

      let emails = 0;
      if (emailRes.status === "fulfilled") {
        const mensajes: Array<{ leido?: boolean }> =
          emailRes.value?.mensajes ?? [];
        emails = mensajes.filter((m) => m.leido === false).length;
      }

      let events = 0;
      let meetings = 0;
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
        //  - eventos que el usuario ha declinado (responseStatus "declined");
        //  - eventos que ya han terminado (su hora de fin es anterior a ahora).
        const ahora = Date.now();
        const vigentes = eventos.filter(
          (e) =>
            !e.allDay &&
            e.miRespuesta !== "declined" &&
            (!e.fin || new Date(e.fin).getTime() > ahora),
        );
        events = vigentes.length;
        meetings = vigentes.filter((e) => !!e.meetLink).length;
      }

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
  }, [connected, empresaSlug, diasAnuncio]);

  useEffect(() => {
    // 1ª carga diferida ~2 s (no compite con el arranque). Además, como el efecto se
    // re-ejecuta al cambiar empresaSlug/connected durante la hidratación, el
    // clearTimeout de la limpieza COALESCE esas 2-3 re-ejecuciones en una sola.
    const firstLoad = setTimeout(fetchCounts, INITIAL_DELAY_MS);
    const id = setInterval(fetchCounts, REFRESH_MS);
    const onRefresh = () => fetchCounts();
    window.addEventListener(DAILY_COUNTS_REFRESH_EVENT, onRefresh);
    return () => {
      clearTimeout(firstLoad);
      clearInterval(id);
      window.removeEventListener(DAILY_COUNTS_REFRESH_EVENT, onRefresh);
    };
  }, [fetchCounts]);

  return counts;
}
