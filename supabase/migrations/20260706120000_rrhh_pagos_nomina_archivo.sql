-- Nómina original adjunta a cada pago (rrhh_pagos).
-- Guarda el PATH en Storage del PDF/imagen de la nómina de ese empleado en ese
-- periodo. Se rellena al subir nóminas (una suelta por empleado, o partiendo un
-- PDF con TODAS: cada página → su empleado por DNI/nombre leído con IA).
--
-- En la UI, la columna "Nómina" muestra un enlace: al pulsarlo se abre la nómina
-- original mediante una URL firmada temporal (mismo patrón que las firmas).
--
-- Idempotente: re-ejecutable sin error.

-- 1) Columna path de la nómina ------------------------------------------------
alter table public.rrhh_pagos
  add column if not exists nomina_path text;

comment on column public.rrhh_pagos.nomina_path is
  'Path en el bucket rrhh-nominas del PDF/imagen de la nómina original de este empleado y periodo. NULL si no se ha adjuntado.';

-- 2) Bucket privado rrhh-nominas ----------------------------------------------
-- Mismo patrón que empleados-docs. Path: <empresa_id>/<periodo>/<empleado_id>.<ext>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rrhh-nominas',
  'rrhh-nominas',
  false,
  10485760, -- 10 MB por nómina individual
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage policies (path: <empresa_id>/<periodo>/<empleado_id>.<ext>) ──────
-- Lectura para autenticados de la empresa propietaria (RRHH) y el propio empleado
-- (ve su nómina en el portal). Las escrituras van por service-role al subir, que
-- ignora estas policies.
DROP POLICY IF EXISTS "rrhh_nominas_read" ON storage.objects;
CREATE POLICY "rrhh_nominas_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rrhh-nominas'
    AND public.user_has_empresa_access(((storage.foldername(name))[1])::uuid)
  );

-- 3) El trigger de bloqueo (liquidación enviada = inmutable) debe cubrir también
-- el path de la nómina: una vez enviada, no se cambia la nómina adjunta.
create or replace function public.rrhh_pagos_lock_confirmado()
returns trigger
language plpgsql
as $$
begin
  -- No bloqueado todavia, o se esta reabriendo (enviada -> NULL): permitir todo.
  if OLD.confirmacion_enviada_at is null or NEW.confirmacion_enviada_at is null then
    -- Si se reabre, la aceptacion previa deja de tener valor.
    if NEW.confirmacion_enviada_at is null then
      NEW.confirmacion_aceptada_at := null;
      NEW.confirmacion_enviada_por := null;
    end if;
    return NEW;
  end if;

  -- Sigue enviado/bloqueado: ningun campo economico ni el destinatario pueden cambiar.
  if  NEW.empleado_nombre      is distinct from OLD.empleado_nombre
   or NEW.fijo                 is distinct from OLD.fijo
   or NEW.pago                 is distinct from OLD.pago
   or NEW.nomina               is distinct from OLD.nomina
   or NEW.horas_reales         is distinct from OLD.horas_reales
   or NEW.horas_trabajadas     is distinct from OLD.horas_trabajadas
   or NEW.propina              is distinct from OLD.propina
   or NEW.ajuste               is distinct from OLD.ajuste
   or NEW.horas_extras         is distinct from OLD.horas_extras
   or NEW.bonus                is distinct from OLD.bonus
   or NEW.propina_mes_anterior is distinct from OLD.propina_mes_anterior
   or NEW.ss_empleado          is distinct from OLD.ss_empleado
   or NEW.ss_empresa           is distinct from OLD.ss_empresa
   or NEW.total                is distinct from OLD.total
   or NEW.pagado               is distinct from OLD.pagado
   or NEW.nomina_path          is distinct from OLD.nomina_path
   or NEW.confirmacion_enviada_at is distinct from OLD.confirmacion_enviada_at
  then
    raise exception 'rrhh_pagos: liquidacion ya enviada; reabrir antes de modificar (pago %).', OLD.id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;
