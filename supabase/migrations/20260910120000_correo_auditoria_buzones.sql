-- ============================================================
-- 20260910120000_correo_auditoria_buzones.sql
-- Auditoría de correos (PRP-094) — Fase 1: los buzones y su permiso.
--
-- QUÉ RESUELVE
--   Hasta ahora el acceso a Gmail vivía SOLO en el roster personal de cada
--   usuario (`google_cuentas_usuario`, RLS por usuario, refresh_token dentro de
--   un JSONB). Eso vale para que cada uno escriba desde su cuenta, pero no vale
--   para auditar: si la persona que vinculó el buzón se lo quita de su selector,
--   la empresa se quedaba sin poder contar su propio correo.
--
-- LA REGLA (Iván, 10-09-2026)
--   «Son correos de empresa nuestros todos»: LA CONEXIÓN LA SOSTIENE LA EMPRESA,
--   NO LA PERSONA. La vincule quien la vincule, el permiso se guarda a nombre del
--   BUZÓN. Que alguien se quite la cuenta de su selector personal NO apaga la
--   auditoría. Solo la apagan dos cosas: desconectar el buzón a propósito desde
--   Ajustes, o que se revoque el permiso en la propia cuenta de Google.
--
-- TRES ESTADOS, NUNCA UN CERO
--   sin_conectar → nadie ha dado permiso todavía
--   conectado    → se está contando
--   caducado     → hubo permiso y Google lo ha revocado (`invalid_grant`)
--   Un buzón que no se puede leer JAMÁS se pinta como «0 correos»: 0 significa
--   «no entró ni un correo», que es una información distinta y muy diferente.
--
-- Sin efecto hasta que se conecte el primer buzón.
-- ============================================================

-- ── 1. Los buzones que se auditan ───────────────────────────────────────────
-- Una fila por (empresa, correo). El correo puede venir de la ficha de la
-- empresa (`datos_generales->>'correoRrhh'`…) o añadirse suelto más adelante:
-- la tabla no distingue, y por eso empezar por 8 buzones y crecer a 19 no exige
-- ningún cambio de modelo.
create table if not exists public.correo_buzones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  email             text not null,
  -- Departamento al que pertenece el buzón, cuando sale de la ficha de empresa.
  -- Es informativo: sirve para leer el panel por áreas, no para dar permisos.
  departamento_id   uuid references public.departamentos(id) on delete set null,
  -- Etiqueta con la que se conoce el buzón en el panel ("RRHH", "Gestoría"…).
  etiqueta          text not null default '',
  estado            text not null default 'Activo',        -- Activo | Inactivo
  conexion          text not null default 'sin_conectar',  -- ver cabecera
  -- Quién dio el permiso la última vez. INFORMATIVO: la conexión no depende de
  -- que esta persona siga en la empresa ni de que conserve la cuenta en su
  -- selector. Si se borra el usuario, el buzón sigue conectado.
  conectado_por     uuid references public.usuarios(id) on delete set null,
  conectado_at      timestamptz,
  ultima_sync_at    timestamptz,
  ultimo_error      text,
  -- Hasta dónde llegó el volcado inicial hacia atrás (12 meses).
  backfill_hasta    date,
  -- Marca de Gmail para pedir solo lo nuevo. Caduca: si Google responde 404 se
  -- cae al modo por fecha (ver Fase 2).
  last_history_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint correo_buzones_unq unique (empresa_id, email),
  constraint correo_buzones_estado_chk check (estado in ('Activo','Inactivo')),
  constraint correo_buzones_conexion_chk
    check (conexion in ('sin_conectar','conectado','caducado'))
);

-- El correo se guarda SIEMPRE en minúsculas: es la clave con la que se cruza el
-- buzón con la cuenta que alguien acaba de vincular. Si una se guarda con
-- mayúsculas, el cruce falla en silencio y el buzón parece no conectarse nunca.
create unique index if not exists correo_buzones_email_lower_idx
  on public.correo_buzones (empresa_id, lower(email));

-- Al vincular una cuenta hay que encontrar, de un tirón, TODOS los buzones de
-- cualquier empresa que usen ese correo (el mismo buzón puede auditarse en dos
-- empresas del grupo).
create index if not exists correo_buzones_email_idx
  on public.correo_buzones (lower(email));

alter table public.correo_buzones enable row level security;

drop policy if exists correo_buzones_lectura on public.correo_buzones;
create policy correo_buzones_lectura on public.correo_buzones
  for select using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists correo_buzones_escritura on public.correo_buzones;
create policy correo_buzones_escritura on public.correo_buzones
  for all using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));


-- ── 2. El permiso de Google, SOLO SERVIDOR ──────────────────────────────────
-- Va en tabla aparte con RLS activada y NINGUNA policy: nadie que entre con la
-- clave pública puede leerla, ni siquiera el dueño de la empresa. Solo el
-- servidor, con la clave de servicio, la lee para pedirle el correo a Google.
-- Mismo patrón que el token de la gestoría para las nóminas.
create table if not exists public.correo_buzones_tokens (
  buzon_id      uuid primary key references public.correo_buzones(id) on delete cascade,
  refresh_token text not null,
  actualizado   timestamptz not null default now()
);

alter table public.correo_buzones_tokens enable row level security;
-- Sin policies A PROPÓSITO. No añadir ninguna.


-- ── 3. `updated_at` al día ──────────────────────────────────────────────────
create or replace function public.correo_buzones_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists correo_buzones_touch_trg on public.correo_buzones;
create trigger correo_buzones_touch_trg
  before update on public.correo_buzones
  for each row execute function public.correo_buzones_touch();
