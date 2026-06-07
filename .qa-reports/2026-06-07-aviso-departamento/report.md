# QA Report: Aviso al asignar turno/patrón a empleado de otro departamento

**Fecha**: 2026-06-07
**Estado**: PASSED (lógica verificada) · E2E de UI no ejecutable sin credenciales

## Qué se probó
La lógica nueva en `HorariosView.tsx` (rejilla de Cuadrantes) que dispara el
AlertDialog "Empleado de otro departamento" cuando se arrastra un turno o
patrón sobre uno o varios empleados que no pertenecen a su departamento.

## Resultados

### 1. La ruta compila y sirve
`GET http://localhost:3000/rrhh/horarios` → HTTP 200 (sin error de build).

### 2. Lógica del disparador del aviso (test determinista, 7/7)
Réplica exacta de `deptosDelDrag()` + filtro `fuera`:

| Escenario | Aviso esperado | Resultado |
|-----------|----------------|-----------|
| Turno Cocina → empleado de Cocina | No | ✅ |
| Turno Cocina → empleado de Sala | Sí | ✅ |
| Turno SIN departamento → empleado de Sala | No (no hay con qué comparar) | ✅ |
| Turno Cocina → empleado SIN departamento | Sí | ✅ |
| Turno Cocina → cabecera [Cocina, Sala, Barra] | Sí (2 fuera) | ✅ |
| Patrón Cocina+Sala → empleado de Sala | No (Sala está en el patrón) | ✅ |
| Patrón solo Cocina → empleado de Sala | Sí | ✅ |

## Limitaciones
No se pudo ejecutar el click-through completo en navegador porque:
- No hay credenciales de acceso en el entorno local (login Google/email; el
  modo demo está limitado al host `demo.balleshosteleros.com` y requiere
  `DEMO_EMAIL`/`DEMO_PASSWORD`, ausentes en `.env.local`).
- Crear un usuario en la auth de producción y sembrar datos toca
  autenticación/datos de clientes (requiere permiso explícito).
- El drag-drop con @dnd-kit (PointerSensor) no es accionable con el CLI
  básico de Playwright.

La verificación cubre lo único que cambió: la condición que decide cuándo
aparece el aviso. El render del diálogo usa el componente AlertDialog estándar
ya usado en el resto del módulo.

## Recomendación
Validación visual final por el usuario en su sesión real: en /rrhh/horarios →
Cuadrantes, abrir el panel "Asignar arrastrando" y soltar un turno de un
departamento sobre un empleado de otro → debe salir el aviso.
