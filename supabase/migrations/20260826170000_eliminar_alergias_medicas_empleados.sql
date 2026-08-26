-- Elimina `empleados.alergias_medicas`.
--
-- Por qué: es un dato de SALUD (categoría especial del art. 9 RGPD) que el
-- software no necesita para nada. No se usaba en ningún cálculo ni informe: solo
-- se pedía, opcional, en el último paso del asistente de primer acceso y se
-- guardaba sin que nadie lo consultara después. Guardar un dato de salud que no
-- se usa es una obligación legal sin contrapartida, así que se retira.
--
-- Junto con esto se ha eliminado del código el paso «Uniforme y salud» del
-- asistente de primer acceso, que quedaba vacío: la talla de uniforme dejó de
-- vivir en la ficha del empleado (ahora se registra al ENTREGAR cada prenda, en
-- el submódulo Entregas, que es donde consta la talla realmente entregada).
--
-- Dato que se pierde: 1 empleada tenía texto escrito (8 caracteres). Es
-- irreversible y está autorizado expresamente.

ALTER TABLE public.empleados DROP COLUMN IF EXISTS alergias_medicas;
