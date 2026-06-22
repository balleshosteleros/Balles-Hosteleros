/**
 * Tipos compartidos del motor de alertas (PRP-065).
 */
import type { TipoNotificacion } from "@/features/notificaciones/lib/catalogo";

/** Segmento de destinatarios para una emisión. */
export type Segmento =
  | { tipo: "empresa" } // toda la empresa (empleados activos con login)
  | { tipo: "empleados"; empleadoIds: string[] } // fichas concretas
  | { tipo: "departamento"; departamentoId: string } // un departamento
  | { tipo: "area"; area: "OPERATIVA" | "ADMINISTRATIVA" } // área operativa/administrativa
  | { tipo: "rol"; rolLabel: string } // un rol (empresa_roles.nombre / usuarios.rol_label)
  | { tipo: "usuarios"; usuarioIds: string[] }; // logins concretos (emisores que ya resuelven en espacio user_id)

/** Un destinatario resuelto: login + ficha (si existe en la empresa). */
export interface Destinatario {
  empleadoId: string | null;
  usuarioId: string;
}

/** Entrada de `emitirNotificacion`. */
export interface EmitirInput {
  /** Empresa destino. Obligatoria cuando se inyecta cliente service (crons); si
   *  se omite, se usa la empresa activa del usuario autenticado. */
  empresaId?: string;
  tipo: TipoNotificacion | string;
  titulo: string;
  mensaje?: string;
  segmento: Segmento;
  payload?: Record<string, unknown>;
  /** Sobrescriben el default del catálogo si se indican. */
  accionLabel?: string;
  requiereAccion?: boolean;
  refTabla?: string | null;
  refId?: string | null;
  accionUrl?: string | null;
  /** Clave de idempotencia (emisores por cron/evento). Una fila por destinatario+clave. */
  dedupeKey?: string;
  /** Disparar push a los destinatarios con opt-in (default true). */
  push?: boolean;
  /** Emisión del sistema (eventos/crons): usa service role y omite la RLS de gestor.
   *  Por defecto false → usa el cliente del usuario (aviso manual de un gestor). */
  system?: boolean;
}

export interface EmitirResultado {
  ok: boolean;
  destinatarios: number;
  creadas: number;
}
