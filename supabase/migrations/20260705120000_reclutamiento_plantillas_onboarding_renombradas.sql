-- Repara plantillas de email del ONBOARDING que se habían renombrado y por eso
-- perdían su conexión con el flujo: todo el sistema las localiza por su NOMBRE
-- exacto (dispara el correo, pinta el destinatario, las protege del borrado).
-- Al renombrar «Gestoría · alta de contrato» a «Gestoría alta de contrato» el
-- alta a la gestoría dejaba de usar la plantilla editable y caía al texto por
-- defecto, además de perder el icono «Gestoría».
--
-- Re-canoniza cualquier variante conocida al nombre reservado. Idempotente:
-- si ya está bien nombrada, no hace nada. Solo actualiza si el nombre canónico
-- no existe ya en esa empresa (evita colisión con el índice único por empresa).

do $$
declare
  r record;
  canon text;
begin
  for r in
    select id, empresa_id, nombre
      from reclutamiento_email_plantillas
     where nombre in (
       'Gestoría alta de contrato',
       'Gestoria alta de contrato',
       'Gestoria · alta de contrato',
       'Gestoría recordatorio de contrato',
       'Gestoria recordatorio de contrato',
       'Gestoria · recordatorio de contrato'
     )
  loop
    canon := case
      when r.nombre ilike '%alta%' then 'Gestoría · alta de contrato'
      when r.nombre ilike '%recordatorio%' then 'Gestoría · recordatorio de contrato'
      else null
    end;

    if canon is not null
       and not exists (
         select 1 from reclutamiento_email_plantillas p
          where p.empresa_id = r.empresa_id
            and p.nombre = canon
       )
    then
      update reclutamiento_email_plantillas
         set nombre = canon,
             updated_at = now()
       where id = r.id;
    end if;
  end loop;
end $$;
