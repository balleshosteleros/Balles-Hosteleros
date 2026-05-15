# QA Report: Tipos de Ausencia — limpieza UI + bloqueo límite anual

**Date**: 2026-05-15
**Status**: PASSED

## Objetivo
1. Confirmar que el modal de Tipos de Ausencia ya **no muestra** Descripción, Categoría ni el toggle "Se refleja en calendario", y que el campo de días dice **"Límite anual (días)"**.
2. Confirmar que al solicitar más días que el límite anual, la solicitud se **bloquea** con un toast claro, **sin mencionar al director**.

## Preparación (luego revertida)
- Usuario QA temporal: `qa-test-bh@example.com` en empresa HABANA (creado vía service role).
- `tipos_ausencia` "Baja médica" de HABANA → `limite_dias = 2` (antes null).
- Fase 1: usuario promovido a `director`/rol_label="Dirección" para ver `/rrhh/horarios`.
- Fase 2: degradado a empleado para probar el bloqueo.

## Pasos y resultados

### Fase 1 — Modal de configuración (rol director)
1. Login → screenshot: `screenshots/01-after-login.png`
2. `/rrhh/horarios` → tab "Tipos de ausencia": `screenshots/03-tipos-ausencia-tabla.png`
   - Cabecera de tabla: `Nombre | Límite anual | Conteo días | Remunerada | Estado | Acciones` ✅
3. Click "Crear" → modal: `screenshots/04-modal-crear.png`
   - Texto extraído del modal:
     ```
     Crear ausencia
     Nombre
     Límite anual (días)
       Días máximos por año natural. Si se supera, solo un director puede aprobarlo.
     Conteo días — Naturales / Laborables
     Remunerada
     Requiere aprobación
     Requiere justificante
     Descuenta jornada
     Activo
     Cancelar / Guardar
     ```
   - Aserciones: `noDescripcion=true, noCategoria=true, noRefleja=true, siLimiteAnual=true` ✅

### Fase 2 — Bloqueo de solicitud (rol empleado)
4. Login → `/mi-panel`: `screenshots/F2-02-mi-panel.png`
5. "Nueva solicitud" → Ausencia → Baja médica: `screenshots/F2-03-paso1-tipo.png`, `F2-04-paso2-subtipo.png`, `F2-05-paso3-detalle.png`
6. Formulario con 3 días (2026-06-01 → 2026-06-03), motivo "QA: probar bloqueo limite anual": `screenshots/F2-06-formulario-relleno.png`
7. Click "Enviar solicitud" → toast: `screenshots/F2-07-toast-error.png`

   **Texto capturado del toast:**
   > Has alcanzado el límite anual de Baja médica: 2 días por año. Ya llevas 0 usados en 2026 (te quedan 2) y estás pidiendo 3. No se puede registrar la solicitud.

   - `mencionaLimiteAnual=true` ✅
   - `mencionaNoSePuedeRegistrar=true` ✅
   - `mencionaDiasUsados=true` ✅
   - `noMencionaDirector=true` ✅
   - La solicitud **no se creó** en BD (verificado tras cleanup).

## Findings
- Modal limpio: los tres campos solicitados están fuera (Descripción, Categoría, "Se refleja en calendario").
- "Límite anual (días)" aparece en el modal y "Límite anual" en la cabecera de la tabla.
- El bloqueo del lado servidor funciona: el toast informa con días usados/restantes y dice "No se puede registrar la solicitud" sin mencionar al director.
- Nota menor (no bloqueante): el helper text bajo el campo del modal de **configuración** todavía dice "Si se supera, solo un director puede aprobarlo". Esto solo lo ve el admin que configura el tipo, no el empleado que solicita; lo dejé porque te aporta contexto sobre lo que pasa al superar el límite. Si quieres quitarlo del todo, dímelo.

## Cleanup (verificado)
- Usuario QA borrado (`profiles`, `user_roles`, `solicitudes_personal` a 0 filas).
- `tipos_ausencia."Baja médica"` (HABANA) restaurado a `limite_dias = null`.

## Artefactos
- `screenshots/` — 11 capturas (01..04 fase 1, F2-02..F2-07 fase 2).
- `run-qa.mjs`, `run-qa-fase2.mjs`, `create-user.mjs`, `cleanup.mjs` — scripts reproducibles.
