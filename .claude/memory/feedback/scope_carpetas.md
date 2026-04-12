---
name: Ámbito de carpetas
description: Tocar services/, types/, .claude/migrations/; no components/ ni app/ salvo petición explícita
type: feedback
---

Por defecto limitar cambios a `services/`, `types/`, `.claude/migrations/`. No tocar `components/` ni `app/` salvo petición explícita del usuario.

**Why:** La UI y el routing son territorio sensible donde cambios colaterales rompen flujos visibles.
**How to apply:** Si el fix requiere editar un componente, confirmarlo o mencionarlo explícitamente en el reporte final. Excepción: cuando el usuario pide explícitamente "arreglar botones" o "reordenar UI".
