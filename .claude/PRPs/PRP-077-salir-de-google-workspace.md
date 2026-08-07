# PRP-077: Salir de Google Workspace — centralizar almacenamiento y envío de correo

**Estado:** PENDIENTE (aprobado por Iván, pendiente de ejecutar)
**Fecha:** 2026-08-07
**Pedido por:** Iván Ballesteros

---

## Objetivo

Cancelar la suscripción de Google Workspace (16,20 €/mes ≈ 195 €/año) moviendo
sus dos usos reales a infraestructura propia:

1. **Almacenamiento** (1,08 TB en Drive) → Cloudflare R2, dentro del software.
2. **Envío de correo automático** → servicio especializado (Resend/Brevo),
   manteniendo el remitente `@balleshosteleros.com`.

## Por qué

- El plan de pago solo sostiene esos dos usos; el resto (calendario, Meet, correo
  integrado) **ya funciona con cuentas Gmail gratuitas** — verificado, ver abajo.
- Google **no escala** para envío automático: techo duro de ~2.000 correos/día
  que no se puede ampliar pagando. Con 3.000 clientes es un bloqueo absoluto.
- Centralizar en el software es objetivo declarado del negocio.

## Datos verificados (2026-08-07)

**Google Workspace:**
- Plan Business Standard, *Flexible Plan*, **1 licencia**, 16,20 €/mes.
- Activa desde 5 may 2025. Próxima factura: **1 sept 2026**.
- Almacenamiento usado: **1,08 TB de 2 TB**. Todo en **Google Drive**
  (Gmail ≈ 0: el usuario `Direccion Balles Hosteleros` ocupa 2 MB).
- Reparto por unidades compartidas:
  - BALLES HOSTELEROS — **813,91 GB**
  - HABANA SYSTEM S.L — **163,68 GB**
  - BACANAL SYSTEM S.L — **129,54 GB**
- ⚠️ **Bajar a Business Starter HOY es imposible:** el límite pasa a 30 GB y
  Google bloquea envío y recepción de correo hasta liberar espacio. Se probó y
  se abortó a tiempo.

**Cloudflare R2 (destino):**
- Uso actual: **36 MB** (HABANA 1 archivo, BACANAL 0). Dentro del tier gratuito
  (10 GB), por eso hoy no se paga nada.
- Coste real: 0,015 $/GB·mes → **1,08 TB ≈ 16 $/mes ≈ 180 €/año**.
- ⚠️ Mover el TB **tal cual NO ahorra**: sale casi igual que Google. El ahorro
  aparece solo si se **purga** antes lo que no haga falta conservar.
  Ejemplo: quedarse en 300 GB → ~55 €/año → ahorro ~140 €/año.
- **Ventaja estratégica: egress gratis.** Servir archivos no cuesta. Con 3.000
  clientes abriendo vídeos y documentos a diario, esto es lo que hace inviable
  cualquier alternativa que cobre por descarga.

**Envío de correo:**
- Hoy: SMTP de Google (`smtp.gmail.com`), remitente `@balleshosteleros.com`,
  configurado en `src/lib/email/send.ts` vía `SMTP_HOST/PORT/USER/PASS`.
  **Cambiar de proveedor = cambiar esas 4 variables. Sin tocar código.**
- `LIMITE_DIARIO = 2000` en `send.ts` con aviso a 1.800: el techo de Google ya
  se roza hoy.
- Resend/Brevo: gratis hasta 3.000/mes; ~20 €/mes a 50.000; ~35 €/mes a 100.000.
- **Enviar con el dominio NO requiere buzón** — solo verificar el dominio
  (SPF/DKIM). Se conserva `no-reply@balleshosteleros.com` como remitente.
- Se pierde solo la RECEPCIÓN en direcciones del dominio, que hoy no se usa:
  todos los envíos llevan Reply-To no-reply por diseño.

## CORRECCIÓN importante

Durante el análisis se afirmó que cancelar Workspace haría perder el correo
integrado, el calendario y Meet. **Es FALSO.** Verificado en código y en
[[project_correo_cuenta_google_independiente_login]]: el software deja conectar
**cualquier** cuenta de Google (incluida Gmail gratuita) y muestra ese buzón,
calendario y Meet. No está atado a Workspace. Iván lo señaló y tenía razón.

## Fases

**Fase 1 — Auditar el Drive (BLOQUEANTE, decisión de negocio)**
Abrir las 3 unidades compartidas y decidir qué se conserva. Sobre todo los
814 GB de BALLES HOSTELEROS. Sin esto, la migración no ahorra dinero.
*No lo puede hacer el agente: son decisiones sobre documentación del negocio.*

**Fase 2 — Migrar el envío de correo**
Alta en Resend, verificar `balleshosteleros.com` (SPF/DKIM en el DNS de
SiteGround), cambiar las 4 variables SMTP, enviar de prueba y verificar entrega
real antes de dar por bueno. Es la fase de menor riesgo y mayor beneficio
inmediato (quita el techo de 2.000/día).

**Fase 3 — Migrar archivos a R2**
Subir lo que sobreviva a la Fase 1. Ajustar `empresas.storage_limit_bytes`
(hoy 500 GB) si BALLES HOSTELEROS supera la cuota.

**Fase 4 — Traspasar documentos Google**
Las hojas HABANA 2026 / BACANAL 2026 y los formularios de auditoría son
documentos VIVOS (editados a diario), no archivos: no se copian a un bucket.
Traspasar su propiedad a una cuenta Gmail gratuita ANTES de cancelar.

**Fase 5 — Cancelar Workspace**
Solo cuando 1-4 estén hechas y verificadas.

## Escala (3.000 clientes)

- **Almacenamiento:** R2 es la opción correcta por el egress gratis. El coste
  deja de ser gasto y pasa a ir repercutido en la cuota del cliente. Revisar la
  cuota por defecto de 500 GB/empresa: a 3.000 clientes son 1.500 TB
  comprometidos. Ajustar a 50-100 GB por plan y cobrar el exceso.
- **Correo:** ~35-100 €/mes a ese volumen (<1 céntimo por cliente). Google sería
  imposible. Además permitiría que cada restaurante envíe con SU dominio
  (`@bacanalmadrid.com`), resolviendo que hoy un candidato de Bacanal recibe
  correos desde un dominio que no reconoce.

## Riesgos

- Cancelar antes de completar las fases → se caen TODOS los correos automáticos
  (contratos, nóminas, invitaciones, candidatos, proveedores) **sin error visible**.
- Migrar el envío con prisa → correos a spam; se detecta tarde y hace daño.
- Fase 4 olvidada → se pierden hojas y formularios de auditoría en uso diario.

## Criterios de éxito

- Workspace cancelado y 0 € de factura.
- Los correos del software siguen saliendo desde `@balleshosteleros.com` y
  llegando a bandeja de entrada (no spam).
- Sin techo de 2.000 envíos/día.
- Calendario, Meet y correo integrado funcionando con cuentas Gmail gratuitas.
- Ningún documento de negocio perdido.
