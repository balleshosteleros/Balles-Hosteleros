"use client";

// Store global del Portal de Formación (modelo classroom, estilo Skool).
// Cursos → Secciones → Lecciones, más Novedades y "completadas".
// Compartido entre /mi-panel/formacion (empleado) y /rrhh/formacion (admin).
// PERSISTE EN SUPABASE: `hydrate()` carga de BD y cada mutación se replica vía
// server action (optimista en local + persistencia real). Los ids se generan
// como UUID en cliente para que coincidan con la fila de BD.

import { create } from "zustand";
import {
  getFormacionData,
  dbCreateCurso, dbUpdateCurso, dbDeleteCurso,
  dbCreateSeccion, dbUpdateSeccion, dbDeleteSeccion,
  dbCreateLeccion, dbUpdateLeccion, dbDeleteLeccion,
  dbCreateNovedad, dbUpdateNovedad, dbDeleteNovedad,
  dbToggleCompletada,
} from "../actions/formacion-actions";
import type {
  Curso,
  Leccion,
  NovedadFormacion,
  Puesto,
  RecursoLeccion,
  Seccion,
} from "../types";

interface State {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
  novedades: NovedadFormacion[];
  /** key = `${userKey}:${leccionId}` */
  completadas: Record<string, boolean>;
  hydrated: boolean;
  userKey: string;
}

interface Actions {
  hydrate: (userKey: string) => Promise<void>;

  addCurso: (c: Omit<Curso, "id">) => string;
  updateCurso: (id: string, patch: Partial<Curso>) => void;
  removeCurso: (id: string) => void;

  addSeccion: (s: Omit<Seccion, "id">) => string;
  updateSeccion: (id: string, patch: Partial<Seccion>) => void;
  removeSeccion: (id: string) => void;

  addLeccion: (l: Omit<Leccion, "id" | "recursos"> & { recursos?: RecursoLeccion[] }) => string;
  updateLeccion: (id: string, patch: Partial<Leccion>) => void;
  removeLeccion: (id: string) => void;

  addNovedad: (n: Omit<NovedadFormacion, "id">) => void;
  updateNovedad: (id: string, patch: Partial<NovedadFormacion>) => void;
  removeNovedad: (id: string) => void;

  marcarCompletada: (userKey: string, leccionId: string) => void;
  desmarcarCompletada: (userKey: string, leccionId: string) => void;

  /** Recarga desde BD (sustituye al antiguo "reset al seed"). */
  resetSeed: () => void;
}

function uuid(): string {
  return crypto.randomUUID();
}

export const useFormacionStore = create<State & Actions>()((set, get) => ({
  cursos: [],
  secciones: [],
  lecciones: [],
  novedades: [],
  completadas: {},
  hydrated: false,
  userKey: "",

  hydrate: async (userKey) => {
    const res = await getFormacionData();
    const completadas: Record<string, boolean> = {};
    if (res.ok) {
      for (const lid of res.data.progresoLeccionIds) completadas[`${userKey}:${lid}`] = true;
    }
    set({
      cursos: res.data.cursos,
      secciones: res.data.secciones,
      lecciones: res.data.lecciones,
      novedades: res.data.novedades,
      completadas,
      hydrated: true,
      userKey,
    });
  },

  // ─── Cursos ─────────────────────────────────────
  addCurso: (c) => {
    const id = uuid();
    const curso = { ...c, id } as Curso;
    set((s) => ({ cursos: [...s.cursos, curso] }));
    void dbCreateCurso(curso);
    return id;
  },
  updateCurso: (id, patch) => {
    set((s) => ({ cursos: s.cursos.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    void dbUpdateCurso(id, patch);
  },
  removeCurso: (id) => {
    set((s) => {
      const seccionIds = s.secciones.filter((sec) => sec.cursoId === id).map((sec) => sec.id);
      const leccionIdsBorrar = new Set(s.lecciones.filter((l) => l.cursoId === id).map((l) => l.id));
      const completadas = { ...s.completadas };
      for (const key of Object.keys(completadas)) {
        const [, lid] = key.split(":");
        if (leccionIdsBorrar.has(lid)) delete completadas[key];
      }
      return {
        cursos: s.cursos.filter((c) => c.id !== id),
        secciones: s.secciones.filter((sec) => !seccionIds.includes(sec.id)),
        lecciones: s.lecciones.filter((l) => !leccionIdsBorrar.has(l.id)),
        novedades: s.novedades.map((n) =>
          n.cursoId === id ? { ...n, cursoId: undefined, leccionId: undefined } : n,
        ),
        completadas,
      };
    });
    void dbDeleteCurso(id); // la BD cascada secciones/lecciones/progreso
  },

  // ─── Secciones ──────────────────────────────────
  addSeccion: (sNew) => {
    const id = uuid();
    const seccion = { ...sNew, id } as Seccion;
    set((s) => ({ secciones: [...s.secciones, seccion] }));
    void dbCreateSeccion(seccion);
    return id;
  },
  updateSeccion: (id, patch) => {
    set((s) => ({ secciones: s.secciones.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)) }));
    void dbUpdateSeccion(id, patch);
  },
  removeSeccion: (id) => {
    set((s) => {
      const leccionIdsBorrar = new Set(s.lecciones.filter((l) => l.seccionId === id).map((l) => l.id));
      const completadas = { ...s.completadas };
      for (const key of Object.keys(completadas)) {
        const [, lid] = key.split(":");
        if (leccionIdsBorrar.has(lid)) delete completadas[key];
      }
      return {
        secciones: s.secciones.filter((sec) => sec.id !== id),
        lecciones: s.lecciones.filter((l) => !leccionIdsBorrar.has(l.id)),
        completadas,
      };
    });
    void dbDeleteSeccion(id);
  },

  // ─── Lecciones ──────────────────────────────────
  addLeccion: (l) => {
    const id = uuid();
    const leccion = { recursos: [], ...l, id } as Leccion;
    set((s) => ({ lecciones: [...s.lecciones, leccion] }));
    void dbCreateLeccion(leccion);
    return id;
  },
  updateLeccion: (id, patch) => {
    set((s) => ({ lecciones: s.lecciones.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    void dbUpdateLeccion(id, patch);
  },
  removeLeccion: (id) => {
    set((s) => {
      const completadas = { ...s.completadas };
      for (const key of Object.keys(completadas)) {
        const [, lid] = key.split(":");
        if (lid === id) delete completadas[key];
      }
      return {
        lecciones: s.lecciones.filter((l) => l.id !== id),
        novedades: s.novedades.map((n) => (n.leccionId === id ? { ...n, leccionId: undefined } : n)),
        completadas,
      };
    });
    void dbDeleteLeccion(id);
  },

  // ─── Novedades ──────────────────────────────────
  addNovedad: (n) => {
    const novedad = { ...n, id: uuid() } as NovedadFormacion;
    set((s) => ({ novedades: [...s.novedades, novedad] }));
    void dbCreateNovedad(novedad);
  },
  updateNovedad: (id, patch) => {
    set((s) => ({ novedades: s.novedades.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
    void dbUpdateNovedad(id, patch);
  },
  removeNovedad: (id) => {
    set((s) => ({ novedades: s.novedades.filter((n) => n.id !== id) }));
    void dbDeleteNovedad(id);
  },

  // ─── Progreso ───────────────────────────────────
  marcarCompletada: (userKey, leccionId) => {
    set((s) => ({ completadas: { ...s.completadas, [`${userKey}:${leccionId}`]: true } }));
    void dbToggleCompletada(leccionId, true);
  },
  desmarcarCompletada: (userKey, leccionId) => {
    set((s) => {
      const next = { ...s.completadas };
      delete next[`${userKey}:${leccionId}`];
      return { completadas: next };
    });
    void dbToggleCompletada(leccionId, false);
  },

  // ─── Recargar desde BD ──────────────────────────
  resetSeed: () => {
    void get().hydrate(get().userKey);
  },
}));

// ─── Selectores ────────────────────────────────────────────────

const TRES_MESES_MS = 1000 * 60 * 60 * 24 * 90;

export function novedadesActivas(
  novedades: NovedadFormacion[],
  empresaId: string,
  puesto: Puesto | null,
  hoy: Date = new Date(),
): NovedadFormacion[] {
  const corte = hoy.getTime() - TRES_MESES_MS;
  return novedades
    .filter((n) => n.empresaId === empresaId)
    .filter((n) => new Date(n.fechaPublicacion).getTime() >= corte)
    .filter((n) => {
      if (n.audiencia === "todos") return true;
      if (!puesto) return false;
      return n.audiencia.includes(puesto);
    })
    .sort(
      (a, b) =>
        new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime(),
    );
}

export function cursosVisibles(
  cursos: Curso[],
  empresaId: string,
  puesto: Puesto | null,
  opts: { incluirNoPublicados?: boolean } = {},
): Curso[] {
  return cursos
    .filter((c) => c.empresaId === empresaId)
    .filter((c) => opts.incluirNoPublicados || c.publicado)
    .filter((c) => {
      if (c.ambito === "general") return true;
      if (!puesto) return false;
      return c.puesto === puesto;
    })
    .sort((a, b) => {
      if (a.ambito !== b.ambito) return a.ambito === "general" ? -1 : 1;
      return a.orden - b.orden;
    });
}

export function leccionesDeCurso(
  secciones: Seccion[],
  lecciones: Leccion[],
  cursoId: string,
): { secciones: Seccion[]; leccionesPorSeccion: Map<string, Leccion[]>; total: number } {
  const cursoSecciones = secciones
    .filter((s) => s.cursoId === cursoId)
    .sort((a, b) => a.orden - b.orden);
  const map = new Map<string, Leccion[]>();
  let total = 0;
  for (const s of cursoSecciones) {
    const ls = lecciones
      .filter((l) => l.seccionId === s.id)
      .sort((a, b) => a.orden - b.orden);
    map.set(s.id, ls);
    total += ls.length;
  }
  return { secciones: cursoSecciones, leccionesPorSeccion: map, total };
}

export function leccionesOrdenadas(
  secciones: Seccion[],
  lecciones: Leccion[],
  cursoId: string,
): Leccion[] {
  const { secciones: cs, leccionesPorSeccion } = leccionesDeCurso(secciones, lecciones, cursoId);
  const out: Leccion[] = [];
  for (const s of cs) out.push(...(leccionesPorSeccion.get(s.id) ?? []));
  return out;
}

export function avanceCurso(
  secciones: Seccion[],
  lecciones: Leccion[],
  completadas: Record<string, boolean>,
  userKey: string,
  cursoId: string,
): { vistas: number; total: number; pct: number } {
  const ordenadas = leccionesOrdenadas(secciones, lecciones, cursoId);
  const total = ordenadas.length;
  const vistas = ordenadas.filter((l) => completadas[`${userKey}:${l.id}`]).length;
  const pct = total > 0 ? Math.round((vistas / total) * 100) : 0;
  return { vistas, total, pct };
}

export function duracionCurso(
  secciones: Seccion[],
  lecciones: Leccion[],
  cursoId: string,
): number {
  return leccionesOrdenadas(secciones, lecciones, cursoId).reduce(
    (acc, l) => acc + l.duracionMin,
    0,
  );
}
