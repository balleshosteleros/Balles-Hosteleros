/**
 * PRP-054 · Llamadas internas por WebRTC entre empleados.
 * Tipos compartidos del feature (Fase 1: datos + multi-tenant).
 */

export type LlamadaTipo = "voz" | "video";

export type LlamadaEstado =
  | "iniciando"
  | "sonando"
  | "conectada"
  | "finalizada"
  | "rechazada"
  | "perdida"
  | "cancelada"
  | "ocupado";

/** Estados que cierran una llamada (sirven para fijar finalizada_at/duracion). */
export const ESTADOS_TERMINALES: readonly LlamadaEstado[] = [
  "finalizada",
  "rechazada",
  "perdida",
  "cancelada",
  "ocupado",
];

/** Fila de `llamadas_internas` ya mapeada a camelCase. */
export interface LlamadaInterna {
  id: string;
  empresaId: string;
  callerId: string;
  calleeId: string;
  tipo: LlamadaTipo;
  estado: LlamadaEstado;
  duracionSeg: number;
  iniciadaAt: string;
  conectadaAt: string | null;
  finalizadaAt: string | null;
}

/** Item de historial enriquecido con la contraparte, relativo al usuario actual. */
export interface LlamadaHistorialItem extends LlamadaInterna {
  direccion: "entrante" | "saliente";
  contraparteUserId: string;
  contraparteNombre: string;
  contraparteAvatarUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Señalización WebRTC (Fase 2) — Broadcast efímero sobre canal privado por empresa
// ─────────────────────────────────────────────────────────────────────────────

export type SignalKind =
  | "invite" // el caller anuncia una llamada entrante
  | "offer" // SDP offer
  | "answer" // SDP answer
  | "ice" // ICE candidate
  | "accept" // el callee acepta
  | "reject" // el callee rechaza
  | "cancel" // el caller cancela antes de que acepten
  | "hangup" // colgar (cualquiera de los dos)
  | "busy"; // el callee está ocupado en otra llamada

/** Mensaje de señalización dirigido (de `from` a `to`) que viaja por Broadcast. */
export interface SignalMessage {
  kind: SignalKind;
  callId: string;
  from: string; // userId emisor (lo fija el hook)
  to: string; // userId destinatario
  tipo?: LlamadaTipo;
  fromNombre?: string;
  fromAvatar?: string | null;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

/** Estado de presencia de un empleado conectado en la empresa. */
export interface PresenciaUsuario {
  userId: string;
  nombre: string;
  avatarUrl: string | null;
  onlineAt: string;
}

/** Empleado al que se puede llamar dentro de la empresa activa. */
export interface EmpleadoLlamable {
  userId: string;
  empleadoId: string;
  nombre: string;
  apellidos: string | null;
  nombreCompleto: string;
  avatarUrl: string | null;
  puesto: string | null;
  departamento: string | null;
}
