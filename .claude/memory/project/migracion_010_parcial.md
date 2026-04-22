---
name: Migración 010 aplicada solo parcialmente en Supabase
description: De las 25 tablas que declara 010_features_restantes.sql, sólo 3 llegaron a la BD (fichas_tecnicas, ingredientes_ficha, stock). El resto hay que crearlas de cero con tipos correctos.
type: project
---

La migración `010_features_restantes.sql` sólo aplicó sus **primeras 3 tablas** en la BD real; el resto nunca entraron.

**Tablas de 010 que NO existen en BD (2026-04-21):**
- `elaboraciones`, `partidas`, `equipos_frio`, `registros_temperatura`
- `inventarios`, `lineas_inventario`
- `contactos_contabilidad`, `facturas`, `transacciones`, `documentos`
- `descuentos`, `vencimientos`, `encuestas`, `presentaciones`
- `procesos_juridicos` (resuelto por 045)
- `publicaciones`
- `plantillas_boarding`, `procesos_boarding`, `bonus`, `turnos`, `ausencias`, `candidatos`

**Why:** Probable que la migración 010 falló a mitad (tamaño ~800 líneas, múltiples FK encadenadas con `empresa_id text`). Los módulos que hoy funcionan (cocina fichas, POS, carta, marketing páginas, gestoría modelos, cocina comandas, logística compras, rrhh empleados) tienen migraciones propias posteriores (026+). Los módulos que aún muestran sólo mocks casi seguro dependen de tablas de 010 que nunca llegaron.

**How to apply:** Antes de implementar cualquier feature de los módulos listados, verificar con `fetch($url/rest/v1/)` si la tabla está expuesta por PostgREST. Si no, crear una migración nueva siguiendo el patrón de 038/045 (empresa_id uuid, no text). No intentar re-aplicar 010 completa — sus FK y tipos no coinciden con la BD actual.
