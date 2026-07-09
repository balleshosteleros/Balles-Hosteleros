/**
 * Seed canónico de la BIBLIOTECA de PLANTILLAS DE EMAIL del RECLUTAMIENTO.
 *
 * Cada plantilla es SUELTA (identificada por `nombre`, no atada a un estado).
 * La asociación email↔estado vive en la plantilla de ESTADOS
 * (`reclutamiento-plantilla-estados.ts` → `defaultEmailNombre` por estado) y,
 * como override por vacante, en `vacantes.email_plantillas`. Estas plantillas
 * libres se asocian por defecto a los estados del proceso estándar (Selección ·
 * Onboarding · Offboarding · Descartado).
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
 *     {{email_rrhh}}             → correo de RRHH / contacto de la empresa
 *     {{empresa_telefono}}          → teléfono principal de la empresa
 *     {{empresa_web}}              → web de la empresa
 *     {{empresa_direccion}}         → dirección del local de la empresa
 *
 *   Documentación (solo plantilla «Documentación»):
 *     {{enlace_documentacion}}      → URL personal del candidato para subir su
 *                                     documentación (DNI/NIE, IBAN, nº SS). Se
 *                                     genera al enviar el correo del estado
 *                                     `documentacion` (ver reclutamiento-email.ts).
 */

export interface ReclutamientoEmailPlantillaSeed {
  /** Nombre INICIAL de la plantilla (editable por el cliente después). */
  nombre: string;
  asunto: string;
  cuerpo: string;
  /** Si la plantilla envía correo automáticamente por defecto. */
  activa: boolean;
  /**
   * CLAVE estable de las plantillas del sistema (onboarding). El flujo las
   * localiza por aquí, NO por el nombre → el nombre es editable. Las plantillas
   * libres (asociadas a estados) no llevan clave.
   */
  clave?: "gestoria_alta" | "gestoria_recordatorio" | "gestoria_cambio_puesto" | "contrato_interno" | "reconocimiento_medico" | "contrato_oficial" | "prueba_aviso";
  /** Destinatario por defecto (candidato / gestoria / rrhh). Editable después. */
  destino?: "candidato" | "gestoria" | "rrhh" | "personalizado";
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
{{email_rrhh}}`,
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
{{email_rrhh}}`,
    activa: true,
  },

  // ─────────────────────────────────────────────────── 4. Documentación ──
  {
    nombre: "Documentación",
    asunto: "Documentación necesaria para tu incorporación — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

¡Enhorabuena! Pasas a la siguiente fase del proceso. Antes de empezar la formación, necesitamos que nos aportes tu documentación para poder gestionar tu alta.

👉 [Subir mi documentación]({{enlace_documentacion}})

⏳ Importante: este enlace caduca a los {{documentacion_dias_validez}} días. Complétalo antes de que expire; si caduca, escríbenos y te enviaremos uno nuevo.

Si te surge cualquier duda, escríbenos a {{email_rrhh}}.

¡Gracias y nos vemos pronto, {{candidato_nombre}}!
{{empresa_nombre}}`,
    activa: true,
  },

  // ──────────────────────────────────────────────────────── 5. Formación ──
  // Unifica Teórica + Práctica (PRP-070): una sola formación obligatoria antes
  // de continuar. El botón enlaza a la URL configurable {{enlace_formacion}}.
  {
    nombre: "Formación",
    asunto: "Accede a tu formación — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

¡Enhorabuena! Superaste la entrevista y avanzamos contigo. Antes de continuar con el proceso, debes completar la formación. Es obligatoria.

En la formación conocerás la empresa, las normas internas, nuestra forma de trabajar, los procedimientos básicos y lo que esperamos del puesto.

👉 Es imprescindible usar un ordenador con pantalla grande (no funciona bien en móvil).
👉 Revisa todo el contenido con atención antes de continuar.

Accede a la formación aquí:
[Acceder a la formación]({{enlace_formacion}})

Cuando termines, Recursos Humanos revisará tu avance para continuar con el proceso. Si te surge cualquier duda, escríbenos a {{email_rrhh}}.

¡Nos vemos pronto, {{candidato_nombre}}!
{{empresa_nombre}}`,
    activa: true,
  },

  // ────────────────────────────────────────────────── 5.b Contratación ──
  // Correo de bienvenida a la fase de contratación. Se envía al candidato al
  // entrar en el estado `contratacion`, además de los correos del sistema (alta
  // a la gestoría, recordatorio, contrato interno y oficial).
  {
    nombre: "Contratación",
    asunto: "Iniciamos tu contratación — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

¡Enhorabuena! Iniciamos oficialmente tu proceso de contratación en {{empresa_nombre}}. A partir de ahora vamos a gestionar tu alta y la documentación de tu contrato.

Normalmente en un plazo de 1 a 3 días desde la recepción de este correo recibirás DOS documentos para firmar:

1. El CONTRATO LABORAL, con el que se comunica tu alta de forma legal al Estado.
2. El CONTRATO INTERNO, con el que confirmas que aceptas las políticas internas de la empresa para sus trabajadores.

Cuando te lleguen, revísalos y fírmalos cuanto antes para no retrasar tu incorporación. Es importante que estés atento/a a tu bandeja de entrada (revisa también la carpeta de spam).

Si te surge cualquier duda durante este proceso, escríbenos a {{email_rrhh}}.

¡Bienvenido/a, {{candidato_nombre}}! Estamos deseando tenerte en el equipo.
{{empresa_nombre}}`,
    activa: true,
  },

  // ────────────────────────────────────────────────────────── 6. Prueba ──
  {
    nombre: "Prueba",
    asunto: "Bienvenido/a a tu periodo de prueba — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Queríamos darte la bienvenida oficialmente en este inicio de tu período de prueba con nosotros. Ya has sido dado/a de alta y has firmado la documentación correspondiente. Estamos muy contentos de contar contigo en el equipo y confiamos plenamente en tus capacidades.

Tu periodo de prueba tendrá una duración de {{prueba_duracion_dias}} días. Durante este tiempo evaluaremos tu adaptación, tu actitud, tu desempeño y el cumplimiento de las normas internas.

Contarás con el acompañamiento y la supervisión de tu formador, que estará a tu disposición para ayudarte, resolver tus dudas y guiarte en todo lo necesario para que te sientas cómodo/a y seguro/a en el desempeño de tus funciones. Aprovecha este periodo para aprender, preguntar y familiarizarte con la dinámica de trabajo.

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

  // ─────────────────────────────────── OFFBOARDING (salida) ──
  // Correos de la fase de salida ordenada del trabajador. Nacen ACTIVOS
  // (activa: true): se envían al mover al candidato al estado correspondiente
  // (con la confirmación del kanban). Destinatario: el propio trabajador.

  // ── 11. Preaviso ──
  {
    nombre: "Preaviso",
    asunto: "Comunicación de preaviso — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Te confirmamos que hemos registrado el preaviso de finalización de tu relación laboral con {{empresa_nombre}}. Queremos acompañarte en esta última etapa para que la salida se realice de forma ordenada y sin contratiempos para ninguna de las partes.

En los próximos días te iremos informando de los siguientes pasos: la tramitación de tu baja, la devolución del material y accesos que tengas asignados, y la preparación de tu liquidación y finiquito.

Si tienes cualquier duda durante este proceso, puedes escribirnos a {{email_rrhh}} y te ayudaremos con gusto.

Gracias por tu trabajo durante este tiempo.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── 12. Baja contrato ──
  {
    nombre: "Baja contrato",
    asunto: "Tramitación de tu baja — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Te informamos de que hemos iniciado la tramitación de la baja de tu contrato en {{empresa_nombre}}. Estamos gestionando con la gestoría toda la documentación necesaria para que tu baja quede registrada correctamente ante la Seguridad Social.

En cuanto el proceso esté completado, te haremos llegar la documentación que corresponda. Si necesitas algún justificante o tienes cualquier consulta, escríbenos a {{email_rrhh}}.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── 13. Entregas ──
  {
    nombre: "Entregas",
    asunto: "Devolución de material y accesos — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Antes de completar tu salida de {{empresa_nombre}}, necesitamos que nos devuelvas el material y los accesos que tengas asignados (uniforme, llaves, tarjetas, dispositivos, taquilla y cualquier otro elemento propiedad de la empresa).

Te indicaremos cómo y cuándo hacer la entrega para que sea lo más cómodo posible. Una vez recibido todo, podremos cerrar tu proceso de salida y avanzar con tu finiquito.

Si tienes cualquier duda sobre qué debes devolver, escríbenos a {{email_rrhh}}.

Gracias por tu colaboración.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── 14. Finiquito ──
  {
    nombre: "Finiquito",
    asunto: "Liquidación y finiquito — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Tu liquidación y finiquito ya están preparados. En este documento se recogen las cantidades que te corresponden a la finalización de tu relación laboral con {{empresa_nombre}} (salario pendiente, parte proporcional de pagas y vacaciones no disfrutadas, según corresponda).

Te haremos llegar la documentación para que puedas revisarla con calma y, si estás conforme, firmarla. Antes de firmar, revisa que todos los importes son correctos; si algo no te cuadra, escríbenos a {{email_rrhh}} y lo revisamos juntos.

Gracias por tu dedicación durante todo este tiempo.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── 15. Ex-empleados ──
  {
    nombre: "Ex-empleados",
    asunto: "Gracias por tu trabajo — {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Damos por finalizada oficialmente tu relación laboral con {{empresa_nombre}}. Queremos agradecerte de corazón tu dedicación, tu esfuerzo y todo lo que has aportado durante tu etapa con nosotros.

Las puertas quedan abiertas: nos encantará volver a coincidir contigo en el futuro, ya sea de nuevo en el equipo o en cualquier otro camino que emprendas. Si en algún momento necesitas una referencia laboral o cualquier documentación, no dudes en escribirnos a {{email_rrhh}}.

Te deseamos lo mejor en tu futuro personal y profesional.

Un fuerte abrazo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ───────────────────────────────────── ONBOARDING (PRP-070) ──
  // Correos del flujo de contratación, editables desde «Plantillas de email».
  // El flujo los localiza por su CLAVE estable (no por el nombre): el nombre y el
  // destinatario son editables sin romper nada.

  // ── Alta a la gestoría ──
  {
    clave: "gestoria_alta",
    destino: "gestoria",
    nombre: "Gestoría · alta de contrato",
    asunto: "Alta de contrato · {{candidato_nombre_completo}} · {{empresa_nombre}}",
    cuerpo: `Hola,

Os enviamos los datos del alta de contrato del siguiente trabajador para que tramitéis su alta:

{{gestoria_datos}}

Cuando tengáis el contrato preparado, podéis adjuntarlo con el botón de más abajo.

Gracias,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── Recordatorio a la gestoría ──
  {
    clave: "gestoria_recordatorio",
    destino: "gestoria",
    nombre: "Gestoría · recordatorio de contrato",
    asunto: "Pendiente: contrato de {{candidato_nombre_completo}} sin subir · {{empresa_nombre}}",
    cuerpo: `Hola,

Os recordamos que el contrato de {{candidato_nombre_completo}} sigue pendiente de subir.

Mientras no subáis el contrato firmado, el trabajador no lo recibe y no puede firmarlo, lo que bloquea su alta. Os agradeceríamos que lo completéis cuanto antes.

Gracias,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── Cambio de puesto / promoción interna (aviso a la gestoría) ──
  {
    clave: "gestoria_cambio_puesto",
    destino: "gestoria",
    nombre: "Gestoría · cambio de puesto (promoción)",
    asunto: "Cambio de puesto · {{candidato_nombre_completo}} · {{empresa_nombre}}",
    cuerpo: `Hola,

Os comunicamos que el siguiente trabajador cambia de puesto dentro de la empresa (promoción interna). Os enviamos los datos para que tramitéis la modificación de su contrato:

{{gestoria_datos}}

Gracias,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── Contrato interno (a firmar por el trabajador) ──
  {
    clave: "contrato_interno",
    destino: "candidato",
    nombre: "Contrato interno (a firmar)",
    asunto: "Firma tu contrato interno · {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Hemos iniciado tu proceso de alta. Antes de empezar a trabajar debes leer y firmar el contrato interno de la empresa, que recoge las normas, compromisos y confirmaciones de tu incorporación.

Tiene validez interna entre la empresa y tú. Puedes leerlo y firmarlo desde el botón que encontrarás en este correo.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── Reconocimiento médico (a firmar por el trabajador) ──
  {
    clave: "reconocimiento_medico",
    destino: "candidato",
    nombre: "Reconocimiento médico (a firmar)",
    asunto: "Firma tu reconocimiento médico · {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Como parte de tu incorporación, la empresa está obligada a informarte de tu derecho a la vigilancia de la salud (reconocimiento médico). Su realización es voluntaria: tú decides si deseas hacértelo o no.

En el documento adjunto podrás indicar tu decisión y firmar para dejar constancia de que has sido informado/a. Puedes leerlo y firmarlo desde el botón que encontrarás en este correo.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── Contrato oficial (a firmar por el trabajador) ──
  {
    clave: "contrato_oficial",
    destino: "candidato",
    nombre: "Contrato oficial (a firmar)",
    asunto: "Firma tu contrato laboral · {{empresa_nombre}}",
    cuerpo: `Hola {{candidato_nombre}},

Tu contrato laboral oficial ya está disponible para firmar. Puedes leerlo y firmarlo desde el botón que encontrarás en este correo.

Un saludo,
{{empresa_nombre}}`,
    activa: true,
  },

  // ── Aviso a RRHH durante el periodo de prueba ──
  {
    clave: "prueba_aviso",
    destino: "rrhh",
    nombre: "Aviso de periodo de prueba (RRHH)",
    asunto: "Periodo de prueba de {{candidato_nombre_completo}}: revisa su evolución · {{empresa_nombre}}",
    cuerpo: `{{candidato_nombre_completo}} lleva {{prueba_dias_transcurridos}} días en periodo de prueba.

Le quedan {{prueba_dias_restantes}} días para finalizar el periodo configurado ({{prueba_duracion_dias}} días). Inicio: {{prueba_fecha_inicio}} · Fin previsto: {{prueba_fecha_fin}}.

Revisa su evolución antes de confirmar su continuidad.`,
    activa: true,
  },
];
