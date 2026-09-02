-- Nóminas · gestoría: UN SOLO ENLACE PERMANENTE por empresa.
--
-- Antes cada enlace llevaba el MES dentro (`periodo`) y caducaba. Eso provocaba
-- que el enlace apuntara al mes equivocado y quedara inservible: HABANA recibió
-- en agosto un enlace de julio (el token de julio se regeneró pisando al que
-- debía ser de agosto) y, como el envío mensual ya estaba anotado, nunca se le
-- mandó otro. La gestoría tenía un enlace que no servía para nada.
--
-- Ahora el enlace identifica SOLO a la empresa y no caduca. El mes lo elige la
-- gestoría dentro de la página, por separado para nóminas y para TC1. Quien
-- cierra un mes es RRHH al confirmarlo (`rrhh_nominas_mes.confirmado_en`): un
-- mes cerrado se deniega, uno abierto admite las tandas que hagan falta.
--
-- `token_hash` NO se toca: los enlaces que la gestoría ya tiene en su correo
-- siguen funcionando y pasan a ser permanentes. No hay que reenviar nada.
--
-- Idempotente y NO destructiva: no borra filas ni columnas.

-- 1. El mes deja de ser obligatorio. NULL = enlace permanente.
--    El CHECK del formato ya tolera NULL (evalúa a NULL → pasa).
alter table public.nominas_gestoria_tokens
  alter column periodo drop not null;

-- 2. Sin caducidad. NULL = no caduca.
alter table public.nominas_gestoria_tokens
  alter column expira_en drop not null;

-- 3. Fuera la unicidad por (empresa, mes): ya no hay un token por mes.
alter table public.nominas_gestoria_tokens
  drop constraint if exists nominas_gestoria_tokens_empresa_id_periodo_key;

-- 4. Un único enlace permanente por empresa. Índice PARCIAL: en un índice único
--    normal dos NULL no colisionan, así que no bastaría con (empresa_id, periodo).
create unique index if not exists nominas_gestoria_tokens_empresa_uidx
  on public.nominas_gestoria_tokens (empresa_id)
  where periodo is null;

-- 5. Promover a permanente el token abierto más reciente de cada empresa, para
--    que el enlace que la gestoría ya tiene siga siendo válido.
with elegido as (
  select distinct on (empresa_id) id
  from public.nominas_gestoria_tokens
  where cerrado_en is null and periodo is not null
  order by empresa_id, enviado_en desc nulls last
)
update public.nominas_gestoria_tokens t
   set periodo = null, expira_en = null, cerrado_en = null
  from elegido e
 where t.id = e.id
   -- Solo si esa empresa no tiene ya uno permanente (re-ejecución).
   and not exists (
     select 1 from public.nominas_gestoria_tokens p
      where p.empresa_id = t.empresa_id and p.periodo is null
   );

comment on column public.nominas_gestoria_tokens.periodo is
  'LEGADO. NULL = enlace permanente de la empresa (lo normal). Con valor: enlace antiguo atado a un mes, ya no se emiten.';
comment on column public.nominas_gestoria_tokens.expira_en is
  'NULL = no caduca (enlace permanente). Con valor: enlace antiguo con caducidad.';
comment on column public.nominas_gestoria_tokens.cerrado_en is
  'Enlace REVOCADO a mano desde Ajustes. Ya no significa "entrega completada": quien cierra un mes es RRHH al confirmarlo.';
