"use client";

/**
 * PRP-054 · Fase 4 — Tono de llamada entrante generado con Web Audio API.
 * Sin ficheros de audio externos: un patrón de dos pitidos que se repite.
 * (Algunos navegadores bloquean el audio sin gesto previo; se intenta `resume`
 * y se ignora el fallo — el respaldo en background será el push de Fase 5.)
 */

type Ctx = AudioContext & { _ringTimer?: number };

let ctx: Ctx | null = null;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC() as Ctx;
  return ctx;
}

function beep(at: number, freq: number, dur: number) {
  const c = ctx;
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.18, at + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function patron() {
  const c = ctx;
  if (!c) return;
  const t = c.currentTime;
  beep(t, 523.25, 0.2); // C5
  beep(t + 0.25, 659.25, 0.25); // E5
}

export function startRingtone() {
  const c = getCtx();
  if (!c) return;
  void c.resume().catch(() => {});
  stopRingtone();
  patron();
  c._ringTimer = window.setInterval(patron, 2200);
}

export function stopRingtone() {
  if (ctx?._ringTimer) {
    clearInterval(ctx._ringTimer);
    ctx._ringTimer = undefined;
  }
}
