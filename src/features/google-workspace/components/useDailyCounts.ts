"use client";

import { useState, useEffect, useCallback } from "react";
import { useGoogleConnection } from "./useGoogleConnection";
import { contarPendientesHoy } from "@/features/tareas/actions/tareas-actions";
import { getTareasValidacionPendientes } from "@/features/mi-panel/actions/mi-panel-actions";
import { listCanales } from "@/features/comunicacion/actions/comunicacion-actions";
import { contarContactosNuevos } from "@/features/agenda/actions/contactos-actions";
import { contarLlamadasPerdidasNoVistas } from "@/features/llamadas-internas/actions/llamadas-actions";
import { LLAMADAS_VISTAS_KEY } from "./TelefonoDrawer";
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
        listCanales(empresaSlug),
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

    // Chat: nº de canales con mensajes sin leer.
    let chatGroups = 0;
    if (canalesRes.status === "fulfilled" && canalesRes.value.ok) {
      chatGroups = (
        canalesRes.value.data as Array<{ sin_leer?: number }>
      ).filter((c) => (c.sin_leer ?? 0) > 0).length;
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
      const [emailRes, calRes] = await Promise.allSettled([
        // Cargamos el inbox completo (no solo is:unread) y contamos las
        // CONVERSACIONES no leídas, igual que la bandeja del drawer. El
        // endpoint agrupa por hilo, así que contar mensajes con q=is:unread
        // daba un número distinto al que se ve en la bandeja (p. ej. 2 hilos
        // con 3 mensajes no leídos → badge 3 vs bandeja 2).
        fetch(
          "/api/google/gmail/messages?carpeta=inbox&maxResults=50",
        ).then((r) => r.json()),
        fetch(`/api/google/calendar/events?view=day&date=${ref}`).then((r) =>
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
        const eventos: Array<{ meetLink?: string | null; fin?: string }> =
          calRes.value?.eventos ?? [];
        // Solo cuentan los eventos del día que aún NO han terminado: según pasa
        // el tiempo, los que ya cumplieron su hora dejan de sumar al badge.
        const ahora = Date.now();
        const vigentes = eventos.filter(
          (e) => !e.fin || new Date(e.fin).getTime() > ahora,
        );
        events = vigentes.length;
        meetings = vigentes.filter((e) => !!e.meetLink).length;
      }

      setCounts({ emails, events, meetings, tasks, chatGroups, missedCalls, newContacts });
    } catch {
      setCounts((prev) => ({ ...prev, tasks, chatGroups, missedCalls, newContacts }));
    }
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
