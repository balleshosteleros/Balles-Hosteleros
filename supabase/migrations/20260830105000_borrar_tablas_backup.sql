-- Retira las tablas de respaldo: los datos nuevos están verificados (0
-- descuadres en las 138 filas) e Iván conserva sus copias fuera de la base de
-- datos. Sin basura acumulada en producción.
--
-- `bh_rls_backup_20260829` era solo un retrato de las políticas RLS del día
-- anterior; las políticas reales siguen activas y no se tocan aquí.
drop table if exists public.rrhh_pagos_backup_pago_20260830;
drop table if exists public.bh_rls_backup_20260829;
