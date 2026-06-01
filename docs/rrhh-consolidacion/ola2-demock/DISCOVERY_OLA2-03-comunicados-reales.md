# DISCOVERY OLA2-03 - Comunicados reales

Fecha: 2026-06-01
Repo: `Balles-Hosteleros`
Plan origen: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
Task: OLA2-03 (de-mock de Comunicados en Gerencia)

## Metodo

Verificacion con el codigo y el SQL como verdad (no con la documentacion):

- Lectura de la vista admin: `src/features/gerencia/components/ComunicadosView.tsx` (925 lin).
- Lectura del mock: `src/features/rrhh/data/comunicados.ts` (64 lin).
- Lectura de las server actions ya existentes: `src/features/gerencia/actions/comunicados-actions.ts` (194 lin).
- Lectura del consumidor real lado empleado: `src/features/mi-panel/actions/mi-panel-actions.ts::listarComunicadosVisibles()` (lin 403-477) y `getMiPanelResumen()`.
- Lectura del helper de notificaciones: `src/features/mi-panel/mobile/lib/push-comunicado.ts`.
- Lectura del resolutor de empresa activa: `src/features/empresa/lib/empresa-server.ts::getEmpresaActivaForUser()`.
- Lectura de las 3 migraciones reales: `supabase/migrations/009_operativa_diaria.sql`, `052_comunicados_destinatarios.sql`, `093_fix_canales_comunicados_empresa_id.sql`.
- Localizacion de ficheros con `wsl -d Ubuntu bash -c "find ... -name ..."` (NON-login, `grep`/`find`; Glob no recorre `supabase/migrations` sobre la ruta UNC).

NOTA: no se ha ejecutado Management API contra produccion. El schema declarado abajo proviene del SQL versionado. Antes de escribir/migrar hay que **VERIFICAR SCHEMA REAL via Management API** (regla del proyecto: las migraciones pueden no reflejar el prod real).

## Estado real (corrige el supuesto del brief)

El brief asumio "el ADMIN crea/gestiona sobre un mock paralelo". El estado real es mas matizado y **el de-mock es mas pequeno de lo previsto**:

1. **La capa de escritura YA es real.** `src/features/gerencia/actions/comunicados-actions.ts` existe y expone CRUD completo contra `public.comunicados`:
   - `listComunicados()` -> `select("*")` filtrado por `empresa_id` (UUID).
   - `createComunicado(input)` -> `insert(...)` con `empresa_id` + `creador_id`; dispara push (`notificarComunicadoNuevo`) si `estado === "publicado"`.
   - `updateComunicado(id, input)` -> `update(...)`; push solo en transicion borrador -> publicado.
   - `deleteComunicado(id)` -> `delete()`.
   - `listEmpleadosParaComunicado()` -> empleados reales desde `profiles` (identidad real).

2. **`ComunicadosView` YA llama a las actions reales al guardar.** `saveEditor()` (lin 686-728) construye un `payload` real y ejecuta `createComunicado`/`updateComunicado`. El selector de empleados destinatarios (`empleadosReales`) tambien es real (`listEmpleadosParaComunicado`).

3. **El gap real es la LECTURA/listado.** `loadComunicados()` (lin 604-619) llama a `listComunicados()` pero **descarta a proposito** el resultado y pinta el mock, con el comentario explicito:
   ```ts
   if (res.ok && res.data.length > 0) {
     // DB has data but shape is flat; use mock for rich nested data
     setComunicados(getComunicadosByEmpresa(empresaId));
   } else {
     setComunicados(getComunicadosByEmpresa(empresaId));
   }
   ```
   Es decir: **siempre** renderiza el mock (`getComunicadosByEmpresa`), nunca los datos reales. Las KPI cards, la tabla, el calendario y el editor de edicion se alimentan del mock.

4. **El lado empleado SI lee real** desde hace tiempo (`listarComunicadosVisibles`), aplicando visibilidad por `toda_empresa` / `empleados_destinatarios` / `departamentos_destinatarios` / `roles_destinatarios` y excluyendo `borrador`/`archivado`. Por tanto **Gerencia y empleado ven universos distintos**: el empleado ve lo que Gerencia ya graba real (al guardar), pero Gerencia se ve a si misma el mock. Inconsistencia visible.

5. **Acciones de fila muertas.** En el dropdown de la tabla (lin 890-899) "Duplicar", "Programar", "Archivar" y "Eliminar" no tienen `onClick` -> botones decorativos. "Ver / Editar" si funciona.

## Causa raiz del bloqueo (por que se quedo en mock la lectura)

La fila real (`comunicados`) es **plana**; el mock (`Comunicado`) es **anidado y enriquecido**. La UI fue construida contra la forma del mock y faltaba el **mapper fila-plana -> ViewModel** + el calculo de los campos derivados que la fila no tiene. En concreto, la UI espera y la BD no aporta directamente:

| Campo UI (mock `Comunicado`) | En BD `comunicados` | Accion necesaria |
| --- | --- | --- |
| `creadoEl` (string "YYYY-MM-DD HH:mm") | `created_at timestamptz` | mapear/formatear |
| `envio` (string) | `envio timestamptz` | mapear/formatear |
| `recurrencia` | `recurrencia text` | mapear (mismo dominio) |
| `rolesDestinatarios: string[]` | `roles_destinatarios text[]` | mapear snake->camel |
| `todaEmpresa` | `toda_empresa bool` | mapear |
| `destinatarios: {empresas, departamentos, empleados}` (contadores) | **no existe** | **derivar** de `toda_empresa` + longitudes de los `*_destinatarios` (y/o resolver headcount real) |
| `alcancePct` | `alcance_pct int` (existe pero **nunca se escribe**, siempre 0) | mostrar 0 honesto o derivar de push/lecturas (fuera de alcance) |
| `creadorId` | `creador_id uuid` | mapear |
| `prioridad`, `estado`, `titulo`, `asunto`, `cuerpo`, `observaciones` | iguales | mapear directo |

El de-mock consiste en **reemplazar el mock por el resultado real mapeado**, no en disenar tabla nueva.

## Schema real verificado (de las 3 migraciones)

### `public.comunicados` (creada en 009, ampliada en 052, retipada en 093)

| Columna | Tipo declarado | Origen | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` | 009 | dbId real; el mock usa ids "hc1"/"bc1" (slug-like) -> usar `id` |
| `empresa_id` | **`uuid`** NOT NULL, FK -> `empresas(id)` ON DELETE CASCADE | 009 (era `text`) -> **093** lo convirtio a `uuid` + FK | clave del fix 093 (antes mezclaba slug vs uuid) |
| `titulo` | `text` NOT NULL | 009 | |
| `asunto` | `text` (nullable) | 009 | |
| `cuerpo` | `text` (nullable) | 009 | el empleado lo lee como `contenido` |
| `estado` | `text` NOT NULL default `'borrador'` | 009 | dominio efectivo: borrador / programado / publicado / archivado (sin CHECK en BD) |
| `prioridad` | `text` NOT NULL default `'normal'` | 009 | sin CHECK (baja/normal/alta/urgente por convencion UI) |
| `recurrencia` | `text` NOT NULL default `'sin_repeticion'` | 009 | sin CHECK |
| `toda_empresa` | `boolean` NOT NULL default `true` | 009 | |
| `roles_destinatarios` | `text[]` NOT NULL default `'{}'` | 009 | GIN index (052) |
| `empleados_destinatarios` | **`uuid[]`** NOT NULL default `'{}'` | **052** | IDs de `auth.users`; GIN index |
| `departamentos_destinatarios` | `text[]` NOT NULL default `'{}'` | **052** | GIN index |
| `envio` | `timestamptz` (nullable) | 009 | fecha/hora de envio programado |
| `alcance_pct` | `integer` NOT NULL default `0` | 009 | nunca escrito por la app -> hoy siempre 0 |
| `observaciones` | `text` (nullable) | 009 | notas internas |
| `creador_id` | `uuid` FK -> `profiles(user_id)` ON DELETE SET NULL | 009 | la action lo rellena con `user.id` |
| `created_at` | `timestamptz` NOT NULL default `now()` | 009 | |
| `updated_at` | `timestamptz` NOT NULL default `now()` | 009 | la action lo setea a mano en update |

OBSERVACION: NO hay tabla hija de destinatarios. Pese al nombre del fichero `052_comunicados_destinatarios.sql`, los destinatarios viven **inline** en columnas array de la propia `comunicados` (`roles_destinatarios`, `empleados_destinatarios`, `departamentos_destinatarios`). No existe `comunicados_destinatarios` como tabla. El brief lo describio como "tabla de destinatarios"; en realidad son **3 columnas array**.

### RLS real (definida en 093, sustituye a la de 009)

```sql
CREATE POLICY "comunicados_read" ON public.comunicados FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "comunicados_write" ON public.comunicados FOR ALL TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));
```

- **Multi-tenant correcto** para lectura y escritura (filtra por `empresa_id` del profile). El fix 093 elimino la version laxa `using(true)` que tenia 009 para `comunicados_write`.
- **Pero el write NO tiene gating por rol**: cualquier usuario `authenticated` de la empresa puede crear/editar/borrar comunicados (no solo Gerencia/Director). El `creador_id` se graba pero no se exige. Es una decision de negocio a confirmar (ver D-OLA2-03-A en el Full-TASK).
- `FOR ALL` cubre INSERT/UPDATE/DELETE; correcto para CRUD admin.

## Slug vs UUID (riesgo 2 del plan): estado

- `useEmpresa().empresaActual.id` = **slug** ("habana"/"bacanal"). `ComunicadosView` usa ese slug solo para el **mock** (`getComunicadosByEmpresa(empresaId)`).
- Las actions reales NO reciben el slug: `comunicados-actions.getContext()` resuelve el `empresa_id` con `getEmpresaActivaForUser()`, que devuelve **UUID** (cookie validada contra UUID_RE o `profiles.empresa_id`, que es uuid). Verificado en `empresa-server.ts`.
- Conclusion: el riesgo slug/uuid **ya esta resuelto server-side**. Al de-mockear la lectura hay que asegurar que la UI deja de usar `empresaActual.id` como clave y confia en el scope de la action (que ya es por UUID). No hace falta pasar `dbId` desde el cliente porque la action lo deriva del profile/cookie.

## Inventario de lo que sigue mock o muerto

| Elemento | Estado | Accion OLA2-03 |
| --- | --- | --- |
| Escritura (create/update) | REAL (ya cableada) | conservar; reusar |
| Lectura/listado | MOCK (descarta BD a proposito) | **de-mockear**: mapper + render real |
| KPI cards (total/publicados/programados/alcance) | MOCK (sobre array mock) | recomputar sobre datos reales |
| Calendario (mensual/anual) | MOCK | alimentar con datos reales (usa `envio`) |
| `alcance_pct` | columna real, nunca escrita (0) | mostrar 0 honesto (no inventar) |
| Dropdown "Archivar" | muerto (sin handler) | implementar via `updateComunicado(estado:'archivado')` |
| Dropdown "Eliminar" | muerto | implementar via `deleteComunicado` (+confirm) |
| Dropdown "Duplicar" | muerto | opcional (clonar payload -> create) |
| Dropdown "Programar" | muerto | opcional (atajo a estado programado) |
| RLS write por rol | sin gating | decision de negocio (D-OLA2-03-A) |
| `src/features/rrhh/data/comunicados.ts` (mock) | fuente funcional de la vista | retirar como fuente; conservar solo labels/tipos si se reutilizan |

## Riesgos detectados

- **R1 (mapper):** la UI espera campos que la fila no tiene (`destinatarios` contadores, `creadoEl`, `alcancePct`). Sin mapper robusto, la tabla rompe (undefined). Riesgo medio.
- **R2 (alcance ficticio):** el mock muestra `alcancePct` 60/85/100 %. La BD no lo calcula. Mostrarlo real (0 %) puede "verse peor" pero es honesto (criterio global del plan). No inventar.
- **R3 (RLS write sin rol):** hoy cualquier empleado de la empresa puede escribir comunicados. Endurecer puede romper el alta si el creador no es Director/Gerencia. Coordinar con la decision de negocio antes de cerrar.
- **R4 (estados sin CHECK):** `estado`/`prioridad`/`recurrencia` son `text` libres en BD. La UI debe validar el dominio (ya hay enums TS); no confiar en la BD.
- **R5 (slug residual):** si queda algun punto que siga pasando `empresaActual.id` (slug) a una query real, devolveria 0 filas (uuid != slug). Auditar que solo el mock usa el slug.
- **R6 (push doble):** `createComunicado` y `updateComunicado` ya disparan push. Al implementar "publicar/archivar" reutilizando esas actions, vigilar no duplicar notificaciones (la logica ya evita spam: solo borrador->publicado).
- **R7 (schema prod != SQL):** otras tablas del proyecto se crearon a mano en prod. Verificar `comunicados` real con Management API antes de tocar (especialmente que `empresa_id` es uuid y que existen las 3 columnas array de 052).

## Conclusion

OLA2-03 es de complejidad **Baja-Media** y **menor de lo que el brief sugeria**: NO hay que disenar tabla ni reescribir la escritura. El trabajo es:
1. De-mockear la **lectura** (mapper fila-plana -> ViewModel + render real en tabla/KPIs/calendario/editor).
2. Implementar los **handlers muertos** (archivar/eliminar; opcional duplicar/programar) sobre las actions reales que ya existen.
3. Retirar `data/comunicados.ts` como fuente funcional (conservar labels/tipos si se reutilizan).
4. Decidir y, si procede, endurecer **RLS write por rol** (decision de negocio).
5. Verificar schema prod via Management API antes de tocar.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-03-comunicados-reales.md
