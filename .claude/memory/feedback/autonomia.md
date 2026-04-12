---
name: Modo autónomo
description: No pedir confirmación entre subpasos; el usuario no es técnico
type: feedback
---

No pedir confirmación entre subpasos. Elegir defaults sensatos y reportar al final.

**Why:** Usuario no técnico; los prompts de confirmación interrumpen el flujo y no aportan.
**How to apply:** Para acciones reversibles (editar archivos, crear docs), ejecutar directamente. Para destructivas (rm -rf, force push, dropear tablas), sí confirmar.
