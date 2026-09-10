-- La provincia del local, que faltaba.
--
-- No es un dato decorativo de la dirección: el convenio de hostelería es
-- PROVINCIAL, así que la provincia es lo que determina bajo qué convenio
-- trabaja la plantilla de ese centro. Sin ella, el convenio se rellena a mano
-- y nadie puede comprobar si es el que toca.

alter table public.locales
  add column if not exists provincia text;

comment on column public.locales.provincia is
  'Provincia del local. Determina el convenio de hostelería aplicable.';

-- Los dos locales en marcha están en Fuenlabrada.
update public.locales l
set provincia = coalesce(l.provincia, 'Madrid')
from public.empresas e
where e.id = l.empresa_id
  and e.nombre in ('BACANAL', 'HABANA');
