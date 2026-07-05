-- Plantillas de email del reclutamiento: identificador estable (`clave`) +
-- destinatario configurable (`destino` / `destino_email`).
--
-- ANTES: el flujo localizaba las plantillas del sistema por su NOMBRE exacto, así
-- que el nombre no se podía editar sin romper el envío. AHORA la ancla es `clave`
-- (inmutable), con lo que el NOMBRE es libremente editable y se propaga solo.
--
-- Destinatario: cada plantilla decide a quién se envía —candidato / gestoría /
-- rrhh (email automático de Ajustes de la empresa) o personalizado (email a mano).
-- Idempotente.

alter table reclutamiento_email_plantillas
  add column if not exists clave text,
  add column if not exists destino text not null default 'candidato',
  add column if not exists destino_email text;

-- Valores permitidos de destino.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reclutamiento_email_plantillas_destino_chk'
  ) then
    alter table reclutamiento_email_plantillas
      add constraint reclutamiento_email_plantillas_destino_chk
      check (destino in ('candidato', 'gestoria', 'rrhh', 'personalizado'));
  end if;
end $$;

-- Backfill de `clave` a partir del nombre canónico de las plantillas del sistema.
update reclutamiento_email_plantillas set clave = 'gestoria_alta'
  where clave is null and nombre = 'Gestoría · alta de contrato';
update reclutamiento_email_plantillas set clave = 'gestoria_recordatorio'
  where clave is null and nombre = 'Gestoría · recordatorio de contrato';
update reclutamiento_email_plantillas set clave = 'contrato_interno'
  where clave is null and nombre = 'Contrato interno (a firmar)';
update reclutamiento_email_plantillas set clave = 'contrato_oficial'
  where clave is null and nombre = 'Contrato oficial (a firmar)';
update reclutamiento_email_plantillas set clave = 'prueba_aviso'
  where clave is null and nombre = 'Aviso de periodo de prueba (RRHH)';

-- Backfill de `destino` según el destinatario canónico de cada correo del sistema.
-- (Todo lo demás queda en 'candidato', el default.)
update reclutamiento_email_plantillas set destino = 'gestoria'
  where clave in ('gestoria_alta', 'gestoria_recordatorio');
update reclutamiento_email_plantillas set destino = 'rrhh'
  where clave = 'prueba_aviso';

-- Una plantilla por clave y empresa (las libres tienen clave NULL → no colisionan).
create unique index if not exists reclutamiento_email_plantillas_clave_unq
  on reclutamiento_email_plantillas (empresa_id, clave)
  where clave is not null;
