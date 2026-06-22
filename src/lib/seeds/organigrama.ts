/**
 * Seed canónico del ORGANIGRAMA base del software.
 *
 * Define la estructura jerárquica por defecto (nodos + edges + zones de área).
 * Se usa al crear una empresa nueva. NO se reescribe en empresas existentes
 * porque el organigrama puede haber sido personalizado por el cliente.
 */

export interface OrganigramaNode {
  id: string;
  label: string;
  area: "operativa" | "administrativa";
  x: number;
  y: number;
}

export interface OrganigramaEdge {
  id: string;
  source: string;
  target: string;
}

export interface OrganigramaZone {
  id: string;
  label: string;
  area: "operativa" | "administrativa";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrganigramaSeed {
  nodes: OrganigramaNode[];
  edges: OrganigramaEdge[];
  zones: OrganigramaZone[];
}

export const ORGANIGRAMA_SEED: OrganigramaSeed = {
  nodes: [
    { id: "socios", label: "SOCIOS", area: "administrativa", x: 560, y: -80 },
    { id: "direccion", label: "DIRECCIÓN", area: "administrativa", x: 560, y: 80 },
    { id: "juridico", label: "JURÍDICO", area: "administrativa", x: 60, y: 200 },
    { id: "gestoria", label: "GESTORÍA", area: "administrativa", x: 200, y: 200 },
    { id: "contabilidad", label: "CONTABILIDAD", area: "administrativa", x: 350, y: 200 },
    { id: "gerencia", label: "GERENCIA", area: "administrativa", x: 500, y: 200 },
    { id: "logistica", label: "LOGÍSTICA", area: "administrativa", x: 640, y: 200 },
    { id: "rrhh", label: "RR.HH", area: "administrativa", x: 780, y: 200 },
    { id: "marketing", label: "MARKETING", area: "administrativa", x: 920, y: 200 },
    { id: "calidad", label: "CALIDAD", area: "administrativa", x: 1060, y: 200 },
    { id: "node-101", label: "COCINA", area: "operativa", x: 700, y: 320 },
    { id: "node-102", label: "SALA", area: "operativa", x: 440, y: 320 },
    { id: "artistas", label: "ARTISTAS", area: "operativa", x: 300, y: 400 },
    { id: "jefe-sala", label: "JEFE DE SALA", area: "operativa", x: 460, y: 400 },
    { id: "jefe-cocina", label: "JEFE DE COCINA", area: "operativa", x: 700, y: 400 },
    { id: "limpieza", label: "LIMPIEZA", area: "operativa", x: 920, y: 360 },
    { id: "mantenimiento", label: "MANTENIMIENTO", area: "operativa", x: 1060, y: 360 },
    { id: "2jefe-sala", label: "2º JEFE DE SALA", area: "operativa", x: 380, y: 500 },
    { id: "hostess", label: "HOSTESS", area: "operativa", x: 560, y: 500 },
    { id: "2jefe-cocina", label: "2º JEFE DE COCINA", area: "operativa", x: 700, y: 500 },
    { id: "camareros", label: "CAMAREROS", area: "operativa", x: 320, y: 600 },
    { id: "cachimberos", label: "CACHIMBEROS", area: "operativa", x: 460, y: 600 },
    { id: "cocineros", label: "COCINEROS", area: "operativa", x: 660, y: 600 },
    { id: "office", label: "OFFICE", area: "operativa", x: 820, y: 600 },
  ],
  edges: [
    { id: "e-direccion-socios", source: "direccion", target: "socios" },
    { id: "e-juridico-direccion", source: "juridico", target: "direccion" },
    { id: "e-gestoria-direccion", source: "gestoria", target: "direccion" },
    { id: "e-contabilidad-direccion", source: "contabilidad", target: "direccion" },
    { id: "e-gerencia-direccion", source: "gerencia", target: "direccion" },
    { id: "e-logistica-direccion", source: "logistica", target: "direccion" },
    { id: "e-rrhh-direccion", source: "rrhh", target: "direccion" },
    { id: "e-marketing-direccion", source: "marketing", target: "direccion" },
    { id: "e-calidad-direccion", source: "calidad", target: "direccion" },
    { id: "e-node101-gerencia", source: "node-101", target: "gerencia" },
    { id: "e-node102-gerencia", source: "node-102", target: "gerencia" },
    { id: "e-jefe-cocina-node101", source: "jefe-cocina", target: "node-101" },
    { id: "e-limpieza-node101", source: "limpieza", target: "node-101" },
    { id: "e-mantenimiento-node101", source: "mantenimiento", target: "node-101" },
    { id: "e-artistas-node102", source: "artistas", target: "node-102" },
    { id: "e-2jefe-sala-jefe-sala", source: "2jefe-sala", target: "jefe-sala" },
    { id: "e-hostess-jefe-sala", source: "hostess", target: "jefe-sala" },
    { id: "e-2jefe-cocina-jefe-cocina", source: "2jefe-cocina", target: "jefe-cocina" },
    { id: "e-camareros-2jefe-sala", source: "camareros", target: "2jefe-sala" },
    { id: "e-cachimberos-2jefe-sala", source: "cachimberos", target: "2jefe-sala" },
    { id: "e-cocineros-2jefe-cocina", source: "cocineros", target: "2jefe-cocina" },
    { id: "e-office-2jefe-cocina", source: "office", target: "2jefe-cocina" },
  ],
  zones: [
    { id: "zone-admin", label: "Área Administrativa", area: "administrativa", x: -30, y: -10, width: 1270, height: 290 },
    { id: "zone-oper", label: "Área Operativa", area: "operativa", x: -40, y: 300, width: 1280, height: 370 },
  ],
};
