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
    {
      id: "p6",
      titulo: "En tu etapa más joven, cuando estudiabas (si fue tu caso), ¿cómo combinaste estudios y trabajo?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p6o1", texto: "Preferí centrarme primero en estudiar y, una vez terminé, empecé a trabajar.", correcta: false },
        { id: "p6o2", texto: "En algún periodo compaginé los estudios y el trabajo a la vez.", correcta: true },
        { id: "p6o3", texto: "Me dediqué principalmente a una cosa cada vez, según el momento.", correcta: false },
      ],
    },
    {
      id: "p7",
      titulo: "¿Cómo valoras la continuidad y el compromiso a largo plazo en un puesto de trabajo?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p7o1", texto: "Me gusta implicarme y crecer dentro del mismo proyecto durante el mayor tiempo posible.", correcta: true },
        { id: "p7o2", texto: "Lo valoro, aunque también me gusta cambiar de entorno cada cierto tiempo.", correcta: false },
        { id: "p7o3", texto: "Prefiero no comprometerme demasiado y mantener mis opciones abiertas.", correcta: false },
      ],
    },
    {
      id: "p8",
      titulo: "Si cometes un error en tu trabajo y nadie se ha dado cuenta, ¿qué sueles hacer?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p8o1", texto: "Espero a ver si pasa desapercibido y, si nadie lo nota, no le doy más importancia.", correcta: false },
        { id: "p8o2", texto: "Lo comento y trato de corregirlo cuanto antes, aunque suponga reconocer el fallo.", correcta: true },
        { id: "p8o3", texto: "Lo arreglo por mi cuenta sin decir nada para no preocupar a nadie.", correcta: false },
      ],
    },
    {
      id: "p9",
      titulo: "Cuando terminas tus tareas y ves que aún queda trabajo pendiente a tu alrededor, ¿cómo actúas?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p9o1", texto: "Si nadie me pide ayuda, aprovecho para descansar hasta que me asignen algo.", correcta: false },
        { id: "p9o2", texto: "Me ofrezco y echo una mano en lo que haga falta sin que me lo tengan que pedir.", correcta: true },
        { id: "p9o3", texto: "Espero a que mi responsable me diga exactamente qué hacer a continuación.", correcta: false },
      ],
    },
    {
      id: "p10",
      titulo: "En momentos de mucha actividad (fines de semana, picos o imprevistos), ¿cómo encajas los cambios de horario o refuerzos?",
      tipo: "eleccion_multiple",
      obligatoria: true,
      opciones: [
        { id: "p10o1", texto: "Entiendo que forman parte del trabajo y me adapto con buena disposición.", correcta: true },
        { id: "p10o2", texto: "Los acepto puntualmente, pero prefiero que no se conviertan en algo habitual.", correcta: false },
        { id: "p10o3", texto: "Procuro ceñirme a mi horario y solo cambio si no me queda otra opción.", correcta: false },
      ],
    },
  ],
};
