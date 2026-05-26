-- ============================================================
-- 20260526180000_simplify_email_config_to_empresas_email_contacto.sql
-- Simplificación radical del sistema de correos transaccionales:
--   - Antes: cada empresa configuraba su SMTP (Gmail/Outlook/IONOS/etc.)
--     y opcionalmente uno distinto por departamento. Demasiado técnico
--     para hosteleros que no son admins de sistemas.
--   - Ahora: TODOS los correos salen desde el SaaS (Resend) y cada empresa
--     solo rellena UN dato — un correo de contacto al que enviar avisos
--     internos (aviso de nueva solicitud de baja, etc.) y al que dirigir
--     las respuestas de los destinatarios (Reply-To).
--
-- Las tablas legacy estaban vacías (verificado: 0 filas en producción).
-- ============================================================

alter table public.empresas
  add column if not exists email_contacto text;

comment on column public.empresas.email_contacto is
  'Correo único de contacto de la empresa. Sirve como Reply-To global y como destino de avisos internos del sistema (p.ej. nueva solicitud de baja). El SaaS envía siempre desde su propia dirección — el cliente no configura SMTP.';

drop table if exists public.departamento_email_config cascade;
drop table if exists public.empresa_email_config cascade;
