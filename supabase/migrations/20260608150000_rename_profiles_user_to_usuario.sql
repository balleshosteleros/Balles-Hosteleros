-- ============================================================================
-- Renombrado a vocabulario del software (ES): profiles + user_* -> usuario*
--   profiles              -> usuarios
--   user_empresas         -> usuario_empresas
--   user_roles            -> usuario_roles
--   user_preferences      -> usuario_preferencias
--   user_view_preferences -> usuario_preferencias_vista
--
-- Atómico: renombra las tablas y recrea las 19 funciones de seguridad/lógica
-- que las referencian por nombre, para que RLS y el alta de usuarios no se
-- rompan en ningún instante. FKs, índices, políticas RLS y triggers se
-- actualizan solos (Postgres los liga por OID).
-- ============================================================================

BEGIN;

-- ─── 1. Renombrado de tablas ────────────────────────────────────────────────
ALTER TABLE public.profiles              RENAME TO usuarios;
ALTER TABLE public.user_empresas         RENAME TO usuario_empresas;
ALTER TABLE public.user_roles            RENAME TO usuario_roles;
ALTER TABLE public.user_preferences      RENAME TO usuario_preferencias;
ALTER TABLE public.user_view_preferences RENAME TO usuario_preferencias_vista;

-- ─── 2. Recreación de funciones (cuerpos con nombres nuevos) ─────────────────

CREATE OR REPLACE FUNCTION public.bh_departamentos_usuario(p_empresa uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dep text;
  v_rol text;
  v_out text[] := '{}';
  v_perm jsonb;
  v_item jsonb;
  v_name text;
begin
  if v_uid is null then return '{}'; end if;

  select public.bh_canon(departamento), public.bh_norm(rol_label)
    into v_dep, v_rol
  from public.usuarios where user_id = v_uid;

  if coalesce(v_dep,'') <> '' then v_out := array_append(v_out, v_dep); end if;
  if coalesce(v_rol,'') <> '' then v_out := array_append(v_out, public.bh_canon(v_rol)); end if;

  select permisos into v_perm
  from public.empresa_roles
  where empresa_id = p_empresa and public.bh_norm(nombre) = v_rol
  limit 1;

  if v_perm is not null then
    for v_item in select * from jsonb_array_elements(v_perm) loop
      if coalesce((v_item->>'ver')::boolean, false) then
        v_name := public.bh_canon(v_item->>'modulo');
        if v_name <> '' then v_out := array_append(v_out, v_name); end if;
      end if;
    end loop;
  end if;

  return (select coalesce(array_agg(distinct x), '{}') from unnest(v_out) as x);
end;
$function$;

CREATE OR REPLACE FUNCTION public.bh_es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.usuario_roles
    where user_id = auth.uid() and role in ('director','admin')
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_credenciales()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_app_director()
    OR EXISTS (
      SELECT 1 FROM public.usuarios p
      WHERE p.user_id = auth.uid()
        AND p.rol_label IS NOT NULL
        AND p.rol_label IN ('DIRECCIÓN','GERENCIA','DIRECTOR')
    )
$function$;

CREATE OR REPLACE FUNCTION public.chat_empleados(p_empresa uuid)
 RETURNS TABLE(user_id uuid, nombre text, apellidos text, rol_label text, departamento text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct p.user_id, p.nombre, p.apellidos, p.rol_label, p.departamento
  from public.usuarios p
  where p.user_id is not null
    and (
      p.empresa_id = p_empresa
      or p.user_id in (select ue.user_id from public.usuario_empresas ue where ue.empresa_id = p_empresa)
    )
    and p_empresa in (select public.empresas_del_usuario())
  order by p.nombre;
$function$;

CREATE OR REPLACE FUNCTION public.departamentos_del_usuario(p_empresa_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT erd.departamento_id
  FROM public.empresa_role_departamentos erd
  JOIN public.empresa_roles er ON er.id = erd.rol_id
  JOIN public.usuarios pr      ON pr.empresa_id = er.empresa_id
  WHERE pr.user_id = auth.uid()
    AND er.empresa_id = p_empresa_id
    AND lower(pr.rol_label) = lower(er.nombre);
$function$;

CREATE OR REPLACE FUNCTION public.empresas_del_usuario()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT empresa_id FROM public.usuarios
  WHERE user_id = auth.uid() AND empresa_id IS NOT NULL
  UNION
  SELECT empresa_id FROM public.usuario_empresas
  WHERE user_id = auth.uid() AND empresa_id IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION public.empresas_del_usuario_text()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT empresa_id::text FROM public.usuarios
  WHERE user_id = auth.uid() AND empresa_id IS NOT NULL
  UNION
  SELECT empresa_id::text FROM public.usuario_empresas
  WHERE user_id = auth.uid() AND empresa_id IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_role text;
BEGIN
  caller_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true),
    ''
  );

  IF caller_role NOT IN ('service_role', 'supabase_admin', 'supabase_auth_admin', 'none') THEN
    RAISE EXCEPTION 'Alta de usuario no permitida. El registro es por invitación desde RRHH.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.usuarios (id, user_id, email, full_name, nombre, avatar_url)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_empresa_access(check_empresa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    check_empresa_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.usuario_empresas ue
              WHERE ue.user_id = auth.uid() AND ue.empresa_id = check_empresa_id)
      OR EXISTS (SELECT 1 FROM public.usuarios p
                 WHERE p.user_id = auth.uid() AND p.empresa_id = check_empresa_id)
    )
$function$;

CREATE OR REPLACE FUNCTION public.has_empresa_role(p_empresa_id uuid, p_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_member_of_empresa(p_empresa_id)
     AND EXISTS (
       SELECT 1 FROM public.usuario_roles ur
        WHERE ur.user_id     = auth.uid()
          AND ur.role::text  = p_role
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_app_director()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = 'director'
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_member_of_empresa(p_empresa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
     WHERE ue.user_id    = auth.uid()
       AND ue.empresa_id = p_empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.usuarios p
     WHERE p.user_id    = auth.uid()
       AND p.empresa_id = p_empresa_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.modulos_del_usuario()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT elem->>'modulo'
  FROM public.usuarios pr
  JOIN public.empresa_roles er
    ON er.empresa_id = pr.empresa_id
   AND lower(er.nombre) = lower(coalesce(pr.rol_label, ''))
  CROSS JOIN LATERAL jsonb_array_elements(er.permisos) elem
  WHERE pr.user_id = auth.uid()
    AND (elem->>'ver')::boolean = true;
$function$;

CREATE OR REPLACE FUNCTION public.seed_cronograma_ejecuciones(p_fecha_desde date DEFAULT CURRENT_DATE, p_fecha_hasta date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id          uuid := auth.uid();
  v_empresa_id       uuid;
  v_departamento     text;
  v_inserted         int := 0;
  v_fecha            date;
  v_dow_iso          int;
  v_day              int;
  v_month            int;
  v_year             int;
  v_ultimo_dia       int;
  v_ancla            date;
  v_intervalo        int;
  v_apply_freq       boolean;
  v_apply_intervalo  boolean;
  v_apply_termina    boolean;
  v_count_existing   int;
  r                  record;
begin
  if v_user_id is null then
    return 0;
  end if;

  select p.empresa_id, coalesce(p.departamento, '')
    into v_empresa_id, v_departamento
  from public.usuarios p
  where p.user_id = v_user_id
  limit 1;

  if v_empresa_id is null then
    return 0;
  end if;

  v_fecha := p_fecha_desde;
  while v_fecha <= p_fecha_hasta loop
    v_dow_iso    := extract(isodow from v_fecha)::int;
    v_day        := extract(day    from v_fecha)::int;
    v_month      := extract(month  from v_fecha)::int;
    v_year       := extract(year   from v_fecha)::int;
    v_ultimo_dia := extract(day from (date_trunc('month', v_fecha) + interval '1 month - 1 day'))::int;

    for r in
      select c.id, c.frecuencia, c.dia_semana, c.dia_mes, c.fecha_anual,
             c.meses_trimestrales, c.empleados_asignados,
             c.intervalo, c.termina_tipo, c.termina_fecha,
             c.termina_repeticiones, c.fecha_inicio
      from public.cronogramas_operativos c
      where (c.empresa_id = v_empresa_id or c.empresa_id is null)
        and c.parent_id is null
        and (
          (c.empleados_asignados is not null and v_user_id = any(c.empleados_asignados))
          or (c.empleados_asignados is null and v_departamento <> '' and c.rol = v_departamento)
        )
    loop
      v_intervalo := coalesce(r.intervalo, 1);
      v_ancla     := r.fecha_inicio;

      -- ¿la frecuencia base aplica en v_fecha?
      v_apply_freq :=
        (r.frecuencia = 'DIARIO') or
        (r.frecuencia = 'SEMANAL'  and r.dia_semana is not null and v_dow_iso = any(r.dia_semana)) or
        (r.frecuencia = 'MENSUAL'  and r.dia_mes  is not null and
           (v_day = r.dia_mes or (r.dia_mes > v_ultimo_dia and v_day = v_ultimo_dia))) or
        (r.frecuencia = 'TRIMESTRAL' and r.dia_mes is not null and
           v_month = any(coalesce(r.meses_trimestrales, array[1,4,7,10]::int[])) and
           (v_day = r.dia_mes or (r.dia_mes > v_ultimo_dia and v_day = v_ultimo_dia))) or
        (r.frecuencia = 'ANUAL' and r.fecha_anual is not null and
           to_char(v_fecha, 'MM-DD') = r.fecha_anual);

      if not v_apply_freq then
        continue;
      end if;

      -- ¿pasa el filtro de intervalo (cada N)?
      if v_intervalo <= 1 or v_ancla is null or v_fecha < v_ancla then
        v_apply_intervalo := (v_ancla is null or v_fecha >= v_ancla);
      else
        if r.frecuencia = 'DIARIO' then
          v_apply_intervalo := ((v_fecha - v_ancla) % v_intervalo) = 0;
        elsif r.frecuencia = 'SEMANAL' then
          -- diferencia en semanas ISO desde el lunes de la ancla
          v_apply_intervalo :=
            (((v_fecha - (v_ancla - ((extract(isodow from v_ancla)::int - 1)))) / 7) % v_intervalo) = 0;
        elsif r.frecuencia = 'MENSUAL' then
          v_apply_intervalo :=
            (((v_year - extract(year from v_ancla)::int) * 12
              + (v_month - extract(month from v_ancla)::int)) % v_intervalo) = 0;
        elsif r.frecuencia = 'ANUAL' then
          v_apply_intervalo := ((v_year - extract(year from v_ancla)::int) % v_intervalo) = 0;
        else
          v_apply_intervalo := true;
        end if;
      end if;

      if not v_apply_intervalo then
        continue;
      end if;

      -- ¿pasa el filtro de termina?
      v_apply_termina := true;
      if r.termina_tipo = 'fecha' then
        v_apply_termina := r.termina_fecha is null or v_fecha <= r.termina_fecha;
      elsif r.termina_tipo = 'repeticiones' and r.termina_repeticiones is not null then
        select count(*) into v_count_existing
        from public.cronograma_ejecuciones e
        where e.tarea_id = r.id and e.user_id = v_user_id;
        v_apply_termina := v_count_existing < r.termina_repeticiones;
      end if;

      if not v_apply_termina then
        continue;
      end if;

      insert into public.cronograma_ejecuciones(
        tarea_id, empresa_id, user_id, fecha_programada, estado
      )
      values (r.id, v_empresa_id, v_user_id, v_fecha, 'pendiente')
      on conflict (tarea_id, user_id, fecha_programada) do nothing;

      if found then
        v_inserted := v_inserted + 1;
      end if;
    end loop;

    v_fecha := v_fecha + 1;
  end loop;

  return v_inserted;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_es_empleado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE perfil_anterior uuid;
BEGIN
  IF (TG_OP IN ('INSERT', 'UPDATE')) AND NEW.user_id IS NOT NULL THEN
    UPDATE public.usuarios
       SET es_empleado = true
     WHERE id = NEW.user_id
       AND es_empleado IS DISTINCT FROM true;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.user_id IS NOT NULL
     AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    perfil_anterior := OLD.user_id;
    IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE user_id = perfil_anterior) THEN
      UPDATE public.usuarios
         SET es_empleado = false
       WHERE id = perfil_anterior
         AND es_empleado IS DISTINCT FROM false;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE user_id = OLD.user_id) THEN
      UPDATE public.usuarios
         SET es_empleado = false
       WHERE id = OLD.user_id
         AND es_empleado IS DISTINCT FROM false;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_estado_from_empleado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE pid uuid; activo boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  pid := NEW.user_id;
  activo := public.empleado_esta_activo(NEW.estado, NEW.fecha_baja);
  IF activo THEN
    UPDATE public.usuarios
       SET estado_acceso = 'Activo'
     WHERE id = pid AND estado_acceso IS DISTINCT FROM 'Activo';
  ELSE
    UPDATE public.usuarios
       SET estado_acceso = 'Inactivo'
     WHERE id = pid AND estado_acceso IS DISTINCT FROM 'Inactivo';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toques_ranking(p_empresa_id uuid, p_inicio date, p_fin date)
 RETURNS TABLE(user_id uuid, empleado_nombre text, total integer, antiguedad timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    m.user_id,
    coalesce(max(p.full_name), max(p.nombre), max(m.empleado_nombre)) as empleado_nombre,
    sum(case when m.toques > 0 then m.toques else 0 end)::int as total,
    max(p.created_at) as antiguedad
  from public.toques_movimientos m
  left join public.usuarios p on p.user_id = m.user_id
  where m.empresa_id = p_empresa_id
    and m.fecha between p_inicio and p_fin
  group by m.user_id
  order by total desc, max(p.created_at) asc nulls last,
           coalesce(max(p.full_name), max(p.nombre), max(m.empleado_nombre)) asc;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_credencial_role(cred_id uuid, cred_empresa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_credencial_roles acr
    JOIN public.empresa_roles er ON er.id = acr.rol_id
    JOIN public.usuarios p ON p.user_id = auth.uid()
    WHERE acr.credencial_id = cred_id
      AND er.empresa_id = cred_empresa_id
      AND p.rol_label IS NOT NULL
      AND er.nombre = p.rol_label
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_has_empresa_access(emp_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_empresas
     WHERE user_id    = auth.uid()
       AND empresa_id = emp_id
  );
$function$;

COMMIT;
