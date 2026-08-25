-- Limpieza: visibilidad de zonas del PRP-048 que nunca se implemento.
--
-- `zonas.zona_publica_id`, `zonas.visible_cliente` y `zonas.oculta_total` se
-- crearon para que el cliente viera nombres distintos a los internos. Nunca se
-- construyo la UI ni el motor las leyo jamas: las tres estan en su valor por
-- defecto en las 16 zonas de las dos empresas (verificado antes de borrar).
--
-- Esa necesidad la cubren ahora `grupos_zonas` + `grupo_zona_zonas`, con un
-- modelo mejor: el nombre comercial no es a su vez una zona real con mesas.
--
-- Mantener las columnas confunde: `zonas.zona_publica_id` se parece demasiado
-- a `reservas.grupo_zona_id` y son cosas distintas.
--
-- NO se toca `tipos_mesa_config` (visibilidad por tipo de mesa): tambien esta
-- sin uso, pero es un concepto aparte que puede querer implementarse.

alter table public.zonas drop column if exists zona_publica_id;
alter table public.zonas drop column if exists visible_cliente;
alter table public.zonas drop column if exists oculta_total;
