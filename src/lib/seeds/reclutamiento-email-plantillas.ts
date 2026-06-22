/**
 * Seed canónico de la BIBLIOTECA de PLANTILLAS DE EMAIL del RECLUTAMIENTO.
 *
 * Cada plantilla es SUELTA (identificada por `nombre`, no atada a un estado).
 * La asociación email↔estado vive en la plantilla de ESTADOS
 * (`reclutamiento-plantilla-estados.ts` → `defaultEmailNombre` por estado) y,
 * como override por vacante, en `vacantes.email_plantillas`. Estas 10 plantillas
 * son las que se asocian por defecto a los 10 estados del proceso estándar.
 *
 * Cualquier cambio aquí se propaga a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (modo aditivo: solo crea los estados que falten,
 * NO sobreescribe lo que el cliente haya personalizado) y se aplica a las
 * empresas nuevas vía `seedEmpresaDefaults()`.
 *
 * ── Códigos (placeholders) disponibles en `asunto` y `cuerpo` ──────────────
 * Sustitución en el envío con datos reales (ver `reclutamiento-email.ts`):
 *
 *   Candidato:
 *     {{candidato_nombre}}          → nombre del candidato
 *     {{candidato_apellidos}}       → apellidos del candidato
 *     {{candidato_nombre_completo}} → "nombre apellidos"
 *     {{candidato_email}}           → email del candidato
 *     {{candidato_telefono}}        → teléfono del candidato
 *
 *   Vacante / puesto:
 *     {{vacante_nombre}}            → título de la vacante
 *     {{vacante_ubicacion}}         → ubicación de la vacante
 *     {{departamento_nombre}}       → departamento del puesto
 *     {{tipo_jornada}}             → tipo de jornada de la vacante
 *
 *   Empresa:
 *     {{empresa_nombre}}            → nombre de la empresa
 *     {{empresa_email}}             → correo de RRHH / contacto de la empresa
 *     {{empresa_telefono}}          → teléfono principal de la empresa
 *     {{empresa_web}}              → web de la empresa
 *     {{empresa_direccion}}         → dirección del local de la empresa
 */

export interface ReclutamientoEmailPlantillaSeed {
  /** Nombre de la plantilla (identidad de la plantilla dentro de la empresa). */
  nombre: string;
  asunto: string;
  cuerpo: string;
  /** Si la plantilla envía correo automáticamente por defecto. */
  activa: boolean;
}

export const RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED: ReclutamientoEmailPlantillaSeed[] = [
  // ─────────────────────────────────────────────────────── 1. Nuevo ──
  {
    nombre: "Nuevo",
    asunto: "Gracias por tu interés en unirte a nuestro equipo",
    cuerpo: `Hola {{candidato_nombre}},

Queríamos darte la bienvenida y agradecerte sinceramente por haberte inscrito en nuestra vacante de {{vacante_nombre}}. Nos alegra mucho que hayas decidido dar este paso y considerar formar parte de nuestro equipo.

En los próximos días revisaremos tu candidatura con atención. Si tu perfil encaja con lo que estamos buscando, nos pondremos en contacto contigo para continuar con el proceso y conocernos mejor.

Mientras tanto, queremos que sepas que valoramos el tiempo y la ilusión que implica postularse a una oportunidad profesional, y eso ya dice mucho de ti.

Te deseamos mucho éxito y esperamos poder hablar muy pronto.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ──────────────────────────────────────────────────────── 2. Elegido ──
  {
    nombre: "Elegido",
    asunto: "Proceso de selección — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Te escribo para agradecerte el interés depositado en nuestra empresa {{empresa_nombre}} y en la oferta de {{vacante_nombre}}. Has sido seleccionado/a para el puesto, pasando la primera fase; decirte que tenemos varios candidatos que valorar y pronto tendrás nuevas noticias nuestras.

{{candidato_nombre}}, gracias y saludos.
{{empresa_nombre}}
{{empresa_email}}`,
    activa: true,
  },

  // ────────────────────────────────────────────────────── 3. Entrevista ──
  {
    nombre: "Entrevista",
    asunto: "Proceso de selección — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Te escribo para agradecerte el interés depositado en nuestra empresa {{empresa_nombre}} y en la oferta de {{vacante_nombre}}. Has sido seleccionado/a para el puesto, y queremos citarte para hacerte una entrevista online; te llamaremos no faltando mucho para conocerte.

{{candidato_nombre}}, gracias y saludos.
{{empresa_nombre}}
{{empresa_email}}`,
    activa: true,
  },

  // ───────────────────────────────────────────────────────── 4. Teórica ──
  {
    nombre: "Teórica",
    asunto: "Teoría — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

¡Enhorabuena! Superaste la entrevista con éxito y estamos muy contentos de avanzar contigo. Ahora empezamos con la Teórica, el primer paso clave antes de pasar a la etapa práctica.

Tendrás que completar dos fases:
A. Leer el Manual Operativo.
B. Hacer la Evaluación del Manual Operativo.

👉 Es imprescindible usar un ordenador con pantalla grande (no funciona bien en móvil).
👉 Lee todo con atención y sigue los pasos tal como se indican.

Una vez hayas terminado de leer y ver todos los documentos que contempla el Manual Operativo, realiza el test de preguntas. Debes leerlo entero y sin prisa y después completar el test. Esta etapa es muy importante para que tengas claro cómo trabajamos.

Si te surge alguna duda, escríbenos sin problema a {{empresa_email}}.

¡Nos vemos pronto, {{candidato_nombre}}!
{{empresa_nombre}}`,
    activa: true,
  },

  // ──────────────────────────────────────────────────────── 5. Práctica ──
  {
    nombre: "Práctica",
    asunto: "Práctica — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

¡Seguimos avanzando! Entras ahora en la Práctica, un paso clave antes de incorporarte al equipo.

Tendrás que completar dos fases:
A. Vídeos Prácticos.
B. Evaluación de la Práctica.

👉 Es imprescindible usar un ordenador con pantalla grande (no funciona bien en móvil).
👉 Lee todo con atención y sigue los pasos tal como se indican.
👉 Selecciona solo la carpeta del puesto al que optas y revisa todos los archivos, incluidos los vídeos.

Una vez hayas terminado de ver los vídeos y leer todos los documentos que contempla dicha parte, solo te quedará hacer la Evaluación de la Práctica.

Cuando termines, ponte en contacto con la persona de Recursos Humanos que te ha hecho la entrevista para concretar día y horario de comienzo y proceder con tu alta de contrato.

📌 Si tienes dudas, apúntalas y coméntalas directamente con la persona de Recursos Humanos, que te ayudará en todo. Puedes escribirnos a {{empresa_email}}.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ────────────────────────────────────────────────────────── 6. Prueba ──
  {
    nombre: "Prueba",
    asunto: "Bienvenido/a a tu periodo de prueba — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Queríamos darte la bienvenida oficialmente en este inicio de tu período de prueba con nosotros. Estamos muy contentos de contar contigo en el equipo y queremos transmitirte que confiamos plenamente en tus capacidades.

Estamos seguros de que superarás esta etapa sin ningún problema y de que tu adaptación será rápida y positiva.

Durante los próximos días contarás con el acompañamiento y supervisión de tu formador, quien estará a tu disposición para ayudarte, resolver cualquier duda y guiarte en todo lo necesario para que te sientas cómodo/a y seguro/a en el desempeño de tus funciones. Te animamos a aprovechar este periodo para aprender, preguntar y familiarizarte con la dinámica de trabajo.

Por nuestra parte, te deseamos lo mejor en esta nueva etapa y estamos convencidos de que será el comienzo de una buena experiencia profesional.

{{candidato_nombre}}, muchas gracias y saludos.
{{empresa_nombre}}`,
    activa: true,
  },

  // ───────────────────────────────────────────────────────── 7. Empleado ──
  {
    nombre: "Empleado",
    asunto: "¡Bienvenido/a al equipo! — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Te escribo para darte la enhorabuena, porque ya perteneces a nuestra gran familia de {{empresa_nombre}}: pasaste el periodo de prueba correctamente. Nuestro equipo de RRHH ya da por finalizada tu incorporación de manera oficial.

{{candidato_nombre}}, muchas gracias y saludos.
{{empresa_nombre}}`,
    activa: true,
  },

  // ───────────────────────────────────────────────────────── 8. Papelera ──
  {
    nombre: "Papelera",
    asunto: "Proceso de selección — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Te escribo para agradecerte el interés depositado en nuestra empresa {{empresa_nombre}} y en la oferta de {{vacante_nombre}}. En esta ocasión, no has sido seleccionado/a para el puesto; sin embargo, guardaremos tu currículum en nuestra base de datos para futuras candidaturas.

{{candidato_nombre}}, gracias y saludos.
{{empresa_nombre}}`,
    activa: true,
  },

  // ────────────────────────────────────────────────── 9. No se presenta ──
  {
    nombre: "No se presenta",
    asunto: "Notificación sobre tu proceso de incorporación",
    cuerpo: `Hola {{candidato_nombre}},

Espero que estés bien. Quiero comentarte que, al no haberte presentado en la fecha y hora acordadas para continuar con tu proceso, hemos tenido que dar por finalizada tu candidatura.

En {{empresa_nombre}} valoramos mucho el compromiso y la responsabilidad, ya que son claves para construir un equipo sólido y alcanzar grandes metas juntos. Sabemos que estas cosas pueden pasar por diferentes motivos, pero también queremos que tengas en cuenta la importancia de aprovechar este tipo de oportunidades.

Estamos seguros de que encontrarás un camino que te permita crecer profesionalmente, y esperamos que en el futuro podamos coincidir en un momento más adecuado.

Te deseamos mucho éxito en tus próximos pasos. Si en algún momento decides retomar el contacto, estaremos encantados de conocerte mejor.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ──────────────────────────────────────────── 10. Suspenso formación ──
  {
    nombre: "Suspenso Formación",
    asunto: "Resultado de tu fase de formación práctica",
    cuerpo: `Hola {{candidato_nombre}},

Espero que te encuentres bien. Tras evaluar tu desempeño en la fase de evaluación de la formación práctica, lamentablemente no hemos podido avanzar a la siguiente etapa del proceso. Apreciamos el esfuerzo y la dedicación que pusiste durante esta fase, pero en esta ocasión no hemos podido ver los resultados esperados para continuar con tu incorporación al equipo.

Aunque en esta ocasión no hemos podido continuar contigo, te agradecemos mucho tu tiempo y el interés en formar parte de {{empresa_nombre}}. Nos gustaría que sigas en contacto y no dudes en postularte en el futuro si lo deseas.

Te deseamos lo mejor en tu camino y mucho éxito en tus próximos proyectos.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },
];
