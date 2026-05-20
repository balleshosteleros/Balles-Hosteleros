# Full-TASK-006 - Accesos apps exclusion y remediacion

## Estado

Pendiente fuera de ola.

## Objetivo

Fijar que `accesos apps` queda fuera de la consolidacion principal de RRHH y preparar una remediacion separada de seguridad.

## Estimacion de complejidad

Media como discovery; alta si se implementa remediacion.

## Criterio de corte

Existe una decision documentada: no mezclar accesos apps con el nucleo RRHH, y remediarlo despues como frente de secretos/permisos/auditoria.

## Modo operativo

- taskId: TASK-006
- taskMode: discovery
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-006-accesos-apps-exclusion-y-remediacion.md

## Contexto previo obligatorio

- Leer seccion `Accesos apps` del informe inicial.
- No tocar runtime salvo peticion explicita.

## Scope IN

- Analizar almacenamiento de credenciales.
- Analizar lectura/revelado a UI.
- Analizar RLS tenant.
- Proponer plan separado de remediacion.

## Scope OUT

- No ejecutar remediacion.
- No meter accesos apps dentro de empleados/fichajes.
- No gestionar secretos reales.

## Restricciones

- No imprimir credenciales.
- No mover datos sensibles sin plan aprobado.
- No prometer cumplimiento de seguridad sin auditoria.

## Validacion requerida

- Informe corto de riesgos.
- Propuesta de remediacion separada.
- Decision de exclusion confirmada.

## Dependencias

- Ninguna para la consolidacion RRHH.

## Inputs

- `src/features/rrhh/actions/accesos-apps-actions.ts`.
- `src/features/rrhh/components/AccesosView.tsx`.
- `supabase/migrations/060_accesos_apps.sql`.
- `supabase/migrations/20260517110000_accesos_apps_rls_tenant.sql`.

## Outputs esperados

- Riesgos documentados.
- Plan separado de remediacion.
- Confirmacion de que no bloquea TASK-001 a TASK-005.

## Riesgos conocidos

- Persistencia de contrasenas.
- Devolucion de credenciales a UI.
- Auditoria insuficiente.
- Permisos finos no necesariamente cerrados.

## Artefactos relacionados

- `docs/rrhh-consolidacion/TASK-006-accesos-apps-exclusion-y-remediacion.md`.

## Paths del proyecto

- `src/app/(main)/accesos/page.tsx`
- `src/features/rrhh/actions/accesos-apps-actions.ts`
- `src/features/rrhh/components/AccesosView.tsx`
- `src/features/rrhh/io/accesos.io.ts`

## Agentes recomendados

- security reviewer si se solicita revision formal.
- planificador para convertir remediacion en tasks.

## Checklist de cierre

- Exclusion documentada.
- Riesgos enumerados.
- No se toca runtime.
- Siguiente plan separado propuesto.

## Modelo de datos propuesto

No aplica en esta consolidacion. Cualquier modelo futuro deberia separar secreto, metadata visible, auditoria y permisos.

## Interfaces publicas propuestas

No aplica para RRHH principal.

## Flujo operativo esperado

1. Revisar acciones y migraciones.
2. Documentar riesgos.
3. Proponer remediacion independiente.

## Notas tecnicas

Este frente pertenece a seguridad operativa, no al nucleo laboral de RRHH.

## Siguiente paso sugerido

Abrir plan de remediacion de accesos apps solo cuando el usuario lo pida.

## Resultado validado


## Duracion real


## Ruta canonica

docs/rrhh-consolidacion/Full-TASK-006-accesos-apps-exclusion-y-remediacion.md
