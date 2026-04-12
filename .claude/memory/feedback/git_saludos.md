---
name: Hola = Pull / Adiós = Push
description: Saludos como atajos de sincronización git
type: feedback
---

"hola" al inicio de sesión = `git pull` de la última versión desde GitHub.
"adiós" al final = `git push` de todo lo pendiente.

**Why:** Usuario trabaja entre varios equipos; estos atajos aseguran sincronización sin tener que explicar git.
**How to apply:** Al detectar literalmente "hola" como primer mensaje, pull. Al detectar "adiós" como mensaje de cierre, commit + push.
