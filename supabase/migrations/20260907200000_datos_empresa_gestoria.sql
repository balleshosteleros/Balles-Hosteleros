-- Datos del CENTRO que la gestoria necesita para dar de alta a un trabajador:
-- CCC, tipo de establecimiento, clase del restaurante y convenio aplicable.
-- Viven en `empresas.datos_generales` (jsonb), asi que no hace falta tocar el
-- esquema: solo se siembran las claves que faltan.
--
-- El convenio se rellena porque es dato conocido y ya consta en los 66 puestos
-- de las tres sociedades. Los otros tres quedan en blanco a proposito: no se
-- inventan, se rellenan en Ajustes -> Empresa -> Datos para la gestoria.
--
-- Idempotente: solo escribe la clave que no existe o esta vacia.

update empresas
set datos_generales = datos_generales || jsonb_build_object(
      'ccc', coalesce(nullif(datos_generales->>'ccc', ''), ''),
      'tipoEstablecimiento', coalesce(nullif(datos_generales->>'tipoEstablecimiento', ''), ''),
      'claseRestaurante', coalesce(nullif(datos_generales->>'claseRestaurante', ''), ''),
      'convenioAplicable', coalesce(
        nullif(datos_generales->>'convenioAplicable', ''),
        'Hostelería de Madrid'
      )
    ),
    updated_at = now()
where datos_generales->>'ccc' is null
   or datos_generales->>'tipoEstablecimiento' is null
   or datos_generales->>'claseRestaurante' is null
   or coalesce(datos_generales->>'convenioAplicable', '') = '';
