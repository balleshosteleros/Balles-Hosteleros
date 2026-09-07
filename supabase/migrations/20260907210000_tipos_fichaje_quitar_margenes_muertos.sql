-- Los márgenes por TIPO de fichaje no los usaba nadie.
--
-- `tipos_fichaje.margen_antes_min` / `margen_despues_min` se editaban en RRHH →
-- Horarios → Tipos de fichaje y se guardaban, pero al validar una entrada el
-- servidor lee SIEMPRE los de la empresa (`empresa_fichajes_config`). Los del
-- tipo se traían en la consulta y se tiraban. Resultado: HABANA y BALLES tenían
-- 15 min ahí y 5 en Ajustes, y el 15 no hacía nada. Una pantalla que miente.
--
-- Se van las columnas: la cortesía vive en un único sitio, Ajustes → Fichajes.
alter table public.tipos_fichaje drop column if exists margen_antes_min;
alter table public.tipos_fichaje drop column if exists margen_despues_min;

-- La cortesía (lo que se redondea a la hora del turno) no pasa de 15 minutos.
-- El mínimo para poder cerrar un fichaje son 30, así que por encima de 15 las
-- dos ventanas se pisarían. Hoy las tres empresas están en 5, así que esto no
-- cambia ningún valor: cierra la puerta a subirlo de más.
update public.empresa_fichajes_config
   set margen_antes_min = 15
 where margen_antes_min > 15;

update public.empresa_fichajes_config
   set margen_despues_min = 15
 where margen_despues_min > 15;

alter table public.empresa_fichajes_config
  drop constraint if exists empresa_fichajes_config_cortesia_max_chk;

alter table public.empresa_fichajes_config
  add constraint empresa_fichajes_config_cortesia_max_chk
  check (
    coalesce(margen_antes_min, 0) between 0 and 15
    and coalesce(margen_despues_min, 0) between 0 and 15
  );
