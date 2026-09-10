-- Tipo de establecimiento, clase y convenio pasaron de la EMPRESA al LOCAL:
-- son del centro, no de la sociedad. Dos locales de la misma empresa tienen CCC
-- distinto, y si estan en provincias distintas tambien convenio distinto, porque
-- el de hosteleria es provincial.
--
-- `locales` ya tiene sus columnas y el codigo las lee de ahi. Estas tres claves
-- quedaron huerfanas dentro de `empresas.datos_generales`: el mismo dato en dos
-- sitios, uno de ellos muerto. Se retiran del jsonb.
--
-- Idempotente: al segundo pase no queda ninguna clave que quitar.

update empresas
set datos_generales = datos_generales
      - 'tipoEstablecimiento'
      - 'claseRestaurante'
      - 'convenioAplicable',
    updated_at = now()
where datos_generales ?| array['tipoEstablecimiento', 'claseRestaurante', 'convenioAplicable'];
