-- Enlace WEB por defecto (protegido, no borrable) + atribucion retroactiva de candidatos sin canal.
-- El canal WEB es el enlace que se pone en la pagina web; todo CV que entra sin un canal
-- concreto se atribuye a el. Idempotente.

alter table public.empleo_links
  add column if not exists protegido boolean not null default false;

-- Marca como protegido cualquier enlace WEB ya existente.
update public.empleo_links
set protegido = true
where upper(codigo) = 'WEB';

-- Siembra un enlace WEB por defecto para cada empresa que no lo tenga.
insert into public.empleo_links (empresa_id, codigo, nombre, origen_categoria, protegido, activo)
select e.id, 'WEB', 'Web', 'web', true, true
from public.empresas e
where not exists (
  select 1 from public.empleo_links l
  where l.empresa_id = e.id and upper(l.codigo) = 'WEB'
);

-- Atribuye al canal WEB los candidatos que entraron sin canal (web por defecto).
update public.candidatos c
set canal_link_id = w.id,
    canal_nombre = 'Web',
    origen = 'web'
from public.empleo_links w
where w.empresa_id = c.empresa_id
  and w.protegido = true
  and c.canal_link_id is null
  and c.canal_nombre is null;

comment on column public.empleo_links.protegido is 'Enlace de sistema no borrable (WEB por defecto del portal de empleo).';
