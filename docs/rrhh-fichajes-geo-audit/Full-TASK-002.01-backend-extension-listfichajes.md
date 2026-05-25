# Full-TASK-002.01 — Backend extension `listFichajes` + helpers + GeoBadge

## Estado

Cerrada — 2026-05-25. typecheck + build pasan. Smoke UI multi-tenant queda para TASK-002.06.

## Objetivo

Extender el server action `listFichajes` para que devuelva, junto con los campos actuales del fichaje, las coordenadas de entrada/salida, su precisión, el modo teletrabajo, los datos del local asignado (lat, lng, radio_metros, nombre, color) y las **distancias precalculadas en servidor** entre fichaje y local. Crear dos artefactos reutilizables: el helper puro `getFichajeGeoStatus(fichaje, local)` que clasifica un fichaje en uno de cuatro estados, y el componente `GeoBadge` que renderiza el badge visual + distancia.

## Estimación de complejidad

Media (M). Aprox 4–6 horas:
- Extender server action: 1.5 h.
- Crear helper + tests mentales de los 4 casos: 0.5 h.
- Crear GeoBadge con 4 variantes visuales: 1.5 h.
- Extender tipo `Fichaje` + ajustes downstream: 0.5 h.
- Validación: 0.5 h.

## Criterio de corte

- `listFichajes(fecha?)` devuelve un array donde cada item tiene los nuevos campos opcionales: `latEntrada`, `lngEntrada`, `precisionEntradaMetros`, `latSalida`, `lngSalida`, `precisionSalidaMetros`, `modoTeletrabajo`, `local`, `distanciaEntradaMetros`, `distanciaSalidaMetros`.
- Las distancias se calculan server-side con `distanciaMetros()` y solo si hay coords completas en fichaje y local; si falta cualquiera, la distancia es `null`.
- `getFichajeGeoStatus(fichaje, local)` devuelve `'en-local' | 'teletrabajo' | 'fuera' | 'sin-datos'` cubriendo los 4 casos.
- `<GeoBadge fichaje={…} />` renderiza el badge con color correcto y texto secundario con la distancia (`87 m` / `>5 km` / `Madrid →`).
- `npm run typecheck` pasa.
- `FichajesView` actual sigue funcionando sin cambios (compatibilidad backward).

## Modo operativo

- taskId: TASK-002.01
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-fichajes-geo-audit/TASK-002.01-backend-extension-listfichajes.md
- sourcePRP: .claude/PRPs/PRP-037-auditoria-geografica-fichajes.md

## Contexto previo obligatorio

- Leer PRP-037 secciones `Criterios de éxito`, `Modelo de datos`, `Referencias internas` antes de tocar nada.
- Leer `src/features/rrhh/utils/geo.ts` (helper `distanciaMetros` Haversine).
- Leer `src/features/rrhh/actions/fichajes-actions.ts` (función actual `listFichajes` y patrón de queries Supabase con `getContext`).
- Leer `src/features/rrhh/data/fichajes.ts` (tipo `Fichaje` actual a extender).
- Leer migración `supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql` para confirmar nombres exactos de columnas BD.
- Leer migración `20260515100000_rename_centros_to_locales.sql` para confirmar que `fichajes.centro_id` ahora apunta a `locales.id`.

## Scope IN

- Editar `src/features/rrhh/actions/fichajes-actions.ts`:
  - extender la query SQL para incluir las columnas geo del fichaje (`lat_entrada, lng_entrada, precision_entrada_metros, lat_salida, lng_salida, precision_salida_metros, modo_teletrabajo, centro_id, local_id`),
  - hacer un JOIN o segunda query a `locales` para resolver `lat, lng, radio_metros, nombre, color` del local asignado al fichaje,
  - calcular `distanciaEntradaMetros` y `distanciaSalidaMetros` con el helper `distanciaMetros()` cuando todas las coords están presentes,
  - devolver el contrato extendido con campos opcionales (`| null` cuando no hay datos).
- Crear `src/features/rrhh/utils/fichaje-geo-status.ts` con:
  ```typescript
  export type FichajeGeoStatus = 'en-local' | 'teletrabajo' | 'fuera' | 'sin-datos';
  export function getFichajeGeoStatus(fichaje: FichajeConGeo, local: LocalGeo | null): FichajeGeoStatus;
  ```
- Crear `src/features/rrhh/components/fichajes/geo-badge.tsx`:
  - props `{ fichaje: FichajeConGeo }`,
  - renderiza `<Badge>` con color semántico (verde / violeta / rojo / gris) + ícono opcional Lucide + texto principal + texto secundario con la distancia.
- Extender el tipo `Fichaje` en `src/features/rrhh/data/fichajes.ts` con los nuevos campos opcionales.

## Scope OUT

- Modificar `ficharEntrada`, `ficharSalida` o `crearFichajeManual`.
- Modificar el form `/rrhh/empleados/nuevo`.
- Crear migraciones nuevas — BD ya tiene todo.
- Tocar `MapPicker.tsx` ni `listLocales`.
- Cambiar el comportamiento actual de `FichajesView` (esta task no debe romper la UI existente).
- Integrar el `GeoBadge` en la tabla (eso es TASK-002.02).

## Restricciones

**Heredadas del PRP (Anti-Patrones):**
- NO calcular distancias en cliente — hacer en server una vez y devolver el resultado.
- NO modificar `ficharEntrada` / `ficharSalida`.
- NO crear nueva migración — todo lo necesario ya está en BD desde 2026-05-14.
- NO usar `any`. Todos los nuevos tipos deben ser explícitos.

**Propias de la task:**
- El contrato de retorno extendido debe ser **aditivo**: añadir campos opcionales sin renombrar ni quitar ninguno existente.
- El JOIN con `locales` debe respetar RLS por empresa (verificar que el cliente Supabase aplicado lee solo locales de la empresa activa).

## Validación requerida

- `npm run typecheck` pasa.
- Manual: llamar `listFichajes()` desde una server action temporal o desde `FichajesView` (logging del primer item) y verificar la forma del payload extendido.
- Manual: cubrir mentalmente los 4 estados del helper con datos de prueba — empleado en local con teletrabajo=false a 30m del local (en-local), empleado con teletrabajo=true (teletrabajo), empleado a 234m con teletrabajo=false (fuera), fichaje manual sin lat_entrada (sin-datos).
- Manual: cambiar empresa activa HABANA ↔ BACANAL en la app y verificar que `listFichajes` sigue funcionando sin errores.

## Dependencias

- TASK-002 (`docs/rrhh-consolidacion/Full-TASK-002-empleados-y-fichajes-canonicos.md`) cerrada.

## Inputs

- `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — PRP padre.
- `supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql` — schema BD geo.
- `supabase/migrations/20260515100000_rename_centros_to_locales.sql` — rename centros→locales.

## Outputs esperados

- `src/features/rrhh/actions/fichajes-actions.ts` — `listFichajes` extendido.
- `src/features/rrhh/utils/fichaje-geo-status.ts` — nuevo helper.
- `src/features/rrhh/components/fichajes/geo-badge.tsx` — nuevo componente.
- `src/features/rrhh/data/fichajes.ts` — tipo `Fichaje` extendido.

## Riesgos conocidos

**Heredados del PRP (Gotchas):**
- **RLS multi-tenant en el JOIN con `locales`**: si el JOIN se hace con cliente RLS y la policy es restrictiva, podría devolver `null` para `local` aunque el fichaje sí tenga `centro_id`. Si se detecta, replicar el patrón del fix aplicado en `listEmpleados` durante TASK-002 (usar `createAdminClient()` con scope explícito de empresa activa). Ver `HANDOFF_2026-05-25_TASK002_SMOKE_EXTENSION.md` y `errors/rls-join-anon.md`.
- **Coordenadas de empleado fuera del centro del mapa**: irrelevante en esta task, pero el contrato debe permitir que el cliente haga `fitBounds` después.
- **Fichajes manuales (`tipo='MAN'`)**: tienen `lat_entrada IS NULL` por diseño. El status correcto es `teletrabajo` o `sin-datos` (criterio: `modo_teletrabajo` decide). Ver `crearFichajeManual` en `fichajes-actions.ts` línea 358.
- **Precisión GPS móvil**: hasta 200m de error. No filtrar por precisión; exponerla en el contrato para que el badge/modal decidan qué hacer.

**Propios de la task:**
- Renombrar accidentalmente algún campo y romper la tabla actual de fichajes.
- Olvidar manejar `local IS NULL` en `getFichajeGeoStatus` (fichaje sin local asignado).

## Artefactos relacionados

- `docs/rrhh-fichajes-geo-audit/EXECUTION_PLAN.md` — índice del PRP-037.
- `docs/rrhh-consolidacion/HANDOFF_2026-05-25_TASK002_SMOKE_EXTENSION.md` — referencia para el patrón de `createAdminClient` con scope explícito si aplica.
- `errors/rls-join-anon.md` (si existe en el factory).

## Paths del proyecto

**Heredados del PRP (Referencias internas):**
- `src/features/rrhh/utils/geo.ts` — reutilizar `distanciaMetros()` tal cual.
- `src/features/rrhh/actions/fichajes-actions.ts` — extender `listFichajes` aquí.
- `src/features/rrhh/data/fichajes.ts` — extender tipo `Fichaje` aquí.
- `supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql` — schema fuente de verdad de los campos geo.

**Nuevos a crear:**
- `src/features/rrhh/utils/fichaje-geo-status.ts`.
- `src/features/rrhh/components/fichajes/geo-badge.tsx`.

## Agentes recomendados

- `ejecutor` para coordinar el tramo.
- `db-admin` solo si aparece duda real sobre RLS del JOIN con `locales`.

## Checklist de cierre

- [ ] `listFichajes` devuelve el contrato extendido con los 10 campos nuevos.
- [ ] Distancias calculadas server-side, `null` cuando faltan coords.
- [ ] `getFichajeGeoStatus` cubre los 4 estados.
- [ ] `<GeoBadge>` renderiza correctamente los 4 estados.
- [ ] Tipo `Fichaje` extendido sin breaking change.
- [ ] `FichajesView` actual sigue funcionando.
- [ ] `npm run typecheck` pasa.
- [ ] Smoke manual de payload extendido OK.

## Modelo de datos propuesto

Sin cambios en BD. Estructura de retorno extendida (TypeScript):

```typescript
export type LocalGeo = {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  radioMetros: number;
  color: string;
};

export type FichajeConGeo = Fichaje & {
  latEntrada: number | null;
  lngEntrada: number | null;
  precisionEntradaMetros: number | null;
  latSalida: number | null;
  lngSalida: number | null;
  precisionSalidaMetros: number | null;
  modoTeletrabajo: boolean;
  local: LocalGeo | null;
  distanciaEntradaMetros: number | null;
  distanciaSalidaMetros: number | null;
};
```

## Interfaces publicas propuestas

```typescript
// src/features/rrhh/actions/fichajes-actions.ts
export async function listFichajes(fecha?: string): Promise<{
  ok: boolean;
  data: FichajeConGeo[];
}>;

// src/features/rrhh/utils/fichaje-geo-status.ts
export type FichajeGeoStatus = 'en-local' | 'teletrabajo' | 'fuera' | 'sin-datos';
export function getFichajeGeoStatus(
  fichaje: Pick<FichajeConGeo, 'latEntrada' | 'lngEntrada' | 'modoTeletrabajo' | 'distanciaEntradaMetros'>,
  local: Pick<LocalGeo, 'lat' | 'lng' | 'radioMetros'> | null
): FichajeGeoStatus;

// src/features/rrhh/components/fichajes/geo-badge.tsx
export function GeoBadge(props: { fichaje: FichajeConGeo }): JSX.Element;
```

## Flujo operativo esperado

1. Leer PRP-037 + archivos referenciados en `Contexto previo obligatorio`.
2. Extender el tipo `Fichaje` en `data/fichajes.ts`.
3. Implementar `getFichajeGeoStatus` en `utils/fichaje-geo-status.ts`.
4. Implementar `GeoBadge` en `components/fichajes/geo-badge.tsx`.
5. Extender `listFichajes` para devolver el contrato extendido con distancias server-side.
6. Verificar que `FichajesView` actual no se rompe.
7. Ejecutar `npm run typecheck` y smoke manual del payload.

## Notas tecnicas

- El cálculo de distancia con `distanciaMetros()` retorna metros como `number`. Para el badge se redondea a entero (`Math.round`).
- Para distancias > 5000m mostrar texto `>5 km` para evitar saturar la columna. Para distancias > 50000m, mostrar nombre de ciudad si se quiere (opcional, no obligatorio en esta task).
- El componente `GeoBadge` debe estar listo para integrarse en la tabla (TASK-002.02), modal (TASK-002.03) y leyenda del mapa (TASK-002.04).

## Siguiente paso sugerido

`Full-TASK-002.02` — integrar `GeoBadge` como columna en la tabla de `FichajesView`.

## Resultado validado

- `npm run typecheck`: ✅ pasa limpio.
- `npm run build`: ✅ pasa (todas las rutas RRHH generadas, incluida `/rrhh/fichajes`).
- Tipo `Fichaje` extendido con campos opcionales geo + nuevo tipo `LocalGeo`.
- `getFichajeGeoStatus` cubre los 4 estados (función pura sin IO).
- `<GeoBadge>` consume `Fichaje` con campos opcionales; renderiza los 4 estados con color + ícono + distancia formateada (`87 m` / `>5 km`).
- `listFichajes` aplicado patrón `createAdminClient + requireAdminFichajes({ empresaIds: [empresaId] })` igual que el fix de TASK-002 para `listEmpleados`.
- JOIN con `locales` vía `locales!local_id(...)`.
- Distancias precomputadas server-side con `distanciaMetros()` ya existente.
- Backward compat: campos snake_case del payload original siguen presentes; `FichajesView.mapDbToFichaje` actual no requiere cambios (los pobla TASK-002.02).
- Smoke UI multi-tenant queda para TASK-002.06 (necesita browser).

## Duracion real

~1.5 h (incluye lectura de contexto, análisis del fix de TASK-002 sobre listEmpleados, implementación y validación).

## Ruta canonica

docs/rrhh-fichajes-geo-audit/Full-TASK-002.01-backend-extension-listfichajes.md
