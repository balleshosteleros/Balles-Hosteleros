/**
 * Permiso para mandar publicidad a un cliente, canal por canal.
 *
 * ── Tres estados, no dos ───────────────────────────────────────────────────
 * La casilla de la base de datos es un sí/no, pero la realidad tiene tres casos
 * y confundir dos de ellos es lo que acaba en denuncia:
 *
 *   acepta        → dijo que sí. Se le puede escribir.
 *   sin_preguntar → nadie se lo preguntó nunca. Es la mayoría de la base: entraron
 *                   con la migración de CoverManager. No es una negativa.
 *   baja          → pulsó "no quiero recibir más". NUNCA se le vuelve a escribir,
 *                   ni siquiera con el alcance más amplio.
 *
 * Lo que separa `sin_preguntar` de `baja` es la fecha de baja: si está, hubo una
 * negativa expresa.
 *
 * ── Por canal ──────────────────────────────────────────────────────────────
 * Darse de baja de los correos no es renunciar a un WhatsApp. Y al revés:
 * WhatsApp exige permiso expreso por norma de Meta, así que el sí del correo no
 * sirve ahí. Cada canal lleva su casilla y su fecha de baja.
 */

export type CanalPublicidad = "email" | "sms" | "whatsapp";

export type EstadoPermiso = "acepta" | "sin_preguntar" | "baja";

/** Columnas de cada canal en `clientes_sala`. */
export const COLUMNAS_PERMISO: Record<
  CanalPublicidad,
  { acepta: string; bajaAt: string; contacto: string }
> = {
  email: {
    acepta: "acepta_marketing_email",
    bajaAt: "marketing_baja_email_at",
    contacto: "email",
  },
  sms: {
    acepta: "acepta_marketing_sms",
    bajaAt: "marketing_baja_sms_at",
    contacto: "telefono",
  },
  whatsapp: {
    acepta: "acepta_marketing_whatsapp",
    bajaAt: "marketing_baja_whatsapp_at",
    contacto: "telefono",
  },
};

/**
 * A quién entra una campaña.
 *
 * No existe un "a todos" de verdad, y no es un olvido: quien se dio de baja
 * queda fuera siempre. Escribirle otra vez es ilegal, y en la práctica es lo que
 * hace que el cliente marque como spam y arrastre la reputación del dominio, con
 * la que se van también las confirmaciones de reserva.
 */
export type AlcanceCampana = "con_permiso" | "sin_bajas";

export const ALCANCES: { value: AlcanceCampana; label: string; ayuda: string }[] = [
  {
    value: "con_permiso",
    label: "Solo los que lo aceptan",
    ayuda: "Los que dijeron que sí expresamente. Es lo que la ley respalda sin discusión.",
  },
  {
    value: "sin_bajas",
    label: "Todos menos las bajas",
    ayuda:
      "Incluye también a los clientes a los que nunca se preguntó. Nunca a los que pidieron no recibir más.",
  },
];

export const ALCANCE_POR_DEFECTO: AlcanceCampana = "con_permiso";

interface FilaPermiso {
  acepta_marketing_email?: boolean | null;
  acepta_marketing_sms?: boolean | null;
  acepta_marketing_whatsapp?: boolean | null;
  marketing_baja_email_at?: string | null;
  marketing_baja_sms_at?: string | null;
  marketing_baja_whatsapp_at?: string | null;
}

/** En qué situación está este cliente para este canal. */
export function estadoPermiso(fila: FilaPermiso, canal: CanalPublicidad): EstadoPermiso {
  const cols = COLUMNAS_PERMISO[canal];
  const baja = (fila as Record<string, unknown>)[cols.bajaAt];
  if (baja) return "baja";
  const acepta = (fila as Record<string, unknown>)[cols.acepta];
  return acepta ? "acepta" : "sin_preguntar";
}

export const ETIQUETA_PERMISO: Record<EstadoPermiso, string> = {
  acepta: "Acepta",
  sin_preguntar: "Sin preguntar",
  baja: "Baja",
};

/** ¿Entra este cliente en una campaña con este alcance? */
export function entraEnCampana(estado: EstadoPermiso, alcance: AlcanceCampana): boolean {
  if (estado === "baja") return false;
  return alcance === "sin_bajas" || estado === "acepta";
}
