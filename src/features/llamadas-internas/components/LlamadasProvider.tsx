"use client";

/**
 * PRP-054 · Fase 4 — Orquestador global de llamadas internas.
 *
 * Monta señalización (Realtime privado), presencia y el motor WebRTC, y traduce
 * las señales entrantes en transiciones de la llamada activa (store). Renderiza
 * los overlays globales (entrante / en curso) y expone un contexto para que el
 * directorio (drawer en escritorio, /m/llamar en móvil) pueda iniciar llamadas
 * y leer la presencia desde cualquier vista.
 */

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useSignaling } from "@/features/llamadas-internas/hooks/useSignaling";
import { usePresencia } from "@/features/llamadas-internas/hooks/usePresencia";
import { usePeerConnection } from "@/features/llamadas-internas/hooks/usePeerConnection";
import { useLlamadaStore } from "@/features/llamadas-internas/store/llamada-store";
import { startRingtone, stopRingtone } from "@/features/llamadas-internas/lib/ringtone";
import {
  createLlamada,
  updateEstadoLlamada,
} from "@/features/llamadas-internas/actions/llamadas-actions";
import type {
  EmpleadoLlamable,
  PresenciaUsuario,
  SignalMessage,
} from "@/features/llamadas-internas/types";
import { LlamadaEntranteCard } from "@/features/llamadas-internas/components/LlamadaEntranteCard";
import { LlamadaEnCursoView } from "@/features/llamadas-internas/components/LlamadaEnCursoView";

interface LlamadasContextValue {
  iniciarLlamada: (callee: EmpleadoLlamable) => Promise<void>;
  conectados: PresenciaUsuario[];
  conectadosIds: Set<string>;
  enLlamada: boolean;
}

const LlamadasContext = createContext<LlamadasContextValue | null>(null);

export function useLlamadas() {
  const ctx = useContext(LlamadasContext);
  if (!ctx) throw new Error("useLlamadas debe usarse dentro de LlamadasProvider");
  return ctx;
}

export function LlamadasProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();

  const fase = useLlamadaStore((s) => s.fase);

  const miNombre = `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim() || "Empleado";
  const miAvatar = profile?.avatar_url ?? null;
  const miNombreRef = useRef(miNombre);
  const miAvatarRef = useRef<string | null>(miAvatar);
  miNombreRef.current = miNombre;
  miAvatarRef.current = miAvatar;

  // Refs para romper la dependencia circular signaling ↔ peer.
  const peerRef = useRef<ReturnType<typeof usePeerConnection> | null>(null);
  const sendSignalRef = useRef<((m: Omit<SignalMessage, "from">) => Promise<boolean>) | null>(null);

  // Reenvío de oferta (para que la app, al abrirse desde el push, reciba la
  // llamada en curso) y timeout de "no contesta".
  const resendRef = useRef<number | null>(null);
  const noAnswerRef = useRef<number | null>(null);
  const offerRef = useRef<RTCSessionDescriptionInit | null>(null);

  const clearTimers = useCallback(() => {
    if (resendRef.current) {
      clearInterval(resendRef.current);
      resendRef.current = null;
    }
    if (noAnswerRef.current) {
      clearTimeout(noAnswerRef.current);
      noAnswerRef.current = null;
    }
    offerRef.current = null;
  }, []);

  const noContesta = useCallback(async () => {
    const { fase: f, llamada } = useLlamadaStore.getState();
    if (f !== "saliente" || !llamada) return;
    await sendSignalRef.current?.({ kind: "cancel", callId: llamada.callId, to: llamada.peerUserId });
    void updateEstadoLlamada({ id: llamada.callId, estado: "perdida" });
    toast.info("Sin respuesta");
    await peerRef.current?.hangup(false);
    clearTimers();
    useLlamadaStore.getState().reset();
  }, [clearTimers]);

  const duracionSeg = () => {
    const { llamada } = useLlamadaStore.getState();
    if (!llamada?.conectadaEn) return 0;
    return Math.max(0, Math.round((Date.now() - llamada.conectadaEn) / 1000));
  };

  const handleSignal = useCallback(async (msg: SignalMessage) => {
    const peer = peerRef.current;
    if (!peer || !user) return;
    const store = useLlamadaStore.getState();

    switch (msg.kind) {
      case "offer": {
        // Reenvío de la MISMA oferta (background): ya estoy sonando, ignorar.
        if (store.llamada && store.llamada.callId === msg.callId) return;
        if (store.fase !== "idle") {
          // Estoy en OTRA llamada → ocupado.
          void sendSignalRef.current?.({ kind: "busy", callId: msg.callId, to: msg.from });
          void updateEstadoLlamada({ id: msg.callId, estado: "ocupado" });
          return;
        }
        store.setEntrante({
          callId: msg.callId,
          peerUserId: msg.from,
          peerNombre: msg.fromNombre ?? "Empleado",
          peerAvatar: msg.fromAvatar ?? null,
          tipo: msg.tipo ?? "voz",
          rol: "callee",
          offer: msg.sdp,
          conectadaEn: null,
        });
        startRingtone();
        break;
      }
      case "answer": {
        if (msg.sdp) await peer.handleAnswer(msg.sdp);
        break;
      }
      case "ice": {
        if (msg.candidate) await peer.handleRemoteCandidate(msg.candidate);
        break;
      }
      case "reject": {
        stopRingtone();
        toast.info(`${store.llamada?.peerNombre ?? "El empleado"} rechazó la llamada`);
        await peer.hangup(false);
        store.reset();
        break;
      }
      case "busy": {
        toast.info(`${store.llamada?.peerNombre ?? "El empleado"} está ocupado`);
        await peer.hangup(false);
        store.reset();
        break;
      }
      case "cancel":
      case "hangup": {
        stopRingtone();
        await peer.hangup(false);
        store.reset();
        break;
      }
    }
  }, [user]);

  const { sendSignal } = useSignaling(handleSignal);
  sendSignalRef.current = sendSignal;

  const { conectados, conectadosIds } = usePresencia();
  const peer = usePeerConnection({ sendSignal });
  peerRef.current = peer;

  // Al dejar de estar "saliente" (contestada, rechazada, etc.) paramos el
  // reenvío de oferta y el timeout de no-contesta.
  useEffect(() => {
    if (fase !== "saliente") clearTimers();
  }, [fase, clearTimers]);

  // Transiciones por estado de la conexión WebRTC.
  useEffect(() => {
    const store = useLlamadaStore.getState();
    if (peer.estado === "conectada") {
      if (store.llamada && store.fase !== "en_curso") {
        store.marcarConectada(Date.now());
        void updateEstadoLlamada({ id: store.llamada.callId, estado: "conectada" });
      }
    } else if (peer.estado === "fallida") {
      if (store.llamada) {
        toast.error("La llamada no se pudo establecer");
        void updateEstadoLlamada({ id: store.llamada.callId, estado: "finalizada" });
      }
      stopRingtone();
      store.reset();
    }
  }, [peer.estado]);

  const iniciarLlamada = useCallback(async (callee: EmpleadoLlamable) => {
    const store = useLlamadaStore.getState();
    if (store.fase !== "idle") {
      toast.info("Ya tienes una llamada en curso");
      return;
    }
    if (callee.userId === user?.id) return;
    const res = await createLlamada({ calleeId: callee.userId, tipo: "voz" });
    if (!res.ok) {
      toast.error("No se pudo iniciar la llamada");
      return;
    }
    store.setSaliente({
      callId: res.id,
      peerUserId: callee.userId,
      peerNombre: callee.nombreCompleto,
      peerAvatar: callee.avatarUrl,
      tipo: "voz",
      rol: "caller",
      conectadaEn: null,
    });
    try {
      const offer = await peerRef.current?.startCall(res.id, callee.userId, "voz", {
        fromNombre: miNombreRef.current,
        fromAvatar: miAvatarRef.current,
      });
      offerRef.current = offer ?? null;

      // Reenvío de la oferta: si el destinatario tenía la app cerrada, al
      // abrirla desde el push recibirá el siguiente reenvío y empezará a sonar.
      resendRef.current = window.setInterval(() => {
        const st = useLlamadaStore.getState();
        if (st.fase !== "saliente" || !st.llamada || !offerRef.current) return;
        void sendSignalRef.current?.({
          kind: "offer",
          callId: st.llamada.callId,
          to: st.llamada.peerUserId,
          tipo: "voz",
          sdp: offerRef.current,
          fromNombre: miNombreRef.current,
          fromAvatar: miAvatarRef.current,
        });
      }, 2500);

      // Sin respuesta tras 35s → perdida.
      noAnswerRef.current = window.setTimeout(() => {
        void noContesta();
      }, 35000);
    } catch {
      toast.error("No se pudo acceder al micrófono");
      void updateEstadoLlamada({ id: res.id, estado: "cancelada" });
      clearTimers();
      useLlamadaStore.getState().reset();
    }
  }, [user?.id, noContesta, clearTimers]);

  const aceptar = useCallback(async () => {
    stopRingtone();
    const { llamada } = useLlamadaStore.getState();
    if (!llamada?.offer) return;
    useLlamadaStore.getState().setFase("conectando");
    try {
      await peerRef.current?.answerCall(llamada.callId, llamada.peerUserId, llamada.offer);
    } catch {
      toast.error("No se pudo acceder al micrófono");
      await peerRef.current?.hangup(true);
      void updateEstadoLlamada({ id: llamada.callId, estado: "finalizada" });
      useLlamadaStore.getState().reset();
    }
  }, []);

  const rechazar = useCallback(async () => {
    stopRingtone();
    const { llamada } = useLlamadaStore.getState();
    if (!llamada) return;
    await sendSignalRef.current?.({ kind: "reject", callId: llamada.callId, to: llamada.peerUserId });
    void updateEstadoLlamada({ id: llamada.callId, estado: "rechazada" });
    useLlamadaStore.getState().reset();
  }, []);

  const colgar = useCallback(async () => {
    const { llamada, fase: f } = useLlamadaStore.getState();
    if (!llamada) return;
    const dur = duracionSeg();
    await peerRef.current?.hangup(true);
    const estado = f === "en_curso" ? "finalizada" : llamada.rol === "caller" ? "cancelada" : "finalizada";
    void updateEstadoLlamada({ id: llamada.callId, estado, duracionSeg: dur });
    stopRingtone();
    useLlamadaStore.getState().reset();
  }, []);

  return (
    <LlamadasContext.Provider
      value={{ iniciarLlamada, conectados, conectadosIds, enLlamada: fase !== "idle" }}
    >
      {children}
      {fase === "entrante" && <LlamadaEntranteCard onAceptar={aceptar} onRechazar={rechazar} />}
      {(fase === "saliente" || fase === "conectando" || fase === "en_curso") && (
        <LlamadaEnCursoView muted={peer.muted} onToggleMute={peer.toggleMute} onColgar={colgar} />
      )}
    </LlamadasContext.Provider>
  );
}
