// Cuestionario por defecto de reclutamiento (genérico, para TODAS las empresas).
//
// Se siembra como `es_default = true` y se asigna automáticamente a todas las
// vacantes que no tengan otro cuestionario. El cliente puede editarlo (si no se
// ha usado), duplicarlo o crear otros y asignarlos por vacante.
//
// Forma de pregunta: ver src/features/rrhh/data/cuestionario-vacante.ts
// (la opción correcta = `correcta: true`; la nota = aciertos / total * 10).

import type { PreguntaCuestionario } from "@/features/rrhh/data/cuestionario-vacante";

export const RECLUTAMIENTO_CUESTIONARIO_DEFAULT_SEED: {
  nombre: string;
  descripcion: string;
  preguntas: PreguntaCuestionario[];
} = {
  nombre: "Evaluación de actitud y compromiso personal",
  descripcion:
    "Este cuestionario tiene como objetivo evaluar tu actitud y valores personales, que consideramos esenciales para formar parte de nuestro equipo. Queremos conocer cómo enfrentas los desafíos, tu disposición para trabajar en equipo y tu capacidad para aprender y mejorar.",
  preguntas: [
    {
      id: "p1",
      titulo: "¿Qué significa para ti la palabra «responsabilidad»?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p1o1", texto: "Cumplir con lo que se espera de mí, aunque a veces tenga que sacrificar algo.", correcta: true },
        { id: "p1o2", texto: "Hacer mi trabajo lo mejor que pueda, pero sin presionarme demasiado.", correcta: false },
        { id: "p1o3", texto: "Solo cumplir con lo mínimo necesario para que no me llamen la atención.", correcta: false },
      ],
    },
    {
      id: "p2",
      titulo: "Cuando te enfrentas a un desafío, ¿cómo reaccionas?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p2o1", texto: "Busco soluciones y trato de aprender de cada experiencia.", correcta: true },
        { id: "p2o2", texto: "Me cuesta un poco, pero al final intento cumplir con lo que se espera de mí.", correcta: false },
        { id: "p2o3", texto: "Prefiero evitar situaciones difíciles si no son necesarias.", correcta: false },
      ],
    },
    {
      id: "p3",
      titulo: "¿Qué tan importante es para ti trabajar con un equipo que se apoye mutuamente?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p3o1", texto: "Es esencial; creo que el trabajo en equipo es fundamental para el éxito y el ambiente laboral.", correcta: true },
        { id: "p3o2", texto: "Es importante, pero también valoro la independencia y mi espacio personal.", correcta: false },
        { id: "p3o3", texto: "No me importa mucho, mientras pueda hacer mi trabajo sin problemas.", correcta: false },
      ],
    },
    {
      id: "p4",
      titulo: "¿Cómo manejas las críticas constructivas?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p4o1", texto: "Las tomo como una oportunidad para mejorar y crecer profesionalmente.", correcta: true },
        { id: "p4o2", texto: "A veces me cuesta aceptarlas, pero trato de escucharlas y reflexionar sobre ellas.", correcta: false },
        { id: "p4o3", texto: "Me siento mal y me cuesta tomar las críticas de manera positiva.", correcta: false },
      ],
    },
    {
      id: "p5",
      titulo: "Si un compañero o cliente tiene una necesidad urgente y estás ocupado/a, ¿cómo lo manejarías?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p5o1", texto: "Priorizaría ayudarles lo más rápido posible, ya que entiendo que es importante.", correcta: true },
        { id: "p5o2", texto: "Trataría de ayudarle, pero primero terminaría lo que estoy haciendo para luego atender su urgencia.", correcta: false },
        { id: "p5o3", texto: "Intentaría delegar la responsabilidad o esperar a que me pidan ayuda de nuevo.", correcta: false },
      ],
    },
  ],
};
