-- ============================================================
-- 20260906210000_gestoria_modelos_un_solo_enlace_abierto.sql
--
-- Un solo enlace ABIERTO por periodo: se acabaron los correos duplicados
-- a la gestoría.
--
-- QUÉ PASABA: el cron `gestoria-modelos` comprobaba en código si ya había
-- token para ese periodo ("¿ya enviamos?" → select → si no hay, insert).
-- Entre el select y el insert no había nada que lo protegiera, así que dos
-- ejecuciones a la vez leían ambas "no hay token" y ambas creaban el suyo.
-- La gestoría recibía DOS correos con DOS enlaces distintos para lo mismo.
--
-- Verificado en producción antes de escribir esto: 22 tokens para 11 periodos
-- (el 100% duplicado), en dos tandas separadas por 10 segundos —el mismo cron
-- ejecutado dos veces casi a la vez, no dos días distintos—.
--
-- QUÉ SE HACE: un índice único PARCIAL sobre los tokens vivos. La BD es lo
-- único que puede arbitrar esto de verdad: aunque dos ejecuciones coincidan,
-- solo una consigue insertar y la otra recibe error de duplicado.
--
-- Por qué PARCIAL (solo `completado_en is null`):
--   · El reenvío manual desde la ficha del modelo DEBE poder crear un enlace
--     nuevo cuando el anterior ya se usó o caducó. Un único índice sobre
--     (empresa, ejercicio, grupo, periodo) lo bloquearía para siempre.
--   · Lo que no tiene sentido es tener DOS enlaces vivos a la vez para el
--     mismo periodo: son dos llaves de la misma puerta.
--
-- LIMPIEZA PREVIA: los duplicados actuales están todos SIN USAR (0 subidas,
-- ninguno completado, verificado). Se cierran los sobrantes dejando el más
-- reciente vivo —que es el del último correo, el que la gestoría tendría a
-- mano—. Cerrar = marcar `completado_en`, que es como el propio cron descarta
-- un token que ya no toca. No se borra ninguna fila: se conserva la traza.
--
-- Idempotente.
-- ============================================================

-- ─── 1. Cerrar los duplicados vivos, dejando el más reciente ───
with vivos as (
  select
    id,
    row_number() over (
      partition by empresa_id, ejercicio, grupo, periodo
      order by created_at desc
    ) as rn
  from public.gestoria_modelos_tokens
  where completado_en is null
)
update public.gestoria_modelos_tokens t
   set completado_en = now()
  from vivos v
 where t.id = v.id
   and v.rn > 1;

-- ─── 2. Que no vuelva a pasar ───
create unique index if not exists uq_gestoria_modelos_token_abierto
  on public.gestoria_modelos_tokens (empresa_id, ejercicio, grupo, periodo)
  where completado_en is null;

comment on index public.uq_gestoria_modelos_token_abierto is
  'Un único enlace VIVO por empresa/ejercicio/grupo/periodo. Impide que dos '
  'ejecuciones simultáneas del cron generen dos correos a la gestoría. Es '
  'parcial a propósito: al completarse un token, el reenvío manual puede crear '
  'uno nuevo.';
