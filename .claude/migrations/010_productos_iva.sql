-- Migración 010: Añadir columna IVA a productos
-- Aplicar en Supabase SQL Editor

alter table public.productos
  add column if not exists iva text check (iva in ('0%', '4%', '10%', '21%'));

comment on column public.productos.iva is 'Tipo de IVA aplicable: 0%, 4%, 10% o 21%';
