/**
 * Tipos del submódulo Sala → Música.
 *
 * El modelo es deliberadamente pequeño: la empresa deja preparadas unas listas
 * con sus canciones y sus horarios, y el equipo del local solo elige y pulsa
 * Play. No hay recomendaciones, ni búsqueda externa, ni streaming de terceros:
 * los archivos son de la propia empresa y viven en R2.
 */

/** Etiquetas de uso sugeridas. Es texto libre en BD: añadir una no migra nada. */
export const ETIQUETAS_MUSICA = [
  "Desayuno",
  "Comida",
  "Tarde",
  "Cena",
  "Copas",
  "Ambiente tranquilo",
  "Fin de semana",
] as const;

export type EtiquetaMusica = (typeof ETIQUETAS_MUSICA)[number];

/** Días ISO: 1 = lunes … 7 = domingo. Coincide con `musica_horarios.dias`. */
export const DIAS_SEMANA: { valor: number; label: string; corto: string }[] = [
  { valor: 1, label: "Lunes", corto: "L" },
  { valor: 2, label: "Martes", corto: "M" },
  { valor: 3, label: "Miércoles", corto: "X" },
  { valor: 4, label: "Jueves", corto: "J" },
  { valor: 5, label: "Viernes", corto: "V" },
  { valor: 6, label: "Sábado", corto: "S" },
  { valor: 7, label: "Domingo", corto: "D" },
];

export interface Cancion {
  id: string;
  titulo: string;
  artista: string | null;
  duracionSeg: number;
  r2Key: string;
  bytes: number;
  mimeType: string;
}

export interface HorarioLista {
  id: string;
  listaId: string;
  dias: number[];
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM"
}

export interface ListaMusica {
  id: string;
  nombre: string;
  etiqueta: string | null;
  favorita: boolean;
  sinHorario: boolean;
  canciones: Cancion[];
  horarios: HorarioLista[];
  /** Calculado en servidor con la zona horaria de la empresa. */
  disponibleAhora: boolean;
  /** Texto legible del porqué del bloqueo ("Disponible de 13:00 a 17:00"). */
  motivoBloqueo: string | null;
}

/** Un local de la empresa. La música es independiente en cada uno. */
export interface LocalMusica {
  id: string;
  nombre: string;
}

/**
 * Estado de la música de UN LOCAL (una fila por local).
 *
 * Dos locales de la misma empresa suenan por separado aunque usen la misma
 * lista: el restaurante puede ir por la canción 3 y la coctelería por la 7.
 */
export interface EstadoReproductor {
  localId: string;
  listaId: string | null;
  cancionId: string | null;
  indice: number;
  reproduciendo: boolean;
  volumen: number;
  comando: string | null;
  comandoSeq: number;
  deviceId: string | null;
  deviceNombre: string | null;
  /** Última señal de vida del equipo de altavoces (ISO). */
  vistoEn: string | null;
  /** Si true, al acabar una canción entra otra al azar. */
  aleatorio: boolean;
}

export type ComandoReproductor =
  | "play"
  | "pause"
  | "siguiente"
  | "anterior"
  | "stop"
  | "volumen"
  | "aleatorio";

/** Uso y tope de almacenamiento de música de la empresa. */
export interface UsoMusica {
  bytesUsados: number;
  bytesLimite: number;
}
