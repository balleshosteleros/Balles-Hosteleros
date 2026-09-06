-- ============================================================
-- 20260906200000_nominas_gestoria_token_no_legible_por_clientes.sql
--
-- El enlace de subida de nóminas de la gestoría deja de ser legible
-- desde el navegador.
--
-- QUÉ PASABA: `nominas_gestoria_tokens` guarda el token en claro en
-- `token_plano` (a propósito: es lo que permite reenviar SIEMPRE el mismo
-- enlace permanente en cada recordatorio). Pero su única policy era:
--
--   for select using (empresa_id in (select empresas_del_usuario()))
--
-- ...sobre TODAS las columnas y para CUALQUIER usuario autenticado de la
-- empresa. Es decir, un camarero con cuenta podía hacer desde el navegador
-- `select token_plano from nominas_gestoria_tokens` y quedarse con el enlace
-- de subida de nóminas de su empresa.
--
-- POR QUÉ IMPORTA AHORA: la justificación escrita en
-- 20260807160000_nominas_gestoria_recordatorio_y_tc1.sql decía que el riesgo
-- estaba acotado porque el enlace "caduca y se cierra al usarse". Dejó de ser
-- cierto en 20260903120000 (enlace permanente): hoy `expira_en` es NULL y no
-- se cierra tras subir. Quien tenga el token puede subir PDFs como nóminas de
-- cualquier mes abierto, disparando lectura por IA y volcando importes a
-- `rrhh_pagos`. El aislamiento ENTRE empresas se mantenía; lo que se rompía
-- era el aislamiento DENTRO de la empresa.
--
-- QUÉ SE HACE: se retira la policy de lectura. La tabla pasa a ser
-- exclusivamente de servidor (service_role, que ignora RLS por definición).
-- Ningún código de cliente la consulta: todos los accesos viven en
-- src/features/rrhh/services/nominas/nominas-gestoria.ts y usan el cliente
-- admin. Verificado con grep sobre src/ antes de escribir esta migración.
--
-- NO se borra `token_plano`: es necesaria para reenviar el mismo enlace.
-- Lo que se quita es que se pueda leer desde fuera del servidor.
--
-- Idempotente.
-- ============================================================

-- RLS activa + sin policies = nadie lee desde el cliente; service_role sí.
alter table public.nominas_gestoria_tokens enable row level security;

drop policy if exists nominas_gestoria_tokens_sel on public.nominas_gestoria_tokens;

comment on table public.nominas_gestoria_tokens is
  'Enlaces de subida de nóminas para la gestoría. SOLO SERVIDOR: sin policies '
  'de RLS a propósito, se accede únicamente con service_role desde '
  'nominas-gestoria.ts. Contiene el token en claro (token_plano) para poder '
  'reenviar el mismo enlace permanente, por eso NO debe ser legible por '
  'usuarios autenticados: cualquier empleado podría llevarse el enlace.';

comment on column public.nominas_gestoria_tokens.token_plano is
  'Token en CLARO. Necesario para reenviar el mismo enlace permanente en cada '
  'recordatorio. Nunca debe exponerse a un cliente: no añadir policies de '
  'select a esta tabla sin excluir esta columna.';
