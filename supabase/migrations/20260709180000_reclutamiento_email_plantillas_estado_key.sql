-- Asignación email→estado en la propia plantilla de email (modelo global).
-- estado_key NULL = el email no se envía automáticamente al entrar en un estado.
-- Un email va a un solo estado; un estado puede tener varios emails.
alter table public.reclutamiento_email_plantillas
  add column if not exists estado_key text;

-- Backfill: hereda las asignaciones actuales de la plantilla de estados
-- PREDETERMINADA de cada empresa (estados[].email_plantilla_id → estado_key).
update public.reclutamiento_email_plantillas ep
set estado_key = sub.key
from (
  select pe.empresa_id,
         elem->>'key' as key,
         (elem->>'email_plantilla_id')::uuid as email_id
  from public.reclutamiento_plantillas_estado pe
  cross join lateral jsonb_array_elements(pe.estados) elem
  where pe.es_predeterminada = true
    and elem->>'email_plantilla_id' is not null
) sub
where ep.id = sub.email_id
  and ep.empresa_id = sub.empresa_id
  and ep.estado_key is null;

-- Anclaje OBLIGATORIO de la cadena de gestoría: el alta a gestoría y el contrato
-- oficial (el que llega al candidato tras subirlo la gestoría) quedan fijados a
-- Contratación. La app impide reasignarlos/quitarlos (candado).
update public.reclutamiento_email_plantillas
set estado_key = 'contratacion'
where clave in ('gestoria_alta', 'contrato_oficial');

create index if not exists idx_reclutamiento_email_plantillas_empresa_estado
  on public.reclutamiento_email_plantillas(empresa_id, estado_key);

comment on column public.reclutamiento_email_plantillas.estado_key is
  'Estado del pipeline en el que se envía este email (NULL = no se envía por estado). Un email va a un solo estado; un estado puede tener varios emails. Los correos con clave (sistema) NO se auto-envían al entrar: su estado_key es solo informativo.';
