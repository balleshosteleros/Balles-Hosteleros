# Balles FTP Relay

Buzón **FTP → Cloudflare R2** para grabadores **Dahua XVR** (probado contra
`DH-XVR4116HS-I`). Es la pieza que cierra el hueco entre lo que el grabador sabe
hacer (FTP + formato `.DAV`) y lo que nuestro software necesita (MP4 en R2).

```
XVR Dahua ──FTP .dav──▶ [ftp-relay] ──ffmpeg .dav→.mp4──▶ POST /api/conector/segmento ──▶ R2
```

**Uno solo para todos los clientes.** No es hardware que enviemos: es un
contenedor nuestro en la nube (~5-10 €/mes). El cliente solo configura el FTP en
su grabador apuntando a este relay.

## Por qué no vive en Vercel

Vercel corre funciones efímeras: no puede mantener un servidor FTP escuchando
24/7 ni ejecutar ffmpeg sobre vídeo. Por eso el relay es un proceso aparte,
siempre encendido. Toda la lógica de negocio (R2, cuota, retención 30 días) sigue
en el software: el relay solo convierte y reenvía usando el endpoint existente.

## Despliegue (Hetzner / Railway / Fly / cualquier VPS con Docker)

1. Un VPS pequeño con IP pública fija (Hetzner CX22 ~4 €/mes sobra).
2. Abrir en el firewall: **TCP 21** (control FTP) y **TCP 30000-30009** (datos
   pasivos).
3. Configurar variables (ver `.env.example`):
   - `FTP_PASV_URL`: la IP pública del VPS (obligatorio para FTP pasivo).
   - `SEGMENTO_URL`, `RESOLVER_URL`: endpoints del software en producción.
4. Levantar:
   ```bash
   cp .env.example .env   # y edita los valores
   docker compose up -d --build
   ```

> **FTP va sin cifrar por defecto.** Para producción conviene FTPS o restringir
> por IP de origen (la del router de cada local). El grabador Dahua Lite no
> siempre soporta FTPS; una alternativa robusta es exigir la IP de origen.

## Autenticación

Cada grabador entra al FTP con:
- **Usuario**: identificador del conector (p. ej. su `pairing_code` inicial o un
  usuario dedicado por empresa).
- **Contraseña**: el **`device_token`** que el conector obtuvo al emparejarse
  (`/api/conector/pair`).

Ese mismo `device_token` viaja como `Bearer` hacia `resolver-camara` y
`segmento`, así que el software valida empresa, cámara y cuota con la lógica que
ya existe.

## Mapeo canal → cámara

El XVR sube por **canal** (1..16). En el software, cada cámara tiene un campo
`canal`: al dar de alta la cámara, asígnale el número de canal físico del
grabador. El relay pregunta a `resolver-camara` "(device_token, canal) →
camara_id" y el clip se atribuye a la cámara correcta.

## Limitaciones conocidas (gama XVR Lite)

- El FTP de los XVR Lite a veces sube **por eventos** (movimiento), no 24/7
  fluido. Si se quiere continuo, revisar en el grabador *Almacenamiento → Modo
  de grabación* y el programa de subida FTP.
- ffmpeg remuxea con `-c copy`; si un `.DAV` trae un códec que el contenedor MP4
  no admite, esa conversión concreta fallará (se registra en el log y se descarta
  ese clip; el siguiente sigue).
