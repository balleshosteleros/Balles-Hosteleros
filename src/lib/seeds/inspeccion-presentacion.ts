/**
 * Seed canónico de la PRESENTACIÓN de inspecciones (módulo Calidad).
 *
 * 8 slides estándar que se muestran al inspector cuando abre el enlace público.
 * Las imágenes son placeholders neutros de hostelería (Unsplash); cada negocio
 * las sustituye por las suyas desde el editor de Presentación.
 *
 * Convenciones:
 * - Las slides "Bienvenidos", "Objetivos" y "Gracias" usan layout `split-right`
 *   con `image` lateral. El resto usa `default` (sin imagen).
 * - El botón "Reservar" (slide 7) lleva href `#` y cada empresa lo personaliza.
 * - Sin nombres de locales (regla "presentación neutra").
 *
 * Cualquier cambio aquí se aplica a empresas nuevas vía `seedEmpresaDefaults()`.
 * NO se sobreescribe la presentación de empresas existentes (estrategia aditiva).
 */

import type { Slide } from "@/features/calidad/inspecciones/types";

const PLACEHOLDER_BIENVENIDOS =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&auto=format&fit=crop&q=80";
const PLACEHOLDER_OBJETIVOS =
  "https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=900&auto=format&fit=crop&q=80";
const PLACEHOLDER_GRACIAS =
  "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=900&auto=format&fit=crop&q=80";

export const INSPECCION_PRESENTACION_SEED: Slide[] = [
  {
    id: "s-1",
    layout: "split-right",
    background: "primary",
    image: PLACEHOLDER_BIENVENIDOS,
    blocks: [
      { id: "b-1", type: "title", text: "¡Bienvenidos!" },
      {
        id: "b-2",
        type: "paragraph",
        text: "Buscamos la excelencia, por encima de todo.",
      },
    ],
  },
  {
    id: "s-2",
    layout: "split-right",
    background: "primary",
    image: PLACEHOLDER_OBJETIVOS,
    blocks: [
      { id: "b-1", type: "title", text: "Objetivos" },
      {
        id: "b-2",
        type: "numbered",
        items: [
          {
            titulo: "Conocer",
            descripcion:
              "El primer paso es entender en profundidad lo que ocurre en nuestros establecimientos. Observar, recopilar datos y registrar hallazgos nos brindará una imagen clara de la situación actual, permitiéndonos tomar decisiones informadas.",
          },
          {
            titulo: "Valorar",
            descripcion:
              "Utilizando nuestros conocimientos y la información recopilada, podremos evaluar el desempeño de cada establecimiento. Esta valoración nos guiará hacia el camino que deseamos que siga la empresa, priorizando la excelencia en todo momento.",
          },
          {
            titulo: "Mejorar",
            descripcion:
              "Una vez identificadas las áreas de oportunidad, podremos implementar acciones concretas para elevar la experiencia de nuestros clientes y el clima laboral de nuestros equipos. La mejora continua es clave para alcanzar la excelencia que buscamos.",
          },
        ],
      },
    ],
  },
  {
    id: "s-3",
    layout: "default",
    background: "primary",
    image: null,
    blocks: [
      { id: "b-1", type: "title", text: "Código de Descuento" },
      {
        id: "b-2",
        type: "cards",
        columns: 4,
        items: [
          {
            imagen: null,
            titulo: "Límite de Descuento",
            descripcion:
              "La colaboracion tiene un límite máximo establecido para evitar excesos y mantener la transparencia.",
          },
          {
            imagen: null,
            titulo: "Revelación del Código",
            descripcion:
              "Mencione que es inspector solo al pagar, para que la inspección sea anónima y no afecte la dinámica.",
          },
          {
            imagen: null,
            titulo: "Comunicar el Código",
            descripcion:
              "Informe al Jefe de sala que vinieron a realizar una inspección y proporcione el código QR para validar dicha inspeccion y aplicar el cierre de la cuenta para obtener el descuento.",
          },
          {
            imagen: null,
            titulo: "Exceso de Gasto",
            descripcion:
              "Si el gasto supera el límite, solo se cobrará la parte que exceda. Se mantiene el importe del descuento.",
          },
        ],
      },
    ],
  },
  {
    id: "s-4",
    layout: "default",
    background: "primary",
    image: null,
    blocks: [
      { id: "b-1", type: "title", text: "Cuestionario de Inspección" },
      {
        id: "b-2",
        type: "cards",
        columns: 3,
        items: [
          {
            imagen: null,
            titulo: "Preparación Previa",
            descripcion:
              "Se recomienda leer detenidamente el cuestionario antes de iniciar la inspección, para conocer a fondo los puntos a evaluar y estar preparados para afrontar cualquier situación que se presente.",
          },
          {
            imagen: null,
            titulo: "Completar el Cuestionario",
            descripcion:
              "Deberán responder en su totalidad de preguntas durante la inspección. Cada pregunta tendrá una única respuesta posible, y podrán agregar observaciones relevantes en el recuadro de cada pregunta.",
          },
          {
            imagen: null,
            titulo: "Entrega del Cuestionario",
            descripcion:
              "El cuestionario deberá ser realizado antes de salir del establecimiento en la propia mesa, al finalizar la experiencia. Este documento será una herramienta clave para evaluar el desempeño del establecimiento y orientar las acciones de mejora.",
          },
        ],
      },
    ],
  },
  {
    id: "s-5",
    layout: "default",
    background: "primary",
    image: null,
    blocks: [
      { id: "b-1", type: "title", text: 'Situaciones "Trampa" para evaluar' },
      {
        id: "b-2",
        type: "numbered",
        items: [
          {
            titulo: "Alérgenos",
            descripcion:
              "Se plantearán preguntas como si fueran alérgenos a ciertos alimentos, con el fin de evaluar la capacidad del equipo para manejar este tipo de situaciones de manera eficaz y resolutiva.",
          },
          {
            titulo: "Reservas",
            descripcion:
              "Se simularán problemas con las reservas, como errores en la asignación de mesas o en el horario, con el objetivo de observar cómo el equipo resuelve estas situaciones, incluso cuando no tienen la razón.",
          },
          {
            titulo: "Solicitudes Inusuales",
            descripcion:
              "Se plantearán solicitudes fuera de lo común, como querer trabajar en la empresa, hacer un evento para más de 30 personas, o pedir una factura antes de anunciar el descuento de inspección. Estas situaciones pondrán a prueba la capacidad de respuesta del equipo.",
          },
          {
            titulo: "Cualquier otra solicitud",
            descripcion:
              "Cualquier otra solicitud que se os pueda ocurrir y no sea algo habitual.",
          },
        ],
      },
    ],
  },
  {
    id: "s-6",
    layout: "default",
    background: "primary",
    image: null,
    blocks: [
      { id: "b-1", type: "title", text: "Normas y Requisitos" },
      {
        id: "b-2",
        type: "icon-row",
        items: [
          {
            icono: "users",
            titulo: "Personas",
            descripcion: "Solo podrán acudir dos personas a la inspección.",
          },
          {
            icono: "wine",
            titulo: "Bebidas",
            descripcion:
              "Se solicita un uso responsable de las bebidas alcohólicas, para mantener un estado sobrio durante la inspección.",
          },
          {
            icono: "shield",
            titulo: "Privacidad",
            descripcion:
              "La inspección se mantendrá en estricta confidencialidad, sin que nadie sepa de su realización antes o después.",
          },
        ],
      },
    ],
  },
  {
    id: "s-7",
    layout: "default",
    background: "primary",
    image: null,
    blocks: [
      { id: "b-1", type: "title", text: "Día y Hora" },
      {
        id: "b-2",
        type: "paragraph",
        text: "Concretar el día y la hora de la inspección con el departamento de calidad. Una vez se haya concretado, podréis hacer la reserva desde el siguiente enlace para confirmar vuestra asistencia como si de un cliente más se tratase.",
      },
      {
        id: "b-3",
        type: "buttons",
        items: [{ href: "#", label: "Reservar" }],
      },
    ],
  },
  {
    id: "s-8",
    layout: "split-right",
    background: "primary",
    image: PLACEHOLDER_GRACIAS,
    blocks: [
      { id: "b-1", type: "title", text: "¡Gracias por su apoyo invaluable!" },
    ],
  },
];
