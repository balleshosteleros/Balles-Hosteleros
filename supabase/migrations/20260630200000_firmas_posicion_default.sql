-- ============================================================
-- Firma colocada automáticamente (posición fija)
--
-- Añade una posición por defecto opcional al documento de firma. Cuando está
-- presente, la pantalla de firma manuscrita coloca la firma del candidato YA
-- POSICIONADA y FIJA (no arrastrable), evitando errores de colocación.
--
-- Formato JSON: { "pagina": 1, "xPct": 0.10, "yPct": 0.82, "anchoPct": 0.32 }
--   - pagina: número de página (1-based)
--   - xPct / yPct: desde arriba-izquierda, en porcentaje del ancho/alto de página
--   - anchoPct: ancho de la firma en porcentaje del ancho de página
--
-- Nullable: los documentos antiguos (sin esta columna) mantienen el flujo de
-- arrastrar la firma manualmente.
-- ============================================================

alter table public.firmas_documentos
  add column if not exists posicion_firma_default jsonb;
