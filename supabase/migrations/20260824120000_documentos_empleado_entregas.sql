-- Actas del ciclo del material (entrega, devolución y baja por deterioro).
-- El PDF firmado por el trabajador se archiva en su carpeta de documentos
-- personales bajo la nueva categoría `entregas`, para que le quede guardado de
-- forma permanente aunque caduque el enlace de descarga del correo.
--
-- Idempotente: recrea el CHECK de `categoria` añadiendo 'entregas'.
alter table public.documentos_empleado
  drop constraint if exists documentos_empleado_categoria_check;

alter table public.documentos_empleado
  add constraint documentos_empleado_categoria_check
  check (categoria in ('nominas','contratos','justificantes','registros-jornada','sanciones','entregas'));
