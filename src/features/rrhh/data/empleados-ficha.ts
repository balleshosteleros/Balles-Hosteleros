// Extended employee data for the full employee profile ("ficha")

export interface DatosPersonales {
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  tipoIdentificacion2?: string;
  numeroIdentificacion2?: string;
  nacionalidad: string;
  estadoCivil: string;
  fechaNacimiento: string;
  genero: string;
  compartirCumple: boolean;
}

export interface Direccion {
  domicilio: string;
  codigoPostal: string;
  localidad: string;
  provincia: string;
  pais: string;
}

export interface Contacto {
  emailEmpresa: string;
  emailPersonal: string;
  telefonoEmpresa: string;
  telefonoPersonal: string;
  emailNotificaciones: string;
}

export interface DatosLaborales {
  puesto: string;
  departamento: string;
  centro: string;
  fechaAlta: string;
  estado: string;
  responsable: string;
  tipoContrato: string;
  jornada: string;
  salarioBrutoAnual: string;
  costePorHora: string;
  horarioBase: string;
}

export interface Formacion {
  titulo: string;
  centro: string;
  anio: string;
  tipo: "formacion" | "curso" | "certificacion";
}

export interface JourneyHito {
  fecha: string;
  titulo: string;
  descripcion: string;
}

export interface ContratoEmpleado {
  id: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

export interface DocumentoEmpleado {
  id: string;
  nombre: string;
  tipo: string;
  fecha: string;
}

export interface EvaluacionEmpleado {
  id: string;
  fecha: string;
  tipo: string;
  resultado: string;
  evaluador: string;
}

export interface FichaEmpleado {
  empleadoId: string;
  datosPersonales: DatosPersonales;
  direccion: Direccion;
  contacto: Contacto;
  datosLaborales: DatosLaborales;
  camposPersonalizados: Record<string, string>;
  formacion: Formacion[];
  habilidades: string[];
  journey: JourneyHito[];
  accesos: string[];
  roles: string[];
  contratos: ContratoEmpleado[];
  documentos: DocumentoEmpleado[];
  evaluaciones: EvaluacionEmpleado[];
}

const HABANA_FICHAS: Record<string, FichaEmpleado> = {
  h1: {
    empleadoId: "h1",
    datosPersonales: { tipoIdentificacion: "DNI", numeroIdentificacion: "12345678A", tipoIdentificacion2: "Pasaporte", numeroIdentificacion2: "AB1234567", nacionalidad: "Española", estadoCivil: "Soltero/a", fechaNacimiento: "1995-03-12", genero: "Masculino", compartirCumple: true },
    direccion: { domicilio: "C/ Gran Vía 15, 3ºA", codigoPostal: "28013", localidad: "Madrid", provincia: "Madrid", pais: "España" },
    contacto: { emailEmpresa: "carlos.martinez@habana.es", emailPersonal: "carlosml@gmail.com", telefonoEmpresa: "912 345 678", telefonoPersonal: "612 345 678", emailNotificaciones: "carlos.martinez@habana.es" },
    datosLaborales: { puesto: "Cachimbero", departamento: "CACHIMBEROS", centro: "Habana Club", fechaAlta: "2022-06-01", estado: "Activo", responsable: "Laura Sánchez", tipoContrato: "Indefinido", jornada: "Parcial", salarioBrutoAnual: "14.400 €", costePorHora: "9,00 €", horarioBase: "05h" },
    camposPersonalizados: { "Talla camiseta": "M", "Alérgenos": "Ninguno" },
    formacion: [{ titulo: "Curso de manipulación de alimentos", centro: "CEAC", anio: "2021", tipo: "curso" }],
    habilidades: ["Atención al cliente", "Cachimba", "Idiomas: inglés"],
    journey: [{ fecha: "2022-06-01", titulo: "Incorporación", descripcion: "Alta en Habana Club como cachimbero" }, { fecha: "2023-01-15", titulo: "Formación interna", descripcion: "Curso de atención al cliente completado" }],
    accesos: ["RRHH", "Fichajes"],
    roles: ["Empleado"],
    contratos: [{ id: "c1", tipo: "Indefinido", fechaInicio: "2022-06-01", fechaFin: "—", estado: "Vigente" }],
    documentos: [{ id: "d1", nombre: "DNI escaneado", tipo: "Identificación", fecha: "2022-05-28" }, { id: "d2", nombre: "Contrato firmado", tipo: "Contrato", fecha: "2022-06-01" }],
    evaluaciones: [{ id: "e1", fecha: "2023-06-01", tipo: "Anual", resultado: "Satisfactorio", evaluador: "Laura Sánchez" }],
  },
  h2: {
    empleadoId: "h2",
    datosPersonales: { tipoIdentificacion: "DNI", numeroIdentificacion: "23456789B", nacionalidad: "Española", estadoCivil: "Casado/a", fechaNacimiento: "1990-07-22", genero: "Femenino", compartirCumple: true },
    direccion: { domicilio: "Av. de la Constitución 8, 1ºB", codigoPostal: "28014", localidad: "Madrid", provincia: "Madrid", pais: "España" },
    contacto: { emailEmpresa: "maria.garcia@habana.es", emailPersonal: "mariagarcia@hotmail.com", telefonoEmpresa: "912 345 679", telefonoPersonal: "623 456 789", emailNotificaciones: "maria.garcia@habana.es" },
    datosLaborales: { puesto: "Jefa de Sala", departamento: "JEFE DE SALA", centro: "Habana Club", fechaAlta: "2020-03-15", estado: "Activo", responsable: "Pedro Ruiz", tipoContrato: "Indefinido", jornada: "Completa", salarioBrutoAnual: "26.000 €", costePorHora: "14,50 €", horarioBase: "Sin horario" },
    camposPersonalizados: { "Talla camiseta": "S" },
    formacion: [{ titulo: "Grado en Turismo", centro: "UCM", anio: "2012", tipo: "formacion" }, { titulo: "PRL Hostelería", centro: "Prevencion360", anio: "2020", tipo: "curso" }],
    habilidades: ["Liderazgo", "Gestión de equipos", "Inglés C1", "Francés B2"],
    journey: [{ fecha: "2020-03-15", titulo: "Incorporación", descripcion: "Alta como Jefa de Sala" }, { fecha: "2021-09-01", titulo: "Promoción", descripcion: "Ascendida a responsable de turno noche" }],
    accesos: ["RRHH", "Fichajes", "Calendarios", "Gerencia"],
    roles: ["Responsable", "Empleado"],
    contratos: [{ id: "c1", tipo: "Indefinido", fechaInicio: "2020-03-15", fechaFin: "—", estado: "Vigente" }],
    documentos: [{ id: "d1", nombre: "Contrato firmado", tipo: "Contrato", fecha: "2020-03-15" }],
    evaluaciones: [{ id: "e1", fecha: "2023-03-15", tipo: "Anual", resultado: "Excelente", evaluador: "Pedro Ruiz" }],
  },
};

const BACANAL_FICHAS: Record<string, FichaEmpleado> = {
  b1: {
    empleadoId: "b1",
    datosPersonales: { tipoIdentificacion: "DNI", numeroIdentificacion: "34567890C", nacionalidad: "Española", estadoCivil: "Casado/a", fechaNacimiento: "1985-11-05", genero: "Masculino", compartirCumple: false },
    direccion: { domicilio: "C/ Serrano 42, 5ºD", codigoPostal: "28001", localidad: "Madrid", provincia: "Madrid", pais: "España" },
    contacto: { emailEmpresa: "andres.jimenez@bacanal.es", emailPersonal: "andresj@gmail.com", telefonoEmpresa: "913 111 222", telefonoPersonal: "611 111 222", emailNotificaciones: "andres.jimenez@bacanal.es" },
    datosLaborales: { puesto: "Director", departamento: "DIRECCIÓN", centro: "Bacanal Club", fechaAlta: "2018-01-10", estado: "Activo", responsable: "—", tipoContrato: "Indefinido", jornada: "Completa", salarioBrutoAnual: "42.000 €", costePorHora: "22,00 €", horarioBase: "08h" },
    camposPersonalizados: { "Vehículo empresa": "Sí" },
    formacion: [{ titulo: "MBA Dirección Hotelera", centro: "IE Business School", anio: "2010", tipo: "formacion" }],
    habilidades: ["Dirección estratégica", "Finanzas", "Liderazgo"],
    journey: [{ fecha: "2018-01-10", titulo: "Incorporación", descripcion: "Fundador y director de Bacanal Club" }],
    accesos: ["Todos"],
    roles: ["Director", "Administrador"],
    contratos: [{ id: "c1", tipo: "Indefinido", fechaInicio: "2018-01-10", fechaFin: "—", estado: "Vigente" }],
    documentos: [{ id: "d1", nombre: "Contrato directivo", tipo: "Contrato", fecha: "2018-01-10" }],
    evaluaciones: [],
  },
  b2: {
    empleadoId: "b2",
    datosPersonales: { tipoIdentificacion: "DNI", numeroIdentificacion: "45678901D", nacionalidad: "Española", estadoCivil: "Soltera", fechaNacimiento: "1992-04-18", genero: "Femenino", compartirCumple: true },
    direccion: { domicilio: "C/ Alcalá 100, 2ºA", codigoPostal: "28009", localidad: "Madrid", provincia: "Madrid", pais: "España" },
    contacto: { emailEmpresa: "lucia.perez@bacanal.es", emailPersonal: "luciap@hotmail.com", telefonoEmpresa: "913 222 333", telefonoPersonal: "622 222 333", emailNotificaciones: "lucia.perez@bacanal.es" },
    datosLaborales: { puesto: "Jefa de Sala", departamento: "JEFE DE SALA", centro: "Bacanal Club", fechaAlta: "2019-09-01", estado: "Activo", responsable: "Andrés Jiménez", tipoContrato: "Indefinido", jornada: "Completa", salarioBrutoAnual: "24.000 €", costePorHora: "13,50 €", horarioBase: "06h" },
    camposPersonalizados: {},
    formacion: [{ titulo: "Grado en Hostelería", centro: "CETT", anio: "2014", tipo: "formacion" }],
    habilidades: ["Gestión de sala", "Atención VIP", "Inglés B2"],
    journey: [{ fecha: "2019-09-01", titulo: "Incorporación", descripcion: "Alta como Jefa de Sala" }],
    accesos: ["RRHH", "Fichajes", "Calendarios"],
    roles: ["Responsable", "Empleado"],
    contratos: [{ id: "c1", tipo: "Indefinido", fechaInicio: "2019-09-01", fechaFin: "—", estado: "Vigente" }],
    documentos: [],
    evaluaciones: [{ id: "e1", fecha: "2023-09-01", tipo: "Anual", resultado: "Notable", evaluador: "Andrés Jiménez" }],
  },
};

function generarFichaDefault(empleadoId: string): FichaEmpleado {
  return {
    empleadoId,
    datosPersonales: { tipoIdentificacion: "DNI", numeroIdentificacion: "—", nacionalidad: "Española", estadoCivil: "—", fechaNacimiento: "—", genero: "—", compartirCumple: false },
    direccion: { domicilio: "—", codigoPostal: "—", localidad: "—", provincia: "—", pais: "España" },
    contacto: { emailEmpresa: "—", emailPersonal: "—", telefonoEmpresa: "—", telefonoPersonal: "—", emailNotificaciones: "—" },
    datosLaborales: { puesto: "—", departamento: "—", centro: "—", fechaAlta: "—", estado: "Activo", responsable: "—", tipoContrato: "—", jornada: "—", salarioBrutoAnual: "—", costePorHora: "—", horarioBase: "—" },
    camposPersonalizados: {},
    formacion: [],
    habilidades: [],
    journey: [],
    accesos: [],
    roles: ["Empleado"],
    contratos: [],
    documentos: [],
    evaluaciones: [],
  };
}

export function getFichaEmpleado(empresaId: string, empleadoId: string): FichaEmpleado {
  const fichas = empresaId === "habana" ? HABANA_FICHAS : empresaId === "bacanal" ? BACANAL_FICHAS : {};
  return fichas[empleadoId] ?? generarFichaDefault(empleadoId);
}
