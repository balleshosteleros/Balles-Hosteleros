# QA Report: Patrones (RRHH → Horarios → Patrones)

**Date**: 2026-05-15
**Status**: PARTIALLY_VERIFIED — BD validada end-to-end; UI requiere credenciales para autenticar.

## Lo verificado automáticamente

### 1. Dev server
- `GET http://localhost:3000` → HTTP 200 ✓

### 2. Tipos TypeScript
- `tsc --noEmit --skipLibCheck` → exit 0 (sin errores) ✓

### 3. Base de datos Supabase (vía MCP)

**Tablas creadas:**
- `rrhh_patrones` (id, empresa_id, nombre, tipo, creado_por_user_id, creado_por_nombre, activo, created_at, updated_at) ✓
- `rrhh_patron_semanas` (id, patron_id, orden, dias jsonb, created_at) ✓
- `rrhh_patron_empleados` (patron_id, empleado_id, asignado_at, asignado_por_user_id) ✓
- RLS habilitada con políticas por `empresa_id` en las tres ✓

**Seed BACANAL (14 patrones)** — query verificada:

| Nombre | Tipo | Creador | Empleados | Días |
|--------|------|---------|-----------|------|
| ARTISTA 1 | semanal | Ivan Ballesteros | 0 | 7 |
| ARTISTA 2 | semanal | Ivan Ballesteros | 0 | 7 |
| CALIDAD | semanal | Ivan Ballesteros | 0 | 7 |
| CAMARERO 1 | semanal | Ivan Ballesteros | 0 | 7 |
| CAMARERO FINDES | semanal | **Alejandro Mojica** | 0 | 7 |
| COCINERO | semanal | Ivan Ballesteros | 0 | 7 |
| JEFE COCINA 3 | semanal | **Alejandro Mojica** | 0 | 7 |
| JEFE DE COCINA 3.. | semanal | **Alejandro Mojica** | 0 | 7 |
| JEFE DE SALA 1 | semanal | Ivan Ballesteros | 0 | 7 |
| JEFE DE SALA 2 | semanal | Ivan Ballesteros | 0 | 7 |
| JEFE DE SALA 3 | semanal | Ivan Ballesteros | 0 | 7 |
| LIMPIEZA/OFFICE | semanal | Ivan Ballesteros | 0 | 7 |
| MANTENIMIENTO | semanal | Ivan Ballesteros | 0 | 7 |
| Plantilla sin nombre | semanal | Ivan Ballesteros | 0 | 7 |

✓ Los 14 patrones existen.
✓ Creador snapshot correcto (Ivan / Alejandro Mojica según pediste).
✓ Empleados asignados = 0 real (no inventado).

### 4. UI — Pendiente login
- La página `/rrhh/horarios` redirige correctamente al formulario de login (`/login` en el screenshot).
- Screenshot: `screenshots/01-horarios.png`
- **No tengo credenciales** para autenticarme sin pedírtelas, así que el flujo UI completo (ver tabla, abrir modal, crear patrón con tu nombre como creador) no se ha ejecutado.

## Findings
- Backend: todo OK, datos persistidos, RLS activa.
- Frontend: código compila y carga, pero el QA visual requiere sesión iniciada.

## Recommendations
- Para validar la UI yo mismo necesitaría: (a) credenciales temporales, (b) un endpoint de impersonación, o (c) que abras tú la página y me confirmes/me pases un screenshot si algo no cuadra.
- Alternativamente, puedo usar `supabase.auth.admin.generateLink` si me proporcionas la `SERVICE_ROLE_KEY` localmente (no recomendable por seguridad — mejor login manual).
