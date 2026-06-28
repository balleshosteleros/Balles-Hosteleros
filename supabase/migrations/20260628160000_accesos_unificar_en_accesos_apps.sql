-- ============================================================
-- 20260628160000_accesos_unificar_en_accesos_apps.sql
--
-- Unifica la gestión de contraseñas en UN solo sitio: la tabla `accesos_apps`
-- (Ajustes → Aplicaciones + desplegable de la barra), que es la que usa el
-- usuario. Las contraseñas se guardan CIFRADAS (AES-256-GCM) dentro del jsonb
-- `accesos[].contrasena`; el revelado pasa por verificación de identidad
-- (server action revelarAccesoApp + verificarIdentidadAccesos).
--
-- Revierte el sistema paralelo creado en 20260628140000 (apps_externas /
-- app_credenciales / app_credencial_roles), cuyos datos ya se migraron a
-- accesos_apps. Idempotente.
-- ============================================================

-- 1. Ampliar tope de accesos por app (apps con muchas cuentas: Correo/Drive,
--    móviles con PIN/PUK como entradas adicionales).
alter table public.accesos_apps drop constraint if exists accesos_apps_accesos_max10;
alter table public.accesos_apps drop constraint if exists accesos_apps_accesos_max50;
alter table public.accesos_apps
  add constraint accesos_apps_accesos_max50 check (jsonb_array_length(accesos) <= 50);

-- 2. Eliminar el sistema paralelo (ya migrado a accesos_apps).
drop table if exists public.app_credencial_roles cascade;
drop table if exists public.app_credenciales cascade;
drop table if exists public.apps_externas cascade;
drop function if exists public.puede_ver_credencial(uuid, uuid);
drop function if exists public.es_direccion_en(uuid);

comment on column public.accesos_apps.accesos is
  'Array jsonb [{etiqueta, usuario, contrasena, roles[]}]. contrasena CIFRADA (AES-256-GCM, formato iv:tag:enc). Revelado solo vía revelarAccesoApp tras verificación. roles[] = quién ve ese acceso (vacío = solo dirección).';
