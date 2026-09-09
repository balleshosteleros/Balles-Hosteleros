-- ESCUELA — fuera la ficha de pruebas que venía de GoHighLevel.
--
-- «Prueba Edu Prueba» no es nadie: es una cuenta de pruebas que se coló en la
-- migración. No tenía ni progreso ni matrículas. Su ficha de CLIENTE se queda
-- como está: esto solo la saca de la escuela.
delete from public.escuela_alumnos
 where lower(email) = 'marketingotyedu@gmail.com'
   and empresa_id = (select id from public.empresas where es_matriz = true limit 1);
