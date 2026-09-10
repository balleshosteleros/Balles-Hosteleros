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
