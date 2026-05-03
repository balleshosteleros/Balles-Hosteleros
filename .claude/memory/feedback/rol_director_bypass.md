---
name: DIRECTOR es el rol más alto, no existe Administrador
description: El rol DIRECTOR es el techo del SaaS y tiene bypass total; la palabra "administrador" debe desaparecer del software
type: feedback
---

En este SaaS **no existe el concepto de "administrador"**. El rol más alto es **DIRECTOR** y es quien tiene bypass total (acceso a todo, sin filtrado por `empresa_roles.permisos`).

**Why:** El cliente (Balles Hosteleros) modela su negocio así: el director del restaurante es el dueño operativo, ve y edita todo. Los demás roles (gerente, abogado, jefe de cocina, responsable rrhh, etc.) están limitados a su módulo via `empresa_roles.permisos`. El concepto técnico de `app_role='admin'` venía del template SaaS Factory y no encaja con el modelo de negocio.

**How to apply:**
- En lógica de bypass (auth-context.tsx, src/proxy.ts, roles-actions.ts), comprobar `roles.includes('director')`, NUNCA `'admin'`.
- El guard server-side de `empresa_roles` se llama `requireDirectorAppRole`.
- Mensajes de error y textos de UI dicen "director", nunca "administrador".
- Listas de roles seleccionables (ROLES en AyudaAdminTab/ConsultasPendientesView/ComunicadosView/etc.) llevan "Director" como primer elemento, NO "Administrador".
- El enum `app_role` de Postgres aún incluye 'admin' por compatibilidad con el template, pero no se asigna a ningún usuario real.
- Excepción: `ROLES_OBSOLETOS` en empresa-context.tsx mantiene "Administrador" porque sirve para detectar y limpiar datos legados.
