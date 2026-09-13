-- Un cronograma para CADA puesto, aunque nazca sin tareas.
--
-- El cronograma no es una tabla propia: es el conjunto de tareas de un puesto
-- dentro de `cronogramas_operativos`. Por eso un cronograma "vacío" se crea con
-- su fila de arranque («Añadir misión de …», frecuencia OTRO), que la pantalla
-- NO cuenta como tarea: el puesto sale como «Sin tareas todavía», pero ya
-- existe, ya está vinculado y ya se puede abrir y rellenar.
--
-- Es exactamente lo que hace `crearCronogramaParaPuesto` al crear un puesto
-- nuevo; esto lo aplica a los que ya existían. La tabla estaba VACÍA en las tres
-- sociedades, así que ningún puesto tenía el suyo.
--
-- Idempotente: solo crea el que falta, y no toca las tareas que ya haya.

insert into cronogramas_operativos
  (empresa_id, puesto_id, rol, departamento, tarea, frecuencia,
   tiempo_requerido, id_visible, orden, parent_id)
select p.empresa_id,
       p.id,
       trim(p.nombre),
       coalesce(d.nombre, ''),
       'Añadir misión de ' || trim(p.nombre),
       'OTRO',
       '',
       '1',
       1,
       null
  from puestos p
  left join departamentos d on d.id = p.departamento_id
 where not exists (
   select 1 from cronogramas_operativos c where c.puesto_id = p.id
 );
