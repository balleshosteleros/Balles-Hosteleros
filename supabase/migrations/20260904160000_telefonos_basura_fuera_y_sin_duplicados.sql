-- Limpieza final de teléfonos tras la migración de CoverManager.
--
-- Tres cosas, en este orden:
--
-- 1) EXTRANJEROS QUE COVER NO MARCÓ. Ocho fichas traían el prefijo del país
--    metido dentro del número ("0033…" francés, "447…" británico, "351…"
--    portugués) pero con +34 delante. No son erratas: el país está escrito, y
--    los nombres lo confirman. Se les pone su prefijo real.
--
-- 2) TELÉFONOS QUE NO SIRVEN. Un número al que no se puede llamar no es un
--    dato, es ruido: ocupa el hueco del bueno, engaña a quien lo marca y
--    ensucia la búsqueda por teléfono. Mejor la ficha SIN teléfono, que dice
--    la verdad (no lo tenemos), que con uno inventado. Se vacía el número y se
--    conserva la ficha entera: nombre, email, historial y visitas.
--
-- 3) NADIE COMPARTE NÚMERO. Norma del sistema: un teléfono o un email
--    identifican a UNA persona. Diana Ceballos y Denisse Blázquez tenían el
--    mismo móvil británico; se lo queda Denisse (que ya lo tiene con su +44) y
--    a Diana se le vacía: mantiene su ficha y su email, que es lo suyo.
--
-- No se borra ninguna ficha ni se fusiona a nadie.

-- 1) Extranjeros evidentes: prefijo real.
update public.clientes_sala set telefono = '+353 860608690',  updated_at = now() where telefono = '+34 353860608690';
update public.clientes_sala set telefono = '+41 791220605',   updated_at = now() where telefono = '+34 41791220605';
update public.clientes_sala set telefono = '+44 7878553337',  updated_at = now() where telefono = '+34 07878553337';
update public.clientes_sala set telefono = '+33 646631910',   updated_at = now() where telefono = '+34 0033646631910';
update public.clientes_sala set telefono = '+351 969873600',  updated_at = now() where telefono = '+34 351969873600';
update public.clientes_sala set telefono = '+44 7398639540',  updated_at = now() where telefono = '+34 447398639540';
update public.clientes_sala set telefono = '+49 17641871924', updated_at = now() where telefono = '+34 4917641871924';

-- 2) y 3) Fuera los números que no sirven, incluido el duplicado de Diana.
--    Criterio: un móvil o fijo español son 9 cifras empezando por 6, 7, 8 o 9.
--    Lo que no cumple eso y no es de fuera, no se puede marcar.
update public.clientes_sala
set    telefono   = null,
       updated_at = now()
where  telefono like '+34 %'
  and  not (
    length(regexp_replace(telefono, '[^0-9]', '', 'g')) = 11
    and substring(regexp_replace(telefono, '[^0-9]', '', 'g') from 3) ~ '^[6-9]'
  );

-- El snapshot de las reservas sigue a la ficha: no puede quedar en la reserva
-- un teléfono que ya no está en el cliente.
update public.reservas r
set    cliente_telefono = c.telefono,
       updated_at       = now()
from   public.clientes_sala c
where  r.cliente_id = c.id
  and  coalesce(r.cliente_telefono, '') is distinct from coalesce(c.telefono, '');
