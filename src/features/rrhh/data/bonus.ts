// ─── Bonus de empresa ───────────────────────────────────────────

export type EstadoBonus = "activo" | "inactivo" | "borrador" | "archivado";
export type PeriodicidadBonus = "mensual" | "trimestral" | "semestral" | "anual" | "puntual";
export type TipoDestinatario = "todos" | "roles" | "departamentos" | "empleados";

export const ESTADO_BONUS_LABEL: Record<EstadoBonus, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  borrador: "Borrador",
  archivado: "Archivado",
};

export const ESTADO_BONUS_COLOR: Record<EstadoBonus, string> = {
  activo: "bg-emerald-500 text-white",
  inactivo: "bg-muted-foreground/60 text-white",
  borrador: "bg-amber-500 text-white",
  archivado: "bg-blue-500 text-white",
};

export const PERIODICIDAD_LABEL: Record<PeriodicidadBonus, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  puntual: "Puntual",
};

export interface TramoBonus {
  id: string;
  condicion: string;
  comision: string;
  observaciones: string;
}

export interface TablaTramos {
  id: string;
  titulo: string;
  descripcion: string;
  tramos: TramoBonus[];
}

export interface ReglaBonus {
  id: string;
  titulo: string;
  descripcion: string;
}

export interface Bonus {
  id: string;
  empresaId: string;
  nombre: string;
  tipo: string;
  descripcion: string;
  objetivo: string;
  explicacion: string;
  estado: EstadoBonus;
  periodicidad: PeriodicidadBonus;
  destinatarios: { tipo: TipoDestinatario; ids: string[] };
  destinatariosTexto: string;
  tablas: TablaTramos[];
  reglas: ReglaBonus[];
  formaPago: string;
  premio: string;
  icono: string;
  /** Puestos (puestos.id) a los que aplica este bonus. Fuente única del vínculo bonus↔puesto. */
  puestoIds: string[];
}

export interface ConfigBonusEmpresa {
  normas: string[];
  formasPago: string[];
}

// ─── Data HABANA ────────────────────────────────────────────────

const bonusHabana: Omit<Bonus, "puestoIds">[] = [
  {
    id: "bh1", empresaId: "habana", nombre: "BALANCE", tipo: "Financiero",
    descripcion: "Bonus basado en el resultado del balance trimestral de la empresa.",
    objetivo: "Motivar al equipo a mejorar la diferencia entre facturación y gastos.",
    explicacion: "Se calcula con la diferencia entre la facturación total y los gastos totales del trimestre. El resultado final del balance determina el tramo de comisión aplicable. Se liquida trimestralmente a trimestre vencido.",
    estado: "activo", periodicidad: "trimestral",
    destinatarios: { tipo: "roles", ids: ["GERENTE", "ENCARGADOS"] },
    destinatariosTexto: "Gerente y Encargados",
    tablas: [{
      id: "t1", titulo: "Comisiones por resultado de balance", descripcion: "Tramos de comisión según el resultado positivo del balance trimestral.",
      tramos: [
        { id: "tr1", condicion: "+15.000 €", comision: "300 €", observaciones: "Resultado mínimo" },
        { id: "tr2", condicion: "+20.000 €", comision: "400 €", observaciones: "" },
        { id: "tr3", condicion: "+25.000 €", comision: "500 €", observaciones: "" },
        { id: "tr4", condicion: "+30.000 €", comision: "600 €", observaciones: "Resultado óptimo" },
      ],
    }],
    reglas: [
      { id: "r1", titulo: "Cálculo trimestral", descripcion: "El balance se calcula por trimestre natural (T1, T2, T3, T4)." },
      { id: "r2", titulo: "Desfase de liquidación", descripcion: "Se paga a trimestre vencido por necesidad de cálculo y cierre contable." },
    ],
    formaPago: "Se liquida trimestralmente a trimestre vencido. Existe un desfase temporal necesario para el cierre y cálculo del balance.",
    premio: "", icono: "TrendingUp",
  },
  {
    id: "bh2", empresaId: "habana", nombre: "INVENTARIOS", tipo: "Operativo",
    descripcion: "Bonus basado en el control del inventario mensual de barra y cocina.",
    objetivo: "Premiar el buen control del stock y reducir mermas.",
    explicacion: "Se calcula a través del inventario mensual, dividido en barra y cocina. Se relacionan las entradas (albaranes) con las salidas (ventas) para generar un valor de almacén. El bonus premia la eficiencia en la gestión del stock.",
    estado: "activo", periodicidad: "trimestral",
    destinatarios: { tipo: "roles", ids: ["ENCARGADOS", "JEFE DE COCINA", "GERENTE"] },
    destinatariosTexto: "Encargados, Jefe de Cocina y Gerente",
    tablas: [
      {
        id: "t2", titulo: "Comisiones Encargados / Jefe de Cocina", descripcion: "Tramos aplicables al encargado de barra o jefe de cocina según su área.",
        tramos: [
          { id: "tr5", condicion: "Desviación < 3%", comision: "150 €", observaciones: "Excelente control" },
          { id: "tr6", condicion: "Desviación 3-5%", comision: "100 €", observaciones: "Buen control" },
          { id: "tr7", condicion: "Desviación 5-8%", comision: "50 €", observaciones: "Aceptable" },
          { id: "tr8", condicion: "Desviación > 8%", comision: "0 €", observaciones: "Sin bonus" },
        ],
      },
      {
        id: "t3", titulo: "Comisiones Gerente", descripcion: "Tramos aplicables al gerente sobre el inventario global.",
        tramos: [
          { id: "tr9", condicion: "Desviación global < 4%", comision: "200 €", observaciones: "" },
          { id: "tr10", condicion: "Desviación global 4-6%", comision: "100 €", observaciones: "" },
          { id: "tr11", condicion: "Desviación global > 6%", comision: "0 €", observaciones: "" },
        ],
      },
    ],
    reglas: [
      { id: "r3", titulo: "División barra/cocina", descripcion: "El inventario se calcula de forma separada para barra y cocina." },
      { id: "r4", titulo: "Base de cálculo", descripcion: "Se comparan entradas por albaranes con salidas por ventas para obtener la desviación." },
    ],
    formaPago: "Se liquida trimestralmente junto al resto de bonus.",
    premio: "", icono: "Package",
  },
  {
    id: "bh3", empresaId: "habana", nombre: "INSPECCIÓN", tipo: "Calidad",
    descripcion: "Bonus basado en la nota obtenida en inspecciones internas de calidad.",
    objetivo: "Mantener los estándares de servicio, producto, ventas y limpieza.",
    explicacion: "Se basa en cuestionarios realizados por inspectores internos. Se valoran aspectos como servicio al cliente, calidad del producto, técnicas de venta y limpieza del local. Se obtiene una nota final de 1 a 10 y el bonus depende de esa nota.",
    estado: "activo", periodicidad: "trimestral",
    destinatarios: { tipo: "todos", ids: [] },
    destinatariosTexto: "Todo el equipo",
    tablas: [{
      id: "t4", titulo: "Comisiones por nota de inspección", descripcion: "Tramos según la nota final obtenida en la inspección.",
      tramos: [
        { id: "tr12", condicion: "1 a 7", comision: "0 €", observaciones: "No alcanza el mínimo" },
        { id: "tr13", condicion: "7 a 8", comision: "20 €", observaciones: "" },
        { id: "tr14", condicion: "8 a 9", comision: "35 €", observaciones: "" },
        { id: "tr15", condicion: "9 a 10", comision: "50 €", observaciones: "Excelencia" },
      ],
    }],
    reglas: [
      { id: "r5", titulo: "Inspecciones sorpresa", descripcion: "Las inspecciones se realizan sin previo aviso para garantizar resultados reales." },
      { id: "r6", titulo: "Áreas evaluadas", descripcion: "Servicio, producto, ventas, limpieza y cumplimiento del manual operativo." },
    ],
    formaPago: "Se liquida trimestralmente.",
    premio: "", icono: "ClipboardCheck",
  },
  {
    id: "bh4", empresaId: "habana", nombre: "BIENESTAR", tipo: "Reconocimiento",
    descripcion: "Premio al empleado con mejor nota en los cuestionarios del Manual Operativo.",
    objetivo: "Fomentar el conocimiento del manual y premiar la excelencia individual.",
    explicacion: "Se premia al empleado que obtenga la mejor nota en los cuestionarios del Manual Operativo. El premio consiste en un regalo aleatorio relacionado con salud y bienestar. En caso de empate, gana el empleado con mayor antigüedad en la empresa.",
    estado: "activo", periodicidad: "trimestral",
    destinatarios: { tipo: "todos", ids: [] },
    destinatariosTexto: "Todo el equipo",
    tablas: [],
    reglas: [
      { id: "r7", titulo: "Criterio de desempate", descripcion: "En caso de empate, gana el empleado con mayor antigüedad en la empresa." },
      { id: "r8", titulo: "Tipo de premio", descripcion: "Regalo aleatorio relacionado con salud y bienestar (ej: sesión spa, suscripción gimnasio, etc.)." },
    ],
    formaPago: "Se entrega el premio tras la evaluación trimestral.",
    premio: "Regalo aleatorio de salud y bienestar (valor aprox. 50-100 €)",
    icono: "Heart",
  },
  {
    id: "bh5", empresaId: "habana", nombre: "PROPINAS", tipo: "Variable",
    descripcion: "Reparto de propinas de clientes entre el equipo.",
    objetivo: "Bonificar al equipo mediante las propinas recibidas de los clientes.",
    explicacion: "Las propinas de clientes se recogen y se reparten mensualmente en proporción a las horas trabajadas de cada empleado. El reparto lo gestiona el gerente del establecimiento.",
    estado: "activo", periodicidad: "mensual",
    destinatarios: { tipo: "todos", ids: [] },
    destinatariosTexto: "Todo el equipo",
    tablas: [],
    reglas: [
      { id: "r9", titulo: "Proporcionalidad", descripcion: "El reparto se realiza en proporción a las horas trabajadas en el periodo." },
      { id: "r10", titulo: "Responsable del reparto", descripcion: "El gerente es el encargado de gestionar y repartir las propinas." },
    ],
    formaPago: "Se reparten mensualmente. No dependen del ciclo trimestral del resto de bonus.",
    premio: "", icono: "Coins",
  },
];

// ─── Data BACANAL ───────────────────────────────────────────────

const bonusBacanal: Omit<Bonus, "puestoIds">[] = [
  {
    id: "bb1", empresaId: "bacanal", nombre: "BALANCE", tipo: "Financiero",
    descripcion: "Bonus basado en el resultado del balance trimestral.",
    objetivo: "Incentivar la eficiencia financiera del establecimiento.",
    explicacion: "Se calcula con la diferencia entre facturación y gastos del trimestre.",
    estado: "activo", periodicidad: "trimestral",
    destinatarios: { tipo: "roles", ids: ["GERENTE"] },
    destinatariosTexto: "Gerente",
    tablas: [{
      id: "t5", titulo: "Comisiones por balance", descripcion: "",
      tramos: [
        { id: "tr16", condicion: "+10.000 €", comision: "200 €", observaciones: "" },
        { id: "tr17", condicion: "+15.000 €", comision: "350 €", observaciones: "" },
        { id: "tr18", condicion: "+20.000 €", comision: "500 €", observaciones: "" },
      ],
    }],
    reglas: [{ id: "r11", titulo: "Trimestral", descripcion: "Cálculo y pago trimestral a vencido." }],
    formaPago: "Trimestral a vencido.",
    premio: "", icono: "TrendingUp",
  },
  {
    id: "bb2", empresaId: "bacanal", nombre: "INSPECCIÓN", tipo: "Calidad",
    descripcion: "Bonus por nota de inspecciones internas.",
    objetivo: "Garantizar estándares de calidad.",
    explicacion: "Nota de inspección de 1 a 10 determina el bonus.",
    estado: "activo", periodicidad: "trimestral",
    destinatarios: { tipo: "todos", ids: [] },
    destinatariosTexto: "Todo el equipo",
    tablas: [{
      id: "t6", titulo: "Comisiones por inspección", descripcion: "",
      tramos: [
        { id: "tr19", condicion: "1 a 7", comision: "0 €", observaciones: "" },
        { id: "tr20", condicion: "7 a 8", comision: "15 €", observaciones: "" },
        { id: "tr21", condicion: "8 a 9", comision: "30 €", observaciones: "" },
        { id: "tr22", condicion: "9 a 10", comision: "45 €", observaciones: "" },
      ],
    }],
    reglas: [],
    formaPago: "Trimestral.",
    premio: "", icono: "ClipboardCheck",
  },
  {
    id: "bb3", empresaId: "bacanal", nombre: "PROPINAS", tipo: "Variable",
    descripcion: "Reparto mensual de propinas por horas trabajadas.",
    objetivo: "Bonificación directa del cliente al equipo.",
    explicacion: "Reparto proporcional a horas trabajadas, gestionado por el gerente.",
    estado: "activo", periodicidad: "mensual",
    destinatarios: { tipo: "todos", ids: [] },
    destinatariosTexto: "Todo el equipo",
    tablas: [], reglas: [],
    formaPago: "Mensual.",
    premio: "", icono: "Coins",
  },
];

const configHabana: ConfigBonusEmpresa = {
  normas: [
    "La empresa se reserva el derecho de modificar las tablas, tramos y condiciones de los bonus por razones internas, comunicándolo previamente al equipo.",
    "Cualquier engaño, trampa o robo para beneficiarse de los bonus implicará la anulación del cobro de bonus durante un periodo mínimo de 6 meses.",
    "Los bonus son un complemento voluntario de la empresa y no forman parte del salario base.",
    "La participación en el plan de bonus es automática para los puestos incluidos en cada tipo de bonus.",
  ],
  formasPago: [
    "Los bonus se liquidan trimestralmente, excepto las propinas que se reparten mensualmente.",
    "El pago se realiza a trimestre vencido, con un desfase temporal necesario para el cierre y cálculo.",
    "Ejemplo: el bonus del T1 (enero-marzo) se liquida en abril-mayo tras cerrar cuentas.",
    "Las propinas dependen del gerente y se reparten al final de cada mes.",
  ],
};

const configBacanal: ConfigBonusEmpresa = {
  normas: [
    "La empresa puede modificar condiciones avisando con antelación.",
    "Fraude o manipulación implica anulación de bonus por 6 meses.",
  ],
  formasPago: [
    "Liquidación trimestral a vencido.",
    "Propinas mensuales gestionadas por el gerente.",
  ],
};

// ─── Resultados de Bonus ────────────────────────────────────────

export type EstadoResultado = "pendiente" | "calculado" | "liquidado";

export const ESTADO_RESULTADO_LABEL: Record<EstadoResultado, string> = {
  pendiente: "Pendiente",
  calculado: "Calculado",
  liquidado: "Liquidado",
};

export const ESTADO_RESULTADO_COLOR: Record<EstadoResultado, string> = {
  pendiente: "bg-amber-500 text-white",
  calculado: "bg-blue-500 text-white",
  liquidado: "bg-emerald-500 text-white",
};

export interface ResultadoBonus {
  id: string;
  bonusId: string;
  periodo: string;
  estado: EstadoResultado;
  importe: string;
  resumen: string;
  detalles: Record<string, string>;
}

const resultadosHabana: ResultadoBonus[] = [
  // BALANCE
  { id: "rh1", bonusId: "bh1", periodo: "T1 2026 (Ene–Mar)", estado: "liquidado", importe: "500 €", resumen: "Balance positivo de +26.300 € → tramo +25.000 €",
    detalles: { "Facturación": "142.500 €", "Gastos": "116.200 €", "Balance final": "+26.300 €", "Tramo alcanzado": "+25.000 €", "Bonus resultante": "500 €" } },
  { id: "rh2", bonusId: "bh1", periodo: "T4 2025 (Oct–Dic)", estado: "liquidado", importe: "600 €", resumen: "Balance positivo de +31.800 € → tramo +30.000 €",
    detalles: { "Facturación": "168.900 €", "Gastos": "137.100 €", "Balance final": "+31.800 €", "Tramo alcanzado": "+30.000 €", "Bonus resultante": "600 €" } },
  { id: "rh3", bonusId: "bh1", periodo: "T2 2026 (Abr–Jun)", estado: "pendiente", importe: "—", resumen: "Periodo en curso, pendiente de cierre",
    detalles: { "Facturación": "En curso", "Gastos": "En curso", "Balance final": "Pendiente", "Tramo alcanzado": "—", "Bonus resultante": "—" } },
  // INVENTARIOS
  { id: "rh4", bonusId: "bh2", periodo: "T1 2026 (Ene–Mar)", estado: "calculado", importe: "150 €", resumen: "Desviación barra 2.4%, cocina 4.1%",
    detalles: { "Entrada albaranes barra": "18.400 €", "Salida ventas barra": "17.960 €", "Desviación barra": "2.4%", "Entrada albaranes cocina": "22.100 €", "Salida ventas cocina": "21.190 €", "Desviación cocina": "4.1%", "Tramo encargado barra": "< 3% → 150 €", "Tramo jefe cocina": "3-5% → 100 €" } },
  { id: "rh5", bonusId: "bh2", periodo: "T4 2025 (Oct–Dic)", estado: "liquidado", importe: "100 €", resumen: "Desviación barra 3.8%, cocina 3.2%",
    detalles: { "Desviación barra": "3.8%", "Desviación cocina": "3.2%", "Desviación global": "3.5%", "Tramo encargados": "3-5% → 100 €", "Tramo gerente": "< 4% → 200 €" } },
  // INSPECCIÓN
  { id: "rh6", bonusId: "bh3", periodo: "T1 2026 (Ene–Mar)", estado: "liquidado", importe: "35 €", resumen: "Nota obtenida: 8.5 → tramo 8-9",
    detalles: { "Nota inspección": "8.5 / 10", "Servicio": "8.0", "Producto": "9.0", "Ventas": "8.5", "Limpieza": "8.5", "Tramo aplicado": "8 a 9 → 35 €" } },
  { id: "rh7", bonusId: "bh3", periodo: "T4 2025 (Oct–Dic)", estado: "liquidado", importe: "50 €", resumen: "Nota obtenida: 9.2 → tramo 9-10",
    detalles: { "Nota inspección": "9.2 / 10", "Tramo aplicado": "9 a 10 → 50 €" } },
  // BIENESTAR
  { id: "rh8", bonusId: "bh4", periodo: "T1 2026 (Ene–Mar)", estado: "liquidado", importe: "—", resumen: "Ganador: María López (nota 9.6, 3 años antigüedad)",
    detalles: { "Empleado premiado": "María López", "Nota cuestionario": "9.6 / 10", "Antigüedad": "3 años", "Criterio desempate": "No necesario", "Premio entregado": "Sesión spa (valor 80 €)" } },
  // PROPINAS
  { id: "rh9", bonusId: "bh5", periodo: "Marzo 2026", estado: "liquidado", importe: "Variable", resumen: "Total recaudado: 1.240 € repartidos entre 12 empleados",
    detalles: { "Total propinas": "1.240 €", "Nº empleados": "12", "Criterio reparto": "Proporcional a horas trabajadas", "Media por empleado": "~103 €", "Responsable reparto": "Gerente" } },
  { id: "rh10", bonusId: "bh5", periodo: "Febrero 2026", estado: "liquidado", importe: "Variable", resumen: "Total recaudado: 980 € repartidos entre 11 empleados",
    detalles: { "Total propinas": "980 €", "Nº empleados": "11", "Media por empleado": "~89 €" } },
];

const resultadosBacanal: ResultadoBonus[] = [
  { id: "rb1", bonusId: "bb1", periodo: "T1 2026 (Ene–Mar)", estado: "calculado", importe: "350 €", resumen: "Balance +16.200 € → tramo +15.000 €",
    detalles: { "Facturación": "98.500 €", "Gastos": "82.300 €", "Balance final": "+16.200 €", "Tramo alcanzado": "+15.000 €", "Bonus resultante": "350 €" } },
  { id: "rb2", bonusId: "bb2", periodo: "T1 2026 (Ene–Mar)", estado: "liquidado", importe: "30 €", resumen: "Nota obtenida: 8.3 → tramo 8-9",
    detalles: { "Nota inspección": "8.3 / 10", "Tramo aplicado": "8 a 9 → 30 €" } },
  { id: "rb3", bonusId: "bb3", periodo: "Marzo 2026", estado: "liquidado", importe: "Variable", resumen: "Total recaudado: 720 € entre 8 empleados",
    detalles: { "Total propinas": "720 €", "Nº empleados": "8", "Media por empleado": "~90 €" } },
];

// ─── Public API ─────────────────────────────────────────────────

export function getBonusPorEmpresa(empresaId: string): Bonus[] {
  // Fallback en memoria (solo import/export legacy). La fuente real es la tabla
  // public.rrhh_bonus vía bonus-actions.ts.
  const base = empresaId === "habana" ? bonusHabana : empresaId === "bacanal" ? bonusBacanal : [];
  return base.map((b) => ({ ...b, puestoIds: [] }));
}

export function getConfigBonusEmpresa(empresaId: string): ConfigBonusEmpresa {
  if (empresaId === "habana") return configHabana;
  if (empresaId === "bacanal") return configBacanal;
  return { normas: [], formasPago: [] };
}

export function getResultadosPorBonus(empresaId: string, bonusId: string): ResultadoBonus[] {
  const all = empresaId === "habana" ? resultadosHabana : empresaId === "bacanal" ? resultadosBacanal : [];
  return all.filter((r) => r.bonusId === bonusId);
}

export function crearBonusVacio(empresaId: string): Bonus {
  return {
    id: `bonus-${Date.now()}`, empresaId, nombre: "", tipo: "", descripcion: "", objetivo: "",
    explicacion: "", estado: "borrador", periodicidad: "trimestral",
    destinatarios: { tipo: "todos", ids: [] }, destinatariosTexto: "Todo el equipo",
    tablas: [], reglas: [], formaPago: "", premio: "", icono: "Gift", puestoIds: [],
  };
}
