-- ============================================================
-- 20260910161000_correo_auditoria_marcar_no_reply.sql
-- Auditoría de correos (PRP-094): marcar como automáticos los `no_reply`.
--
-- La primera versión solo reconocía `noreply@` y `no-reply@`. En la vida real
-- llegan también con guion bajo (`testflight_no_reply@email.apple.com`), y esos
-- se colaban en el ranking como si fueran alguien con quien se trabaja — que es
-- justo lo que estropea la lectura del 80/20.
--
-- El código ya está corregido; esto arregla lo que se guardó antes, sin tener
-- que volver a pedirle nada a Gmail: la señal está en la propia dirección.
-- ============================================================

update public.correo_mensajes
   set automatico = true
 where automatico = false
   and split_part(contraparte_email, '@', 1) ~*
       '(^|[.\-_])(no[-_]?reply|do[-_]?not[-_]?reply|no[-_]?responder|noresponder)([.\-_]|$)';
