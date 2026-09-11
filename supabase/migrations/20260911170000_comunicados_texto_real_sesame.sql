-- COMUNICADOS: el texto REAL que había en Sesame.
--
-- Los 18 comunicados recurrentes sembrados el 03/09/2026 decían venir de Sesame,
-- pero su texto se había escrito de cero: de la migración solo existía una captura
-- del LISTADO. Iván capturó el 11/09/2026 los 12 comunicados abiertos, y esta
-- migración pone en cada uno su texto, su fecha, su hora y su recurrencia reales.
--
-- Además de los cuerpos, se corrige lo que la siembra había cambiado:
--   · las HORAS (todo estaba a las 10:00; en Sesame cada uno tenía la suya),
--   · el que faltaba ("Feliz Dia del Trabajador", el segundo, de las 12:41).
--
-- Dos retoques deliberados sobre el original, por ser errores materiales:
--   · "Grupo Bacanal" firmaba el Año Nuevo de HABANA -> firma la empresa correcta.
--   · El sistema de fichajes ya no es SESAME -> se nombra Balles Hosteleros.
--
-- Los textos salen de HABANA. BACANAL lleva el mismo, con su firma y su correo
-- de RRHH (Iván: "para Bacanal es casi todo igual, no cambia nada").
--
-- Idempotente: la clave de cada comunicado se guarda en `observaciones`
-- ("sesame:<clave> · ..."), así que volver a lanzarla actualiza, no duplica.

-- 1) Etiquetar las filas de la siembra vieja con su clave, para actualizarlas
--    en vez de crear duplicados al lado.
update public.comunicados set observaciones = 'sesame:fichajes'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '⏱️ Comunicado mensual · Fichajes';
update public.comunicados set observaciones = 'sesame:reunion_encargados'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '📋 Comunicado mensual · Reunión de encargados';
update public.comunicados set observaciones = 'sesame:pagos'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '💶 Comunicado mensual · Pagos';
update public.comunicados set observaciones = 'sesame:navidad'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '🎄 Feliz Navidad, equipo';
update public.comunicados set observaciones = 'sesame:ano_nuevo'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '🎉 Feliz Año Nuevo';
update public.comunicados set observaciones = 'sesame:trabajador'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '🛠️ ¡Feliz Día del Trabajador!';
update public.comunicados set observaciones = 'sesame:padre'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '💙 Feliz Día del Padre';
update public.comunicados set observaciones = 'sesame:madre'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '💗 Feliz Día de la Madre';
update public.comunicados set observaciones = 'sesame:horario_otono'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '🕐 Comunicado interno · Cambio de horario nacional';
update public.comunicados set observaciones = 'sesame:horario_primavera'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '🕐 Comunicado interno · Cambio de horario nacional (primavera)';
update public.comunicados set observaciones = 'sesame:computo_nochebuena'
  where observaciones like 'Comunicado periódico migrado de Sesame%' and titulo = '🎆 Cómputo de horas de Nochebuena y Nochevieja';

-- 2) El texto real, tal y como estaba en Sesame.
create temporary table tmp_com (
  clave        text primary key,
  titulo       text    not null,
  cuerpo       text    not null,
  recurrencia  text    not null,
  estado       text    not null,
  envio_local  timestamp,          -- hora de la EMPRESA (Europe/Madrid)
  nota         text    not null
) on commit drop;

insert into tmp_com (clave, titulo, cuerpo, recurrencia, estado, envio_local, nota) values

('sesame:fichajes', '📣 COMUNICADO MENSUAL - FICHAJES 📣', $c$<p>Estimado equipo,</p>
<p>Les recordamos que <strong>el día 1 de cada mes a las 00:00</strong> se cerrará el plazo para solicitar la revisión de fichajes. Si no se han solicitado antes de esa fecha, <strong>no serán contabilizados</strong>.</p>
<p>Para cualquier incidencia o circunstancia excepcional, es imprescindible avisar con <strong>antelación</strong> al departamento de Recursos Humanos.</p>
<p>Una vez pasada esta fecha, la información se enviará automáticamente al departamento de <strong>Contabilidad</strong>, y el total de horas fichadas será <strong>irrevocable</strong>.</p>
<p>Este comunicado se enviará mensualmente como recordatorio. Agradecemos su colaboración y cumplimiento con este procedimiento.</p>
<p>Atentamente,<br>Grupo Habana</p>$c$, 'mensual', 'programado', '2026-09-28 21:00', 'Texto original de Sesame (28/09/2026 21:00, cada mes, sin fin).'),

('sesame:reunion_encargados', '📣 COMUNICADO MENSUAL - REUNION ENCARGADOS 📣', $c$<p>Te informo sobre las fechas de pago correspondientes al año 2026:</p>
<p>📅 <strong>Calendario de reuniones</strong></p>
<ul>
<li>27 de enero – 12:00 h a 13:00</li>
<li>24 de febrero – 12:00 h a 13:00</li>
<li>24 de marzo – 12:00 h a 13:00</li>
<li>28 de abril – 12:00 h a 13:00</li>
<li>26 de mayo – 12:00 h a 13:00</li>
<li>23 de junio – 12:00 h a 13:00</li>
<li>28 de julio – 12:00 h a 13:00</li>
<li>25 de agosto – 12:00 h a 13:00</li>
<li>22 de septiembre – 12:00 h a 13:00</li>
<li>27 de octubre – 12:00 h a 13:00</li>
<li>24 de noviembre – 12:00 h a 13:00</li>
<li>22 de diciembre – 12:00 h a 13:00</li>
</ul>
<p>🔹 <strong>Enlace de reunion : ( siempre es el mismo )</strong><br>Vínculo a la videollamada: <a href="https://meet.google.com/cdc-keou-qid">https://meet.google.com/cdc-keou-qid</a></p>
<p>🔹 <strong>Ausencias en la fecha de reunion</strong><br>Si no puedes acudir en la fecha indicada, es necesario que lo comuniques previamente con tu gerente responsable, en caso de no avisar se dara por no presentado, y no sera valido la justificacion despues, lo que conlleva no presentarse.</p>
<p>📩 <a href="mailto:rrhh.grupohabana@gmail.com">rrhh.grupohabana@gmail.com</a></p>
<p>Agradezco tu colaboración y compromiso.</p>
<p>Atentamente,<br><strong>Departamento de RRHH</strong><br><strong>Grupo Habana</strong></p>$c$, 'mensual', 'borrador', '2026-09-20 13:00', 'Texto original de Sesame (20/09/2026 13:00, cada mes, fin 31/12/2026). En Sesame iba a 2 DEPARTAMENTOS, no a toda la empresa: en borrador hasta saber cuáles.'),

('sesame:pagos', '📣 COMUNICADO MENSUAL - PAGOS 📣', $c$<p>Te informo sobre las fechas de pago correspondientes al año 2025:</p>
<p>📅 <strong>Calendario de pagos</strong></p>
<ul>
<li>7 de enero – 13:00 h a 15:00</li>
<li>4 de febrero – 13:00 h a 15:00</li>
<li>4 de marzo – 13:00 h a 15:00</li>
<li>1 de abril – 13:00 h a 15:00</li>
<li>6 de mayo – 13:00 h a 15:00</li>
<li>3 de junio – 13:00 h a 15:00</li>
<li>1 de julio – 13:00 h a 15:00</li>
<li>5 de agosto – 13:00 h a 15:00</li>
<li>2 septiembre – 13:00 h a 15:00</li>
<li>7 de octubre – 13:00 h a 15:00</li>
<li>4 de noviembre – 13:00 h a 15:00</li>
<li>2 de diciembre – 13:00 h a 15:00</li>
</ul>
<p>🔹 <strong>Ausencias en la fecha de pago</strong><br>Si no puedes acudir en la fecha indicada, es necesario que lo comuniques previamente con tu gerente responsable para coordinar la entrega.</p>
<p>🔹 <strong>Gestión de incidencias</strong><br>Para cualquier incidencia relacionada con el pago, por favor, envía un correo a la siguiente dirección :</p>
<p>📩 <a href="mailto:rrhh.grupohabana@gmail.com">rrhh.grupohabana@gmail.com</a></p>
<p>🔹 <strong>Revisión de fichajes</strong><br>Es importante que revises tus horas fichadas antes de presentar cualquier reclamación al departamento de rrhh. Una vez realizado el pago, no será posible efectuar cambios, ya que los registros se cierran de forma definitiva el día 1 de cada mes a las 00:00 h, en caso de mandar una revision del pago por un error de la empresa se respondera en el plazo maximo de 7 dias.</p>
<p>En el caso de los fichajes correspondientes a la última semana del mes, estos serán aprobados o denegados antes del pago, siempre y cuando la solicitud de corrección haya sido enviada antes del cierre del mes (día 1 a las 00:00 h).</p>
<p>Agradezco tu colaboración y compromiso.</p>
<p>Atentamente,<br><strong>Departamento de RRHH</strong><br><strong>Grupo Habana</strong></p>$c$, 'mensual', 'programado', '2026-10-01 13:00', 'Texto original de Sesame (01/10/2026 13:00, cada mes, fin 31/12/2026).'),

('sesame:navidad', '🎄 Feliz Navidad, equipo 🎄', $c$<p>🎄 <strong>Querido equipo</strong> 🎄</p>
<p>🙏 En estas fechas tan especiales queremos parar un momento para deciros <strong>GRACIAS</strong>.<br>Gracias por vuestro esfuerzo diario, por la actitud, la implicación y por formar parte de esta gran familia que construimos juntos día a día.</p>
<p>❤️ La Navidad también es tiempo de mirar a lo verdaderamente importante:<br>vuestras <strong>familias</strong>, las personas que os apoyan, os cuidan y os esperan al final de cada jornada. A ellas también va dirigido este mensaje, porque sin su comprensión y cariño nada de esto sería posible.</p>
<p>🙏✨ Os deseamos <strong>salud, bienestar y calma</strong>, que podáis descansar, disfrutar, recargar energía y empezar el nuevo año con ilusión, fuerza y buenas vibras (de las buenas, no de las que roban energía 😉).</p>
<p>💪 Gracias por ser como sois y por dar siempre lo mejor.<br>Seguimos creciendo juntos, como equipo y como personas.</p>
<p>🎁 <strong>Feliz Navidad y un próspero Año Nuevo</strong> 🎁</p>$c$, 'anual', 'programado', '2026-12-25 16:00', 'Texto original de Sesame (25/12/2026 16:00, cada año, sin fin).'),

('sesame:ano_nuevo', '📣 Feliz Año Nuevo', $c$<p>Estimado equipo,</p>
<p>Con la llegada de un nuevo año, queremos aprovechar este momento para agradeceros sinceramente el compromiso, el esfuerzo y la dedicación que habéis demostrado a lo largo del año que dejamos atrás. Cada uno de vosotros ha sido una parte fundamental para que la empresa siga creciendo y avanzando.</p>
<p>Comenzamos este nuevo año con ilusión, nuevos retos y grandes oportunidades, y estamos convencidos de que, con el talento y la implicación de todo el equipo, seguiremos alcanzando importantes logros juntos.</p>
<p>Os deseamos un año lleno de salud, éxitos profesionales y personales, y muchas razones para celebrar. Gracias por formar parte de este proyecto y por hacerlo posible día a día.</p>
<p>¡Feliz Año Nuevo!<br>Grupo Habana</p>$c$, 'anual', 'programado', '2027-01-01 16:00', 'Texto original de Sesame (01/01/2027 16:00, cada año, sin fin). El original firmaba "Grupo Bacanal" en HABANA; firma corregida.'),

('sesame:trabajador', '🎉 ¡Feliz Día del Trabajador! 🛠️', $c$<p>Desde <strong>Habana</strong> queremos daros las <strong>GRACIAS de corazón</strong> ❤️.</p>
<p>Cada uno de vosotros aporta algo <strong>único y valioso</strong> que hace crecer esta familia. Sois los que convertís esta empresa en algo más que un lugar de trabajo:<br>👉 un espacio donde se comparte, se aprende y se construye juntos 🤝✨</p>
<p>👏 Gracias por vuestro <strong>compromiso</strong>,<br>🔥 vuestra <strong>energía diaria</strong>,<br>💪 vuestro <strong>esfuerzo constante</strong>,<br>y sobre todo… por <strong>elegir ser parte de este equipo</strong>.</p>
<p>Nada de lo que logramos sería posible sin vosotros.<br><strong>Sois el alma de Habana.</strong></p>
<p>Con mucho cariño,<br>💛 <strong>Equipo Habana</strong></p>$c$, 'anual', 'programado', '2027-05-01 15:20', 'Texto original de Sesame (01/05/2027 15:20, cada año, sin fin).'),

('sesame:trabajador_2', '📣 Feliz Dia del Trabajador', $c$<p>Hola equipo,</p>
<p>Hoy celebramos el Día del Trabajador, ese día en el que recordamos lo importante que es vuestro esfuerzo diario… aunque algunos sigamos necesitando café para arrancar y otros tengamos una relación demasiado estrecha con el botón de “posponer alarma”.</p>
<p>Queremos aprovechar esta ocasión para reconocer de corazón vuestra dedicación, vuestra actitud y todo lo que aportáis cada día. Cada persona, desde su puesto, hace que esto funcione, avance y tenga sentido.</p>
<p>Y a quienes hoy les toca trabajar, solo podemos decirles una cosa: la culpa no es nuestra, es de los clientes, que han decidido venir justo hoy. A nosotros nos encantaría cerrar, daros el día libre y celebrarlo todos como se merece… pero también nos encanta poder pagar a todo el mundo cada mes, y si cerramos demasiado, la cosa se nos complica bastante.</p>
<p>Así que, entre bromas y realidades, queremos que sepáis que valoramos muchísimo vuestro esfuerzo, especialmente en días como hoy. Detrás de cada tarea terminada, cada problema resuelto y cada “ahora lo miro” que acaba saliendo adelante, hay compromiso, compañerismo y mucho trabajo bien hecho.</p>
<p>Esperamos que disfrutéis de este día con orgullo por todo lo que hacéis y, si os toca trabajarlo, al menos que venga acompañado de buen ambiente, paciencia y algún café salvador.</p>
<p>¡Feliz Día del Trabajador!</p>$c$, 'anual', 'borrador', '2027-05-01 12:41', 'Texto original de Sesame (01/05/2027 12:41, cada año, sin fin). En Sesame había DOS del Día del Trabajador el mismo día: este queda en borrador para no mandar dos.'),

('sesame:padre', 'Feliz día del Padre 💙', $c$<p>Feliz día del Padre:</p>
<p>Hoy es un día especial para todos aquellos que, de una u otra manera, han vivido la experiencia de la paternidad.</p>
<p>Ya sea que estén criando a sus hijos con amor y dedicación, esperando la llegada de un nuevo miembro a la familia, asumiendo el rol de padres por circunstancias de la vida, recordando a aquellos que ya no están con nosotros o estando a miles de kilómetros, este día está dedicado a todos vosotros.</p>
<p>La paternidad es un viaje lleno de retos, alegrías, aprendizajes y momentos de profunda conexión, no es un camino fácil, pero recordando por quien lo recorremos hace que todos los esfuerzos merezcan la pena. Cada uno de vosotros tiene o tendrá una historia única que contar y un amor incondicional que compartir.</p>
<p>En este Día del Padre, queremos agradeceros por vuestro esfuerzo, por vuestra entrega y por ser ejemplo de valentía, paciencia y amor.</p>
<p>Gracias por ser una inspiración para todos los que os rodeamos.</p>
<p>Con todo el cariño y admiración</p>
<p>Equipo HABANA.</p>$c$, 'anual', 'programado', '2027-03-19 08:00', 'Texto original de Sesame (19/03/2027 08:00, cada año, sin fin).'),

('sesame:madre', 'Feliz día de la Madre 💗', $c$<p>Feliz día de la Madre:</p>
<p>Hoy es un día especial para todas aquellas que, de una u otra manera, han vivido la experiencia de la maternidad.</p>
<p>Ya sea que estén criando a sus hijos con amor y dedicación, esperando la llegada de un nuevo miembro a la familia, asumiendo el rol de madres por circunstancias de la vida, recordando a aquellas que ya no están con nosotros o estando a miles de kilómetros, este día está dedicado a todas vosotras.</p>
<p>La maternidad es un viaje lleno de retos, alegrías, aprendizajes y momentos de profunda conexión, no es un camino fácil, pero recordando por quien lo recorremos hace que todos los esfuerzos merezcan la pena. Cada una de vosotras tiene o tendrá una historia única que contar y un amor incondicional que compartir.</p>
<p>En este Día de la Madre, queremos agradeceros por vuestro esfuerzo, por vuestra entrega y por ser ejemplo de valentía, paciencia y amor.</p>
<p>Gracias por ser una inspiración para todos los que os rodeamos.</p>
<p>Con todo el cariño y admiración</p>
<p>Equipo HABANA.</p>$c$, 'anual', 'programado', '2027-05-03 13:00', 'Texto original de Sesame (03/05/2027 13:00, cada año, sin fin).'),

('sesame:horario_otono', '📣 COMUNICADO INTERNO – CAMBIO DE HORARIO NACIONAL', $c$<p>Hola equipo,</p>
<p>Os informamos que con motivo del <strong>cambio de horario nacional</strong> (cuando se adelanta o atrasa el reloj), es importante tener en cuenta lo siguiente:</p>
<p>🔹 <strong>Cada persona deberá cumplir el total de horas asignadas a su turno</strong>, sin que el cambio horario afecte este cómputo.<br>🔹 El sistema de fichajes <strong>Balles Hosteleros calcula automáticamente el total de horas trabajadas</strong>, por lo que no habrá errores ni confusión en el registro.<br>🔹 En caso de que la <strong>hora de salida prevista coincida justo con el momento del cambio horario</strong>, <strong>prevalecerá siempre el total de horas a realizar</strong>, y no la hora marcada inicialmente de salida.</p>
<p>📌 <strong>Ejemplo práctico:</strong><br>Un empleado tiene un turno de <strong>8 horas</strong>, de <strong>20:00h a 04:00h</strong>.</p>
<ul>
<li>Si esa noche se <strong>adelanta una hora</strong> (por ejemplo, de 2:00h pasan a ser las 3:00h), se deberá <strong>salir una hora más tarde</strong>, a la <strong>05:00h real</strong>, para completar las 8 horas.</li>
<li>Si esa noche se <strong>atrasa una hora</strong> (por ejemplo, de 3:00h vuelven a ser las 2:00h), se deberá <strong>salir una hora antes</strong>, a la <strong>03:00h real</strong>, para completar las 8 horas.</li>
</ul>
<p>En el caso del horario real del local sera exactamente igual, el cambio que sea de 2:00 a 3:00, el local cerrara una hora mas tarde, y cuando el cambio sea de 3:00 a 2:00, el local cerrara una hora antes. Siempre es importante regirse por el total de horas que debe estar el local abierto que deben ser el toal de horas de siempre, al igual que el total de horas trabajadas siempre seran las mismas por cada persona de la plantilla.</p>
<p><strong>Lo importante es que el sistema de fichajes marca las horas reales trabajadas.</strong><br>No os fijéis tanto en el reloj, sino en cumplir con vuestro horario completo según el turno asignado. Si os toca el cambio de hora, no pasa nada: el sistema lo gestiona automáticamente.</p>
<p>Gracias a todos por vuestra atención y compromiso… ¡aunque el reloj nos quiera despistar dos veces al año! 😉</p>
<p>Agradezco tu colaboración y compromiso.</p>
<p>Atentamente,<br><strong>Departamento de RRHH</strong><br><strong>Grupo Habana</strong></p>$c$, 'anual', 'programado', '2026-10-24 13:00', 'Texto original de Sesame (24/10/2026 13:00, cada año, sin fin). Donde decía SESAME ahora dice Balles Hosteleros.'),

('sesame:horario_primavera', '📣 COMUNICADO INTERNO – CAMBIO DE HORARIO NACIONAL', $c$<p>Hola equipo,</p>
<p>Os informamos que con motivo del <strong>cambio de horario nacional</strong> (cuando se adelanta o atrasa el reloj), es importante tener en cuenta lo siguiente:</p>
<p>🔹 <strong>Cada persona deberá cumplir el total de horas asignadas a su turno</strong>, sin que el cambio horario afecte este cómputo.<br>🔹 El sistema de fichajes <strong>Balles Hosteleros calcula automáticamente el total de horas trabajadas</strong>, por lo que no habrá errores ni confusión en el registro.<br>🔹 En caso de que la <strong>hora de salida prevista coincida justo con el momento del cambio horario</strong>, <strong>prevalecerá siempre el total de horas a realizar</strong>, y no la hora marcada inicialmente de salida.</p>
<p>📌 <strong>Ejemplo práctico:</strong><br>Un empleado tiene un turno de <strong>8 horas</strong>, de <strong>20:00h a 04:00h</strong>.</p>
<ul>
<li>Si esa noche se <strong>adelanta una hora</strong> (por ejemplo, de 2:00h pasan a ser las 3:00h), se deberá <strong>salir una hora más tarde</strong>, a la <strong>05:00h real</strong>, para completar las 8 horas.</li>
<li>Si esa noche se <strong>atrasa una hora</strong> (por ejemplo, de 3:00h vuelven a ser las 2:00h), se deberá <strong>salir una hora antes</strong>, a la <strong>03:00h real</strong>, para completar las 8 horas.</li>
</ul>
<p>En el caso del horario real del local sera exactamente igual, el cambio que sea de 2:00 a 3:00, el local cerrara una hora mas tarde, y cuando el cambio sea de 3:00 a 2:00, el local cerrara una hora antes. Siempre es importante regirse por el total de horas que debe estar el local abierto que deben ser el toal de horas de siempre, al igual que el total de horas trabajadas siempre seran las mismas por cada persona de la plantilla.</p>
<p><strong>Lo importante es que el sistema de fichajes marca las horas reales trabajadas.</strong><br>No os fijéis tanto en el reloj, sino en cumplir con vuestro horario completo según el turno asignado. Si os toca el cambio de hora, no pasa nada: el sistema lo gestiona automáticamente.</p>
<p>Gracias a todos por vuestra atención y compromiso… ¡aunque el reloj nos quiera despistar dos veces al año! 😉</p>
<p>Agradezco tu colaboración y compromiso.</p>
<p>Atentamente,<br><strong>Departamento de RRHH</strong><br><strong>Grupo Habana</strong></p>$c$, 'anual', 'programado', '2027-03-24 13:00', 'Texto original de Sesame (24/03/2027 13:00, cada año, sin fin). Donde decía SESAME ahora dice Balles Hosteleros.'),

('sesame:computo_nochebuena', '📣 COMPUTO DE HORAS DE NOCHEBUENA Y NOCHEVIEJA', $c$<p>Estimados/as compañeros/as,</p>
<p>Con motivo de las fechas especiales de <strong>Nochebuena y Nochevieja</strong>, queremos informaros sobre el tratamiento de las horas trabajadas durante dichas jornadas, así como las condiciones aplicables en caso de cierre de la empresa.</p>
<p>Durante las siguientes <strong>franjas horarias</strong>, las horas trabajadas <strong>computarán al doble</strong>:</p>
<p>📅 <strong>Nochebuena</strong><br>Desde el <strong>día 24 a las 11:00 a. m.</strong> hasta el <strong>día 25 a las 7:00 a. m.</strong></p>
<p>📅 <strong>Nochevieja</strong><br>Desde el <strong>día 31 a las 11:00 a. m.</strong> hasta el <strong>día 1 a las 7:00 a. m.</strong></p>
<p>Esto significa que, por ejemplo, si durante cualquiera de estas franjas se trabajan <strong>6 horas</strong>, en el sistema <strong>Balles Hosteleros</strong> se reflejarán como <strong>12 horas trabajadas</strong>, y a la hora de la liquidación se abonarán al <strong>doble del precio habitual</strong>, mediante el complemento correspondiente.</p>
<p>Es importante señalar que <strong>el resto de días trabajados fuera de estas franjas horarias</strong> se computarán como <strong>días normales</strong>, sin ninguna excepción.<br>La empresa <strong>únicamente reserva estos tramos horarios concretos</strong> y los contabiliza, como viene haciendo desde hace años, como <strong>días especiales</strong>, aplicando para ellos un <strong>complemento salarial</strong> que permite retribuir dichas horas a un importe superior al habitual.</p>
<p>Asimismo, queremos informaros de que <strong>los horarios durante estos días podrán variar</strong>. Será el <strong>departamento de RRHH</strong> quien coordine directamente con los trabajadores la organización de los turnos necesarios.</p>
<p>En el caso de <strong>encargados/as, jefes/as de cocina y gerentes</strong>, podrá solicitarse —de manera excepcional— el <strong>cambio o ajuste de algún día</strong>, aunque no coincida con su horario habitual, con el objetivo de que <strong>cada persona trabaje al menos uno de los dos días</strong>.<br>Dado que ambas fechas caen en el mismo día de la semana y repiten el mismo horario, la empresa ha decidido aplicar este criterio para <strong>repartir de forma justa estos días especiales</strong>, permitiendo que todos puedan disfrutar de uno de ellos siempre que sea posible.</p>
<p>Para el <strong>resto de departamentos</strong>, existirá <strong>mayor flexibilidad</strong>, especialmente en aquellos casos en los que no se tenga asignado horario en estas fechas. En dichas situaciones, se podrá <strong>coordinar directamente con RRHH</strong> la decisión de trabajar o no durante esos días.</p>
<p>Por otro lado, en el caso de que la empresa decida <strong>no abrir durante estas franjas horarias por causas justificadas</strong>, los trabajadores/as a los que por horario les correspondería trabajar deberán tener en cuenta lo siguiente:</p>
<ul>
<li>Dichas horas quedarán <strong>pendientes de recuperación</strong>, al tratarse de un cierre decidido por la empresa.</li>
<li>La parte positiva es que se disfrutará del día libre.</li>
<li>Las horas no trabajadas se <strong>recuperarán en semanas posteriores</strong>, <strong>sin una fecha límite concreta</strong>.</li>
<li>La recuperación de estas horas se <strong>coordinará con el departamento de RRHH</strong>, siempre <strong>de mutuo acuerdo entre la empresa y el trabajador/a</strong>, ya que se trata de horas fuera del horario habitual.</li>
</ul>
<p>Esperamos que esta información os resulte útil y ayude a clarificar cualquier duda.<br>Para cualquier consulta adicional, no dudéis en contactar con RRHH.</p>
<p>📩 <a href="mailto:rrhh.grupohabana@gmail.com">rrhh.grupohabana@gmail.com</a></p>
<p>Muchas gracias por vuestra colaboración y comprensión.</p>
<p>Atentamente,<br><strong>Departamento de RRHH</strong><br><strong>Grupo Habana</strong></p>$c$, 'anual', 'programado', '2026-11-28 13:00', 'Texto original de Sesame (28/11/2026 13:00, cada año, sin fin). Donde decía Sesame ahora dice Balles Hosteleros.');

-- 3) Lo que le toca a cada empresa. BACANAL lleva el mismo texto con su firma
--    y su correo de RRHH.
create temporary table tmp_plan on commit drop as
select
  e.id                                as empresa_id,
  t.clave,
  t.titulo,
  case when e.nombre = 'BACANAL' then
    replace(replace(replace(replace(replace(replace(t.cuerpo,
      'rrhh.grupohabana@gmail.com', 'rrhh.grupobacanal@gmail.com'),
      'Grupo Habana',   'Grupo Bacanal'),
      'Equipo Habana',  'Equipo Bacanal'),
      'Equipo HABANA',  'Equipo BACANAL'),
      'Desde <strong>Habana</strong>', 'Desde <strong>Bacanal</strong>'),
      'alma de Habana', 'alma de Bacanal')
  else t.cuerpo end                   as cuerpo,
  t.recurrencia,
  t.estado,
  (t.envio_local at time zone 'Europe/Madrid') as envio,
  (t.clave || ' · ' || t.nota)        as observaciones
from tmp_com t
cross join public.empresas e
where e.nombre in ('HABANA', 'BACANAL');

-- 4) Actualizar los que ya existen (los de la siembra vieja, ya etiquetados).
update public.comunicados c set
  titulo        = p.titulo,
  asunto        = p.titulo,
  cuerpo        = p.cuerpo,
  recurrencia   = p.recurrencia,
  estado        = p.estado,
  envio         = case when p.estado = 'borrador' then null else p.envio end,
  tipo          = 'informativo',
  toda_empresa  = true,
  roles_destinatarios         = '{}',
  empleados_destinatarios     = '{}',
  departamentos_destinatarios = '{}',
  enviar_email  = true,
  observaciones = p.observaciones,
  updated_at    = now()
from tmp_plan p
where c.empresa_id = p.empresa_id
  and (c.observaciones = p.clave or c.observaciones like p.clave || ' ·%');

-- 5) Crear los que no estaban (el segundo Día del Trabajador, y cualquiera que
--    falte si la siembra vieja ya no está).
insert into public.comunicados (
  empresa_id, titulo, asunto, cuerpo, estado, tipo, recurrencia, toda_empresa,
  roles_destinatarios, empleados_destinatarios, departamentos_destinatarios,
  envio, observaciones, enviar_email
)
select
  p.empresa_id, p.titulo, p.titulo, p.cuerpo, p.estado, 'informativo', p.recurrencia, true,
  '{}', '{}', '{}',
  case when p.estado = 'borrador' then null else p.envio end,
  p.observaciones, true
from tmp_plan p
where not exists (
  select 1 from public.comunicados c
  where c.empresa_id = p.empresa_id
    and (c.observaciones = p.clave or c.observaciones like p.clave || ' ·%')
);
