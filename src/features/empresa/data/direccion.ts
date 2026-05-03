export type AreaType = 'administrativa' | 'operativa';

export interface OrgNode {
  id: string;
  label: string;
  area: AreaType;
  x: number;
  y: number;
}

export interface OrgEdge {
  id: string;
  source: string;
  target: string;
}

export interface AreaZone {
  id: string;
  label: string;
  area: 'administrativa' | 'operativa';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrgChart {
  nodes: OrgNode[];
  edges: OrgEdge[];
  zones: AreaZone[];
}

const habanaChart: OrgChart = {
  nodes: [
    // Área Administrativa
    { id: 'socios', label: 'SOCIOS', area: 'administrativa', x: 560, y: -60 },
    { id: 'direccion', label: 'DIRECCIÓN', area: 'administrativa', x: 560, y: 80 },
    { id: 'juridico', label: 'JURÍDICO', area: 'administrativa', x: 60, y: 200 },
    { id: 'gestoria', label: 'GESTORÍA', area: 'administrativa', x: 200, y: 200 },
    { id: 'contabilidad', label: 'CONTABILIDAD', area: 'administrativa', x: 350, y: 200 },
    { id: 'calidad', label: 'CALIDAD', area: 'administrativa', x: 500, y: 200 },
    { id: 'marketing', label: 'MARKETING', area: 'administrativa', x: 640, y: 200 },
    { id: 'rrhh', label: 'RR.HH', area: 'administrativa', x: 780, y: 200 },
    { id: 'logistica', label: 'LOGÍSTICA', area: 'administrativa', x: 920, y: 200 },
    { id: 'gerencia', label: 'GERENCIA', area: 'administrativa', x: 1060, y: 200 },
    // Área Operativa
    { id: 'seguridad', label: 'SEGURIDAD', area: 'operativa', x: 100, y: 400 },
    { id: 'artistas', label: 'ARTISTAS', area: 'operativa', x: 280, y: 400 },
    { id: 'jefe-sala', label: 'JEFE DE SALA', area: 'operativa', x: 480, y: 400 },
    { id: 'jefe-cocina', label: 'JEFE DE COCINA', area: 'operativa', x: 820, y: 400 },
    { id: 'limpieza', label: 'LIMPIEZA', area: 'operativa', x: 1020, y: 400 },
    { id: 'mantenimiento', label: 'MANTENIMIENTO', area: 'operativa', x: 1180, y: 400 },
    { id: '2jefe-sala', label: '2º JEFE DE SALA', area: 'operativa', x: 400, y: 520 },
    { id: 'hostess', label: 'HOSTESS', area: 'operativa', x: 580, y: 520 },
    { id: 'camareros', label: 'CAMAREROS', area: 'operativa', x: 320, y: 630 },
    { id: 'cachimberos', label: 'CACHIMBEROS', area: 'operativa', x: 500, y: 630 },
    { id: '2jefe-cocina', label: '2º JEFE DE COCINA', area: 'operativa', x: 760, y: 520 },
    { id: 'cocineros', label: 'COCINEROS', area: 'operativa', x: 760, y: 630 },
    { id: 'office', label: 'OFFICE', area: 'operativa', x: 930, y: 630 },
  ],
  edges: [
    { id: 'e1', source: 'socios', target: 'direccion' },
    { id: 'e2', source: 'direccion', target: 'juridico' },
    { id: 'e3', source: 'direccion', target: 'gestoria' },
    { id: 'e4', source: 'direccion', target: 'contabilidad' },
    { id: 'e5', source: 'direccion', target: 'calidad' },
    { id: 'e6', source: 'direccion', target: 'marketing' },
    { id: 'e7', source: 'direccion', target: 'rrhh' },
    { id: 'e8', source: 'direccion', target: 'gerencia' },
    { id: 'e9', source: 'direccion', target: 'logistica' },
    { id: 'e10', source: 'gerencia', target: 'seguridad' },
    { id: 'e11', source: 'gerencia', target: 'artistas' },
    { id: 'e12', source: 'gerencia', target: 'jefe-sala' },
    { id: 'e13', source: 'gerencia', target: 'jefe-cocina' },
    { id: 'e14', source: 'gerencia', target: 'limpieza' },
    { id: 'e15', source: 'gerencia', target: 'mantenimiento' },
    { id: 'e16', source: 'jefe-sala', target: '2jefe-sala' },
    { id: 'e17', source: 'jefe-sala', target: 'hostess' },
    { id: 'e18', source: '2jefe-sala', target: 'camareros' },
    { id: 'e19', source: '2jefe-sala', target: 'cachimberos' },
    { id: 'e20', source: 'jefe-cocina', target: '2jefe-cocina' },
    { id: 'e21', source: '2jefe-cocina', target: 'cocineros' },
    { id: 'e22', source: '2jefe-cocina', target: 'office' },
  ],
  zones: [
    { id: 'zone-admin', label: 'Área Administrativa', area: 'administrativa', x: -10, y: -90, width: 1250, height: 370 },
    { id: 'zone-oper', label: 'Área Operativa', area: 'operativa', x: 30, y: 340, width: 1280, height: 370 },
  ],
};

const bacanalChart: OrgChart = {
  nodes: [
    { id: 'socios', label: 'SOCIOS', area: 'administrativa', x: 460, y: -60 },
    { id: 'direccion', label: 'DIRECCIÓN', area: 'administrativa', x: 460, y: 80 },
    { id: 'contabilidad', label: 'CONTABILIDAD', area: 'administrativa', x: 180, y: 200 },
    { id: 'marketing', label: 'MARKETING', area: 'administrativa', x: 360, y: 200 },
    { id: 'rrhh', label: 'RR.HH', area: 'administrativa', x: 540, y: 200 },
    { id: 'gerencia', label: 'GERENCIA', area: 'administrativa', x: 720, y: 200 },
    { id: 'jefe-sala', label: 'JEFE DE SALA', area: 'operativa', x: 400, y: 400 },
    { id: 'jefe-cocina', label: 'JEFE DE COCINA', area: 'operativa', x: 700, y: 400 },
    { id: 'camareros', label: 'CAMAREROS', area: 'operativa', x: 320, y: 520 },
    { id: 'hostess', label: 'HOSTESS', area: 'operativa', x: 500, y: 520 },
    { id: 'cocineros', label: 'COCINEROS', area: 'operativa', x: 700, y: 520 },
  ],
  edges: [
    { id: 'e1', source: 'socios', target: 'direccion' },
    { id: 'e2', source: 'direccion', target: 'contabilidad' },
    { id: 'e3', source: 'direccion', target: 'marketing' },
    { id: 'e4', source: 'direccion', target: 'rrhh' },
    { id: 'e5', source: 'direccion', target: 'gerencia' },
    { id: 'e6', source: 'gerencia', target: 'jefe-sala' },
    { id: 'e7', source: 'gerencia', target: 'jefe-cocina' },
    { id: 'e8', source: 'jefe-sala', target: 'camareros' },
    { id: 'e9', source: 'jefe-sala', target: 'hostess' },
    { id: 'e10', source: 'jefe-cocina', target: 'cocineros' },
  ],
  zones: [
    { id: 'zone-admin', label: 'Área Administrativa', area: 'administrativa', x: 110, y: -90, width: 700, height: 370 },
    { id: 'zone-oper', label: 'Área Operativa', area: 'operativa', x: 250, y: 340, width: 530, height: 260 },
  ],
};

export const orgChartsPorEmpresa: Record<string, OrgChart> = {
  habana: habanaChart,
  bacanal: bacanalChart,
};
