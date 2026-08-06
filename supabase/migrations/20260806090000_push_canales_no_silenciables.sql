-- Los avisos internos del software NO son silenciables por el empleado.
--
-- Regla de negocio (Ivan, 6 ago 2026): dentro de Balles no existe ningun boton
-- para apagar avisos. Lo unico que el empleado puede silenciar es lo que vive en
-- su terminal (ajustes del movil/navegador, "No molestar"), que esta fuera de
-- nuestro alcance.
--
-- Estado antes de esta migracion: las 6 columnas push_* existian y el servidor
-- las respetaba al enviar, pero NINGUNA pantalla las escribia — eran una
-- preferencia que nunca se llego a montar. Los 25 usuarios las tenian a true.
-- Es decir: el comportamiento ya era el correcto, pero no habia nada que lo
-- garantizase. Esto lo blinda para que no se pueda romper por error ni por una
-- pantalla futura.
--
-- Las columnas NO se borran: el dia que se quiera permitir silenciar SOLO las
-- llamadas internas (un encargado que libra, alguien de vacaciones) el canal ya
-- existe. Lo que se impide es apagarlas mientras esa decision no se tome.

-- Normaliza cualquier valor apagado o nulo antes de fijar la restriccion.
UPDATE public.usuarios
SET push_solicitudes = true,
    push_comunicados = true,
    push_cronograma  = true,
    push_llamadas    = true,
    push_fichajes    = true,
    push_alertas     = true
WHERE push_solicitudes IS DISTINCT FROM true
   OR push_comunicados IS DISTINCT FROM true
   OR push_cronograma  IS DISTINCT FROM true
   OR push_llamadas    IS DISTINCT FROM true
   OR push_fichajes    IS DISTINCT FROM true
   OR push_alertas     IS DISTINCT FROM true;

-- Default a true para las altas nuevas: un empleado nace con todos los avisos.
ALTER TABLE public.usuarios
  ALTER COLUMN push_solicitudes SET DEFAULT true,
  ALTER COLUMN push_comunicados SET DEFAULT true,
  ALTER COLUMN push_cronograma  SET DEFAULT true,
  ALTER COLUMN push_llamadas    SET DEFAULT true,
  ALTER COLUMN push_fichajes    SET DEFAULT true,
  ALTER COLUMN push_alertas     SET DEFAULT true;

-- El candado: ningun canal puede quedar apagado. Si algun dia se decide permitir
-- silenciar las llamadas, se retira este CHECK de forma explicita y consciente.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS chk_usuarios_push_canales_activos;

ALTER TABLE public.usuarios
  ADD CONSTRAINT chk_usuarios_push_canales_activos CHECK (
    push_solicitudes IS NOT false
    AND push_comunicados IS NOT false
    AND push_cronograma  IS NOT false
    AND push_llamadas    IS NOT false
    AND push_fichajes    IS NOT false
    AND push_alertas     IS NOT false
  );
