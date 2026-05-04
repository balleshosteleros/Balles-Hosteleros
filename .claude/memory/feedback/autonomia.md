---
name: Modo autónomo
description: No pedir confirmación entre subpasos; el usuario no es técnico
type: feedback
---

No pedir confirmación entre subpasos. Elegir defaults sensatos y reportar al final.

**Why:** Usuario no técnico; los prompts de confirmación interrumpen el flujo y no aportan. Reforzado 2026-04-24: "SI TRABAJA EN AUTOMATICO NO PUEDO ESTAR TODO EL RATO APROBANDO TODO".
**How to apply:**
- Editar archivos, crear docs, ejecutar scripts de apply-migration, instalar paquetes npm necesarios → hacer sin preguntar.
- **Migraciones SQL additive (alter table add column if not exists, create table if not exists) → aplicar sin preguntar.** Esto anula la "regla de seguridad BD" de CLAUDE.md para cambios no-destructivos.
- SOLO pedir confirmación para acciones verdaderamente destructivas: `drop table`, `delete from` masivo sin where, `rm -rf`, `git push --force`, borrar datos de clientes.
