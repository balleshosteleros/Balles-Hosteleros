-- El modelo de destino de las plantillas de reclutamiento evolucionó: en vez de
-- valores por rol fijo (`gestoria`/`rrhh`) ahora se usa `departamento` + la clave
-- del correo del departamento en `destino_email` (Ajustes → Empresa).
--
-- La restricción CHECK original (migración 20260705130000) solo permitía
-- ('candidato','gestoria','rrhh','personalizado'), por lo que guardar una plantilla
-- con destino «Departamento» fallaba con:
--   new row ... violates check constraint "reclutamiento_email_plantillas_destino_chk"
--
-- Aquí ampliamos la restricción para aceptar 'departamento' manteniendo los valores
-- heredados por retrocompatibilidad. Idempotente.

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'reclutamiento_email_plantillas_destino_chk'
  ) then
    alter table reclutamiento_email_plantillas
      drop constraint reclutamiento_email_plantillas_destino_chk;
  end if;

  alter table reclutamiento_email_plantillas
    add constraint reclutamiento_email_plantillas_destino_chk
    check (destino in ('candidato', 'departamento', 'personalizado', 'gestoria', 'rrhh'));
end $$;
