"use client";

import { useState, useEffect, useCallback } from "react";
import { useGoogleConnection } from "./useGoogleConnection";
import { contarPendientesHoy } from "@/features/tareas/actions/tareas-actions";
import { listCanales } from "@/features/comunicacion/actions/comunicacion-actions";
import { contarLlamadasNoVistas } from "./TelefonoDrawer";
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
}

const REFRESH_MS = 60 * 1000; // 1 minuto

export function useDailyCounts(): DailyCounts {
  const { connected } = useGoogleConnection();
  const { empresaActual } = useEmpresa();
  const empresaSlug = empresaActual.id;
  const [counts, setCounts] = useState<DailyCounts>({
    emails: 0,
    events: 0,
    meetings: 0,
    tasks: 0,
    chatGroups: 0,
    missedCalls: 0,
  });

  const fetchCounts = useCallback(async () => {
    // Tareas de BD (no localStorage)
    let tasks = 0;
    try {
      const res = await contarPendientesHoy();
      if (res.ok) tasks = res.data;
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

    // Llamadas: entrantes nuevas no vistas (mock hasta que VoIP esté integrado)
    const missedCalls = contarLlamadasNoVistas();

    if (!connected) {
      setCounts({
        emails: 0,
        events: 0,
        meetings: 0,
        tasks,
        chatGroups,
        missedCalls,
      });
      return;
    }

    try {
      const ref = ymd(new Date());
      const [emailRes, calRes] = await Promise.allSettled([
        fetch(
          "/api/google/gmail/messages?carpeta=inbox&q=is:unread&maxResults=50",
        ).then((r) => r.json()),
        fetch(`/api/google/calendar/events?view=day&date=${ref}`).then((r) =>
          r.json()
        ),
      ]);

      let emails = 0;
      if (emailRes.status === "fulfilled") {
        emails = (emailRes.value?.mensajes ?? []).length;
      }

      let events = 0;
      let meetings = 0;
      if (calRes.status === "fulfilled") {
        const eventos: Array<{ meetLink?: string | null }> =
          calRes.value?.eventos ?? [];
        events = eventos.length;
        meetings = eventos.filter((e) => !!e.meetLink).length;
      }

      setCounts({ emails, events, meetings, tasks, chatGroups, missedCalls });
    } catch {
      setCounts((prev) => ({ ...prev, tasks, chatGroups, missedCalls }));
    }
  }, [connected, empresaSlug]);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchCounts]);

  return counts;
}
