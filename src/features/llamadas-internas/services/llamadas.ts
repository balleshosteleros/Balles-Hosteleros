/**
 * PRP-054 · Fase 3 — Cliente para obtener los servidores ICE.
 * Pide al endpoint server-only `/api/llamadas/ice` los `iceServers` (STUN siempre;
 * TURN solo si está configurado en el servidor). Si falla, cae a STUN público.
 */

const FALLBACK_STUN: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/llamadas/ice", { cache: "no-store" });
    if (!res.ok) throw new Error(`ICE fetch ${res.status}`);
    const json = (await res.json()) as { iceServers?: RTCIceServer[] };
    return json.iceServers && json.iceServers.length > 0 ? json.iceServers : FALLBACK_STUN;
  } catch (err) {
    console.error("[llamadas] fetchIceServers:", err);
    return FALLBACK_STUN;
  }
}
