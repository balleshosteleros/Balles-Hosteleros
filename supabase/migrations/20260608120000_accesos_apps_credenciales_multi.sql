-- Múltiples accesos (usuario/contraseña) por app, máx. 10.
-- Columna `accesos` jsonb: array de { etiqueta, usuario, contrasena }.
-- Las columnas legacy `usuario`/`contrasena` se conservan (sincronizadas con accesos[0]).

alter table public.accesos_apps
  add column if not exists accesos jsonb not null default '[]'::jsonb;

-- Backfill: convertir el usuario/contraseña existente en el primer acceso.
update public.accesos_apps
set accesos = jsonb_build_array(
  jsonb_build_object('etiqueta', '', 'usuario', coalesce(usuario, ''), 'contrasena', coalesce(contrasena, ''))
)
where accesos = '[]'::jsonb
  and (coalesce(usuario, '') <> '' or coalesce(contrasena, '') <> '');

-- Tope de 10 accesos por app (aplicado en silencio, sin UI que lo anuncie).
alter table public.accesos_apps
  drop constraint if exists accesos_apps_accesos_max10;
alter table public.accesos_apps
  add constraint accesos_apps_accesos_max10
  check (jsonb_array_length(accesos) <= 10);
