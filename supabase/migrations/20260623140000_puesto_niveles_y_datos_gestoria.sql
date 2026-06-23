-- NIVELES del puesto: puesto_salarios pasa de 1:1 a 1:N por `nivel`.
-- Cada fila = un Nivel (plantilla de condiciones). Filas existentes -> nivel 1.
alter table public.puesto_salarios add column if not exists nivel int not null default 1;

-- Reemplazar la unicidad (puesto_id) por (puesto_id, nivel).
alter table public.puesto_salarios drop constraint if exists puesto_salarios_puesto_unico;
create unique index if not exists puesto_salarios_puesto_nivel_unico
  on public.puesto_salarios (puesto_id, nivel);

-- Datos de gestoría COMPARTIDOS a nivel de puesto (opcionales): convenio común a
-- todos los niveles + datos útiles para la gestoría.
alter table public.puestos
  add column if not exists convenio_colectivo    text,
  add column if not exists tipo_contrato_defecto text,  -- 'indefinido' | 'temporal'
  add column if not exists grupo_categoria_prof  text,
  add column if not exists epigrafe_cotizacion   text;
