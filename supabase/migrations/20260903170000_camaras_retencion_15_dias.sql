-- ============================================================================
-- Cámaras: la retención rodante pasa de 30 a 15 días
-- ----------------------------------------------------------------------------
-- Decisión de negocio (Habana, XVR Dahua DH-XVR4116HS-I): 15 días de histórico
-- son suficientes para revisar incidencias y reducen a la mitad el coste de R2
-- y el consumo de la cuota de 500 GB por empresa.
--
-- El borrado real lo hace el cron `/api/cron/camaras-retencion` (RETENCION_DIAS
-- = 15). Esta migración solo alinea la documentación viva de la tabla para que
-- el esquema no siga diciendo 30.
--
-- Idempotente: re-ejecutable sin error.
-- ============================================================================

comment on table public.camara_grabaciones is
  'Clips de vídeo de cámaras subidos a Cloudflare R2 por el grabador/cámara del local. Retención rodante de 15 días (cron). Los bytes viven en R2; esta tabla solo registra metadatos + tamaño para cuota.';
