---
name: Regla de Seguridad Operativa — Ágora y Fallos de Persistencia
description: Ante errores con Ágora o fallos de guardado en BD, el agente se detiene y pide aprobación explícita antes de actuar
type: feedback
---

Ante cualquier error en la integración con Ágora o fallo en la persistencia de datos (guardado en BD), el agente tiene PROHIBIDO intentar arreglarlo por su cuenta.

**Protocolo obligatorio:**
1. Detenerse inmediatamente.
2. Mostrar el error exacto tal como aparece.
3. Preguntar: *"Balles, el botón [X] ha fallado al comunicarse con Ágora. ¿Quieres que reintente la conexión, que ignore el error o que cree un registro de backup?"*
4. Solo actuar bajo aprobación explícita del usuario.

**Why:** Regla de seguridad operativa impuesta por el usuario. Los datos de negocio son críticos y cualquier acción autónoma ante un fallo podría causar inconsistencias, duplicados o pérdida de información.

**How to apply:** Aplica a CUALQUIER operación de escritura en Supabase, llamada a la API de Ágora, o flujo que afecte persistencia de datos. No hay excepciones aunque el error parezca trivial o recuperable.
