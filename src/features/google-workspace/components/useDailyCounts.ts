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
    // Tareas de BD (no localStorage) + tareas de validación (validador).
    let tasks = 0;
    try {
      const res = await contarPendientesHoy();
      if (res.ok) tasks = res.data;
    } catch {
      /* ignore */
    }
    try {
      const val = await getTareasValidacionPendientes();
      if (val.ok && val.data.activo) {
        // Cuenta como 1 tarea por tipo con pendientes (igual que el drawer).
        tasks += (val.data.ausencia > 0 ? 1 : 0) + (val.data.trabajo > 0 ? 1 : 0);
      }
    } catch {
      /* ignore */
    }

    // Chat: nº de canales con mensajes sin leer
    let chatGroups = 0;
    try {
      const res = await listCanales(empresaSlug);
      if (res.ok) {
        chatGroups = (res.data as Array<{ sin_leer?: number }>).filter(
          (c) => (c.sin_leer ?? 0) > 0,
        ).length;
      }
    } catch {
      /* ignore */
    }

    // Llamadas: perdidas internas posteriores a la última vez que se vio Recientes.
    let missedCalls = 0;
    try {
      let vistasAt: string | null = null;
      try {
        vistasAt = localStorage.getItem(LLAMADAS_VISTAS_KEY);
      } catch {
        /* localStorage no disponible */
      }
      missedCalls = await contarLlamadasPerdidasNoVistas(vistasAt);
    } catch {
      /* ignore */
    }

    // Agenda: contactos nuevos dentro de la ventana de anuncio configurada.
    let newContacts = 0;
    try {
      newContacts = await contarContactosNuevos(diasAnuncio);
    } catch {
      /* ignore */
    }

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
    fetchCounts();
    const id = setInterval(fetchCounts, REFRESH_MS);
    const onRefresh = () => fetchCounts();
    window.addEventListener(DAILY_COUNTS_REFRESH_EVENT, onRefresh);
    return () => {
      clearInterval(id);
      window.removeEventListener(DAILY_COUNTS_REFRESH_EVENT, onRefresh);
    };
  }, [fetchCounts]);

  return counts;
}
