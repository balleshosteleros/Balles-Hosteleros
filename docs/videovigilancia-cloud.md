# Videovigilancia cloud (grabaciones de cámaras en Cloudflare R2)

## Modelo elegido: arquitectura B — "todo vive en el software"

El vídeo **real de 30 días vive en NUESTRO Cloudflare R2**, no en el grabador del
local. El software rebobina leyendo R2; **nunca se conecta al grabador**.

- **Ventaja**: si roban el grabador o se cae internet del local, el vídeo ya subido
  está a salvo en la nube. El cliente no depende de la caja física.
- **Contrapartida**: el vídeo ocupa almacenamiento R2 (cuenta contra la cuota de
  500 GB/empresa, ampliable por plan).
- **Nada de hardware nuestro**: no vendemos ni enviamos nada. El cliente compra su
  kit y lo configura siguiendo un vídeo de onboarding.

El grabador (NVR) —o una cámara con subida S3 nativa— es solo la **tubería**:
captura clips MP4 de ~1 min y los empuja a nuestro endpoint. Su disco local es un
búfer de 1-2 días por si se cae internet (reintenta al recuperar conexión).

## Piezas construidas (en este repo)

| Pieza | Ruta |
|---|---|
| Tabla `camaras` (versionada) + `camara_grabaciones` + RLS + cuota | `supabase/migrations/20260710120500_camaras_grabaciones_cloud.sql` |
| Cliente R2 compartido | `src/shared/lib/r2.ts` |
| Ingesta de clips (grabador → R2) | `src/app/api/conector/segmento/route.ts` |
| Reproducción / cobertura | `listGrabaciones`, `getCoberturaGrabacion` en `src/features/camaras/actions/camaras-actions.ts` |
| Visor real (reproduce desde R2) | `src/features/camaras/components/CamaraTile.tsx` |
| Retención rodante 30 días (SOLO cámaras) | `src/app/api/cron/camaras-retencion/route.ts` + `vercel.json` (02:30 UTC) |

## Cómo el grabador sube los clips (contrato del endpoint)

`POST /api/conector/segmento`

- **Auth**: `Authorization: Bearer <device_token>` — el token que el conector obtuvo
  al emparejarse por QR (`/api/conector/pair`). Se guarda solo su hash sha256.
- **Body** `multipart/form-data`:
  - `file`: clip `video/mp4` (máx 100 MB).
  - `camara_id`: uuid de la cámara (debe pertenecer al conector/empresa).
  - `inicio`, `fin`: ISO 8601 con offset (ventana temporal del clip).
- **Respuesta**: `{ ok: true, grabacion_id }`. El clip se guarda en R2 en
  `empresa_<id>/camaras/<camara_id>/<YYYY-MM-DD>/<uuid>.mp4` y se registra su
  metadato. Cada subida marca el conector `online` + `last_seen_at` (latido).

## Retención de 30 días

El cron `camaras-retencion` (02:30 UTC diario) borra de R2 **y** de la tabla los
clips con `inicio` de hace más de 30 días. **Solo toca `camara_grabaciones`**: las
grabaciones de pantalla, formación y onboarding (`recordings`) NO caducan.

## Pendiente para dejarlo 100% operativo

1. **Estandarizar el kit "compatible Balles"**: elegir 1-2 modelos de NVR (o cámara)
   que sepan subir clips MP4 a un endpoint HTTP con `Bearer` (o a un bucket S3, que
   R2 acepta). El endpoint de ingesta ya es genérico y admite ambos flujos.
2. **Grabar el vídeo de onboarding** sobre ESE modelo: emparejar por QR + pegar el
   dato de destino en el grabador. Sin ese estándar no hay "conecta cualquier cámara
   y funciona": alguien tiene que capturar el RTSP (aquí, el propio NVR).
3. **Variables de entorno R2** (`R2_*`) y `CRON_SECRET` ya existen en `.env.example`.
