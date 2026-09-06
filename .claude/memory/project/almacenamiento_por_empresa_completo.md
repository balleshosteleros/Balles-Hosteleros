# Almacenamiento por empresa (migración 019)

`storage_usage_por_empresa` suma ahora **R2 + Supabase Storage**. Antes ignoraba
los 21 buckets de Storage: 1.010 ficheros y 381 MB que salían como 0 bytes.

## Reparto por empresa
Por la **primera carpeta** del objeto, con dos convenciones vivas:
- **UUID** de la empresa → la mayoría de buckets.
- **slug** → `chat-archivos`, `empresa-logos` y una foto suelta de `carta-fotos`.

`avatars` se organiza por usuario, no por empresa: queda fuera a propósito
(17 ficheros, 15 MB). Adjudicarlos a una empresa sería inventar.

## Desglose
`storage.objects` no es accesible desde PostgREST → función
`storage_desglose_por_bucket(empresa_id)` (SECURITY DEFINER, `search_path`
fijado, solo `service_role`). Un bucket sin etiqueta cae en "Otros documentos":
los bytes del desglose deben cuadrar con el total.

## Cuotas
Las tres a **500 GB**. BALLES tenía 3 TB heredados de pruebas; igualado el
6-sep-2026 por decisión de Iván.
