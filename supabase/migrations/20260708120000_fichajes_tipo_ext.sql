-- ============================================================================
-- Fichajes: admitir el tipo 'EXT' (horas extras) en la columna `tipo`.
--
-- El catálogo `tipos_fichaje` ya define NOR ("Fichaje normal") y EXT ("Fichaje
-- horas extras", requiere_solicitud=true), y el flujo móvil (ficharEntradaPersonal)
-- ya persiste `tipoSel.codigo` en `fichajes.tipo`. Pero el CHECK de la columna NO
-- admitía 'EXT', así que un fichaje de horas extras fallaría al insertar. Esto lo
-- corrige: añade 'EXT' a los valores válidos.
--
-- A partir de aquí, el módulo de Pagos puede separar horas NORMALES (NOR/ENT/MAN)
-- de horas EXTRAS (EXT) por empleado y mes.
-- Idempotente: re-ejecutable sin error.
-- ============================================================================

alter table public.fichajes
  drop constraint if exists fichajes_tipo_check;

alter table public.fichajes
  add constraint fichajes_tipo_check
  check (tipo = any (array['ENT','SAL','IPA','FPA','MAN','COR','VAL','NOR','EXT']));

comment on column public.fichajes.tipo is
  'Código del tipo de fichaje. NOR=normal, EXT=horas extras (catálogo tipos_fichaje); ENT/MAN legacy = normal a efectos de cómputo.';
