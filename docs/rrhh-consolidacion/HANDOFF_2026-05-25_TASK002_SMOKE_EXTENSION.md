# Handoff TASK-002 smoke extension — 2026-05-25

## Estado de sesión

Sesión de revisión estática y preparación del script de smoke UI.
Chrome/Preview no disponibles en esta sesión — el smoke de UI queda como script ejecutable.

Branch: `rrhh-sync-origin-c4da3ca`
Repo: `https://github.com/balleshosteleros/Balles-Hosteleros.git`

---

## Verificaciones estáticas completadas

### typecheck
- `npm run typecheck` (vía WSL): **pasa limpio, sin errores**.

### createEmpleado — flujo multiempresa
Archivo: `src/features/rrhh/actions/empleados-actions.ts`

Secuencia verificada:
1. Deduplica y ordena `empresaIds[]` con empresa principal primero.
2. `requireAdminUser({ empresaIds })` — director tiene bypass total; admin tenant verifica `user_empresas`.
3. `admin.auth.admin.createUser()` crea `auth.user` con email + contraseña temporal.
4. `admin.from("profiles").update({...}).eq("id", newUserId)` — setea empresa, rol, `es_empleado=true`.
5. `admin.from("user_roles").insert({ role: "empleado" })` — rol RBAC base.
6. `admin.from("user_empresas").upsert(accesosRows)` — inserta fila por cada empresa marcada.
7. Valida que `localPrincipal` existe y pertenece a `empresaPrincipalId` antes de crear empleado.
8. `admin.from("empleados").insert({...})` — vincula a empresa principal y local.
9. **Rollback**: si cualquier paso 6-8 falla, `deleteUser(newUserId)` por CASCADE.

Conclusión: **flujo correcto y robusto**.

### handle_new_user trigger
Migración más reciente: `20260521140000_allow_supabase_auth_admin_handle_new_user.sql`

El trigger ahora inserta:
```sql
INSERT INTO public.profiles (id, user_id, email, full_name, nombre, avatar_url)
VALUES (NEW.id, NEW.id, ...)
```
`profiles.user_id = profiles.id = auth.users.id` — garantizado para todos los usuarios nuevos.

Conclusión: `fichajes-actions.ts getContext()` usa `.eq("user_id", user.id)` — **correcto**.

### Form /rrhh/empleados/nuevo
Archivo: `src/app/(main)/rrhh/empleados/nuevo/page.tsx`

- Checkboxes por empresa (carga desde `getEmpresasAccesibles()`).
- Al marcar la primera empresa, se autoelige como principal.
- Botón "Marcar principal" para cambiar la empresa principal.
- Selector de local solo aparece para la empresa principal (correcto — `empleados.local_id` solo persiste para la principal).
- Validaciones front: nombre, emailPersonal, ≥1 empresa marcada, empresaPrincipalId válido, local principal asignado.
- Al crear: muestra dialog con email + contraseña temporal y botón "Copiar".

### fichajes vs mi-panel — alineación de campos
- `fichajes.empleado_id` = `user.id` (auth UUID), no `empleados.id`.
- `crearFichajeManual` usa `empleado.user_id` para insertar en fichajes — correcto.
- `listFichajesEmpleado` filtra por `empleado_id = empleado.user_id` — correcto.
- Los dos caminos (RRHH y mi-panel) escriben en la misma tabla con los mismos campos.

---

## Script de smoke UI pendiente

### Prerequisitos
- Dev server arrancado: `npm run dev` en `/home/fernandomp/dev/Balles-Hosteleros`
- Credenciales del admin smoke: `rrhh-smoke-admin-no-borrar@example.com`
  (ver `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md` para instrucciones de reset de password)

### Paso 1 — Alta multiempresa

1. Login como `rrhh-smoke-admin-no-borrar@example.com`.
2. Navegar a `/rrhh/empleados`.
3. Verificar que la empresa activa en el selector es HABANA (empresa esperada del admin).
4. Pulsar "+ Nuevo".
5. Rellenar:
   - Nombre: `Smoke Multiempresa`
   - Apellidos: `Test 20260525`
   - Email personal: `smoke-multiempresa-20260525@example.com`
   - Departamento: cualquiera disponible
6. En la sección "Acceso a empresas":
   - Marcar HABANA → asignar local de HABANA → marcar como principal.
   - Marcar BACANAL → acceso secundario (sin local — correcto por diseño).
7. Pulsar "Crear empleado y usuario".

**Resultado esperado:**
- Dialog con email + contraseña temporal visible.
- Copiar credenciales.
- Pulsar "Hecho" → redirige a `/rrhh/empleados`.
- Empleado `Smoke Multiempresa Test` visible en la lista con empresa activa HABANA.
- Cambiar empresa activa a BACANAL → el empleado sigue apareciendo (multiempresa).

### Paso 2 — Verificación en lista

Con empresa activa HABANA:
- El nuevo empleado aparece.
- La columna "Empresas" muestra badges de HABANA y BACANAL.

Con empresa activa BACANAL:
- El nuevo empleado sigue apareciendo.

### Paso 3 — Reentrada del empleado (primer acceso)

1. Cerrar sesión del admin.
2. Login con `smoke-multiempresa-20260525@example.com` + contraseña temporal copiada.
3. Verificar que llega a `/mis-departamentos` o a la pantalla de onboarding.
4. Si aparece onboarding de formación: completarlo o saltarlo.
5. Verificar que `Mi Panel` es accesible.
6. Verificar que la empresa activa del empleado es HABANA (su empresa principal).

**Resultado esperado:**
- Login correcto sin errores.
- Landing page coherente (no redirige a login en bucle).
- Empresa activa = HABANA.

### Paso 4 — Fichaje personal (opcional, extiende TASK-002)

Desde Mi Panel del empleado smoke:
1. Intentar fichar entrada.
2. Si requiere geolocalización y no está disponible: verificar que el error es claro ("Activa la geolocalización").
3. Si el empleado tiene `permite_teletrabajo=true`: debería poder fichar sin geo.

---

## Riesgos activos

- El empleado creado en el smoke tiene `es_empleado=true` pero `perfil_completado=false`.
  El onboarding puede bloquearlo dependiendo de los gates configurados.
- Si el smoke arroja error en el alta, el rollback debe haber limpiado el `auth.user`.
  Verificable en Supabase → Auth → Users buscando el email.
- `pagos` sigue siendo WIP visible en el módulo — no tocar.
- `typecheck` confirmado en esta sesión; `npm run build` no ejecutado.

---

## Usuarios de smoke creados en esta sesión

Ninguno. El usuario `smoke-multiempresa-20260525@example.com` se crea durante el smoke de UI,
si ese paso se completa.

Si se crea, añadirlo a `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`.

---

## Dónde retomar

1. Ejecutar el script de smoke UI de este handoff.
2. Si pasan los 4 pasos: TASK-002 puede marcarse como **cerrada**.
3. Siguiente: abrir TASK-003 (horarios y solicitudes discovery) —
   pero NO antes de decidir el modelado de `rrhh_turnos`, `rrhh_cuadrantes`, `rrhh_descansos`.

## Pendiente de TASK-002 para cierre formal

- [ ] Alta multiempresa via UI — resultado OK/FAIL.
- [ ] Empleado aparece en lista con empresa activa HABANA y BACANAL.
- [ ] Reentrada del empleado — login + landing correctos.
- [ ] `npm run build` — no ejecutado en esta sesión.
