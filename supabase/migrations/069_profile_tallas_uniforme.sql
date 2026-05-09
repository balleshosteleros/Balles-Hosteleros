-- ============================================================
-- 069_profile_tallas_uniforme.sql
-- La sección "Uniforme" del perfil del empleado deja de tener
-- una talla genérica (talla_uniforme) para distinguir entre
-- camiseta y pantalón, que son las dos tallas reales que
-- necesita pedir RRHH a hostelería.
--
-- No se borra `talla_uniforme` para no perder los datos
-- existentes de empleados que ya hubieran rellenado el campo;
-- simplemente la UI de Mi Panel deja de usarlo.
-- ============================================================

alter table public.profiles
  add column if not exists talla_camiseta text,
  add column if not exists talla_pantalon text;

comment on column public.profiles.talla_camiseta is
  'Talla de camiseta del empleado (XS, S, M, L, XL, XXL, XXXL).';
comment on column public.profiles.talla_pantalon is
  'Talla de pantalón del empleado (texto libre — formato europeo o de cintura).';
