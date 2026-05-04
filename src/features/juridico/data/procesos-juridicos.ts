export type EstadoProceso = "ABIERTO" | "CERRADO";
export type GravedadProceso = "LEVE" | "GRAVE" | "MUY GRAVE";
export type TipoProceso = "Reclamación judicial" | "Sanción administrativa" | "Procedimiento interno" | "Reclamación contra empresa" | "Expediente laboral" | "Otro";
export type CategoriaDocumento = "Demanda" | "Requerimiento" | "Escrito" | "Resolución" | "Notificación" | "Contrato" | "Comunicación" | "Informe" | "Anexo" | "Otro";

export interface DocumentoProceso {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaDocumento;
  url: string;
  tipo: string; // mime hint: pdf, docx, img…
  subidoPor: string;
  fechaSubida: string;
  actualizacionId?: string;
}

export interface ActualizacionProceso {
  id: string;
  texto: string;
  fecha: string;
  apuntadoPor: string;
  documentos: DocumentoProceso[];
}

export interface ProcesoJuridico {
  id: string;
  titulo: string;
  empresa: string;
  empresaId: string;
  tipo: TipoProceso;
  juridico: string;
  fecha: string;
  estado: EstadoProceso;
  gravedad: GravedadProceso;
  descripcion: string;
  documentos: DocumentoProceso[];
  actualizaciones: ActualizacionProceso[];
}

export const ESTADOS_PROCESO: EstadoProceso[] = ["ABIERTO", "CERRADO"];
export const GRAVEDADES_PROCESO: GravedadProceso[] = ["LEVE", "GRAVE", "MUY GRAVE"];
export const TIPOS_PROCESO: TipoProceso[] = ["Reclamación judicial", "Sanción administrativa", "Procedimiento interno", "Reclamación contra empresa", "Expediente laboral", "Otro"];
export const CATEGORIAS_DOCUMENTO: CategoriaDocumento[] = ["Demanda", "Requerimiento", "Escrito", "Resolución", "Notificación", "Contrato", "Comunicación", "Informe", "Anexo", "Otro"];
export const JURIDICOS = ["Ana Beltrán (interna)", "Bufete García & Asociados", "Carlos Mendoza (interno)", "Despacho Ruiz Legal", "Marta Domínguez (interna)"];

function doc(id: string, nombre: string, categoria: CategoriaDocumento, descripcion: string, subidoPor: string, fechaSubida: string): DocumentoProceso {
  return { id, nombre, descripcion, categoria, url: "#", tipo: "pdf", subidoPor, fechaSubida };
}

const HABANA_PROCESOS: ProcesoJuridico[] = [
  {
    id: "pj-h1", titulo: "Reclamación por despido improcedente – Ex empleado J.L.", empresa: "HABANA", empresaId: "habana", tipo: "Reclamación judicial", juridico: "Bufete García & Asociados", fecha: "2026-01-15", estado: "ABIERTO", gravedad: "GRAVE",
    descripcion: "Ex empleado reclama despido improcedente. Demanda presentada en Juzgado Social nº3. Indemnización solicitada: 18.500 €.",
    documentos: [
      doc("d1", "Demanda_JL_2026.pdf", "Demanda", "Demanda presentada por el ex empleado", "Bufete García", "2026-01-16"),
      doc("d2", "Contrato_laboral.pdf", "Contrato", "Contrato de trabajo original", "Ana Beltrán", "2026-01-17"),
      doc("d3", "Carta_despido.pdf", "Notificación", "Carta de despido firmada", "Carlos Mendoza", "2026-01-15"),
    ],
    actualizaciones: [
      { id: "a1", texto: "Recibida notificación judicial. Se asigna al bufete externo.", fecha: "2026-01-18", apuntadoPor: "Ana Beltrán", documentos: [doc("da1", "Notificacion_judicial.pdf", "Notificación", "Cédula de notificación del juzgado", "Ana Beltrán", "2026-01-18")] },
      { id: "a2", texto: "Acto de conciliación programado para el 15 de febrero.", fecha: "2026-02-01", apuntadoPor: "Bufete García", documentos: [] },
      { id: "a3", texto: "Conciliación sin acuerdo. Se procede a juicio oral.", fecha: "2026-02-16", apuntadoPor: "Bufete García", documentos: [doc("da3", "Acta_conciliacion.pdf", "Resolución", "Acta de conciliación sin acuerdo", "Bufete García", "2026-02-16")] },
    ],
  },
  {
    id: "pj-h2", titulo: "Sanción municipal por ruido – Terraza nocturna", empresa: "HABANA", empresaId: "habana", tipo: "Sanción administrativa", juridico: "Ana Beltrán (interna)", fecha: "2026-02-20", estado: "ABIERTO", gravedad: "LEVE",
    descripcion: "Expediente sancionador por exceso de decibelios en horario nocturno. Multa propuesta: 3.000 €. Plazo de alegaciones abierto.",
    documentos: [doc("d4", "Expediente_ruido_2026.pdf", "Requerimiento", "Expediente sancionador del Ayuntamiento", "Ana Beltrán", "2026-02-21")],
    actualizaciones: [
      { id: "a4", texto: "Recibida notificación del Ayuntamiento. Revisión de mediciones.", fecha: "2026-02-22", apuntadoPor: "Ana Beltrán", documentos: [doc("da4", "Medicion_ruido.pdf", "Informe", "Informe de mediciones acústicas", "Ana Beltrán", "2026-02-22")] },
      { id: "a5", texto: "Presentadas alegaciones con informe acústico favorable.", fecha: "2026-03-05", apuntadoPor: "Ana Beltrán", documentos: [doc("da5", "Alegaciones_ruido.pdf", "Escrito", "Escrito de alegaciones presentado", "Ana Beltrán", "2026-03-05"), doc("da5b", "Informe_acustico.pdf", "Informe", "Informe técnico del perito acústico", "Ana Beltrán", "2026-03-05")] },
    ],
  },
  {
    id: "pj-h3", titulo: "Reclamación de proveedor – Factura impagada", empresa: "HABANA", empresaId: "habana", tipo: "Reclamación contra empresa", juridico: "Carlos Mendoza (interno)", fecha: "2026-03-01", estado: "ABIERTO", gravedad: "LEVE",
    descripcion: "Proveedor de bebidas reclama factura de 2.400 € supuestamente impagada. Se está verificando con contabilidad.",
    documentos: [doc("d5", "Factura_proveedor.pdf", "Otro", "Factura reclamada por el proveedor", "Carlos Mendoza", "2026-03-02")],
    actualizaciones: [
      { id: "a6", texto: "Verificado con contabilidad: pago realizado pero no reflejado por error bancario.", fecha: "2026-03-10", apuntadoPor: "Carlos Mendoza", documentos: [doc("da6", "Justificante_pago.pdf", "Comunicación", "Justificante bancario del pago", "Carlos Mendoza", "2026-03-10")] },
    ],
  },
  {
    id: "pj-h4", titulo: "Inspección de trabajo – Control de horarios", empresa: "HABANA", empresaId: "habana", tipo: "Procedimiento interno", juridico: "Ana Beltrán (interna)", fecha: "2025-11-10", estado: "CERRADO", gravedad: "LEVE",
    descripcion: "Inspección de trabajo sobre registro horario. Se solicitó documentación de fichajes de los últimos 6 meses.",
    documentos: [doc("d6", "Acta_inspeccion.pdf", "Informe", "Acta de inspección de trabajo", "Ana Beltrán", "2025-11-12"), doc("d7", "Registros_horarios.pdf", "Anexo", "Registros de fichaje aportados", "Ana Beltrán", "2025-11-14")],
    actualizaciones: [
      { id: "a7", texto: "Documentación entregada al inspector.", fecha: "2025-11-15", apuntadoPor: "Ana Beltrán", documentos: [] },
      { id: "a8", texto: "Resolución favorable. Sin sanción.", fecha: "2025-12-20", apuntadoPor: "Ana Beltrán", documentos: [doc("da8", "Resolucion_inspeccion.pdf", "Resolución", "Resolución favorable de la inspección", "Ana Beltrán", "2025-12-20")] },
    ],
  },
  {
    id: "pj-h5", titulo: "Expediente disciplinario – Empleado M.R.", empresa: "HABANA", empresaId: "habana", tipo: "Expediente laboral", juridico: "Carlos Mendoza (interno)", fecha: "2026-03-20", estado: "ABIERTO", gravedad: "MUY GRAVE",
    descripcion: "Expediente por falta muy grave: abandono de puesto reiterado sin justificación. Posible despido disciplinario.",
    documentos: [doc("d8", "Expediente_MR.pdf", "Informe", "Expediente disciplinario completo", "Carlos Mendoza", "2026-03-20")],
    actualizaciones: [
      { id: "a9", texto: "Abierto expediente tras tercer abandono registrado.", fecha: "2026-03-21", apuntadoPor: "Carlos Mendoza", documentos: [doc("da9", "Partes_abandono.pdf", "Anexo", "Partes de abandono firmados por responsables", "Carlos Mendoza", "2026-03-21")] },
      { id: "a10", texto: "Audiencia con el empleado realizada. Niega los hechos.", fecha: "2026-03-28", apuntadoPor: "Carlos Mendoza", documentos: [doc("da10", "Acta_audiencia.pdf", "Comunicación", "Acta de la audiencia con el empleado", "Carlos Mendoza", "2026-03-28")] },
      { id: "a11", texto: "Escalado a dirección para decisión final.", fecha: "2026-04-02", apuntadoPor: "Ana Beltrán", documentos: [] },
    ],
  },
  {
    id: "pj-h6", titulo: "Licencia de actividad – Renovación 2026", empresa: "HABANA", empresaId: "habana", tipo: "Sanción administrativa", juridico: "Despacho Ruiz Legal", fecha: "2025-09-01", estado: "CERRADO", gravedad: "LEVE",
    descripcion: "Renovación de licencia de actividad. Tramitado y concedido sin incidencias.",
    documentos: [doc("d9", "Licencia_2026.pdf", "Resolución", "Licencia de actividad renovada", "Despacho Ruiz Legal", "2025-10-15")],
    actualizaciones: [],
  },
];

const BACANAL_PROCESOS: ProcesoJuridico[] = [
  {
    id: "pj-b1", titulo: "Reclamación de cliente por intoxicación alimentaria", empresa: "BACANAL", empresaId: "bacanal", tipo: "Reclamación judicial", juridico: "Bufete García & Asociados", fecha: "2026-02-10", estado: "ABIERTO", gravedad: "MUY GRAVE",
    descripcion: "Cliente presenta denuncia por supuesta intoxicación. Se ha solicitado informe al laboratorio de sanidad.",
    documentos: [doc("db1", "Denuncia_cliente.pdf", "Demanda", "Denuncia del cliente", "Bufete García", "2026-02-11"), doc("db2", "Informe_sanidad.pdf", "Informe", "Informe del laboratorio de sanidad", "Bufete García", "2026-03-06")],
    actualizaciones: [
      { id: "b1", texto: "Recibida denuncia. Se contacta con el seguro.", fecha: "2026-02-12", apuntadoPor: "Bufete García", documentos: [doc("dba1", "Comunicacion_seguro.pdf", "Comunicación", "Comunicación al seguro de RC", "Bufete García", "2026-02-12")] },
      { id: "b2", texto: "Informe de sanidad: no se encontraron irregularidades.", fecha: "2026-03-05", apuntadoPor: "Bufete García", documentos: [doc("dba2", "Informe_laboratorio.pdf", "Informe", "Resultados del laboratorio", "Bufete García", "2026-03-05")] },
      { id: "b3", texto: "Pendiente de resolución judicial.", fecha: "2026-03-20", apuntadoPor: "Bufete García", documentos: [] },
    ],
  },
  {
    id: "pj-b2", titulo: "Sanción por terraza – Ocupación de vía pública", empresa: "BACANAL", empresaId: "bacanal", tipo: "Sanción administrativa", juridico: "Marta Domínguez (interna)", fecha: "2026-03-15", estado: "ABIERTO", gravedad: "LEVE",
    descripcion: "Expediente del Ayuntamiento por exceso de mobiliario en terraza. Multa propuesta: 1.500 €.",
    documentos: [doc("db3", "Sancion_terraza.pdf", "Requerimiento", "Expediente sancionador municipal", "Marta Domínguez", "2026-03-16")],
    actualizaciones: [
      { id: "b4", texto: "Revisión de la licencia de ocupación vigente.", fecha: "2026-03-18", apuntadoPor: "Marta Domínguez", documentos: [doc("dba4", "Licencia_ocupacion.pdf", "Contrato", "Licencia de ocupación vigente", "Marta Domínguez", "2026-03-18")] },
    ],
  },
  {
    id: "pj-b3", titulo: "Contrato de alquiler – Renegociación condiciones", empresa: "BACANAL", empresaId: "bacanal", tipo: "Procedimiento interno", juridico: "Despacho Ruiz Legal", fecha: "2026-01-05", estado: "CERRADO", gravedad: "LEVE",
    descripcion: "Renegociación del contrato de alquiler del local. Conseguida reducción del 8% en la renta mensual.",
    documentos: [doc("db4", "Contrato_alquiler_v2.pdf", "Contrato", "Contrato de alquiler renegociado", "Despacho Ruiz Legal", "2026-02-02")],
    actualizaciones: [
      { id: "b5", texto: "Reunión con propietario. Propuesta de reducción presentada.", fecha: "2026-01-15", apuntadoPor: "Despacho Ruiz Legal", documentos: [doc("dba5", "Propuesta_reduccion.pdf", "Escrito", "Propuesta formal de reducción de renta", "Despacho Ruiz Legal", "2026-01-15")] },
      { id: "b6", texto: "Acuerdo alcanzado. Firma del nuevo contrato.", fecha: "2026-02-01", apuntadoPor: "Despacho Ruiz Legal", documentos: [doc("dba6", "Contrato_firmado.pdf", "Contrato", "Contrato firmado por ambas partes", "Despacho Ruiz Legal", "2026-02-01")] },
    ],
  },
  {
    id: "pj-b4", titulo: "Reclamación laboral – Horas extra no pagadas", empresa: "BACANAL", empresaId: "bacanal", tipo: "Expediente laboral", juridico: "Marta Domínguez (interna)", fecha: "2026-04-01", estado: "ABIERTO", gravedad: "GRAVE",
    descripcion: "Ex empleada reclama 45 horas extra no abonadas. Pendiente de cruzar con registros de fichaje.",
    documentos: [doc("db5", "Reclamacion_horas.pdf", "Demanda", "Reclamación formal de la ex empleada", "Marta Domínguez", "2026-04-02")],
    actualizaciones: [
      { id: "b7", texto: "Recopilando registros de fichaje del periodo reclamado.", fecha: "2026-04-03", apuntadoPor: "Marta Domínguez", documentos: [doc("dba7", "Registros_fichaje_parcial.pdf", "Anexo", "Registros de fichaje del trimestre", "Marta Domínguez", "2026-04-03")] },
    ],
  },
];

export function getProcesosPorEmpresa(empresaId: string): ProcesoJuridico[] {
  if (empresaId === "habana") return HABANA_PROCESOS.map((p) => ({ ...p, documentos: [...p.documentos], actualizaciones: p.actualizaciones.map((a) => ({ ...a, documentos: [...a.documentos] })) }));
  if (empresaId === "bacanal") return BACANAL_PROCESOS.map((p) => ({ ...p, documentos: [...p.documentos], actualizaciones: p.actualizaciones.map((a) => ({ ...a, documentos: [...a.documentos] })) }));
  return [];
}
