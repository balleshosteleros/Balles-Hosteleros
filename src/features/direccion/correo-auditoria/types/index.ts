/**
 * Tipos de la auditoría de correos (PRP-094).
 *
 * Viven fuera del archivo de acciones porque un archivo `"use server"` solo
 * puede exportar funciones async: cualquier otra exportación lo rompe.
 */

/**
 * Estado de la conexión de un buzón. Son TRES, no dos, y esa es la gracia:
 *
 *  - `sin_conectar` → nadie ha dado permiso todavía
 *  - `conectado`    → se está contando su correo
 *  - `caducado`     → hubo permiso y se ha revocado en Google
 *
 * Ninguno se enseña como «0 correos»: un cero significa que no entró ni un
 * correo, que es una información completamente distinta de no poder mirar.
 */
export type ConexionBuzon = "sin_conectar" | "conectado" | "caducado";

export interface BuzonVista {
  id: string;
  email: string;
  etiqueta: string;
  conexion: ConexionBuzon;
  /** Nombre de quien dio el permiso la última vez. Informativo. */
  conectadoPor: string | null;
  /**
   * Última vez que se trajo correo, YA formateada (dd/mm/aaaa, hh:mm) en la
   * zona de la empresa. Se formatea en servidor a propósito: el navegador puede
   * estar en otro huso y enseñaría una hora que aquí no ha existido.
   */
  ultimaSync: string | null;
  ultimoError: string | null;
}

// ─── Panel de Dirección › Auditorías › Correo ──────────────────────────────

export type Periodo = "dia" | "semana" | "mes";

export interface FiltrosPanelCorreo {
  periodo: Periodo;
  /** Un buzón concreto, o null para ver todos los que se pueden leer. */
  buzonId: string | null;
  /**
   * Agrupar el ranking por empresa (dominio) en vez de por persona (dirección).
   * Con esto, los quince correos de tres personas del mismo proveedor se leen
   * como lo que son: un proveedor.
   */
  porDominio: boolean;
  /**
   * Incluir boletines y `no-reply`. Apagarlo deja el ranking con las personas y
   * empresas con las que de verdad se trabaja.
   */
  incluirAutomaticos: boolean;
}

export interface BuzonDelPanel {
  id: string;
  email: string;
  etiqueta: string;
  conexion: ConexionBuzon;
}

export interface DiaDeCorreo {
  /** aaaa-mm-dd, en el día de la empresa. */
  dia: string;
  entrantes: number;
  salientes: number;
}

/** Una fila del ranking: con quién habla el buzón y cuánto. */
export interface ContactoDelRanking {
  /** Dirección de correo, o dominio si se agrupa por empresa. */
  contacto: string;
  /** Nombre visible más reciente, si el correo lo traía. */
  nombre: string;
  entrantes: number;
  salientes: number;
  total: number;
  /** Qué parte del correo del periodo es de este contacto. */
  porcentaje: number;
  /**
   * Porcentaje acumulado hasta esta fila incluida. Es la columna que hace
   * visible la regla del 80/20: donde cruza el 80 se corta la lista corta de
   * contactos que genera casi todo el trabajo.
   */
  acumulado: number;
}

export interface DatosPanelCorreo {
  rango: { desde: string; hasta: string; etiqueta: string };
  buzones: BuzonDelPanel[];
  totalEntrantes: number;
  totalSalientes: number;
  /** Correos (entrantes + salientes) por día del rango, con un decimal. */
  mediaDiaria: number;
  /** Interlocutores distintos del periodo. Es el total real, no las filas. */
  contactosDistintos: number;
  serie: DiaDeCorreo[];
  ranking: ContactoDelRanking[];
  /**
   * false cuando ningún buzón de la empresa se puede leer todavía. El panel lo
   * dice con esas palabras: enseñar ceros haría creer que no entra correo.
   */
  hayBuzonesConectados: boolean;
}
