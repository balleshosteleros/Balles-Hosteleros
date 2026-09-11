import type { ArticuloManual } from "./tipos";

/** CALIDAD: cómo se comprueba que las cosas se hacen bien. */
export const MANUAL_CALIDAD: ArticuloManual[] = [
  {
    ref: "sw:calidad-auditorias",
    modulo: "CALIDAD",
    titulo: "Auditorías de calidad",
    contenido: `En Calidad, Auditorías se pasan las revisiones internas del local: lo que hay que comprobar, quién lo comprueba y qué salió.

Cada auditoría deja constancia con su fecha y su responsable.`,
    ruta: "/calidad/auditorias",
    rutaTitulo: "Auditorías",
  },
  {
    ref: "sw:calidad-cuestionarios",
    modulo: "CALIDAD",
    titulo: "Cuestionarios",
    contenido: `En Calidad, Cuestionarios se montan las preguntas que se le pasan a la plantilla o a los candidatos.

Un cuestionario que ya ha respondido alguien no se puede cambiar: si se tocaran las preguntas, las respuestas dejarían de significar lo mismo.`,
    ruta: "/calidad/cuestionarios",
    rutaTitulo: "Cuestionarios",
  },
  {
    ref: "sw:calidad-resenas",
    modulo: "CALIDAD",
    titulo: "Reseñas de clientes",
    contenido: `En Calidad, Reseñas se ven las valoraciones que dejan los clientes, con su nota y su comentario.

Sirven para ver qué se repite en lo bueno y en lo malo.`,
    ruta: "/calidad/resenas",
    rutaTitulo: "Reseñas",
  },
  {
    ref: "sw:calidad-inspecciones",
    modulo: "CALIDAD",
    titulo: "Inspecciones",
    contenido: `En Calidad, Inspecciones se guarda lo que pasa cuando viene una inspección de fuera: qué revisaron, qué dijeron y qué hay que corregir.`,
    ruta: "/calidad/inspecciones",
    rutaTitulo: "Inspecciones",
  },
];
