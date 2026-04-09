export interface Descuento {
  id: string;
  codigo: string;
  ejecucion: string;
  tenerEnCuenta: string;
  activo: boolean;
  observaciones: string;
  creadoPor: string;
  fechaCreacion: string;
  ultimaActualizacion: string;
}

export interface ResultadoMensual {
  id: string;
  mes: string; // "2025-01", "2025-02", etc.
  etiqueta: string; // "Enero 2025"
  pdfNombre: string;
  datos: ResultadoDato[];
}

export interface ResultadoDato {
  codigoDescuento: string;
  totalDescontado: number;
  usos: number;
}

const DESCUENTOS_BASE: Descuento[] = [
  {
    id: "d1", codigo: "CHUPITO",
    ejecucion: "Se aplica cuando se ofrece un chupito de cortesía al cliente como gesto comercial. El camarero lo registra en el TPV seleccionando este código.",
    tenerEnCuenta: "Máximo 1 chupito por mesa. Solo con autorización del jefe de sala. No acumulable con otros descuentos.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d2", codigo: "EMPLEADO VISITA",
    ejecucion: "Descuento aplicado cuando un empleado acude al local como cliente fuera de su horario laboral. Se aplica directamente en cuenta.",
    tenerEnCuenta: "El empleado debe identificarse. No válido en días de evento especial. Descuento sobre consumo personal, no para acompañantes.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d3", codigo: "IVAN BALLESTEROS",
    ejecucion: "Descuento especial de dirección. Se aplica bajo autorización directa de Iván Ballesteros.",
    tenerEnCuenta: "Solo autorizado por dirección. Requiere justificación. Registrar siempre el motivo en observaciones del TPV.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d4", codigo: "MERMA",
    ejecucion: "Se usa para registrar producto que se ha estropeado, caducado o desperdiciado. El encargado lo registra como merma para control de stock.",
    tenerEnCuenta: "Requiere foto del producto. Debe registrarse el mismo día. Reportar al jefe de cocina si es recurrente.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d5", codigo: "SIN PAGAR",
    ejecucion: "Código para registrar consumiciones que no se han cobrado por cualquier motivo operativo. Debe siempre justificarse.",
    tenerEnCuenta: "Obligatorio dejar nota explicativa. Revisión semanal por gerencia. Excesivo uso genera alerta automática.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d6", codigo: "MARKETING",
    ejecucion: "Descuento asociado a acciones de marketing: influencers, eventos promocionales, invitaciones estratégicas.",
    tenerEnCuenta: "Debe estar previamente aprobado por el departamento de marketing. Registrar campaña o acción asociada.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d7", codigo: "JUSTIFICATIVO",
    ejecucion: "Descuento genérico con justificación obligatoria. Se usa cuando ningún otro código aplica pero hay un motivo legítimo.",
    tenerEnCuenta: "Siempre dejar justificación por escrito. Revisión obligatoria por gerencia. No abusar de este código.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d8", codigo: "10%",
    ejecucion: "Descuento fijo del 10% sobre el total de la cuenta. Se aplica en situaciones comerciales autorizadas.",
    tenerEnCuenta: "No acumulable con otros descuentos. Requiere autorización del responsable de turno.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d9", codigo: "AGUA",
    ejecucion: "Cortesía de agua para la mesa. Se registra como descuento para control de stock y costes.",
    tenerEnCuenta: "Solo agua, no otras bebidas. Un servicio por mesa como máximo.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d10", codigo: "CALIDAD 25%",
    ejecucion: "Descuento del 25% aplicado por problema de calidad en el servicio o producto. Compensación parcial al cliente.",
    tenerEnCuenta: "Registrar incidencia de calidad asociada. Notificar al jefe de cocina o sala. Seguimiento obligatorio.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d11", codigo: "CALIDAD 50%",
    ejecucion: "Descuento del 50% aplicado por problema grave de calidad. Compensación significativa al cliente.",
    tenerEnCuenta: "Requiere autorización de gerencia. Documentar incidencia completa. Seguimiento con el cliente si es posible.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d12", codigo: "CALIDAD 100%",
    ejecucion: "Invitación completa al cliente por problema crítico de calidad. Se asume el coste total.",
    tenerEnCuenta: "Solo con autorización de dirección o gerencia. Documentación obligatoria. Informe de incidencia requerido.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d13", codigo: "COLABORACIONES",
    ejecucion: "Descuento para colaboradores externos del negocio: proveedores, socios, alianzas estratégicas.",
    tenerEnCuenta: "Debe existir acuerdo previo de colaboración. Registrar nombre del colaborador y empresa.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d14", codigo: "BEBIDA COMIDA PERSONAL",
    ejecucion: "Consumición del personal durante su turno. Se registra para control pero no genera cobro al empleado.",
    tenerEnCuenta: "Solo durante el turno de trabajo. Limitado al menú de personal autorizado. No incluye bebidas alcohólicas.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d15", codigo: "INSPECCIONES",
    ejecucion: "Consumiciones durante inspecciones oficiales (sanidad, trabajo, etc.). Cortesía institucional.",
    tenerEnCuenta: "Registrar tipo de inspección y organismo. Comunicar a gerencia inmediatamente.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
  {
    id: "d16", codigo: "BONO 10 MENÚ DEL DÍA",
    ejecucion: "Bono de 10 menús del día prepagados con descuento. Se descuenta una unidad del bono en cada uso.",
    tenerEnCuenta: "Verificar que el bono tiene usos restantes. No válido en festivos salvo indicación contraria. No transferible.",
    activo: true, observaciones: "", creadoPor: "Sistema", fechaCreacion: "2024-01-01", ultimaActualizacion: "2024-01-01",
  },
];

const RESULTADOS_EJEMPLO: ResultadoMensual[] = [
  {
    id: "r1", mes: "2025-01", etiqueta: "Enero 2025", pdfNombre: "",
    datos: [
      { codigoDescuento: "CHUPITO", totalDescontado: 120, usos: 48 },
      { codigoDescuento: "EMPLEADO VISITA", totalDescontado: 340, usos: 12 },
      { codigoDescuento: "MERMA", totalDescontado: 210, usos: 15 },
      { codigoDescuento: "MARKETING", totalDescontado: 560, usos: 8 },
      { codigoDescuento: "CALIDAD 25%", totalDescontado: 95, usos: 6 },
      { codigoDescuento: "BEBIDA COMIDA PERSONAL", totalDescontado: 480, usos: 62 },
    ],
  },
  {
    id: "r2", mes: "2025-02", etiqueta: "Febrero 2025", pdfNombre: "",
    datos: [
      { codigoDescuento: "CHUPITO", totalDescontado: 135, usos: 54 },
      { codigoDescuento: "EMPLEADO VISITA", totalDescontado: 290, usos: 10 },
      { codigoDescuento: "MERMA", totalDescontado: 180, usos: 11 },
      { codigoDescuento: "MARKETING", totalDescontado: 720, usos: 14 },
      { codigoDescuento: "CALIDAD 50%", totalDescontado: 250, usos: 4 },
      { codigoDescuento: "BEBIDA COMIDA PERSONAL", totalDescontado: 510, usos: 68 },
      { codigoDescuento: "10%", totalDescontado: 380, usos: 22 },
    ],
  },
  {
    id: "r3", mes: "2025-03", etiqueta: "Marzo 2025", pdfNombre: "",
    datos: [
      { codigoDescuento: "CHUPITO", totalDescontado: 98, usos: 39 },
      { codigoDescuento: "EMPLEADO VISITA", totalDescontado: 310, usos: 11 },
      { codigoDescuento: "MERMA", totalDescontado: 260, usos: 19 },
      { codigoDescuento: "MARKETING", totalDescontado: 430, usos: 6 },
      { codigoDescuento: "JUSTIFICATIVO", totalDescontado: 150, usos: 5 },
      { codigoDescuento: "BEBIDA COMIDA PERSONAL", totalDescontado: 490, usos: 65 },
      { codigoDescuento: "COLABORACIONES", totalDescontado: 200, usos: 3 },
    ],
  },
];

export function buildDefaultDescuentos(): Descuento[] {
  return DESCUENTOS_BASE.map((d) => ({ ...d }));
}

export function buildDefaultResultados(): ResultadoMensual[] {
  return RESULTADOS_EJEMPLO.map((r) => ({ ...r, datos: r.datos.map((d) => ({ ...d })) }));
}
