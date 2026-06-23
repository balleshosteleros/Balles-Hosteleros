-- Configuración general de Reclutamiento (movida desde el ⚙️ del módulo a
-- Ajustes → Departamentos → RRHH → Reclutamiento). Se persiste en la misma
-- fila por empresa de `reclutamiento_config`. Idempotente.

-- Emails automáticos
alter table public.reclutamiento_config add column if not exists emails_auto_cambio_fase        boolean not null default true;
alter table public.reclutamiento_config add column if not exists emails_pedir_confirmacion       boolean not null default true;
alter table public.reclutamiento_config add column if not exists emails_copia_reclutador         boolean not null default false;
alter table public.reclutamiento_config add column if not exists emails_firma_corporativa        boolean not null default true;

-- Usuarios autorizados y roles
alter table public.reclutamiento_config add column if not exists directores_mueven_fases         boolean not null default true;
alter table public.reclutamiento_config add column if not exists reclutadores_mueven_fases       boolean not null default true;
alter table public.reclutamiento_config add column if not exists rrhh_edita_vacantes             boolean not null default true;
alter table public.reclutamiento_config add column if not exists otros_roles_ven_vacantes        boolean not null default false;

-- Idioma y ajustes regionales
alter table public.reclutamiento_config add column if not exists idioma_portal                   text    not null default 'es';
alter table public.reclutamiento_config add column if not exists formato_fecha                   text    not null default 'dd/mm/yyyy';

-- Ajustes generales
alter table public.reclutamiento_config add column if not exists permitir_candidaturas_duplicadas       boolean not null default false;
alter table public.reclutamiento_config add column if not exists archivar_vacantes_cerradas_30d         boolean not null default true;
alter table public.reclutamiento_config add column if not exists mostrar_contador_candidatos            boolean not null default true;
alter table public.reclutamiento_config add column if not exists notificar_reclutador_nueva_candidatura boolean not null default true;
