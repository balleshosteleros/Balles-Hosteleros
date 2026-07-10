-- Sanción disciplinaria (Comunicados → Sanción disciplinaria).
-- El PDF firmado por el trabajador («leído / informado») se archiva en su
-- carpeta de documentos personales bajo la nueva categoría `sanciones`, de modo
-- que le quede guardado de forma permanente (bucket privado `empleados-docs`).
--
-- Idempotente: recrea el CHECK de `categoria` añadiendo 'sanciones'.
alter table public.documentos_empleado
  drop constraint if exists documentos_empleado_categoria_check;

alter table public.documentos_empleado
  add constraint documentos_empleado_categoria_check
  check (categoria in ('nominas','contratos','justificantes','registros-jornada','sanciones'));
