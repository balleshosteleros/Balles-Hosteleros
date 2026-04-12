-- ─── 012. Añadir tipo 'elaboracion' a productos ──────────────
-- Las elaboraciones son preparaciones intermedias (salsas, masas, caldos, fondos…)
-- que tienen su propio escandallo y se usan como ingrediente en otros platos.

alter type public.producto_tipo add value if not exists 'elaboracion';
