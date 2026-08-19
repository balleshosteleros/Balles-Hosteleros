/**
 * Catálogo canónico de revisiones y obligaciones normativas de hostelería en España.
 *
 * Cada entrada representa una obligación legal real que una inspección puede exigir.
 * `clave` es el identificador estable — nunca se renombra (los registros de la empresa
 * apuntan a él). El catálogo es la plantilla; cada empresa crea sus propios registros.
 */

export type AmbitoRevision =
  | "SEGURIDAD"
  | "SANIDAD"
  | "INSTALACIONES"
  | "LABORAL"
  | "LICENCIAS"
  | "SEGUROS"
  | "DERECHOS"
  | "MEDIOAMBIENTE";

export type PeriodicidadRevision =
  | "MENSUAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL"
  | "BIENAL"
  | "CADA_5_ANOS"
  | "CONTINUA"
  | "UNICA";

export interface RevisionCatalogo {
  clave: string;
  nombre: string;
  ambito: AmbitoRevision;
  periodicidad: PeriodicidadRevision;
  /** Norma que la obliga, en lenguaje citable ante un inspector. */
  normativa: string;
  /** Qué hay que hacer y qué papel queda como prueba. */
  descripcion: string;
  /** Quién puede firmarlo: la propia empresa o un tercero acreditado. */
  ejecutor: "EMPRESA" | "EXTERNO_ACREDITADO" | "ADMINISTRACION";
  /** Documento que hay que poder enseñar. */
  documentoProbatorio: string;
  /** Rango orientativo de multa por incumplimiento. */
  riesgoSancion: string;
  /** Icono lucide que representa la revisión en la barra superior. */
  icono: string;
  /** Las que marcamos como críticas van primero en la barra. */
  critica: boolean;
}

export const CATALOGO_REVISIONES: RevisionCatalogo[] = [
  // ─── SEGURIDAD / INCENDIOS ──────────────────────────────────
  {
    clave: "extintores",
    nombre: "Extintores",
    ambito: "SEGURIDAD",
    periodicidad: "ANUAL",
    normativa: "RD 513/2017 (RIPCI), modificado por RD 164/2025 · UNE 23120",
    descripcion:
      "Revisión anual completa por empresa mantenedora habilitada, inspección visual mensual por el propio titular y retimbrado (prueba de presión) cada 5 años. En cocina es obligatorio extintor de clase F para aceites y grasas.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Acta de mantenimiento y etiqueta de revisión en cada extintor",
    riesgoSancion: "Hasta 60.000 € (infracción grave en materia de industria)",
    icono: "FireExtinguisher",
    critica: true,
  },
  {
    clave: "inspeccion-visual-extintores",
    nombre: "Comprobación mensual de extintores",
    ambito: "SEGURIDAD",
    periodicidad: "MENSUAL",
    normativa: "RD 513/2017, anexo II — mantenimiento a cargo del titular",
    descripcion:
      "Comprobación por el propio personal: accesibilidad, señalización, precinto intacto y aguja del manómetro en zona verde. Se anota en el registro interno.",
    ejecutor: "EMPRESA",
    documentoProbatorio: "Registro interno de comprobaciones mensuales",
    riesgoSancion: "Agrava la sanción si concurre con un siniestro",
    icono: "ClipboardCheck",
    critica: false,
  },
  {
    clave: "bies-deteccion-incendios",
    nombre: "BIE, detección y alarma de incendios",
    ambito: "SEGURIDAD",
    periodicidad: "ANUAL",
    normativa: "RD 513/2017 (RIPCI) · CTE DB-SI",
    descripcion:
      "Mantenimiento anual por mantenedor habilitado de bocas de incendio equipadas, detectores, pulsadores, sirenas y central de alarma. Prueba de presión de BIE cada 5 años.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Acta de mantenimiento del sistema de PCI",
    riesgoSancion: "6.000 – 60.000 €",
    icono: "Siren",
    critica: true,
  },
  {
    clave: "alumbrado-emergencia",
    nombre: "Alumbrado de emergencia y señalización",
    ambito: "SEGURIDAD",
    periodicidad: "ANUAL",
    normativa: "CTE DB-SUA 4 · RD 513/2017",
    descripcion:
      "Comprobación de que las luminarias de emergencia encienden al cortar el suministro y de que las señales de evacuación son visibles y fotoluminiscentes.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Informe de revisión de alumbrado de emergencia",
    riesgoSancion: "Hasta 30.000 € y cierre cautelar",
    icono: "Lightbulb",
    critica: false,
  },
  {
    clave: "plan-autoproteccion",
    nombre: "Plan de autoprotección / evacuación",
    ambito: "SEGURIDAD",
    periodicidad: "ANUAL",
    normativa: "RD 393/2007 (NBA) — exigible según aforo y normativa autonómica",
    descripcion:
      "Documento con vías de evacuación, medios de extinción y equipos de emergencia. Requiere simulacro periódico documentado cuando el aforo lo obliga.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Plan de autoprotección visado y acta de simulacro",
    riesgoSancion: "Hasta 600.000 € en infracciones muy graves de protección civil",
    icono: "ShieldAlert",
    critica: false,
  },

  // ─── INSTALACIONES ──────────────────────────────────────────
  {
    clave: "aire-acondicionado",
    nombre: "Aire acondicionado y climatización",
    ambito: "INSTALACIONES",
    periodicidad: "ANUAL",
    normativa: "RD 1027/2007 (RITE), modificado por RD 178/2021 · RD 115/2017 (gases fluorados)",
    descripcion:
      "Mantenimiento preventivo por empresa habilitada: limpieza de filtros y baterías, control de estanqueidad del circuito de refrigerante y registro de gases fluorados. La periodicidad de la revisión de fugas depende de la carga de CO₂ equivalente del equipo.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Contrato de mantenimiento y registro de instalación de gases fluorados",
    riesgoSancion: "Hasta 60.000 € (industria) y hasta 45.000 € por gases fluorados",
    icono: "AirVent",
    critica: true,
  },
  {
    clave: "instalacion-electrica-bt",
    nombre: "Inspección de la instalación eléctrica",
    ambito: "INSTALACIONES",
    periodicidad: "CADA_5_ANOS",
    normativa: "RD 842/2002 (REBT), ITC-BT-05 — locales de pública concurrencia",
    descripcion:
      "Los locales de pública concurrencia son de inspección obligatoria por Organismo de Control Autorizado (OCA) cada 5 años, además del mantenimiento periódico del cuadro y las protecciones diferenciales.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Certificado de inspección periódica favorable emitido por OCA",
    riesgoSancion: "Hasta 60.000 € y precinto de la instalación",
    icono: "Zap",
    critica: true,
  },
  {
    clave: "instalacion-gas",
    nombre: "Instalación de gas (natural o GLP)",
    ambito: "INSTALACIONES",
    periodicidad: "CADA_5_ANOS",
    normativa: "RD 919/2006 (RIGLO), ITC-ICG 07",
    descripcion:
      "Inspección quinquenal de la instalación receptora por la empresa distribuidora o instalador habilitado, con revisión de estanqueidad, ventilación del recinto y evacuación de productos de combustión de los aparatos de cocina.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Certificado de inspección periódica de gas",
    riesgoSancion: "Hasta 60.000 € y corte del suministro",
    icono: "Flame",
    critica: true,
  },
  {
    clave: "campana-extraccion",
    nombre: "Campana extractora y conductos de humos",
    ambito: "INSTALACIONES",
    periodicidad: "SEMESTRAL",
    normativa: "RITE · UNE 100165 · CTE DB-HS 3 y ordenanzas municipales",
    descripcion:
      "Limpieza y desengrase de campana, filtros y conducto completo hasta la salida en cubierta. La acumulación de grasa en el conducto es la primera causa de incendio en cocina y el punto que primero mira una inspección.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Certificado de limpieza de conductos con fotografías",
    riesgoSancion: "6.000 – 50.000 €, cierre temporal en casos graves",
    icono: "Wind",
    critica: true,
  },
  {
    clave: "ascensor-montacargas",
    nombre: "Ascensor o montacargas",
    ambito: "INSTALACIONES",
    periodicidad: "BIENAL",
    normativa: "RD 88/2013 (ITC AEM 1)",
    descripcion:
      "Mantenimiento mensual por empresa conservadora e inspección periódica por OCA. Aplica solo si el local dispone de aparato elevador.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Acta de inspección periódica y libro de mantenimiento",
    riesgoSancion: "Hasta 60.000 € y puesta fuera de servicio",
    icono: "MoveVertical",
    critica: false,
  },
  {
    clave: "legionela",
    nombre: "Prevención de legionela",
    ambito: "SANIDAD",
    periodicidad: "TRIMESTRAL",
    normativa: "RD 487/2022 y RD 614/2024",
    descripcion:
      "Plan de prevención y control frente a legionela: mantener el agua caliente por encima de 60 °C y la fría por debajo de 20 °C, limpieza y desinfección de acumuladores y analíticas periódicas. Obliga cuando hay ACS con acumulador, torres de refrigeración o nebulizadores en terraza.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Plan de prevención, registro de temperaturas y analíticas de laboratorio",
    riesgoSancion: "Hasta 600.000 € (infracción muy grave en salud pública)",
    icono: "Droplets",
    critica: true,
  },

  // ─── SANIDAD / ALIMENTARIA ──────────────────────────────────
  {
    clave: "appcc",
    nombre: "Sistema APPCC",
    ambito: "SANIDAD",
    periodicidad: "CONTINUA",
    normativa: "Reglamento (CE) 852/2004, art. 5",
    descripcion:
      "Análisis de peligros y puntos de control crítico implantado y con registros diarios al día: temperaturas de cámaras, recepción de mercancía, trazabilidad, limpieza y desinfección. Revisión anual del sistema completo.",
    ejecutor: "EMPRESA",
    documentoProbatorio: "Manual APPCC y registros diarios firmados",
    riesgoSancion: "Hasta 600.000 € en infracciones muy graves de sanidad",
    icono: "ClipboardList",
    critica: true,
  },
  {
    clave: "formacion-manipulador",
    nombre: "Formación de manipulador de alimentos",
    ambito: "SANIDAD",
    periodicidad: "ANUAL",
    normativa: "Reglamento (CE) 852/2004, anexo II cap. XII",
    descripcion:
      "Todo el personal que manipula alimentos debe acreditar formación en higiene alimentaria. Hay que poder enseñar el certificado de cada empleado en plantilla.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Certificados de formación por empleado",
    riesgoSancion: "Hasta 60.000 €",
    icono: "GraduationCap",
    critica: false,
  },
  {
    clave: "control-plagas",
    nombre: "Control de plagas (DDD)",
    ambito: "SANIDAD",
    periodicidad: "TRIMESTRAL",
    normativa: "RD 830/2010 · Reglamento (CE) 852/2004 — prerrequisito del APPCC",
    descripcion:
      "Desinsectación, desratización y desinfección por empresa inscrita en el ROESB, con plano de cebos, productos aplicados y certificado de cada actuación.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Certificado DDD y plano de puntos de control",
    riesgoSancion: "Hasta 600.000 € si deriva en riesgo sanitario",
    icono: "Bug",
    critica: true,
  },
  {
    clave: "alergenos",
    nombre: "Información de alérgenos",
    ambito: "SANIDAD",
    periodicidad: "CONTINUA",
    normativa: "Reglamento (UE) 1169/2011 · RD 126/2015",
    descripcion:
      "Informar de los 14 alérgenos de declaración obligatoria en toda la oferta gastronómica, por escrito y accesible al cliente. La carta debe estar actualizada con cada cambio de escandallo.",
    ejecutor: "EMPRESA",
    documentoProbatorio: "Fichas de alérgenos por plato y carta actualizada",
    riesgoSancion: "Hasta 600.000 € si causa daño al consumidor",
    icono: "Wheat",
    critica: true,
  },
  {
    clave: "aceites-usados",
    nombre: "Retirada de aceites usados y residuos",
    ambito: "MEDIOAMBIENTE",
    periodicidad: "MENSUAL",
    normativa: "Ley 7/2022 de residuos y suelos contaminados",
    descripcion:
      "Retirada por gestor autorizado del aceite vegetal usado y del resto de residuos peligrosos, conservando los documentos de entrega.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Documentos de entrega del gestor autorizado",
    riesgoSancion: "Hasta 100.000 € por vertido no autorizado",
    icono: "Recycle",
    critica: false,
  },

  // ─── LABORAL ────────────────────────────────────────────────
  {
    clave: "prl",
    nombre: "Prevención de riesgos laborales (PRL)",
    ambito: "LABORAL",
    periodicidad: "ANUAL",
    normativa: "Ley 31/1995 de PRL · RD 39/1997",
    descripcion:
      "Plan de prevención, evaluación de riesgos por puesto y planificación de la actividad preventiva, actualizados y con el servicio de prevención ajeno contratado y al corriente.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Plan de prevención, evaluación de riesgos y contrato con el SPA",
    riesgoSancion: "Hasta 983.736 € en infracciones muy graves (LISOS)",
    icono: "HardHat",
    critica: true,
  },
  {
    clave: "vigilancia-salud",
    nombre: "Vigilancia de la salud",
    ambito: "LABORAL",
    periodicidad: "ANUAL",
    normativa: "Ley 31/1995, art. 22",
    descripcion:
      "Oferta anual de reconocimiento médico a toda la plantilla. Aunque el trabajador renuncie, hay que conservar la renuncia firmada como prueba de que se ofreció.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Aptos médicos y renuncias firmadas",
    riesgoSancion: "Hasta 49.180 € (infracción grave)",
    icono: "Stethoscope",
    critica: false,
  },
  {
    clave: "formacion-prl-empleados",
    nombre: "Formación PRL de la plantilla",
    ambito: "LABORAL",
    periodicidad: "ANUAL",
    normativa: "Ley 31/1995, art. 19",
    descripcion:
      "Formación en riesgos del puesto e información entregada a cada trabajador en el momento de la contratación y cuando cambian sus funciones.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Certificados de formación y recibí firmado por empleado",
    riesgoSancion: "Hasta 49.180 €",
    icono: "BookOpenCheck",
    critica: false,
  },
  {
    clave: "registro-jornada",
    nombre: "Registro de jornada",
    ambito: "LABORAL",
    periodicidad: "CONTINUA",
    normativa: "RD-ley 8/2019 · art. 34.9 del Estatuto de los Trabajadores",
    descripcion:
      "Registro diario de la jornada de cada trabajador, con hora de inicio y fin, conservado 4 años y a disposición inmediata de la Inspección de Trabajo.",
    ejecutor: "EMPRESA",
    documentoProbatorio: "Registro horario de los últimos 4 años",
    riesgoSancion: "751 – 7.500 € por centro de trabajo",
    icono: "Clock",
    critica: true,
  },
  {
    clave: "plan-igualdad",
    nombre: "Plan de igualdad y protocolo de acoso",
    ambito: "LABORAL",
    periodicidad: "ANUAL",
    normativa: "LO 3/2007 · RD 901/2020 — plan obligatorio desde 50 personas",
    descripcion:
      "Protocolo frente al acoso sexual obligatorio en toda empresa con plantilla, y plan de igualdad registrado a partir de 50 personas. No basta con tenerlos redactados: hay que acreditar que se han comunicado a la plantilla. Esa comunicación se hace desde Formación, con el curso «Igualdad y protocolo frente al acoso», que deja registro de quién lo ha completado y cuándo.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Protocolo comunicado a la plantilla (registro de Formación), plan registrado en REGCON",
    riesgoSancion: "Hasta 225.018 €",
    icono: "Scale",
    critica: false,
  },

  // ─── LICENCIAS Y SEGUROS ────────────────────────────────────
  {
    clave: "licencia-actividad",
    nombre: "Licencia de actividad y apertura",
    ambito: "LICENCIAS",
    periodicidad: "UNICA",
    normativa: "Normativa municipal y autonómica de espectáculos y actividades recreativas",
    descripcion:
      "Licencia o declaración responsable que ampara la actividad, con el aforo, el horario y la clasificación del local. Cualquier reforma o cambio de actividad obliga a actualizarla.",
    ejecutor: "ADMINISTRACION",
    documentoProbatorio: "Licencia de actividad y certificado final de obra",
    riesgoSancion: "Cierre del local y hasta 600.000 € por actividad clandestina",
    icono: "FileCheck",
    critica: true,
  },
  {
    clave: "licencia-terraza",
    nombre: "Licencia de terraza",
    ambito: "LICENCIAS",
    periodicidad: "ANUAL",
    normativa: "Ordenanza municipal de terrazas y de ocupación de vía pública",
    descripcion:
      "Autorización de ocupación de la vía pública con mesas, sillas, sombrillas y elementos delimitadores. Suele renovarse cada año y define el número exacto de veladores, el horario y los metros autorizados.",
    ejecutor: "ADMINISTRACION",
    documentoProbatorio: "Autorización municipal vigente y plano de la ocupación",
    riesgoSancion: "750 – 30.000 € y retirada del mobiliario",
    icono: "Umbrella",
    critica: true,
  },
  {
    clave: "seguro-rc",
    nombre: "Seguro de responsabilidad civil",
    ambito: "SEGUROS",
    periodicidad: "ANUAL",
    normativa: "Legislación autonómica de espectáculos públicos y actividades recreativas",
    descripcion:
      "Póliza de RC obligatoria con la cobertura mínima que fije la comunidad autónoma según el aforo. Debe estar vigente y con el recibo pagado: se comprueba el recibo, no solo la póliza.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Póliza vigente y último recibo de pago",
    riesgoSancion: "Hasta 60.000 € y suspensión de la actividad",
    icono: "ShieldCheck",
    critica: true,
  },
  {
    clave: "seguro-local",
    nombre: "Seguro multirriesgo del local",
    ambito: "SEGUROS",
    periodicidad: "ANUAL",
    normativa: "Contractual — exigido por arrendador y entidades financieras",
    descripcion:
      "Cobertura de continente, contenido, pérdida de beneficios y daños por agua o incendio. No es sancionable por la Administración, pero su ausencia deja el negocio expuesto.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Póliza vigente y recibo",
    riesgoSancion: "Sin sanción administrativa · riesgo económico directo",
    icono: "Building2",
    critica: false,
  },

  // ─── DERECHOS DE AUTOR Y CONSUMO ────────────────────────────
  {
    clave: "sgae",
    nombre: "SGAE — derechos de autor",
    ambito: "DERECHOS",
    periodicidad: "ANUAL",
    normativa: "RDL 1/1996, Ley de Propiedad Intelectual, art. 20",
    descripcion:
      "Licencia de comunicación pública por reproducir música con obras protegidas, sea por radio, televisión, hilo musical o listas propias. La cuota depende de los metros del local y de si hay música ambiente, en directo o baile.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Licencia SGAE vigente y recibo anual",
    riesgoSancion: "Reclamación civil por comunicación pública no autorizada más intereses",
    icono: "Music",
    critica: true,
  },
  {
    clave: "agedi-aie",
    nombre: "AGEDI · AIE — productores e intérpretes",
    ambito: "DERECHOS",
    periodicidad: "ANUAL",
    normativa: "RDL 1/1996, art. 108 y 116 — derechos afines",
    descripcion:
      "Cuota independiente de la de SGAE que remunera a productores fonográficos (AGEDI) y artistas intérpretes (AIE). Tener licencia de SGAE no exime de pagar esta: son derechos distintos sobre la misma grabación.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Licencia AGEDI-AIE vigente y recibo anual",
    riesgoSancion: "Reclamación civil independiente de la de SGAE",
    icono: "Disc3",
    critica: true,
  },
  {
    clave: "hojas-reclamaciones",
    nombre: "Hojas de reclamaciones y cartelería",
    ambito: "LICENCIAS",
    periodicidad: "CONTINUA",
    normativa: "RDL 1/2007 de consumidores y normativa autonómica de consumo",
    descripcion:
      "Hojas oficiales de reclamación disponibles, cartel que anuncia su existencia, precios visibles al público, prohibición de fumar y aforo señalizado.",
    ejecutor: "EMPRESA",
    documentoProbatorio: "Talonario oficial y carteles colocados en zona visible",
    riesgoSancion: "Hasta 100.000 € en materia de consumo",
    icono: "MessageSquareWarning",
    critica: false,
  },
  {
    clave: "rgpd",
    nombre: "Protección de datos (RGPD)",
    ambito: "LICENCIAS",
    periodicidad: "ANUAL",
    normativa: "Reglamento (UE) 2016/679 · LO 3/2018 (LOPDGDD)",
    descripcion:
      "Registro de actividades de tratamiento, cláusulas informativas en reservas y cámaras, contratos de encargado con los proveedores y cartel informativo de videovigilancia.",
    ejecutor: "EXTERNO_ACREDITADO",
    documentoProbatorio: "Registro de tratamientos y cláusulas informativas",
    riesgoSancion: "Hasta 20.000.000 € o el 4 % de la facturación",
    icono: "Lock",
    critica: false,
  },
  {
    clave: "libro-visitas-itss",
    nombre: "Documentación laboral para Inspección",
    ambito: "LABORAL",
    periodicidad: "CONTINUA",
    normativa: "RD-ley 5/2000 (LISOS) · Ley 23/2015 de la ITSS",
    descripcion:
      "Contratos, altas en Seguridad Social, nóminas, TC1 y TC2 y convenio de hostelería aplicable, disponibles en el centro de trabajo cuando se persona la Inspección.",
    ejecutor: "EMPRESA",
    documentoProbatorio: "Carpeta laboral del centro de trabajo",
    riesgoSancion: "Hasta 225.018 € por trabajador no dado de alta",
    icono: "FolderCheck",
    critica: false,
  },
];

export const AMBITOS: AmbitoRevision[] = [
  "SEGURIDAD",
  "SANIDAD",
  "INSTALACIONES",
  "LABORAL",
  "LICENCIAS",
  "SEGUROS",
  "DERECHOS",
  "MEDIOAMBIENTE",
];

export const PERIODICIDADES: PeriodicidadRevision[] = [
  "MENSUAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
  "BIENAL",
  "CADA_5_ANOS",
  "CONTINUA",
  "UNICA",
];

export const ETIQUETA_PERIODICIDAD: Record<PeriodicidadRevision, string> = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
  BIENAL: "Cada 2 años",
  CADA_5_ANOS: "Cada 5 años",
  CONTINUA: "Permanente",
  UNICA: "Una sola vez",
};

export const ETIQUETA_AMBITO: Record<AmbitoRevision, string> = {
  SEGURIDAD: "Seguridad",
  SANIDAD: "Sanidad",
  INSTALACIONES: "Instalaciones",
  LABORAL: "Laboral",
  LICENCIAS: "Licencias",
  SEGUROS: "Seguros",
  DERECHOS: "Derechos de autor",
  MEDIOAMBIENTE: "Medioambiente",
};

export const ETIQUETA_EJECUTOR: Record<RevisionCatalogo["ejecutor"], string> = {
  EMPRESA: "La propia empresa",
  EXTERNO_ACREDITADO: "Empresa externa acreditada",
  ADMINISTRACION: "Administración pública",
};

/** Meses que suma cada periodicidad para calcular el siguiente vencimiento. */
export const MESES_PERIODICIDAD: Record<PeriodicidadRevision, number | null> = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
  BIENAL: 24,
  CADA_5_ANOS: 60,
  CONTINUA: null,
  UNICA: null,
};

export function getRevisionCatalogo(clave: string): RevisionCatalogo | undefined {
  return CATALOGO_REVISIONES.find((r) => r.clave === clave);
}
