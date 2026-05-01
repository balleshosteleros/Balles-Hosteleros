# PRP-032 — Cronogramas: ejecuciones diarias, confirmación por empleado y dashboard Dirección

**Estado:** Borrador (pendiente aprobación DB)
**Fecha:** 2026-04-24
**Módulo:** Dirección · Cronogramas
**Dependencias:** `cronogramas_operativos` (existente), `profiles` (auth), `empleados` (RRHH)

---

## 1. Objetivo

Transformar el submódulo Cronogramas de una tabla estática de tareas a un **sistema operativo diario**:

1. Cada tarea queda anclada a un calendario (día de semana / día de mes / fecha anual).
2. Cuando un empleado entra al sistema, ve **las tareas de hoy** según su rol/asignación.
3. Las confirma como hechas (o no). Lo no confirmado queda como **pendiente**.
4. Dirección dispone de un **dashboard de productividad** con gráficas, filtros y detalle por departamento/empleado.
5. Rediseño visual del submódulo: home con cards por departamento, tabla pivote mejorada con chips de día.

## 2. Comportamiento esperado

### 2.1 Edición del cronograma (Dirección)
- Home del submódulo: **grid de cards por rol/departamento** (CALIDAD, DIRECCIÓN, RRHH, COCINA…) con:
  - Icono, nº de tareas, barra de distribución por frecuencia, % con vídeo formativo, % cumplimiento semanal.
- Click en card → detalle del cronograma (tabla pivote actual + mejoras).
- Cada tarea permite definir:
  - Frecuencia (DIARIO / SEMANAL / MENSUAL / TRIMESTRAL / ANUAL / POR NECESIDAD).
  - Días concretos según frecuencia (selectores dinámicos).
  - Empleados específicos (opcional, multi). Si vacío → todos los del rol.

### 2.2 Índice del empleado
- En el dashboard del empleado aparece un bloque **"Tareas de hoy — lunes 27 abr"**:
  - Lista las tareas del día ordenadas por frecuencia (DIARIO primero).
  - Cada fila: checkbox "He hecho esta tarea", descripción, botón "Ver detalle" (resumen + vídeo formativo).
  - Al marcar → estado `hecha` + timestamp.
- Bloque **"Pendientes"**: tareas de días anteriores (últimos 30 días) sin confirmar. El empleado puede marcarlas retroactivamente o dejarlas.
- Timeline de los últimos 7 días con % cumplimiento personal.

### 2.3 Dashboard Dirección (`/direccion/cronogramas/productividad`)
- **KPIs top:** % cumplimiento global hoy / semana / mes · nº tareas hechas · nº pendientes · top y bottom departamento.
- **Filtros:** rango fechas, departamento (multi), empleado.
- **Gráficas** (Recharts):
  - Barras apiladas hecho/pendiente por departamento.
  - Línea de evolución semanal de cumplimiento.
  - Heatmap día × departamento (intensidad = % cumplimiento).
  - Ranking empleados por cumplimiento (top 10).
- **Tabla detalle:** empleado · depto · tareas programadas · hechas · pendientes · % cumplimiento.

## 3. Modelo de datos

### 3.1 Alterar `cronogramas_operativos`

```sql
ALTER TABLE cronogramas_operativos
  ADD COLUMN dia_semana int[] DEFAULT NULL,    -- ISO 1=lun..7=dom, solo SEMANAL
  ADD COLUMN dia_mes int DEFAULT NULL,          -- 1-31, MENSUAL/TRIMESTRAL
  ADD COLUMN fecha_anual text DEFAULT NULL,     -- 'MM-DD', ANUAL
  ADD COLUMN meses_trimestrales int[] DEFAULT ARRAY[1,4,7,10]::int[],  -- TRIMESTRAL
  ADD COLUMN empleados_asignados uuid[] DEFAULT NULL;  -- null = todos los del rol
```

### 3.2 Tabla nueva `cronograma_ejecuciones`

```sql
CREATE TABLE cronograma_ejecuciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id uuid NOT NULL REFERENCES cronogramas_operativos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha_programada date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','hecha','omitida')),
  confirmada_en timestamptz,
  nota text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tarea_id, user_id, fecha_programada)
);
```

RLS:
- Empleado lee/escribe solo sus propias filas (user_id = auth.uid()).
- Admin (profiles.rol = 'ADMIN' de su empresa) lee todas las filas de su empresa.

### 3.3 Función de siembra

`seed_cronograma_ejecuciones(p_user_id uuid, p_fecha date)` — idempotente:
1. Lee el perfil → empresa + rol.
2. Para cada tarea del rol (o con user_id en empleados_asignados) aplicable a p_fecha según frecuencia y campos de calendario:
3. Inserta en cronograma_ejecuciones si no existe (`ON CONFLICT DO NOTHING`).

Se llama **lazy** al abrir la vista de tareas del empleado (client invoca RPC).

## 4. Fases

| Fase | Contenido | Entrega |
|------|-----------|---------|
| F1 | Migración SQL 045 + RPC seed + actualizar hook/tipos | DB lista, tipos TS correctos |
| F2 | Rediseño visual Dirección: cards home + tabla pivote con selector de días por tarea | `/direccion/cronogramas` refactor |
| F3 | Bloque "Tareas de hoy" + "Pendientes" en dashboard empleado | `/dashboard` + componente `TareasHoy.tsx` |
| F4 | Dashboard productividad Dirección con gráficas | `/direccion/cronogramas/productividad` |

## 5. Archivos afectados

- `supabase/migrations/045_cronogramas_ejecuciones.sql` (nuevo)
- `src/features/direccion/hooks/useCronogramasOperativos.ts` (campos nuevos)
- `src/features/direccion/hooks/useCronogramaEjecuciones.ts` (nuevo)
- `src/features/direccion/components/cronogramas/CronogramasView.tsx` (refactor visual)
- `src/features/direccion/components/cronogramas/CronogramasHome.tsx` (nuevo — grid cards)
- `src/features/direccion/components/cronogramas/CronogramaDetalle.tsx` (nuevo — tabla mejorada)
- `src/features/direccion/components/cronogramas/SelectorDiasTarea.tsx` (nuevo — selector dinámico)
- `src/features/direccion/components/cronogramas/TareasHoyWidget.tsx` (nuevo — empleado)
- `src/app/(main)/direccion/cronogramas/productividad/page.tsx` (nuevo — dashboard)
- `src/features/direccion/components/cronogramas/DashboardProductividad.tsx` (nuevo)
- `src/features/direccion/actions/cronograma-ejecuciones-actions.ts` (nuevo — server actions)

## 6. Decisiones (defaults tomados)

- **Asignación híbrida:** por rol por defecto + override con `empleados_asignados uuid[]` opcional.
- **Pendientes:** últimos 30 días en UI (historial completo persistido).
- **Trimestral:** siembra en meses 1,4,7,10 con `dia_mes` configurable (editable por tarea).
- **Clamp día:** si `dia_mes = 31` y el mes no tiene 31, se usa último día del mes.
- **POR NECESIDAD:** no se siembra; aparece en lista aparte para lanzar manualmente.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Performance del seed lazy al abrir dashboard | RPC idempotente + unique constraint evita duplicados; se ejecuta solo para `fecha=hoy` |
| Empleados sin user_id en profiles | Degradación graceful: si user_id es null, no se siembra; admin ve aviso |
| Cambio de frecuencia en tarea ya sembrada | No se reescribe el pasado; aplica desde hoy en adelante |
| Empresa con muchos empleados × tareas | Seed solo por usuario al entrar, no global; índices en `(user_id, fecha_programada)` |
