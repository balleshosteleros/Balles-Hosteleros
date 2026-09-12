-- Carta digital: un solo enlace, y el menú del día con su franja de verdad.
--
-- 1) Antes había dos lecturas de la carta: el QR de la mesa enseñaba solo lo
--    que se sirve ahora, y la web (que enlazaba con `?web=1`) lo enseñaba todo.
--    Ahora es la misma carta se entre por donde se entre, así que el parámetro
--    sobra en los enlaces ya guardados de las páginas web.
--
-- 2) El menú del día estaba clavado de lunes a viernes, de 12:30 a 16:30. Pasa
--    a verse todos los días, de 23:30 a 19:30 del día siguiente: la franja
--    cruza la medianoche, y el único hueco en el que NO aparece es de 19:30 a
--    23:30 — la noche, que es cuando no se sirve.
--
-- Idempotente: se puede repetir sin cambiar nada más.

-- 1) Los enlaces a la carta pierden el `?web=1`.
update paginas_web
set bloques = replace(bloques::text, '/carta?web=1', '/carta')::jsonb
where bloques::text like '%/carta?web=1%';

-- El histórico de versiones no se toca: es lo que hubo, no lo que hay.

-- 2) El menú del día, todos los días de 23:30 a 19:30 del día siguiente.
update carta_categorias
set dias_semana = null,
    hora_desde = '23:30',
    hora_hasta = '19:30',
    updated_at = now()
where nombre ilike 'Menú del día%'
  and (dias_semana is distinct from null
       or hora_desde is distinct from time '23:30'
       or hora_hasta is distinct from time '19:30');
