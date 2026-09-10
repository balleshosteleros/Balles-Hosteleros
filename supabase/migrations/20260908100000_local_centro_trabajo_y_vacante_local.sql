-- El CENTRO DE TRABAJO del alta es el LOCAL, no la empresa.
--
-- La gestoria da de alta a un trabajador en una cuenta de cotizacion (CCC) que
-- es del CENTRO: dos locales de la misma sociedad pueden tener CCC distinto. Por
-- eso el CCC y la ubicacion completa viven en `locales`, y el alta coge el local
-- del empleado. Tipo de establecimiento, clase y convenio siguen siendo de la
-- empresa (datos fiscales).
--
-- Ademas, la VACANTE pasa a decir en que local se va a dar el alta: se pregunta
-- junto al puesto y viaja al empleado al contratar.
--
-- Idempotente: `if not exists` en todo.

-- 1) Datos del centro que necesita la gestoria.
alter table locales add column if not exists provincia text;
alter table locales add column if not exists ccc text;

comment on column locales.ccc is
  'Codigo de Cuenta de Cotizacion de la Seguridad Social de este centro. Viaja en el alta a la gestoria.';
comment on column locales.provincia is
  'Provincia del centro de trabajo. Junto a ciudad forma el "municipio y provincia" del alta.';

-- 2) La vacante dice a que local entra quien la ocupe.
alter table vacantes add column if not exists local_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vacantes_local_id_fkey'
  ) then
    alter table vacantes
      add constraint vacantes_local_id_fkey
      foreign key (local_id) references locales(id) on delete set null;
  end if;
end $$;

create index if not exists idx_vacantes_local on vacantes(local_id);

comment on column vacantes.local_id is
  'Local (centro de trabajo) en el que se da de alta a quien ocupe la vacante. Se copia a empleados.local_id al contratar.';

-- 3) Los dos locales existentes heredan la provincia de su empresa, que es la
--    que ya consta en `datos_generales`. Solo si esta vacia.
update locales l
set provincia = e.datos_generales->>'provincia',
    updated_at = now()
from empresas e
where e.id = l.empresa_id
  and coalesce(l.provincia, '') = ''
  and coalesce(e.datos_generales->>'provincia', '') <> '';

-- 4) El CCC deja de ser dato de empresa: se guarda por centro. Se retira la
--    clave del jsonb para que no queden dos sitios diciendo lo mismo.
update empresas
set datos_generales = datos_generales - 'ccc',
    updated_at = now()
where datos_generales ? 'ccc';
