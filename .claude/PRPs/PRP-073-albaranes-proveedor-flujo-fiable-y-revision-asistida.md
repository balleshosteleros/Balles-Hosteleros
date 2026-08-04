# PRP-073 — Albaranes de proveedor: captura fiable, revisión asistida e integridad de stock

> **Estado:** APROBADO (2026-08-04, Fernando)
> **Fecha:** 2026-07-31
> **Proyecto:** Balles Hosteleros
> **Documento de origen:** `docs/analisis_funcion_albaranes.md`

## Orden de ejecución aprobado

Se ejecuta por etapas, generando los TASKs de cada etapa al arrancarla (no todos de golpe).
Dos cambios respecto al orden literal de las fases: la **Fase 3 se parte en dos** y su
semántica de cantidades (3a) se adelanta por delante de la confirmación transaccional, para
que la transacción de la Fase 4 nazca validando cantidad base y equivalencia.

| Etapa | Fases | Gate de salida |
| --- | --- | --- |
| A — Captura fiable ✅ **EJECUTADA 2026-08-04** (TASK-201..209, migraciones aplicadas, E2E verde: matriz 2/8/12 MB, bloqueo sha, aviso+override de negocio; pendiente solo el gate humano: que Iván repita su prueba) | F1 → F2 | Matriz 2/8/12 MB pasa desde móvil real; Iván repite su prueba fallida; mismo archivo no crea dos albaranes. |
| B — Confirmación segura ✅ **EJECUTADA 2026-08-04** (`confirmar_albaran_transaccional` aplicada y testada en prod: caja×24→72, doble confirm idempotente, contenedora sin equivalencia bloquea con rollback; autosave+conflicto de versión quedan para F5) | F3a (solo cantidades/equivalencias) → F4 | Concurrencia/doble clic = máx. 1 movimiento por línea; fallo de stock mantiene Revisión; recarga conserva decisiones. |
| 🏁 Piloto | — | Los 23 albaranes pendientes de Fernando se suben por móvil y se confirman por el camino nuevo. La fricción observada alimenta el diseño de la etapa C. |
| C — Revisión rápida | F3b (alias + matcher + cuestionario) → F5 | Criterios de las fases 3 y 5. ⚠️ Re-coordinar con Iván antes: pisa `AsistenteAlbaranPanel`/`ResolverLineaDialog`. |
| D — Deuda y cierre | F6 → F7 | Sin llamadas a la Edge Function no versionada; gates finales del PRP. ⚠️ F6 toca la recepción que Iván usa a diario: avisar y elegir ventana. |

Ajustes de validación acordados: en esta máquina no se ejecuta `npm run build` (OOM en WSL) —
el build lo valida el deploy de Vercel; la suite E2E se rebaja a mock determinista del OCR +
Playwright mobile Chromium + matriz manual con teléfonos reales. Migraciones: se escriben y
commitean en su fase, pero ejecutarlas en prod requiere OK explícito de Fernando, una a una.

---

## Objetivo

Completar y endurecer los dos flujos de recepción de albaranes de proveedor —alta libre
por fotografía y recepción vinculada a un pedido— para que una captura móvil sea recuperable,
la revisión de escritorio permita resolver todas las líneas y la confirmación actualice
catálogo, precios y stock de forma trazable, idempotente y transaccional.

La IA seguirá siendo extractiva y asistiva: ninguna coincidencia dudosa podrá modificar
catálogo o existencias sin una decisión humana.

## Por qué

| Problema | Resultado buscado |
| --- | --- |
| La carga móvil transporta el archivo como base64 y puede exceder límites reales aunque la UI lo acepte. | Subida directa a Storage, normalización de imágenes, errores claros y reintento sin repetir todo el proceso. |
| Sesión, empresa activa, RLS o Storage pueden fallar en pasos distintos y dejar poca evidencia. | Importación persistente con estado, código de error, intentos y `traceId`. |
| El mismo documento puede crearse dos veces y duplicar stock. | Huella binaria, identidad de negocio, aviso previo y comprobación final bajo transacción. |
| La confirmación cambia el estado antes de conocer el resultado final del stock. | Una única transacción para validar, registrar precios, generar movimientos y confirmar. |
| El escritorio solo busca entre candidatos y pierde resoluciones locales al recargar. | Búsqueda de catálogo completa, autosave, guardado explícito y control de concurrencia. |
| El alias de proveedor es único y el matcher es principalmente textual. | Alias múltiples por producto y proveedor, contexto de unidad/formato y explicación de sugerencias. |
| La cantidad del documento entra directamente en stock aunque exista formato o conversión. | Cantidad de stock calculada y guardada como snapshot antes de confirmar. |
| La recepción contra pedido depende de una Edge Function no versionada. | Un único servicio OCR server-only, versionado y compartido por ambos flujos. |

**Valor de negocio:** reducir albaranes perdidos o duplicados, evitar descuadres de stock,
acortar la revisión y disponer de evidencia suficiente para diagnosticar fallos móviles reales.

---

## Alcance y decisiones cerradas

### Dentro del alcance

- Alta libre desde `/m/albaranes/subir` y su equivalente de escritorio.
- Recepción móvil y de escritorio vinculada a un pedido.
- Captura, Storage, OCR, matching, revisión, creación de productos de compra, histórico de
  precios, duplicados y entradas de stock.
- Experiencia móvil de captura, corrección básica, reintento y consulta del estado.
- Mesa de control de escritorio para resolver, crear, ignorar y confirmar.
- Observabilidad, permisos, RLS, pruebas automatizadas y prueba real en dispositivos.

### Fuera del alcance

- OCR de facturas y `docs/PRP_ASISTENTE_OCR_LINEAS_NO_RECONOCIDAS.md`, salvo reutilización
  de componentes puros.
- Dirección → Documentación y el archivo documental corporativo.
- Normalizar completamente `albaranes.lineas` desde JSONB a una tabla relacional.
- Recalcular movimientos o saldos de albaranes históricos ya confirmados.
- Aprobar automáticamente coincidencias dudosas.

### Permisos

- `LOGÍSTICA.ver`: consulta de bandeja, detalle, original y trazabilidad.
- `LOGÍSTICA.editar`: capturar, reintentar, guardar revisión, vincular, ignorar, crear un
  producto de compra desde este asistente y confirmar.
- Dirección conserva su bypass de administración.
- Todos los permisos se validan también en servidor; ocultar un botón no es autorización.
- El alta desde el asistente usará un servicio interno de producto y una acción específica
  autorizada por Logística. No se relajará de forma implícita todo el CRUD manual existente.

### Responsabilidad móvil y escritorio

- El móvil debe ser fiable para capturar, corregir cabecera/cantidades/precios, reintentar y
  dejar el albarán en Revisión.
- La creación compleja de catálogo y la resolución de ambigüedades permanecen en escritorio.
- La recepción móvil de un pedido conocido puede confirmar cantidades porque sus productos
  ya están definidos.

---

## Criterios de éxito

- [ ] Ningún archivo viaja como base64 dentro de una Server Action.
- [ ] Una carga interrumpida o un OCR fallido se puede reintentar sobre la misma importación.
- [ ] El usuario recibe un código de error estable y un `traceId`, sin mensajes técnicos crudos.
- [ ] El mismo archivo no puede generar dos albaranes distintos en una empresa.
- [ ] Un posible duplicado de negocio exige abrir el existente o justificar la excepción.
- [ ] Toda revisión parcial sobrevive a recarga, cierre de pestaña y cambio de revisor.
- [ ] El buscador de vinculación consulta todo el catálogo de compra de la empresa.
- [ ] El original privado se puede consultar desde el detalle sin exponer otras empresas.
- [ ] Un usuario con `LOGÍSTICA.editar` puede completar el flujo; uno de solo lectura no puede mutarlo.
- [ ] Ningún producto nuevo queda creado sin su alias/precio cuando la operación informa éxito.
- [ ] Toda línea inventariable tiene producto, cantidad base y conversión resuelta antes de confirmar.
- [ ] Confirmar dos veces o concurrentemente genera como máximo un movimiento por línea.
- [ ] Si falla precio, stock o auditoría obligatoria, el albarán no queda Confirmado.
- [ ] La recepción contra pedido deja de invocar una Edge Function ausente del repositorio.
- [ ] Typecheck, lint, build, pruebas de dominio, integración y E2E pasan.
- [ ] Safari iOS, Chrome Android y PWA instalada completan la matriz de captura acordada.

---

## Comportamiento esperado

### Alta libre

1. El usuario abre una importación y fotografía o selecciona un documento.
2. El cliente valida y normaliza la imagen; el servidor autoriza un path de la empresa activa.
3. El navegador sube directamente al bucket privado.
4. El servidor valida el objeto real y ejecuta OCR desde Storage.
5. Si falla, la importación queda en `error`, conserva archivo/contexto y ofrece reintentar.
6. El usuario corrige cabecera y líneas; el sistema busca proveedor y posibles duplicados.
7. Al guardar se crea un albarán en Revisión y se vincula el original ya almacenado.
8. En escritorio se resuelven producto, unidad, formato, IVA y precio pendientes.
9. La confirmación transaccional registra precios, entradas de stock, auditoría y estado.

### Recepción vinculada a pedido

1. La importación se crea con `pedidoId` y usa el mismo transporte y extractor.
2. El resultado OCR se compara con las líneas conocidas del pedido.
3. La persona ajusta cantidades recibidas; la foto continúa siendo opcional.
4. Una restricción impide recepcionar dos veces el mismo pedido.
5. La confirmación utiliza el mismo dominio transaccional de stock.

---

## Contexto verificado

### Código existente a preservar o evolucionar

- `src/features/logistica/hooks/use-subir-albaran.ts`: máquina de estados compartida.
- `src/features/logistica/mobile/components/SubirAlbaranMobile.tsx`: captura móvil libre.
- `src/features/logistica/mobile/components/RecepcionAlbaranMobile.tsx`: recepción de pedido.
- `src/features/logistica/actions/asistente-albaran-actions.ts`: OCR, matching y resolución.
- `src/features/logistica/actions/albaranes-actions.ts`: CRUD, adjuntos y transición de estado.
- `src/features/logistica/components/albaranes/AsistenteAlbaranPanel.tsx`: revisión.
- `src/features/logistica/components/albaranes/ResolverLineaDialog.tsx`: vincular/crear/ignorar.
- `src/features/logistica/components/pedidos/DetalleAlbaran.tsx`: detalle y OCR comparativo.
- `src/features/logistica/services/entradas-stock-por-albaran.ts`: entrada de stock.
- `src/features/logistica/services/kardex.ts`: movimientos y saldo materializado.
- `src/features/logistica/lib/albaranes/emparejar-catalogo.ts`: matcher actual.
- `src/features/logistica/actions/catalogos-estandar-actions.ts`: medidas, formatos y equivalencias.
- `src/features/auth/lib/permisos.ts`: fuente canónica de permisos por módulo.

### Hechos que condicionan la solución

- La UI acepta actualmente 20 MB y `next.config.ts` limita Server Actions a 14 MB; base64
  incrementa el tamaño aproximadamente un tercio.
- `browser-image-compression` ya está instalado.
- El bucket `logistica-albaranes` es privado, pero sus policies actuales solo consultan
  `usuarios`; deben cubrir de forma coherente la pertenencia multiempresa y la empresa activa.
- El documento se adjunta después de crear el albarán, por lo que hoy puede quedar un registro
  sin original.
- `getDocumentoAlbaranSignedUrl` existe, pero el detalle no lo ofrece de forma visible.
- `resolverAlbaranRevision(..., false)` permite persistencia parcial, pero la UI no la usa.
- `createProducto` exige Dirección; el asistente necesita autorización específica de Logística.
- Ya existen `medidas`, `formatos.equivalencias`, `productos.unidad_uso` y
  `productos.factor_conversion`; deben reutilizarse.
- `aplicarEntradasAlbaran` suma actualmente `cantidad` sin aplicar el formato del documento.
- `updateAlbaranEstado` puede devolver éxito con aviso después de haber cambiado el estado y
  fallado el stock; la nueva confirmación debe ser atómica.
- La recepción de pedido invoca `supabase.functions.invoke("analizar-albaran")`, pero el código
  de esa función no está en `supabase/functions`.

---

## Contratos de aplicación

Los nombres son el contrato objetivo. Podrán agruparse físicamente en actions y services,
pero no deben mezclarse autorización, transporte del fichero y lógica de dominio.

### Importación

```ts
type FlujoImportacionAlbaran = "libre" | "pedido";
type EstadoImportacionAlbaran =
  | "pendiente_subida"
  | "subido"
  | "analizando"
  | "revisable"
  | "error"
  | "finalizado";

type ErrorImportacionAlbaran =
  | "AUTH_EXPIRED"
  | "NO_ACTIVE_COMPANY"
  | "UNSUPPORTED_MEDIA"
  | "FILE_TOO_LARGE"
  | "UPLOAD_FAILED"
  | "OCR_FAILED"
  | "OCR_EMPTY"
  | "PERSIST_FAILED";
```

- `iniciarImportacionAlbaran({ flujo, pedidoId?, fileName, mimeType, size })`
  devuelve `importacionId`, path y credencial de subida firmada.
- `completarSubidaAlbaran({ importacionId })` valida objeto, MIME, tamaño y huella.
- `analizarImportacionAlbaran({ importacionId })` ejecuta OCR desde Storage.
- `reintentarImportacionAlbaran({ importacionId })` reusa archivo y aumenta intentos.
- Todas las respuestas fallidas devuelven `{ errorCode, message, traceId, retryable }`.

### Revisión y resolución

- `buscarProductosCompra({ query, page, pageSize, proveedorId? })` busca de forma paginada
  y acotada a empresa; los seis candidatos son sugerencias iniciales, no el universo posible.
- `guardarRevisionAlbaran({ albaranId, version, cabecera, resoluciones })` persiste parcialmente
  y devuelve la nueva versión, autor y hora.
- `crearProductoCompraDesdeAlbaran({ albaranId, lineaId, datos, version })` crea producto,
  relación/alias, precio y resolución en una operación atómica.
- `confirmarAlbaranRevision({ albaranId, version, duplicateOverride? })` ejecuta la transición
  transaccional completa.
- `getDocumentoAlbaranSignedUrl({ albaranId, documentoId })` resuelve internamente el path;
  el cliente nunca firma un path arbitrario.

---

## Modelo de datos objetivo

### `albaran_importaciones`

- `id`, `empresa_id`, `created_by`, timestamps.
- `flujo`, `pedido_id`, `albaran_id`, `estado`.
- `storage_path`, `file_name`, `mime_type`, `size_bytes`, `archivo_sha256`.
- `ocr_resultado jsonb`, `intentos`, `error_code`, `error_message`, `trace_id`.
- Índice único por empresa y `archivo_sha256` cuando la importación haya producido albarán.
- RLS por pertenencia a empresa; escrituras sensibles mediante servicios autorizados.

### `albaran_eventos`

- `empresa_id`, `albaran_id`, `importacion_id`, `actor_id`, `tipo`, `payload jsonb`, timestamp.
- Append-only para carga, OCR, retry, asignación, guardado, resolución, excepción de duplicado,
  confirmación y reversión.
- `payload` no contendrá fichero, base64 ni secretos.

### Cambios en `albaranes`

- Reutilizar `proveedor_id` como identidad y `proveedor_nombre` como snapshot.
- `importacion_id`, `revision_version`, `revision_guardada_at`, `revision_guardada_por`.
- `responsable_id`, `posible_duplicado_de`, `duplicado_override_motivo` y actor/fecha del override.
- Restricción única parcial para un solo albarán por `pedido_id` no nulo.

### `producto_proveedor_aliases`

- `empresa_id`, `producto_id`, `proveedor_id`, `alias`, `alias_normalizado`, `referencia`.
- Varios alias por producto/proveedor.
- Un alias normalizado solo puede identificar un producto dentro del mismo proveedor y empresa.
- Migrar `productos.nombre_proveedor` solo cuando proveedor y producto se resuelvan sin ambigüedad.
- Mantener la columna antigua como fallback de lectura durante una versión; dejar de escribirla.

### Snapshot de línea JSONB

Cada línea nueva o revisada conservará:

```ts
interface LineaAlbaranRevision {
  id: string;
  productoId: string | null;
  nombreProveedor: string;
  cantidadDocumento: number;
  unidadDocumento: string | null;
  formatoDocumento: string | null;
  precioUnitarioDocumento: number | null;
  importeDocumento: number | null;
  ivaDocumento: 0 | 4 | 10 | 21 | null;
  unidadStock: string | null;
  formatoId: string | null;
  equivalenciaAplicada: number | null;
  cantidadStock: number | null;
  ignorada: boolean;
}
```

Regla: `cantidadStock = cantidadDocumento × equivalenciaAplicada`. Si el documento ya usa la
unidad base, la equivalencia es 1. Una línea no ignorada no se confirma sin producto, cantidad
positiva, unidad base y equivalencia.

---

## Política de duplicados

1. **Mismo SHA-256:** bloqueo. Se ofrece abrir el albarán/importación existente.
2. **Mismo proveedor + número normalizado:** candidato fuerte, aunque fecha o total difieran.
3. **Sin número fiable:** proveedor + fecha + total + resumen normalizado de líneas.
4. **Excepción:** solo `LOGÍSTICA.editar`, motivo obligatorio y evento de auditoría.
5. **Carreras:** la misma evaluación se repite bajo bloqueo al confirmar.

No se impondrá una restricción dura sobre el número del proveedor porque puede repetirse entre
ejercicios o contener errores; la huella exacta y el bloqueo transaccional aportan la garantía.

---

## Matching y cuestionario adaptativo

Orden de evidencia:

1. Alias exacto del mismo proveedor.
2. Referencia exacta del proveedor.
3. Nombre interno/alias aproximado compatible con unidad y formato.
4. Historial de precios como explicación y ordenación, nunca como decisión aislada.

Solo un alias/referencia exactos o una puntuación alta sin conflicto de proveedor, unidad y
formato pueden autovincular. El resto requiere confirmación.

Al crear producto:

- Nombre y proveedor se proponen desde OCR/cabecera.
- Categoría no selecciona automáticamente la primera opción.
- IVA no selecciona automáticamente el último valor de la lista.
- Precio ausente permanece `null`; no se convierte en 0.
- Unidad, formato y equivalencia deben resolverse antes de que el producto controle stock.
- Cada propuesta muestra su origen y confianza; solo se pregunta lo que siga sin resolver.

---

## Blueprint (Assembly Line)

> Solo se definen fases. Los TASKs se generarán después de aprobar este PRP y deberán mantener
> las dependencias, validaciones y criterios de corte indicados aquí.

### Fase 1 — Base fiable de importación y observabilidad

**Objetivo:** crear importaciones/eventos, códigos de error, subida firmada directa, validación
real de archivo, normalización de imágenes, reintentos y políticas Storage multiempresa.

**Validación:** JPEG pequeño/grande, PDF, HEIC soportado/no soportado, sesión caducada, empresa
secundaria y red interrumpida terminan en éxito o error recuperable sin albaranes huérfanos.

### Fase 2 — Identidad de proveedor y prevención de duplicados

**Objetivo:** poblar `proveedor_id`, calcular fingerprints, mostrar coincidencias antes de crear,
registrar excepciones y añadir la protección única de `pedido_id`.

**Validación:** el mismo archivo no crea dos albaranes; las coincidencias de negocio requieren
decisión explícita; el backfill genera informe y no adivina proveedores ambiguos.

### Fase 3 — Catálogo, matcher y semántica de cantidades

**Objetivo:** alias por proveedor, matcher contextual, cuestionario adaptativo y snapshots de
unidad/formato/equivalencia. Crear producto + precio + alias debe ser atómico.

**Validación:** cajas, unidades, kilos y litros generan la cantidad base esperada; un formato
ambiguo bloquea; no hay categorías, IVA o precios inventados.

### Fase 4 — Guardado y confirmación transaccional

**Objetivo:** persistencia parcial con versión optimista y una función transaccional que bloquee
el albarán/stock, revalide todo, registre precios/movimientos/eventos y cambie el estado al final.

**Validación:** recarga conserva decisiones; un revisor desactualizado recibe conflicto; fallo de
precio/stock mantiene Revisión; doble clic o concurrencia no duplica movimientos.

### Fase 5 — Mesa de revisión de escritorio

**Objetivo:** original y líneas lado a lado, búsqueda total, autosave + botón Guardar revisión,
último guardado, asignación, filtros, explicación de candidatos y permisos completos.

**Validación:** se puede vincular un producto no sugerido, el original se abre con URL firmada,
el trabajo se recupera al recargar y un usuario de solo lectura no puede cambiar nada.

### Fase 6 — Convergencia de recepción contra pedido y móvil

**Objetivo:** eliminar la dependencia de la Edge Function ausente; ambos flujos usan importación,
OCR, adjunto, errores y confirmación comunes. Añadir estado/reintento en móvil.

**Validación:** recepción con foto, sin foto, con diferencias y tras fallo de red funciona sin
`supabase.functions.invoke("analizar-albaran")`.

### Fase 7 — Productividad, QA y despliegue gradual

**Objetivo:** teclado y acciones masivas seguras, pruebas de dominio/integración/E2E, piloto y
retirada del camino antiguo tras cumplir los gates.

**Validación:** todos los criterios de éxito y la matriz final se cumplen antes de activar para
todas las empresas.

---

## Plan de pruebas

### Dominio

- Normalización de proveedor, número y alias.
- SHA-256 y claves de duplicado con/sin número.
- Matcher: alias exacto, referencia, similitud, incompatibilidad de unidad y empate.
- Conversión de caja/unidad/kg/L y snapshot inmutable.
- `null` frente a precio o IVA cero.

### Integración con Supabase

- RLS positiva y negativa para empresa principal, empresa asociada y empresa ajena.
- Subida firmada, validación, URL de lectura y limpieza de importaciones huérfanas.
- Guardado optimista con conflicto de versión.
- Producto + alias + precio: todo o nada.
- Confirmación y reversión con bloqueo de stock e idempotencia.
- Unicidad de recepción por pedido.

### E2E automatizado

- Playwright Desktop Chromium: búsqueda total, original, guardar, recargar y confirmar.
- Playwright Mobile Chromium y WebKit: foto/archivo, errores, retry y estado final.
- Mock determinista del proveedor OCR para CI; Gemini real solo en smoke controlado.
- Fixtures sin datos sensibles: JPEG, PNG, WebP, HEIC, PDF y documentos duplicados.

### Matriz manual obligatoria

- Safari iOS y Chrome Android, tanto navegador como PWA instalada.
- Imagen original aproximada de 2, 8 y 12 MB.
- PDF válido, formato rechazado, sesión vencida, empresa secundaria y conectividad inestable.
- Al menos 20 albaranes de tres proveedores en el piloto de BACANAL.
- Verificación en BD: documento, alias/precio, evento, cantidad base, movimiento y saldo.

### Validación técnica final

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Pruebas de dominio e integración
- [ ] Playwright desktop + mobile
- [ ] No quedan llamadas a la Edge Function no versionada
- [ ] No quedan documentos base64 enviados por Server Actions

---

## Compatibilidad y despliegue

- Migraciones aditivas, idempotentes y versionadas en `supabase/migrations`.
- No recalcular albaranes Confirmados históricos.
- Para albaranes antiguos en Revisión, asumir equivalencia 1 únicamente si la unidad coincide
  con la base; los demás deben revisarse.
- Backfills de proveedor/alias solo con coincidencia inequívoca y con informe de descartes.
- Mantener lectura legacy de `nombre_proveedor` una versión; dejar de escribirlo desde el nuevo flujo.
- Mantener el nuevo flujo desactivable hasta completar la confirmación transaccional.
- Piloto inicial en BACANAL sin IDs hardcodeados en la aplicación.
- Activación general solo tras 20 documentos piloto, matriz móvil y cero inconsistencias de stock.

---

## Gotchas

- [ ] Una URL firmada de subida no sustituye la autorización previa de usuario y empresa activa.
- [ ] Validar magic bytes; `file.type` y la extensión no son confiables.
- [ ] No registrar base64, URLs firmadas, OCR completo ni secretos en logs.
- [ ] No usar `productos.nombre_proveedor` como identidad canónica nueva.
- [ ] No recalcular históricos al cambiar equivalencias de formatos.
- [ ] El precio del documento puede ser por formato mientras el stock usa unidad base; conservar ambos.
- [ ] `controla_stock=false` puede producir una confirmación válida sin movimiento para esa línea.
- [ ] La transacción debe bloquear filas de stock para evitar pérdidas de actualización concurrentes.
- [ ] La excepción de duplicado no puede existir solo en cliente; debe validarse y auditarse en servidor.
- [ ] La captura de pedido sin foto debe seguir disponible como contingencia operativa.

## Anti-patrones

- NO aumentar únicamente `bodySizeLimit` para ocultar el problema de transporte.
- NO crear el albarán antes de disponer de una importación persistente y recuperable.
- NO confirmar estado y ejecutar stock como operaciones independientes.
- NO considerar el aviso de stock como una confirmación correcta.
- NO ofrecer como “buscador” una lista local de seis candidatos.
- NO elegir categoría, IVA, unidad o formato por posición en una lista.
- NO usar el precio como prueba suficiente de identidad de producto.
- NO implementar permisos solo ocultando controles en React.
- NO mantener dos extractores OCR con contratos distintos.
- NO introducir TASKs antes de aprobar este PRP.

---

## Aprendizajes (Self-Annealing)

> Esta sección crecerá durante la ejecución. Cada aprendizaje deberá registrar error, causa,
> corrección, prueba que evita la regresión y otros puntos del sistema donde aplica.

---

*PRP aprobado el 2026-08-04. Los TASKs se generan etapa a etapa según el orden de ejecución aprobado (ver cabecera).*
