"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campana, CampanaEmail, CampanaWhatsApp, CampanaMeta } from "@/features/marketing/data/campanas";
import {
  listCampanasAction,
  guardarCampanaAction,
  eliminarCampanaAction,
} from "@/features/marketing/actions/campanas-actions";
import { toast } from "sonner";

/**
 * Hook de campañas: Supabase como fuente principal, localStorage como fallback
 * cuando la tabla aún no está migrada (error típico: relation does not exist).
 */

function lsKey(empresaId: string) {
  return `campanas:${empresaId}`;
}

function lsRead(empresaId: string): Campana[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(lsKey(empresaId));
    return raw ? (JSON.parse(raw) as Campana[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(empresaId: string, list: Campana[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(lsKey(empresaId), JSON.stringify(list));
}

export function useCampanas(empresaId: string) {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modoLocal, setModoLocal] = useState(false); // true si DB aún no migrada

  const recargar = useCallback(async () => {
    const res = await listCampanasAction();
    if (res.ok) {
      setCampanas(res.data);
      setModoLocal(false);
    } else {
      // Fallback a localStorage
      setCampanas(lsRead(empresaId));
      setModoLocal(true);
    }
    setLoaded(true);
  }, [empresaId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const guardar = useCallback(async (c: Campana) => {
    if (modoLocal) {
      const current = lsRead(empresaId);
      const next = current.some((x) => x.id === c.id)
        ? current.map((x) => (x.id === c.id ? { ...c, updatedAt: new Date().toISOString() } : x))
        : [...current, c];
      lsWrite(empresaId, next);
      setCampanas(next);
      return;
    }
    const res = await guardarCampanaAction(c);
    if (res.ok && res.data) {
      setCampanas((prev) => {
        const idx = prev.findIndex((x) => x.id === res.data!.id || x.id === c.id);
        if (idx >= 0) return prev.map((x, i) => (i === idx ? res.data! : x));
        return [res.data!, ...prev];
      });
    } else {
      toast.error(res.error ?? "No se pudo guardar la campaña");
    }
  }, [empresaId, modoLocal]);

  const eliminar = useCallback(async (id: string) => {
    if (modoLocal) {
      const next = lsRead(empresaId).filter((x) => x.id !== id);
      lsWrite(empresaId, next);
      setCampanas(next);
      return;
    }
    const res = await eliminarCampanaAction(id);
    if (res.ok) {
      setCampanas((prev) => prev.filter((x) => x.id !== id));
    } else {
      toast.error(res.error ?? "No se pudo eliminar");
    }
  }, [empresaId, modoLocal]);

  const emails = campanas.filter((c): c is CampanaEmail => c.canal === "email");
  const whatsapps = campanas.filter((c): c is CampanaWhatsApp => c.canal === "whatsapp");
  const metas = campanas.filter((c): c is CampanaMeta => c.canal === "meta");

  return { campanas, emails, whatsapps, metas, guardar, eliminar, loaded, modoLocal, recargar };
}
