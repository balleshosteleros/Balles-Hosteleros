-- Datos personales completos del empleado en `profiles`.
-- Permite que cada usuario gestione su propia ficha desde Mi Panel > Datos personales.
-- Antes estaban repartidos en empleados/contratos: ahora el usuario es la fuente
-- canónica y RRHH puede consumirlos para nóminas, contratos y prevención.
alter table public.profiles
  -- Identificación oficial
  add column if not exists tipo_documento text
    check (tipo_documento in ('DNI','NIE','PASAPORTE')),
  add column if not exists dni_nie text,
  add column if not exists fecha_nacimiento date,
  add column if not exists nacionalidad text,
  add column if not exists genero text
    check (genero in ('mujer','hombre')),
  add column if not exists estado_civil text
    check (estado_civil in ('soltero','casado','pareja_hecho','divorciado','viudo','otro')),
  add column if not exists numero_ss text,
  -- Contacto personal
  add column if not exists telefono text,
  add column if not exists telefono_secundario text,
  add column if not exists email_personal text,
  -- Dirección
  add column if not exists direccion text,
  add column if not exists codigo_postal text,
  add column if not exists ciudad text,
  add column if not exists provincia text,
  add column if not exists pais text default 'España',
  -- Datos bancarios
  add column if not exists iban text,
  add column if not exists banco_codigo text,
  add column if not exists banco_nombre text,
  add column if not exists titular_cuenta text,
  add column if not exists iban_verificado boolean default false,
  -- Contacto de emergencia
  add column if not exists emergencia_nombre text,
  add column if not exists emergencia_relacion text,
  add column if not exists emergencia_telefono text,
  -- Permiso de trabajo / formación obligatoria
  add column if not exists permiso_trabajo text,
  add column if not exists permiso_caducidad date,
  add column if not exists carnet_manipulador date,
  add column if not exists talla_uniforme text,
  add column if not exists alergias text,
  -- Marca temporal de actualización por el propio usuario
  add column if not exists datos_personales_actualizado_at timestamptz;

-- IBAN único por empresa: evita que la misma cuenta apunte a dos empleados
-- distintos (alarma típica de fraude de nóminas).
create unique index if not exists uq_profiles_iban_por_empresa
  on public.profiles(empresa_id, iban)
  where iban is not null and iban <> '';

-- Política RLS: el usuario puede actualizar SU propio perfil (ya existía
-- "Users can update own profile" sobre id=auth.uid(); también soportamos
-- el uso por user_id que hace el resto del código).
drop policy if exists "Users can update own profile by user_id" on public.profiles;
create policy "Users can update own profile by user_id"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on column public.profiles.iban is
  'IBAN español del titular. Validado en cliente por checksum mod 97 y prefijo ES.';
comment on column public.profiles.titular_cuenta is
  'Nombre del titular de la cuenta. La UI compara con nombre+apellidos del perfil para alertar de discrepancias antes del pago de nóminas.';
comment on column public.profiles.iban_verificado is
  'true cuando RRHH ha cotejado el documento bancario con el IBAN registrado.';
