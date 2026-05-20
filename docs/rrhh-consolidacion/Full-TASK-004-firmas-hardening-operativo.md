# Full-TASK-004 - Firmas hardening operativo

## Estado

Pendiente.

## Objetivo

Auditar firmas como submodulo sensible antes de considerarlo consolidado: storage, documentos, hash, token, OTP, eventos, expiracion, permisos y smokes.

## Estimacion de complejidad

Alta por seguridad, secretos y trazabilidad.

## Criterio de corte

Firmas queda con gaps y smokes definidos, o con autorizacion clara para una task runtime posterior.

## Modo operativo

- taskId: TASK-004
- taskMode: discovery
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-004-firmas-hardening-operativo.md

## Contexto previo obligatorio

- Revisar informe inicial, seccion Firmas.
- Revisar variables requeridas sin exponer valores.
- No ejecutar flujos que envien emails o consuman tokens reales sin aprobacion.

## Scope IN

- Listado de firmas.
- Alta de documento PDF.
- Hash y storage.
- Tokens y OTP.
- Auditoria de eventos.
- Cron de expiracion.
- Permisos por empresa y empleado activo.

## Scope OUT

- Nuevo proveedor legal.
- Redefinir validez juridica.
- Accesos apps.

## Restricciones

- No imprimir secretos.
- No enviar emails reales salvo smoke autorizado.
- No relajar permisos para "hacer que funcione".

## Validacion requerida

- Revision estatica.
- Checklist de entorno.
- Checklist de smoke controlado.
- Lista de gaps antes de runtime.

## Dependencias

- `docs/rrhh-consolidacion/TASK-001-cierre-bloque-runtime-iniciado.md`.

## Inputs

- `src/features/rrhh/actions/firmas-actions.ts`.
- `src/features/rrhh/services/firmas/`.
- `src/app/api/cron/firmas-expirar/route.ts`.
- `supabase/migrations/20260515160000_firmas_eidas.sql`.

## Outputs esperados

- Informe de hardening.
- Condiciones para smoke.
- Task posterior si hay cambios runtime.

## Riesgos conocidos

- Depende de `SUPABASE_SERVICE_ROLE_KEY`.
- Depende de bucket `firmas`.
- Expone documentos y enlaces temporales.
- El cron borra tokens y OTPs; requiere control de entorno.

## Artefactos relacionados

- `docs/rrhh-consolidacion/TASK-004-firmas-hardening-operativo.md`.

## Paths del proyecto

- `src/app/(main)/rrhh/firmas/page.tsx`
- `src/features/rrhh/actions/firmas-actions.ts`
- `src/features/rrhh/components/empleados/FirmasEmpleadoTab.tsx`
- `src/features/rrhh/services/firmas/audit.ts`
- `src/features/rrhh/services/firmas/crypto.ts`
- `src/features/rrhh/services/firmas/email.ts`
- `src/app/api/cron/firmas-expirar/route.ts`

## Agentes recomendados

- security reviewer si se solicita revision de seguridad formal.
- detective para storage/RLS.
- qa-gate antes de smoke real.

## Checklist de cierre

- Estados de documento definidos.
- Token/OTP revisado.
- Storage revisado.
- Cron revisado.
- Evento de auditoria revisado.
- Smoke seguro descrito.

## Modelo de datos propuesto

Mantener modelo existente salvo hallazgo:

- `firmas_documentos`
- `firmas_tokens`
- `firmas_otps`
- eventos/auditoria de firmas

## Interfaces publicas propuestas

- `listFirmas()`
- `listFirmasPorEmpleado(empleadoId)`
- `crearFirma(formData)`
- funciones de evento/token/visor existentes.

## Flujo operativo esperado

1. Revisar actions.
2. Revisar servicios.
3. Revisar cron.
4. Emitir hardening y smoke.

## Notas tecnicas

Firmas puede estar funcionalmente avanzado y aun no estar operativo de forma segura.

## Siguiente paso sugerido

Crear task runtime de firmas solo si esta discovery cierra gaps.

## Resultado validado


## Duracion real


## Ruta canonica

docs/rrhh-consolidacion/Full-TASK-004-firmas-hardening-operativo.md
