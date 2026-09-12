-- El Tinto de Verano va al final de los tintos: no es un vino de la bodega
-- sino un refresco de vino, y en medio rompia la lista de referencias.
update public.carta_items ci
set orden = 5, updated_at = now()
from public.carta_categorias cc, public.empresas e
where cc.id = ci.categoria_id and e.id = ci.empresa_id
  and e.nombre = 'BACANAL' and cc.nombre = 'Vinos tintos'
  and ci.nombre = 'Tinto de Verano';

update public.carta_items ci
set orden = 4, updated_at = now()
from public.carta_categorias cc, public.empresas e
where cc.id = ci.categoria_id and e.id = ci.empresa_id
  and e.nombre = 'BACANAL' and cc.nombre = 'Vinos tintos'
  and ci.nombre = 'Marqués de Vargas Reserva';

-- Las 157 fotos de botella se rehacen desde el original de Agora: se habian
-- ido recortando una y otra vez al cambiar de formato y algunas ya solo
-- enseñaban la etiqueta.
