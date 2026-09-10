-- BACANAL es un restaurante de dos tenedores (tercera categoría).
-- Solo si estaba sin poner, para no pisar una corrección posterior.
update public.locales l
set clase_restaurante = '2 tenedores (tercera)'
from public.empresas e
where e.id = l.empresa_id
  and e.nombre = 'BACANAL'
  and l.clase_restaurante is null;
