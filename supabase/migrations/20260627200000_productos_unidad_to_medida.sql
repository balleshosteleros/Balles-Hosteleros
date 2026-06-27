-- La columna que guarda la MEDIDA del producto se llamaba 'unidad' (heredado, confuso,
-- porque "Unidades" es además un valor de medida). Se renombra a 'medida'.
-- (unidad_uso se mantiene: es la medida de USO en escandallos/recetas, con factor_conversion.)
alter table public.productos rename column unidad to medida;
