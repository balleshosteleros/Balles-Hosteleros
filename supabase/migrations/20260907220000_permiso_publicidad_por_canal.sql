-- ============================================================
-- Permiso de publicidad por canal, y constancia de la baja.
--
-- ── El problema que resuelve ───────────────────────────────────────────────
-- `acepta_marketing_email/sms/whatsapp` son booleanos que arrancan en `false`,
-- así que hoy comparten casilla dos cosas que no son lo mismo:
--
--   · el cliente al que NUNCA se le preguntó (la mayoría: entraron por la
--     migración de CoverManager, y nadie les pidió permiso), y
--   · el cliente que SE DIO DE BAJA pulsando el enlace del correo.
--
-- Al primero se le puede preguntar. Al segundo no se le puede volver a escribir
-- nunca, y confundirlos es exactamente lo que acaba en denuncia y en dominio
-- bloqueado. La fecha de baja separa los dos casos: si está, hubo una negativa
-- expresa; si no, es que nadie preguntó.
--
-- Se guarda la fecha y no un simple "sí/no" porque ante una reclamación hay que
-- poder decir CUÁNDO se dio de baja, y porque permite ver si las bajas se
-- disparan tras una campaña concreta.
--
-- Una fecha por canal: darse de baja de los correos no es renunciar a que te
-- avisen por WhatsApp de que tu mesa está lista.
--
-- Idempotente.
-- ============================================================

alter table public.clientes_sala
  add column if not exists marketing_baja_email_at    timestamptz,
  add column if not exists marketing_baja_sms_at      timestamptz,
  add column if not exists marketing_baja_whatsapp_at timestamptz;

comment on column public.clientes_sala.marketing_baja_email_at is
  'Cuándo pidió no recibir más correos comerciales. Con fecha = negativa expresa: NUNCA volver a incluirlo en una campaña. Sin fecha y sin permiso = simplemente no se le ha preguntado.';
comment on column public.clientes_sala.marketing_baja_sms_at is
  'Igual que el de correo, para los SMS.';
comment on column public.clientes_sala.marketing_baja_whatsapp_at is
  'Igual que el de correo, para WhatsApp. Meta exige permiso expreso en este canal.';

-- Las campañas preguntan siempre por permiso y baja a la vez; sin índice, cada
-- envío recorre las 19.000 fichas.
create index if not exists idx_clientes_sala_permiso_email
  on public.clientes_sala (empresa_id, acepta_marketing_email, marketing_baja_email_at);
