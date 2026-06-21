// PRP-061: Conector Balles — tipos del dominio de videovigilancia (appliance push).

export const CONECTOR_ESTADOS = [
  "pendiente",
  "emparejado",
  "online",
  "offline",
  "error",
] as const;

export type ConectorEstado = (typeof CONECTOR_ESTADOS)[number];

export type ConectorRow = {
  id: string;
  empresa_id: string;
  local_id: string | null;
  nombre: string;
  estado: ConectorEstado;
  pairing_code: string | null;
  pairing_expira: string | null;
  device_token_hash: string | null;
  last_seen_at: string | null;
  fw_version: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

// Lo que devolvemos al portal: nunca exponemos device_token_hash.
export type ConectorPublic = Omit<ConectorRow, "device_token_hash">;

export const ESTADO_LABEL: Record<ConectorEstado, string> = {
  pendiente: "Pendiente de emparejar",
  emparejado: "Emparejado",
  online: "En línea",
  offline: "Sin conexión",
  error: "Error",
};
