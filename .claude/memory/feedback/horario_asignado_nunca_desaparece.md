# Un horario asignado NUNCA desaparece, sea de la versión que sea

**Regla de Iván (12-09-2026):** *«no puede desaparecer, esto es una norma: ninguna
versión. Todos los horarios que estén asignados, o bien por turno o bien por
patrón, siempre salen, da igual la versión. Eso no afecta, eso afecta para hacer
un cambio nada más.»*

**Qué significa:** `es_oficial` (la versión vigente de una familia de turnos o de
patrones) sirve SOLO para decidir **qué se ofrece al hacer un cambio**. No sirve
para decidir qué se pinta. Si alguien tiene puesto un turno o un patrón, su
horario se ve siempre: en el cuadrante, en su calendario, en su ficha y en las
horas del mes, aunque sea una versión anterior.

**El fallo que lo destapó:** el catálogo de turnos del cuadrante
(`planificacion-actions.ts`) filtraba `es_oficial = true`. Al versionar los
turnos de cocina, la versión 1 dejó de ser oficial pero seguía siendo la vigente
hasta su `vigente_hasta`: esos días salían **en blanco** y parecía que los dos
jefes de cocina no trabajaban miércoles, viernes ni sábado. Arreglado en
`5622ea3e`.

**Al tocar código, comprobar:** cualquier consulta con `.eq("es_oficial", true)`
tiene que ser de un sitio donde se ELIGE algo (asignar un turno, montar un
patrón, adjudicar un puesto, contratar). Si es de un sitio donde se MUESTRA un
horario ya asignado, está mal.

Relacionado: [[project_horario_vigencia_y_recorte_por_baja]]
