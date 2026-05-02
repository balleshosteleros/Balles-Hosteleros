"use client";

// Store global del Portal de Formación (modelo classroom).
// Cursos → Secciones → Lecciones, más Novedades y "completadas".
// Compartido entre /mi-panel/formacion (empleado) y /rrhh/formacion (admin).
// Persiste en localStorage para que los cambios del admin los vea el empleado
// al instante (mock; cuando se conecte Supabase se sustituye esta capa).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSeed } from "../data/seed";
import type {
  Curso,
  Leccion,
  NovedadFormacion,
  Puesto,
  RecursoLeccion,
  Seccion,
} from "../types";

const STORAGE_KEY = "balles_formacion_v2";

interface State {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
  novedades: NovedadFormacion[];
  /** key = `${userKey}:${leccionId}` */
  completadas: Record<string, boolean>;
  hydrated: boolean;
}

interface Actions {
  // Cursos
  addCurso: (c: Omit<Curso, "id">) => string;
  updateCurso: (id: string, patch: Partial<Curso>) => void;
  removeCurso: (id: string) => void;

  // Secciones
  addSeccion: (s: Omit<Seccion, "id">) => string;
  updateSeccion: (id: string, patch: Partial<Seccion>) => void;
  removeSeccion: (id: string) => void;

  // Lecciones
  addLeccion: (l: Omit<Leccion, "id" | "recursos"> & { recursos?: RecursoLeccion[] }) => string;
  updateLeccion: (id: string, patch: Partial<Leccion>) => void;
  removeLeccion: (id: string) => void;

  // Novedades
  addNovedad: (n: Omit<NovedadFormacion, "id">) => void;
  updateNovedad: (id: string, patch: Partial<NovedadFormacion>) => void;
  removeNovedad: (id: string) => void;

  // Progreso
  marcarCompletada: (userKey: string, leccionId: string) => void;
  desmarcarCompletada: (userKey: string, leccionId: string) => void;

  // Reset
  resetSeed: () => void;
}

const seed = buildSeed();

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useFormacionStore = create<State & Actions>()(
  persist(
    (set) => ({
      cursos: seed.cursos,
      secciones: seed.secciones,
      lecciones: seed.lecciones,
      novedades: seed.novedades,
      completadas: {},
      hydrated: false,

      // ─── Cursos ─────────────────────────────────────
      addCurso: (c) => {
        const id = genId("c");
        set((s) => ({ cursos: [...s.cursos, { ...c, id }] }));
        return id;
      },
      updateCurso: (id, patch) =>
        set((s) => ({
          cursos: s.cursos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCurso: (id) =>
        set((s) => {
          const seccionIds = s.secciones
            .filter((sec) => sec.cursoId === id)
            .map((sec) => sec.id);
          const leccionIdsBorrar = new Set(
            s.lecciones
              .filter((l) => l.cursoId === id)
              .map((l) => l.id),
          );
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
              n.cursoId === id
                ? { ...n, cursoId: undefined, leccionId: undefined }
                : n,
            ),
            completadas,
          };
        }),

      // ─── Secciones ──────────────────────────────────
      addSeccion: (sNew) => {
        const id = genId("s");
        set((s) => ({ secciones: [...s.secciones, { ...sNew, id }] }));
        return id;
      },
      updateSeccion: (id, patch) =>
        set((s) => ({
          secciones: s.secciones.map((sec) =>
            sec.id === id ? { ...sec, ...patch } : sec,
          ),
        })),
      removeSeccion: (id) =>
        set((s) => {
          const leccionIdsBorrar = new Set(
            s.lecciones
              .filter((l) => l.seccionId === id)
              .map((l) => l.id),
          );
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
        }),

      // ─── Lecciones ──────────────────────────────────
      addLeccion: (l) => {
        const id = genId("l");
        set((s) => ({
          lecciones: [
            ...s.lecciones,
            { recursos: [], ...l, id } as Leccion,
          ],
        }));
        return id;
      },
      updateLeccion: (id, patch) =>
        set((s) => ({
          lecciones: s.lecciones.map((l) =>
            l.id === id ? { ...l, ...patch } : l,
          ),
        })),
      removeLeccion: (id) =>
        set((s) => {
          const completadas = { ...s.completadas };
          for (const key of Object.keys(completadas)) {
            const [, lid] = key.split(":");
            if (lid === id) delete completadas[key];
          }
          return {
            lecciones: s.lecciones.filter((l) => l.id !== id),
            novedades: s.novedades.map((n) =>
              n.leccionId === id ? { ...n, leccionId: undefined } : n,
            ),
            completadas,
          };
        }),

      // ─── Novedades ──────────────────────────────────
      addNovedad: (n) =>
        set((s) => ({
          novedades: [...s.novedades, { ...n, id: genId("n") }],
        })),
      updateNovedad: (id, patch) =>
        set((s) => ({
          novedades: s.novedades.map((n) =>
            n.id === id ? { ...n, ...patch } : n,
          ),
        })),
      removeNovedad: (id) =>
        set((s) => ({
          novedades: s.novedades.filter((n) => n.id !== id),
        })),

      // ─── Progreso ───────────────────────────────────
      marcarCompletada: (userKey, leccionId) =>
        set((s) => ({
          completadas: { ...s.completadas, [`${userKey}:${leccionId}`]: true },
        })),
      desmarcarCompletada: (userKey, leccionId) =>
        set((s) => {
          const next = { ...s.completadas };
          delete next[`${userKey}:${leccionId}`];
          return { completadas: next };
        }),

      // ─── Reset ──────────────────────────────────────
      resetSeed: () => {
        const fresh = buildSeed();
        set({
          cursos: fresh.cursos,
          secciones: fresh.secciones,
          lecciones: fresh.lecciones,
          novedades: fresh.novedades,
          completadas: {},
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        cursos: s.cursos,
        secciones: s.secciones,
        lecciones: s.lecciones,
        novedades: s.novedades,
        completadas: s.completadas,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

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
        new Date(b.fechaPublicacion).getTime() -
        new Date(a.fechaPublicacion).getTime(),
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
      // Primero los generales, luego por orden.
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
  const { secciones: cs, leccionesPorSeccion } = leccionesDeCurso(
    secciones,
    lecciones,
    cursoId,
  );
  const out: Leccion[] = [];
  for (const s of cs) {
    out.push(...(leccionesPorSeccion.get(s.id) ?? []));
  }
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
  const vistas = ordenadas.filter(
    (l) => completadas[`${userKey}:${l.id}`],
  ).length;
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
