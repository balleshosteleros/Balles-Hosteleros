-- Accesos · el gerente no veía sus propias contraseñas (solo 2 de ~28)
--
-- Iván detectó que gerencia.grupobacanal@gmail.com, con rol GERENCIA, solo veía
-- 2 credenciales de las que tiene en su hoja de contraseñas (Habana y Bacanal).
--
-- CAUSA: `listAccesosApps` encadena DOS filtros y una credencial debe superar
-- LOS DOS (ver accesos-apps-actions.ts, PRP-075):
--   1. El DEPARTAMENTO de la app: si el rol no tiene ese departamento asignado
--      en `empresa_role_departamentos`, la app entera desaparece. El rol
--      GERENCIA solo tiene el departamento «GERENCIA», así que toda app puesta
--      en [Dirección] o [Dirección, Contabilidad] se caía aunque su credencial
--      estuviese marcada para Gerencia (caso Cashlogy, Prosegur, Móviles/SIM).
--   2. Los `roles` de CADA credencial (fail-closed): sin GERENCIA en la lista,
--      la credencial no sale del servidor (caso Makro, Amazon, Coca-Cola).
--
-- Las únicas dos que pasaban ambos filtros eran Correo/Drive → Gerencia y
-- Cover Manager → Gerencia. De ahí el «solo me salen 2».
--
-- Esta migración NO toca ninguna contraseña ni la descifra: solo corrige la
-- VISIBILIDAD de las credenciales que ya existen, según la hoja oficial.
-- Idempotente: se puede reejecutar sin duplicar departamentos ni roles.

-- ---------------------------------------------------------------------------
-- 1) Departamento de la app: añadir «Gerencia» donde el gerente debe entrar.
-- ---------------------------------------------------------------------------
update accesos_apps
set departamentos = departamentos || array['Gerencia'],
    updated_at = now()
where not exists (
        select 1 from unnest(departamentos) d
        where upper(unaccent(trim(d))) in ('GERENCIA', 'TODOS')
      )
  and (empresa_slug, nombre) in (
    values
      -- HABANA
      ('habana', 'Amazon'),
      ('habana', 'InfoJobs'),
      ('habana', 'Tarjetas Débito'),
      ('habana', 'Makro'),
      ('habana', 'Coca-Cola'),
      ('habana', 'Madrid HiFi'),
      ('habana', 'Cashlogy'),
      ('habana', 'Móviles / SIM'),
      ('habana', 'Spotify'),
      -- BACANAL
      ('bacanal', 'Coca-Cola'),
      ('bacanal', 'Makro'),
      ('bacanal', 'Prosegur'),
      ('bacanal', 'AliExpress'),
      ('bacanal', 'Amazon'),
      ('bacanal', 'Madrid HiFi'),
      ('bacanal', 'Tarjetas Débito'),
      ('bacanal', 'Tarjeta de Crédito Fuenlabrada'),
      ('bacanal', 'Móvil Empresa Logística'),
      ('bacanal', 'Móvil Gerencia'),
      ('bacanal', 'SIM Gerente Bacanal'),
      ('bacanal', 'PC Música'),
      ('bacanal', 'Administrador My Ágora')
  );

-- ---------------------------------------------------------------------------
-- 2) Roles de cada credencial: añadir GERENCIA a las líneas de la hoja oficial.
--
-- Se identifican por (empresa, app, etiqueta) — no por índice, que cambia si se
-- reordena el array. `jsonb_agg` reconstruye el array respetando el orden
-- original (`with ordinality`), imprescindible porque `origen_indice` de la
-- tabla espejo `credenciales` depende de esa posición.
-- ---------------------------------------------------------------------------
with objetivo(empresa_slug, app, etiqueta) as (
  values
    -- HABANA · hoja CONTRASEÑAS HABANA
    ('habana', 'Amazon',                  'Cuenta'),
    ('habana', 'InfoJobs',                'Cuenta'),
    ('habana', 'Correo / Drive (Google)', 'Logística'),
    ('habana', 'Correo / Drive (Google)', 'RRHH'),
    ('habana', 'Tarjetas Débito',         'habana / fuenlabrada'),
    ('habana', 'Makro',                   'Fuenlabrada'),
    ('habana', 'Coca-Cola',               'Cuenta'),
    ('habana', 'Madrid HiFi',             'Cuenta'),
    ('habana', 'Administrador My Ágora',  'Admin'),
    ('habana', 'Spotify',                 'Cuenta'),
    ('habana', 'Móviles / SIM',           'Teléfono RRHH'),
    -- BACANAL · hoja CONTRASEÑAS BACANAL
    ('bacanal', 'Correo / Drive (Google)', 'RRHH'),
    ('bacanal', 'Correo / Drive (Google)', 'Logística'),
    ('bacanal', 'Coca-Cola',               'Fuenlabrada'),
    ('bacanal', 'Makro',                   'Fuenlabrada'),
    ('bacanal', 'Tarjetas Débito',         'PIN'),
    ('bacanal', 'Amazon',                  'Dirección'),
    ('bacanal', 'Madrid HiFi',             'Dirección'),
    ('bacanal', 'Administrador My Ágora',  'Contabilidad')
)
update accesos_apps a
set accesos = sub.nuevos,
    updated_at = now()
from (
  select a2.id,
         jsonb_agg(
           case
             when exists (select 1 from objetivo o
                          where o.empresa_slug = a2.empresa_slug
                            and o.app = a2.nombre
                            and o.etiqueta = e->>'etiqueta')
              and not exists (select 1
                              from jsonb_array_elements_text(coalesce(e->'roles', '[]'::jsonb)) r
                              where upper(unaccent(trim(r))) = 'GERENCIA')
             then jsonb_set(e, '{roles}',
                            coalesce(e->'roles', '[]'::jsonb) || '["GERENCIA"]'::jsonb)
             else e
           end
           order by t.i
         ) as nuevos
  from accesos_apps a2,
       jsonb_array_elements(coalesce(a2.accesos, '[]'::jsonb)) with ordinality as t(e, i)
  where exists (select 1 from objetivo o
                where o.empresa_slug = a2.empresa_slug and o.app = a2.nombre)
  group by a2.id
) sub
where a.id = sub.id;

-- ---------------------------------------------------------------------------
-- 3) DIRECCIÓN debe aparecer en TODAS las credenciales (regla de Iván).
--
-- Dirección funciona como un departamento más —no tiene atajo en el código ni
-- se salta ningún escudo—, pero está marcada en todas las credenciales, así que
-- las ve todas. Se hace por DATO y no por código a propósito: la regla queda
-- auditable mirando la propia credencial, y `revelarAccesoApp` sigue aplicando
-- los tres escudos por igual a todo el mundo.
--
-- Hacía falta porque en Habana NINGUNA credencial llevaba DIRECCIÓN salvo las
-- suyas propias (al contrario que en Bacanal): dirección no veía casi nada de
-- Habana, el mismo fallo que sufría gerencia.
-- ---------------------------------------------------------------------------
update accesos_apps
set departamentos = departamentos || array['Dirección'],
    updated_at = now()
where not exists (
  select 1 from unnest(departamentos) d
  where upper(unaccent(trim(d))) in ('DIRECCION', 'TODOS')
);

update accesos_apps a
set accesos = sub.nuevos,
    updated_at = now()
from (
  select a2.id,
         jsonb_agg(
           case
             when not exists (select 1
                              from jsonb_array_elements_text(coalesce(e->'roles', '[]'::jsonb)) r
                              where upper(unaccent(trim(r))) = 'DIRECCION')
             then jsonb_set(e, '{roles}',
                            coalesce(e->'roles', '[]'::jsonb) || '["DIRECCIÓN"]'::jsonb)
             else e
           end
           order by t.i
         ) as nuevos,
         count(*) filter (where not exists (
           select 1 from jsonb_array_elements_text(coalesce(e->'roles', '[]'::jsonb)) r
           where upper(unaccent(trim(r))) = 'DIRECCION')) as anadidas
  from accesos_apps a2,
       jsonb_array_elements(coalesce(a2.accesos, '[]'::jsonb)) with ordinality as t(e, i)
  group by a2.id
) sub
where a.id = sub.id and sub.anadidas > 0;

-- ---------------------------------------------------------------------------
-- 4) Resincronizar la tabla espejo `credenciales`.
--
-- Es el tercer candado: `recortarSegunCredencialesRLS` se queda con el criterio
-- MÁS RESTRICTIVO entre el código y la RLS de `credenciales`. Si aquí no se
-- copian los `roles` nuevos, la RLS seguiría recortando y el gerente NO vería
-- nada de lo anterior. `origen_indice` = posición en el array (base 0).
-- ---------------------------------------------------------------------------
-- Ojo: se normaliza a MAYÚSCULAS SIN ACENTOS porque la política
-- `credenciales_lectura_por_rol` compara con `rol_normalizado()`, que quita los
-- acentos. Guardar «DIRECCIÓN» con tilde aquí no rompía nada (la RLS también
-- normaliza al leer), pero dejarlo ya normalizado evita futuras confusiones.
update credenciales c
set roles = sub.roles
from (
  select a.id as origen_id,
         (t.i - 1)::int as origen_indice,
         array(select upper(unaccent(trim(r)))
               from jsonb_array_elements_text(coalesce(t.e->'roles', '[]'::jsonb)) r) as roles
  from accesos_apps a,
       jsonb_array_elements(coalesce(a.accesos, '[]'::jsonb)) with ordinality as t(e, i)
) sub
where c.origen_id = sub.origen_id
  and c.origen_indice = sub.origen_indice
  and c.roles is distinct from sub.roles;

-- ---------------------------------------------------------------------------
-- RESULTADO
--   GERENCIA:  de 2 → 35 credenciales visibles (17 Habana + 18 Bacanal),
--              24 con contraseña ya cifrada que se revelan al instante.
--   DIRECCIÓN: las 145 de sus dos empresas, 111 con contraseña grabada.
--
-- Las 34 restantes (PIN/PUK de móviles, SIM y tarjetas) se ven listadas pero
-- salen vacías: NUNCA se llegaron a grabar. Se cargarán en una segunda pasada.
--
-- El código NO se ha tocado: ningún rol tiene atajo. La visibilidad depende
-- solo del dato, y los tres escudos de PRP-075 siguen aplicándose a todos.
-- ---------------------------------------------------------------------------
