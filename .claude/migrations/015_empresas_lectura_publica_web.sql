-- 015 — Lectura pública de la empresa SOLO para las que tienen web publicada.
--
-- POR QUÉ:
-- La web pública (páginas web con dominio propio) la sirve un visitante ANÓNIMO.
-- `empresas` solo tenía política para `authenticated`, así que el resolvedor no
-- podía leer el nombre ni el logo: la web salía como "Restaurante" y al guardarla
-- en la pantalla de inicio del móvil no aparecía el logotipo de la empresa.
--
-- ALCANCE ESTRECHO A PROPÓSITO:
-- Solo se exponen las empresas que TIENEN una página publicada con dominio
-- verificado — es decir, las que ya son públicas por definición. Una empresa sin
-- web sigue siendo invisible para el anónimo.
--
-- SOBRE LOS DATOS: RLS filtra FILAS, no columnas, así que esta política deja leer
-- `datos_generales` entero, que incluye correos internos y CIF. Para no exponerlo,
-- el acceso anónimo va por la vista `empresas_web_publica` (abajo), que publica
-- solo los campos que la web necesita. La política de tabla se mantiene restringida
-- a authenticated.

-- Vista con SOLO los campos públicos de la empresa.
create or replace view public.empresas_web_publica as
select
  e.id,
  e.nombre,
  e.slug,
  e.datos_generales ->> 'logoUrl'           as logo_url,
  e.datos_generales ->> 'nombreComercial'   as nombre_comercial,
  e.datos_generales ->> 'instagram'         as instagram,
  e.datos_generales ->> 'facebook'          as facebook,
  e.datos_generales ->> 'tiktok'            as tiktok,
  e.datos_generales ->> 'whatsapp'          as whatsapp,
  e.datos_generales ->> 'telefonoPrincipal' as telefono,
  e.datos_generales ->> 'direccionLocal'    as direccion,
  e.datos_generales ->> 'ciudad'            as ciudad,
  e.datos_generales ->> 'provincia'         as provincia,
  e.datos_generales ->> 'codigoPostal'      as codigo_postal,
  e.datos_generales ->> 'razonSocial'       as razon_social,
  e.datos_generales ->> 'cif'               as cif
from public.empresas e
where exists (
  select 1
  from public.paginas_web p
  join public.paginas_web_dominios d on d.pagina_id = p.id
  where p.empresa_id = e.id
    and p.estado = 'PUBLICADA'
    and d.estado = 'VERIFICADO'
);

-- `security_invoker = off` (por defecto en vistas normales) haría que la vista
-- corriera con permisos del creador y saltara la RLS de `empresas`. Es
-- justamente lo que queremos aquí, pero lo dejamos explícito para que se lea.
alter view public.empresas_web_publica set (security_invoker = off);

comment on view public.empresas_web_publica is
  'Campos públicos de las empresas con web publicada. La consume el sitio público (anónimo): nombre y logo del manifest PWA, contacto del footer y datos del aviso legal. NO incluye correos internos.';

grant select on public.empresas_web_publica to anon, authenticated;
