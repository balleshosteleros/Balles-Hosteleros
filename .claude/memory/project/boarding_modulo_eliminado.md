---
name: Módulo BOARDING de RRHH eliminado (2026-06-30)
description: La tecla BOARDING de RRHH (plantillas/procesos alta-baja de empleado) se borró por completo, código y BD. NO reintroducir. El wizard /onboarding de empresa nueva (PRP-067) y el OnboardingGuard de formación SÍ siguen vivos.
type: project
---

El módulo **BOARDING de RRHH** se retiró entero el 2026-06-30 a petición del usuario ("no existe ya"). No quedaban procesos creados (`procesos_boarding` vacío), solo plantillas semilla.

**Borrado de código:**
- `src/app/(main)/rrhh/boarding/`, `src/features/rrhh/components/boarding/`, `src/features/rrhh/{actions/boarding-actions.ts, data/boarding.ts, io/boarding.io.ts}`.
- Tecla BOARDING del menú RRHH (`nav-routes.tsx`) y tab/case "boarding" en ficha empleado (`empleados/[id]/page.tsx`).
- Bloque que creaba proceso onboarding automático al completar perfil (`primer-acceso/actions/perfil-actions.ts`).
- `iniciarOffboarding` + su diálogo (estaba muerto, nunca se abría) en `candidatos-actions.ts` y `CandidatosRealesTab.tsx`.
- `placeholder("boarding", ...)` en `reglas-submodulos-catalogo.ts`.
- El bloqueo "candidato ya empleado no se puede descartar" se conserva: el error pasó de `OFFBOARDING_REQUIRED` a `YA_EMPLEADO` (`candidatos-actions.ts` + `ReclutamientoView.tsx`), mensaje sin mención a offboarding.

**Borrado de BD:** tablas `plantillas_boarding` y `procesos_boarding` (DROP CASCADE). Migración `supabase/migrations/20260630120000_drop_boarding_modulo.sql`.

**NO confundir / SÍ siguen vivos:**
- Wizard `/onboarding` de empresa nueva (PRP-067, `src/features/onboarding/`, tabla `empresa_onboarding_pasos`).
- `OnboardingGuard` de formación obligatoria (`features/formacion`).
- API videos onboarding, tipo de firma "onboarding", inducción en cuestionarios.
