-- ============================================================
-- 20260910150000_correo_auditoria_mensajes.sql
-- Auditoría de correos (PRP-094) — Fase 2: el índice de mensajes.
--
-- QUÉ SE GUARDA Y QUÉ NO
--   Solo la FICHA de cada correo: cuándo, quién, a quién, asunto y si entró o
--   salió. NUNCA el cuerpo, ni un extracto, ni un resumen. Decisión de Iván:
--   contar el correo no es archivarlo, y duplicar el contenido de los correos de
--   clientes y empleados en otra base es un riesgo que no compensa.
--
-- CERO IA
--   No hay categorías ni reglas de clasificación: el eje del panel es CON QUIÉN
--   habla cada buzón. Por eso las columnas que mandan son `contraparte_email` y
--   `contraparte_dominio`, y por eso hay índices pensados para agrupar por ellas.
--
-- EL DÍA ES EL DE LA EMPRESA
--   `dia_empresa` se calcula al guardar con la zona horaria de la empresa. Así
--   el panel agrupa por una columna de fecha, sin cuentas de husos en cada
--   consulta, y la medianoche que corta el día es la de la casa — no la de UTC
--   ni la del navegador de quien mira.
-- ============================================================

create table if not exists public.correo_mensajes (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  buzon_id            uuid not null references public.correo_buzones(id) on delete cascade,
  gmail_message_id    text not null,
  gmail_thread_id     text not null default '',
  direccion           text not null,          -- entrante | saliente
  enviado_at          timestamptz not null,   -- instante real, en UTC
  dia_empresa         date not null,          -- ese instante, en la hora de la empresa
  -- Con quién habla el buzón: en un correo que entra es quien escribe; en uno
  -- que sale, el primer destinatario. Es EL EJE del panel.
  contraparte_email   text not null default '',
  contraparte_dominio text not null default '',
  contraparte_nombre  text not null default '',
  asunto              text not null default '',
  etiquetas           text[] not null default '{}',
  -- Marcador técnico, NO una categoría: no-reply, mailer-daemon, boletines con
  -- baja automática. Solo sirve para el interruptor «ocultar automáticos» del
  -- panel, para que el ruido no falsee el ranking de con quién se trabaja.
  automatico          boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint correo_mensajes_unq unique (buzon_id, gmail_message_id),
  constraint correo_mensajes_direccion_chk check (direccion in ('entrante','saliente'))
);

-- Volumen por periodo (las tarjetas y la gráfica de barras).
create index if not exists correo_mensajes_empresa_dia_idx
  on public.correo_mensajes (empresa_id, dia_empresa desc);
create index if not exists correo_mensajes_buzon_dia_idx
  on public.correo_mensajes (buzon_id, dia_empresa desc);

-- El ranking 80/20: agrupar por contraparte dentro de un buzón y un rango.
create index if not exists correo_mensajes_ranking_idx
  on public.correo_mensajes (buzon_id, dia_empresa, contraparte_email);
create index if not exists correo_mensajes_dominio_idx
  on public.correo_mensajes (buzon_id, dia_empresa, contraparte_dominio);

alter table public.correo_mensajes enable row level security;

drop policy if exists correo_mensajes_lectura on public.correo_mensajes;
create policy correo_mensajes_lectura on public.correo_mensajes
  for select using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists correo_mensajes_escritura on public.correo_mensajes;
create policy correo_mensajes_escritura on public.correo_mensajes
  for all using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
