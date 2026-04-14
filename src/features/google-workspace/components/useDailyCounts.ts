"use client";

import { useState, useEffect, useCallback } from "react";
import { isToday, parseISO, startOfDay, endOfDay } from "date-fns";
import { useGoogleConnection } from "./useGoogleConnection";
import { loadTareas } from "./TareasDrawer";

export interface DailyCounts {
  emails: number;   // correos no leídos hoy
  events: number;   // eventos de calendario hoy
  meetings: number; // reuniones con Meet hoy
  tasks: number;    // tareas pendientes hoy
}

const REFRESH_MS = 5 * 60 * 1000; // 5 minutos

export function useDailyCounts(): DailyCounts {
  const { connected } = useGoogleConnection();
  const [counts, setCounts] = useState<DailyCounts>({
    emails: 0,
    events: 0,
    meetings: 0,
    tasks: 0,
  });

  const fetchCounts = useCallback(async () => {
    // Tareas locales (localStorage)
    let tasks = 0;
    try {
      tasks = loadTareas().filter(
        (t) => !t.hecha && isToday(parseISO(t.fecha))
      ).length;
    } catch {
      /* ignore */
    }

    if (!connected) {
      setCounts({ emails: 0, events: 0, meetings: 0, tasks });
      return;
    }

    try {
      const now = new Date();
      const [emailRes, calRes] = await Promise.allSettled([
        fetch("/api/google/gmail/messages?q=is:unread&maxResults=20").then((r) =>
          r.json()
        ),
        fetch(
          `/api/google/calendar/events?timeMin=${startOfDay(now).toISOString()}&timeMax=${endOfDay(now).toISOString()}`
        ).then((r) => r.json()),
      ]);

      let emails = 0;
      if (emailRes.status === "fulfilled") {
        emails = (emailRes.value?.messages ?? []).length;
      }

      let events = 0;
      let meetings = 0;
      if (calRes.status === "fulfilled") {
        const items: Array<{ hangoutLink?: string }> = calRes.value?.items ?? [];
        events = items.length;
        meetings = items.filter((e) => e.hangoutLink).length;
      }

      setCounts({ emails, events, meetings, tasks });
    } catch {
      setCounts((prev) => ({ ...prev, tasks }));
    }
  }, [connected]);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchCounts]);

  return counts;
}
