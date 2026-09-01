-- Accesos/apps: un enlace por app, sin el departamento pegado al nombre.
--
-- InfoJobs, BBVA Net Cash y Prosegur estaban partidos en varias fichas
-- ("InfoJobs Dirección", "InfoJobs Contabilidad", ...) que apuntaban al mismo
-- sitio. En el cohete son solo enlaces: ahí el departamento no pinta nada.
--
-- La ficha que sobrevive ABSORBE las credenciales de las demás antes de
-- borrarlas, así que no se pierde ninguna contraseña: cada una queda dentro
-- con su etiqueta ("Dirección", "Contabilidad", ...) y sus roles, que es lo
-- que decide quién puede verla en la bóveda.
--
-- Idempotente: la fusión solo ocurre si la ficha duplicada todavía existe, de
-- modo que reejecutar esto no duplica credenciales ni las borra.

-- ── 1. Fusionar credenciales en la ficha que se queda ────────────────────

-- InfoJobs
update accesos_apps a
set accesos = a.accesos || b.accesos
from accesos_apps b
where a.id = 'ba-x2' and b.id = 'ba-x2-s1';

-- BBVA Net Cash
update accesos_apps a
set accesos = a.accesos || b.accesos
from accesos_apps b
where a.id = 'ba-bf1' and b.id = 'ba-bf1-s1';

-- Prosegur (tres fichas hermanas)
update accesos_apps a
set accesos = a.accesos || b.accesos
from accesos_apps b
where a.id = 'ba-x14' and b.id = 'ba-x14-s1';

update accesos_apps a
set accesos = a.accesos || b.accesos
from accesos_apps b
where a.id = 'ba-x14' and b.id = 'ba-x14-s2';

update accesos_apps a
set accesos = a.accesos || b.accesos
from accesos_apps b
where a.id = 'ba-x14' and b.id = 'ba-x14-s3';

-- ── 2. Borrar las fichas ya vaciadas de contenido propio ─────────────────

delete from accesos_apps
where id in ('ba-x2-s1', 'ba-bf1-s1', 'ba-x14-s1', 'ba-x14-s2', 'ba-x14-s3');

-- ── 3. Nombres limpios ───────────────────────────────────────────────────

update accesos_apps set nombre = 'InfoJobs'       where id = 'ba-x2';
update accesos_apps set nombre = 'BBVA Net Cash'  where id = 'ba-bf1';
update accesos_apps set nombre = 'Prosegur'       where id = 'ba-x14';

-- InfoJobs pasa a verse también desde Contabilidad, que antes lo tenía en su
-- propia ficha.
update accesos_apps
set departamentos = array['Dirección', 'Contabilidad', 'Gerencia']::text[]
where id = 'ba-x2';

-- ── 4. Logos servidos por nosotros, no por un CDN de terceros ────────────
--
-- icon.horse y simpleicons dejaron de responder para estas marcas y las apps
-- salían sin imagen. Prosegur y Canaluz ya viajan en `public/logos-apps`.
-- Iberdrola, Canal de Isabel II y Madrid HiFi no publican un icono decente
-- (16x16), así que van por `/api/logo-app`: lo sirve nuestro servidor, y el
-- navegador del empleado deja de contarle a un tercero qué apps usa la empresa.

update accesos_apps set logo_url = '/logos-apps/prosegur.png'
where nombre = 'Prosegur' and (logo_url is null or logo_url = '' or logo_url like '%icon.horse%');

update accesos_apps set logo_url = '/logos-apps/canaluz.png'
where logo_url like '%canaluz%' and logo_url not like '/logos-apps/%';

update accesos_apps set logo_url = '/api/logo-app?dominio=iberdrola.es'
where logo_url like '%simpleicons.org/iberdrola%';

update accesos_apps set logo_url = '/api/logo-app?dominio=canaldeisabelsegunda.es'
where logo_url like '%icon.horse%canaldeisabelsegunda%';

update accesos_apps set logo_url = '/api/logo-app?dominio=madridhifi.com'
where logo_url like '%icon.horse%madridhifi%';
