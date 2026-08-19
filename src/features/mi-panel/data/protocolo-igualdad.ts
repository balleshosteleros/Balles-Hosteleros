/**
 * Protocolo de igualdad y frente al acoso.
 *
 * NO es un curso: es un apartado permanente que toda la plantilla tiene
 * disponible en su panel, siempre accesible para consultarlo cuando haga falta.
 *
 * Cubre dos obligaciones legales:
 *   · Protocolo frente al acoso — obligatorio en TODA empresa con plantilla,
 *     sea cual sea su tamaño (LO 3/2007, art. 48).
 *   · Plan de igualdad — obligatorio a partir de 50 personas (RD 901/2020).
 *
 * La ley exige acreditar que se ha COMUNICADO a la plantilla. Por eso el
 * apartado lleva confirmación de lectura, que se guarda en
 * `igualdad_confirmaciones` con nombre y fecha.
 */

/** Al cambiar el texto, sube la versión: se pedirá confirmar de nuevo. */
export const VERSION_PROTOCOLO = "1";

export interface BloqueProtocolo {
  id: string;
  titulo: string;
  /** Resumen de una línea para el índice lateral. */
  resumen: string;
  /** Cuerpo en markdown ligero. */
  contenido: string;
}

export const BLOQUES_PROTOCOLO: BloqueProtocolo[] = [
  {
    id: "compromiso",
    titulo: "Nuestro compromiso y tus derechos",
    resumen: "A qué se compromete la empresa y con qué derechos cuentas tú.",
    contenido: `## Nuestro compromiso

Esta empresa no tolera ninguna forma de acoso ni de discriminación. No es una declaración de intenciones: es una norma interna de obligado cumplimiento para todas las personas que trabajan aquí, sin excepción por antigüedad, cargo o tipo de contrato.

Se aplica a toda la plantilla e igualmente a las personas en prácticas, al personal de empresas externas que presta servicio en nuestros centros y a las relaciones con clientes y proveedores.

## Qué dice la ley

- **Ley Orgánica 3/2007, de igualdad efectiva entre mujeres y hombres.** Su artículo 48 obliga a *toda* empresa con plantilla —da igual el tamaño— a tener un procedimiento para prevenir el acoso sexual y el acoso por razón de sexo, y a darlo a conocer a las personas trabajadoras.
- **Real Decreto 901/2020.** Regula los planes de igualdad, obligatorios a partir de 50 personas en plantilla.

La ley no se conforma con que estos documentos existan guardados en un cajón: exige que la plantilla los conozca. Por eso este apartado está siempre disponible en tu panel y por eso se te pide confirmar que lo has leído.

## Tus derechos

Si sufres o presencias una situación de acoso, tienes derecho a:

- **Denunciarla** por el canal interno que se explica más abajo.
- **Ser atendido con confidencialidad.** Solo accede a la información quien tramita el caso.
- **Que se investigue con rapidez y de forma imparcial**, escuchando a ambas partes.
- **No sufrir represalias** por haber denunciado o por haber declarado como testigo. Cualquier represalia es en sí misma una falta muy grave.
- **Recibir apoyo** durante el proceso y ser informado de cómo termina.

## Qué se espera de ti

Que trates a tus compañeros con respeto y que no mires hacia otro lado. Si presencias una conducta de acoso, no eres un espectador neutral: tienes un canal para comunicarlo y usarlo también te protege a ti.`,
  },
  {
    id: "que-es-acoso",
    titulo: "Qué es acoso y qué no lo es",
    resumen: "Los tres tipos, con ejemplos reales de hostelería.",
    contenido: `Conviene distinguir tres cosas que se confunden a menudo. No es una cuestión académica: el procedimiento cambia según de cuál se trate.

## Acoso sexual

Cualquier comportamiento de naturaleza sexual, verbal o físico, que atente contra la dignidad de una persona, especialmente si crea un ambiente intimidatorio, degradante u ofensivo.

Ejemplos reales del sector:

- Comentarios sobre el cuerpo o la vida sexual de un compañero o compañera.
- Contacto físico no buscado: roces "sin querer" al cruzarse en la barra o en cocina, abrazos o tocamientos no deseados.
- Enviar mensajes, fotos o vídeos de contenido sexual por WhatsApp o redes, aunque sea fuera del horario de trabajo.
- Insistir en invitaciones después de haber recibido un no.
- **Chantaje sexual:** condicionar el turno, las horas, un ascenso o la renovación del contrato a aceptar una propuesta sexual. Esto es especialmente grave.

## Acoso por razón de sexo

Comportamiento que humilla o margina a una persona **por su sexo**, aunque no tenga contenido sexual alguno.

Por ejemplo: asignar sistemáticamente las tareas peores a las mujeres del equipo, hacer comentarios despectivos sobre la capacidad de alguien por ser hombre o mujer, o apartar a una compañera de responsabilidades al comunicar que está embarazada.

## Acoso laboral (*mobbing*)

Hostigamiento **repetido y prolongado** contra una persona con el fin de aislarla o de que acabe marchándose: humillaciones delante del equipo, dejarla sin tareas o darle solo las degradantes, aislarla del grupo, criticar todo lo que hace de manera sistemática.

## Dónde está el límite

1. **Cuenta cómo lo recibe quien lo sufre**, no la intención de quien lo hace. "Era una broma" no sirve de defensa si la otra persona se siente humillada.
2. **Un no es un no.** A la primera. No hace falta repetirlo ni justificarlo.
3. **No todo conflicto es acoso.** Una discusión puntual, una crítica de trabajo hecha con respeto o una instrucción que no gusta no son acoso. Que un responsable corrija tu forma de emplatar o te pida puntualidad es dirigir, no acosar.

## Un apunte sobre la hostelería

- **El acoso puede venir de un cliente.** Un cliente que se propasa con una camarera no es "parte del oficio". La empresa está obligada a protegerte y tienes que comunicarlo igual que si viniera de un compañero.
- **El grupo de WhatsApp del equipo y la copa de después del turno siguen siendo ámbito laboral.** Lo que ocurre ahí también está cubierto por este protocolo.`,
  },
  {
    id: "como-denunciar",
    titulo: "Cómo se denuncia",
    resumen: "El canal único, las dos modalidades y las garantías.",
    contenido: `## El canal único

Toda queja o denuncia se presenta desde el **canal interno del software**, en tu panel de empleado: el botón **«Queja o denuncia»**, en Solicitudes, junto al de pedir vacaciones o permisos. Lo revisa siempre **Recursos Humanos**.

Es el **único canal válido**. No se tramitan quejas por correo electrónico, por teléfono, por WhatsApp ni de palabra. Esto no es burocracia: garantiza que toda comunicación quede registrada con fecha, que ninguna se pierda por el camino y que nadie pueda decir después que nunca se enteró. También te protege a ti, porque deja constancia de que avisaste.

Puede presentarla tanto la persona afectada como cualquier compañero que presencie los hechos.

## Dos formas de presentarla

Al abrir el canal tendrás que elegir entre dos modalidades. **La diferencia es importante y conviene que la entiendas antes de decidir.**

### En tu nombre

Consta quién la presenta. Solo lo ve Recursos Humanos, con la confidencialidad de siempre.

Es la vía que **permite resolver de verdad la situación**: se puede investigar a fondo, escuchar a las dos partes y, si se confirman los hechos, adoptar medidas disciplinarias contra quien las cometió.

### Anónima

No se guarda ningún dato que permita identificarte. Al presentarla recibes un **código de seguimiento** con el que puedes consultar después en qué estado está y qué respuesta ha dado RRHH, sin revelar quién eres. Guárdalo: no se puede volver a mostrar.

**Pero tiene un límite que debes conocer:** una denuncia anónima **no puede dar lugar a una sanción**. La razón es sencilla. Para tomar medidas contra alguien hay que darle la oportunidad de defenderse de lo que se le imputa. Si al otro lado no hay una persona identificada, no puede haber contradicción entre ambas partes, y cualquier sanción impuesta así sería nula.

Por eso las anónimas **se registran, se leen y se estudian**, sirven como señal de alerta para detectar problemas y se computan como estadística — pero no pueden fundamentar un expediente.

Si quieres que la situación se resuelva y no solo que quede constancia, presenta la denuncia en tu nombre.

## Qué incluir

Cuanto más concreto, mejor se puede investigar: qué ha pasado, cuándo y dónde, quién estaba implicado, quién pudo presenciarlo y cualquier prueba que tengas (mensajes, correos, capturas, partes de turno).

No hace falta que aportes pruebas para denunciar. La investigación es responsabilidad de la empresa, no tuya.

## Qué pasa después

1. **Recepción y acuse.** RRHH registra la comunicación.
2. **Medidas cautelares.** Si hace falta, se separa a las partes —cambio de turno o de centro— sin perjuicio para quien denuncia.
3. **Investigación.** Se escucha a la persona denunciante, a la denunciada y a los testigos.
4. **Conclusión y decisión.** Se emite un informe y, si se confirman los hechos, se aplican las medidas disciplinarias que correspondan según el convenio de hostelería y el Estatuto de los Trabajadores, que pueden llegar al despido disciplinario.
5. **Comunicación del resultado** a las partes.

Como referencia, el objetivo es resolverlo en un plazo aproximado de **30 días** desde la comunicación.

## Las garantías

- **Confidencialidad.** Solo conocen el caso quienes intervienen en su tramitación.
- **Imparcialidad.** Se escucha a ambas partes antes de concluir nada.
- **Presunción de inocencia** de la persona denunciada mientras no se acredite lo contrario.
- **Prohibición absoluta de represalias** contra quien denuncia o declara. Tomar represalias es una falta muy grave.
- **Denuncias falsas.** Denunciar de mala fe, a sabiendas de que los hechos son falsos, también es sancionable. Esto no debe disuadirte: equivocarse de buena fe al interpretar una situación no es denunciar en falso.

## Si RRHH está implicado

Si la persona a la que tendrías que dirigirte está implicada en los hechos, comunícalo directamente a la Dirección de la empresa. Nunca debe quedarse sin cauce por ese motivo.

## Fuera de la empresa

Este protocolo interno no sustituye ni limita tu derecho a acudir a la **Inspección de Trabajo y Seguridad Social** o a la vía judicial en cualquier momento.`,
  },
  {
    id: "plan-igualdad",
    titulo: "El plan de igualdad",
    resumen: "Qué es, qué cubre y en qué te afecta.",
    contenido: `## Qué es

Un plan de igualdad es un conjunto ordenado de medidas para que no haya discriminación entre mujeres y hombres en la empresa. Se elabora a partir de un diagnóstico previo —se analiza cómo está realmente la plantilla— y se negocia con la representación de los trabajadores.

Es **obligatorio a partir de 50 personas** en plantilla (RD 901/2020) y hay que inscribirlo en el registro público de planes de igualdad (REGCON). Por debajo de esa cifra puede adoptarse voluntariamente, pero el **protocolo frente al acoso es obligatorio siempre**, sea cual sea el tamaño de la empresa.

## Qué materias cubre

- **Selección y contratación:** ofertas redactadas en términos neutros y procesos con criterios objetivos.
- **Clasificación profesional y promoción:** que ascender dependa del desempeño, no del sexo.
- **Formación:** acceso en igualdad de condiciones a la formación interna.
- **Retribución:** igualdad retributiva por trabajo de igual valor, con el registro salarial que exige la ley.
- **Conciliación:** ejercicio de los permisos y adaptaciones de jornada sin que penalice profesionalmente.
- **Infrarrepresentación femenina** y medidas para corregirla.
- **Prevención del acoso sexual y por razón de sexo.**

## En qué te afecta a ti

- Los **turnos y los horarios** se reparten con criterios objetivos, no por preferencias personales.
- Pedir una **reducción de jornada o un permiso** de conciliación no puede penalizarte en el reparto de turnos ni en tu promoción.
- Los **ascensos** se basan en desempeño y capacidad.
- Cobras lo mismo que un compañero que hace un **trabajo de igual valor**.
- El **lenguaje** que usamos en comunicados, carteles y grupos de trabajo es inclusivo.

## Dónde consultarlo

El plan de igualdad y el protocolo frente al acoso completos están a tu disposición en Recursos Humanos. Puedes solicitar una copia en cualquier momento, sin justificar el motivo.`,
  },
];
