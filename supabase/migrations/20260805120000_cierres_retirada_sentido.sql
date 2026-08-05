-- ============================================================
-- 20260805120000_cierres_retirada_sentido.sql
-- CIERRES (Gerencia): la retirada puede SACAR o METER dinero en caja.
--
-- Hasta ahora toda retirada se guardaba en positivo y la pantalla le aplicaba
-- un signo negativo fijo: siempre significaba "sale dinero". Ahora el usuario
-- elige el sentido con dos botones (Sale dinero / Entra dinero).
--
-- Las retiradas ANTIGUAS se quedan tal cual (positivas = salida). Para poder
-- distinguirlas de las nuevas entradas de dinero se añade esta marca:
--   retirada_entrada = false → sale dinero de caja (por defecto, y todo el histórico)
--   retirada_entrada = true  → entra dinero en caja
--
-- Solo aplica a tipo = 'retirada'. Idempotente.
-- ============================================================

alter table public.cierres_semanales
  add column if not exists retirada_entrada boolean not null default false;

comment on column public.cierres_semanales.retirada_entrada is
  'Solo para tipo=retirada: true si el dinero ENTRA en caja, false si SALE (default). El histórico previo queda en false, que es lo que siempre significó.';
