import { useSyncExternalStore } from "react";
import { CRITERIOS_RESENA_DEFAULT, type CriterioResena } from "./reclutamiento";

let criterios: CriterioResena[] = [...CRITERIOS_RESENA_DEFAULT];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot() {
  return criterios;
}

export function useCriteriosResena(): CriterioResena[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getCriteriosResena(): CriterioResena[] {
  return criterios;
}

function slug(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function addCriterioResena(nombre: string) {
  const trimmed = nombre.trim();
  if (!trimmed) return;
  const baseId = slug(trimmed) || `criterio_${Date.now()}`;
  let id = baseId;
  let i = 1;
  while (criterios.some((c) => c.id === id)) {
    i += 1;
    id = `${baseId}_${i}`;
  }
  criterios = [...criterios, { id, nombre: trimmed }];
  emit();
}

export function renameCriterioResena(id: string, nombre: string) {
  const trimmed = nombre.trim();
  if (!trimmed) return;
  criterios = criterios.map((c) => (c.id === id ? { ...c, nombre: trimmed } : c));
  emit();
}

export function removeCriterioResena(id: string) {
  criterios = criterios.filter((c) => c.id !== id);
  emit();
}
