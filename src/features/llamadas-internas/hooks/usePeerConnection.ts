"use client";

/**
 * PRP-054 · Fase 3 — Motor WebRTC (solo audio en v1).
 *
 * Gestiona el ciclo de vida de una `RTCPeerConnection` 1-a-1: micrófono,
 * offer/answer, intercambio de ICE, reproducción del audio remoto, mute, cierre.
 * No conoce la UI ni el ringing (eso es Fase 4): expone métodos imperativos que
 * el provider orquesta. La señalización entra/sale por `sendSignal` (Fase 2).
 *
 * Conectividad: STUN público por defecto (sin nada externo). TURN se enchufa
 * solo, vía `/api/llamadas/ice`, si algún día se configuran sus env.
 */

import { useCallback, useRef, useState } from "react";
import { fetchIceServers } from "@/features/llamadas-internas/services/llamadas";
import type { LlamadaTipo, SignalMessage } from "@/features/llamadas-internas/types";

export type EstadoConexion =
  | "idle"
  | "llamando"
  | "conectando"
  | "conectada"
  | "cerrada"
  | "fallida";

interface Args {
  sendSignal: (msg: Omit<SignalMessage, "from">) => Promise<boolean>;
}

export function usePeerConnection({ sendSignal }: Args) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  // ICE remotos que llegan antes de tener remoteDescription.
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  // Periodo de gracia ante "disconnected" (cortes breves de red).
  const reconnectRef = useRef<number | null>(null);

  const [estado, setEstado] = useState<EstadoConexion>("idle");
  const [muted, setMuted] = useState(false);

  const getAudioEl = () => {
    if (!remoteAudioRef.current && typeof Audio !== "undefined") {
      const el = new Audio();
      el.autoplay = true;
      remoteAudioRef.current = el;
    }
    return remoteAudioRef.current;
  };

  const buildPc = useCallback(
    async (callId: string, peerId: string) => {
      const iceServers = await fetchIceServers();
      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void sendSignal({ kind: "ice", callId, to: peerId, candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        const el = getAudioEl();
        if (el) {
          el.srcObject = e.streams[0] ?? null;
          void el.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case "connected":
            if (reconnectRef.current) {
              clearTimeout(reconnectRef.current);
              reconnectRef.current = null;
            }
            setEstado("conectada");
            break;
          case "failed":
            setEstado("fallida");
            break;
          case "disconnected":
            // Corte breve: damos margen a que ICE se recupere solo antes de
            // declarar la llamada caída (evita cortar por un microcorte de red).
            if (!reconnectRef.current) {
              reconnectRef.current = window.setTimeout(() => {
                reconnectRef.current = null;
                if (pcRef.current && pcRef.current.connectionState !== "connected") {
                  setEstado("fallida");
                }
              }, 7000);
            }
            break;
          case "closed":
            setEstado("cerrada");
            break;
        }
      };

      pcRef.current = pc;
      callIdRef.current = callId;
      peerIdRef.current = peerId;
      return pc;
    },
    [sendSignal],
  );

  const getMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const addLocalTracks = (pc: RTCPeerConnection, stream: MediaStream) => {
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  };

  const drainCandidates = async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidates.current) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* candidato inválido/tardío: ignorar */
      }
    }
    pendingCandidates.current = [];
  };

  /** CALLER: crea offer y la envía al destinatario (con su identidad para el ringing). */
  const startCall = useCallback(
    async (
      callId: string,
      calleeId: string,
      tipo: LlamadaTipo = "voz",
      meta?: { fromNombre?: string; fromAvatar?: string | null },
    ) => {
      setEstado("llamando");
      const pc = await buildPc(callId, calleeId);
      const stream = await getMic();
      addLocalTracks(pc, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setEstado("conectando");
      await sendSignal({
        kind: "offer",
        callId,
        to: calleeId,
        tipo,
        sdp: offer,
        fromNombre: meta?.fromNombre,
        fromAvatar: meta?.fromAvatar ?? null,
      });
      return offer;
    },
    [buildPc, getMic, sendSignal],
  );

  /** CALLEE: tras aceptar, responde al offer recibido. */
  const answerCall = useCallback(
    async (callId: string, callerId: string, offer: RTCSessionDescriptionInit) => {
      setEstado("conectando");
      const pc = await buildPc(callId, callerId);
      const stream = await getMic();
      addLocalTracks(pc, stream);
      await pc.setRemoteDescription(offer);
      await drainCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal({ kind: "answer", callId, to: callerId, sdp: answer });
    },
    [buildPc, getMic, sendSignal],
  );

  /** CALLER: aplica la answer del destinatario. */
  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(sdp);
    await drainCandidates(pc);
  }, []);

  /** Ambos: aplica un ICE remoto (buffer si aún no hay remoteDescription). */
  const handleRemoteCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingCandidates.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* ignorar */
    }
  }, []);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const estabanActivas = stream.getAudioTracks().some((t) => t.enabled);
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !estabanActivas;
    });
    setMuted(estabanActivas); // si estaban activas → ahora silenciado
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pcRef.current = null;
    localStreamRef.current = null;
    callIdRef.current = null;
    peerIdRef.current = null;
    pendingCandidates.current = [];
  }, []);

  /** Cuelga: avisa al otro extremo (salvo que ya nos hayan colgado) y limpia. */
  const hangup = useCallback(
    async (notify = true) => {
      if (notify && callIdRef.current && peerIdRef.current) {
        await sendSignal({ kind: "hangup", callId: callIdRef.current, to: peerIdRef.current });
      }
      cleanup();
      setEstado("cerrada");
      setMuted(false);
    },
    [cleanup, sendSignal],
  );

  return {
    estado,
    muted,
    startCall,
    answerCall,
    handleAnswer,
    handleRemoteCandidate,
    toggleMute,
    hangup,
  };
}
