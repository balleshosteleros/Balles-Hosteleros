export type Estado = "PENDIENTE" | "EN PROGRESO" | "ESCALADO" | "TERMINADO";
export type Gravedad = "LEVE" | "MEJORA" | "GRAVE" | "MUY GRAVE";

export interface Actualizacion {
  id: string;
  texto: string;
  fecha: string;
  apuntadoPor: string;
}

export interface Incidencia {
  id: string;
  desperfecto: string;
  local: string;
  estado: Estado;
  gravedad: Gravedad;
  apuntaDesperfecto: string;
  reparador: string;
  fechaPublicado: string;
  comentarios: string;
  actualizaciones: Actualizacion[];
}

export const LOCALES = ["HABANA", "BACANAL", "CENTRAL", "TERRAZA", "ALMACÉN"];
export const ESTADOS: Estado[] = ["PENDIENTE", "EN PROGRESO", "ESCALADO", "TERMINADO"];
export const GRAVEDADES: Gravedad[] = ["LEVE", "MEJORA", "GRAVE", "MUY GRAVE"];
export const AREAS = ["GERENCIA", "SEGURO", "DIRECCIÓN", "MANTENIMIENTO", "RRHH"];
export const REPARADORES = ["MANTENIMIENTO", "SEGURO", "DIRECCIÓN", "GERENCIA", "PROVEEDOR EXTERNO", "ELECTRICISTA EXT.", "FONTANERO EXT."];

export const SAMPLE_DATA: Incidencia[] = [
  { id: "1", desperfecto: "Gotera en techo del salón principal", local: "HABANA", estado: "PENDIENTE", gravedad: "GRAVE", apuntaDesperfecto: "GERENCIA", reparador: "MANTENIMIENTO", fechaPublicado: "2026-03-28", comentarios: "Se detectó humedad creciente tras las lluvias. Revisar impermeabilización.", actualizaciones: [
    { id: "1a", texto: "Se ha colocado un cubo provisional para recoger el agua.", fecha: "2026-03-29", apuntadoPor: "MANTENIMIENTO" },
    { id: "1b", texto: "Presupuesto solicitado al proveedor de impermeabilización.", fecha: "2026-04-02", apuntadoPor: "GERENCIA" },
  ] },
  { id: "2", desperfecto: "Luces fundidas en pasillo de acceso", local: "BACANAL", estado: "EN PROGRESO", gravedad: "MEJORA", apuntaDesperfecto: "MANTENIMIENTO", reparador: "ELECTRICISTA EXT.", fechaPublicado: "2026-03-30", comentarios: "Cambiar 4 fluorescentes. Proveedor confirmado para el jueves.", actualizaciones: [] },
  { id: "3", desperfecto: "Cisterna del baño de mujeres no funciona", local: "HABANA", estado: "ESCALADO", gravedad: "MUY GRAVE", apuntaDesperfecto: "DIRECCIÓN", reparador: "FONTANERO EXT.", fechaPublicado: "2026-03-25", comentarios: "Baño fuera de servicio. Afecta a la operativa diaria. Urgente.", actualizaciones: [
    { id: "3a", texto: "Se ha cerrado el baño y señalizado. Derivar al baño alternativo.", fecha: "2026-03-26", apuntadoPor: "DIRECCIÓN" },
  ] },
  { id: "4", desperfecto: "Puerta de emergencia atascada", local: "CENTRAL", estado: "PENDIENTE", gravedad: "MUY GRAVE", apuntaDesperfecto: "SEGURO", reparador: "MANTENIMIENTO", fechaPublicado: "2026-04-01", comentarios: "Riesgo de seguridad. Bisagra rota, posible cambio completo.", actualizaciones: [] },
  { id: "5", desperfecto: "Silla rota en zona de terraza", local: "TERRAZA", estado: "TERMINADO", gravedad: "LEVE", apuntaDesperfecto: "MANTENIMIENTO", reparador: "MANTENIMIENTO", fechaPublicado: "2026-03-20", comentarios: "Reemplazada por silla nueva del almacén.", actualizaciones: [] },
  { id: "6", desperfecto: "Aire acondicionado no enfría", local: "BACANAL", estado: "EN PROGRESO", gravedad: "GRAVE", apuntaDesperfecto: "GERENCIA", reparador: "PROVEEDOR EXTERNO", fechaPublicado: "2026-04-02", comentarios: "Técnico de climatización citado para revisión.", actualizaciones: [] },
  { id: "7", desperfecto: "Baldosa suelta en entrada principal", local: "CENTRAL", estado: "PENDIENTE", gravedad: "MEJORA", apuntaDesperfecto: "MANTENIMIENTO", reparador: "MANTENIMIENTO", fechaPublicado: "2026-04-03", comentarios: "Peligro de tropiezo. Señalizar mientras tanto.", actualizaciones: [] },
  { id: "8", desperfecto: "Estanterías del almacén desniveladas", local: "ALMACÉN", estado: "TERMINADO", gravedad: "LEVE", apuntaDesperfecto: "DIRECCIÓN", reparador: "MANTENIMIENTO", fechaPublicado: "2026-03-15", comentarios: "Niveladas y reforzadas con soportes adicionales.", actualizaciones: [] },
  { id: "9", desperfecto: "Fuga de agua en cocina", local: "HABANA", estado: "ESCALADO", gravedad: "GRAVE", apuntaDesperfecto: "GERENCIA", reparador: "FONTANERO EXT.", fechaPublicado: "2026-04-04", comentarios: "Tubería corroída. Necesita sustitución de tramo completo.", actualizaciones: [] },
  { id: "10", desperfecto: "Pintura descascarada en fachada", local: "TERRAZA", estado: "PENDIENTE", gravedad: "MEJORA", apuntaDesperfecto: "MANTENIMIENTO", reparador: "PROVEEDOR EXTERNO", fechaPublicado: "2026-04-05", comentarios: "Solicitar presupuesto a pintor habitual.", actualizaciones: [] },
];
