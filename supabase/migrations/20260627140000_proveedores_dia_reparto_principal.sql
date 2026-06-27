-- Día PRINCIPAL de reparto negociado (default de los pedidos). Columna con nombre propio,
-- en sustitución de la antigua y deprecated `dia_reparto_negociado` (que mezclaba un texto
-- libre legacy). Migramos solo los valores que son un nombre de día válido y eliminamos la vieja.
alter table public.proveedores
  add column if not exists dia_reparto_principal text;

update public.proveedores
set dia_reparto_principal = dia_reparto_negociado
where dia_reparto_negociado in ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo');

alter table public.proveedores
  drop column if exists dia_reparto_negociado;
