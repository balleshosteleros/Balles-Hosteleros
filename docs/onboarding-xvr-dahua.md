# Onboarding: conectar un grabador Dahua XVR a Balles

Estándar "compatible Balles": **Dahua XVR serie 4** (probado con `DH-XVR4116HS-I`;
el hermano de 4 canales es `DH-XVR4104HS-I`). Cámaras por cable coaxial
(HDCVI/AHD/TVI), plug & play con el grabador.

El objetivo del onboarding es que el dueño del local, **solo con un vídeo**, deje
el grabador subiendo sus grabaciones a nuestra nube. Son ~5 minutos.

## Requisitos previos (los prepara Balles)

1. El relay FTP desplegado y con IP pública (ver `ftp-relay/README.md`).
2. En el software: crear el **conector** de la empresa y emparejarlo → obtienes
   el `device_token`. Dar de alta cada **cámara** con su número de **canal**
   físico (1, 2, 3…) tal como está enchufada en el grabador.

## Pasos que hace el cliente en el grabador (guiados por vídeo)

Con un ratón conectado al grabador y su pantalla:

1. **Menú principal → Red → FTP** (o *Almacenamiento → FTP* según firmware).
2. Activar **Habilitar**.
3. Rellenar:
   - **Servidor / Host**: la IP pública del relay (te la damos).
   - **Puerto**: `21`.
   - **Usuario**: el que te indique Balles (identificador del conector).
   - **Contraseña**: el `device_token` (te lo damos; es largo, se copia y pega o
     se teclea con cuidado).
4. En **tipo de subida**, marcar **Vídeo/Record** (no solo "Imagen"). Si el
   grabador solo deja Imagen, hay que activar la grabación por FTP en
   *Almacenamiento → Programa* según el modelo.
5. **Probar** (botón *Test*): debe decir OK.
6. **Guardar**.

A los pocos minutos, en el software → **Cámaras**, los mosaicos dejan de decir
"Sin grabación aún" y empiezan a reproducir desde R2.

## Qué pasa por detrás

```
XVR ──FTP .dav──▶ relay (convierte a MP4) ──▶ software ──▶ Cloudflare R2 (30 días)
```

- El disco del grabador sigue actuando de **búfer**: si se cae internet, guarda
  en local y reintenta la subida al recuperar conexión.
- La **copia buena de 30 días vive en R2**, no en el grabador: si roban el
  aparato, el vídeo ya subido está a salvo.
- La **retención de 30 días** la aplica nuestro cron; el cliente no gestiona nada.

## Problemas típicos

| Síntoma | Causa probable | Solución |
|---|---|---|
| *Test* FTP falla | Puerto 21 cerrado en el router del local, o IP/credenciales mal | Revisar credenciales; permitir salida al puerto 21 |
| Sube pero "Sin grabación" en el software | El canal de la cámara no coincide con el `canal` dado de alta | Ajustar el campo `canal` de la cámara |
| Solo sube fotos | El grabador está en modo "Imagen" | Cambiar a Vídeo/Record en el menú FTP |
| Nada se sube | El grabador solo sube por evento (movimiento) | Configurar grabación/subida continua o aceptar solo eventos |
