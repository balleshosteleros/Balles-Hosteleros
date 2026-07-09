# PRP-072: Almacén de modelos fiscales de gestoría (PDF adjunto por modelo)

> **Estado**: PENDIENTE
> **Fecha**: 2026-07-09
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Almacenar en el software los 48 PDFs de modelos fiscales de gestoría (ya descargados en `/gestoria`) de BACANAL y HABANA, reutilizando la tabla existente `modelos_aeat`, con un bucket privado Supabase por empresa, de modo que en el submódulo Gestoría → Modelos cada recuadro muestre un icono clicable que abra el PDF adjunto mediante URL firmada temporal, incluyendo siempre PYG y Balance de Situación como huecos anuales por ejercicio aunque el PDF no exista todavía.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los modelos fiscales viven sueltos en disco/gestoría; no hay acceso desde el software ni trazabilidad por empresa | Se suben a un bucket privado por empresa y se enlazan a la fila `modelos_aeat` correspondiente |
| El submódulo Modelos calcula/edita pero no permite consultar el documento oficial presentado por la gestoría | Cada recuadro gana un icono que abre el PDF real vía `createSignedUrl` en pestaña nueva |
| Faltan tipos de documento anual (Sociedades 200, PYG, Balance) en el catálogo del submódulo | Se amplía el enum `modelo_aeat_tipo` y los tipos anuales aparecen SIEMPRE como parte de cada ejercicio, con o sin PDF |

**Valor de negocio**: Dirección y gestoría consultan el modelo oficial presentado desde un único sitio, por empresa y ejercicio, sin buscar en carpetas; sienta la base para el PRP posterior de extracción/parseo de datos a BD.

## Qué

### Criterios de Éxito
- [ ] Existe bucket privado `modelos-aeat-pdf`, MIME `application/pdf`, con policies RLS por empresa (patrón 096) — path `<empresa_id>/<ejercicio>/<periodo>/<tipo>_<timestamp>.pdf`.
- [ ] El enum `modelo_aeat_tipo` admite además de los existentes: `200`, `190`, `PYG`, `BALANCE`, `LIBRO_MAYOR` (los que aportan los ficheros de `/gestoria`).
- [ ] Los 48 PDFs de `/gestoria` (BACANAL + HABANA, sin HOSTELBAR) están subidos y cada uno tiene su fila en `modelos_aeat` con `pdf_url` apuntando al path.
- [ ] En la vista de Modelos, cada recuadro con `pdf_url` muestra un icono clicable que abre el PDF vía URL firmada temporal en pestaña nueva.
- [ ] En los ejercicios anuales, PYG, Balance de Situación y Libro Mayor aparecen SIEMPRE por año para ambas empresas, aunque no exista PDF (fila placeholder sin `pdf_url` = hueco a rellenar).
- [ ] Junto al selector de ejercicio hay un icono de ajustes (patrón universal de configuración de submódulo) que abre la configuración propia de Modelos, con: (1) tipos de modelo visibles por empresa y (2) recordatorios de plazos de presentación (opt-in).
- [ ] La server action de subida sigue el patrón `subirDocumentoAlbaran` (getAppContext → upload → guardar path → compensación si falla).
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path (consulta):** Usuario entra en Gestoría → Modelos, elige empresa y ejercicio. Ve los recuadros trimestrales (303/111/…) y la sección anual (390/347/200/PYG/Balance). Cada recuadro con documento adjunto muestra un icono de PDF; al hacer clic se genera una URL firmada temporal (`createSignedUrl`, ~10 min) y el PDF se abre en pestaña nueva. Los recuadros PYG y Balance de cada año aparecen aunque no tengan PDF, marcados como hueco pendiente.

**Happy path (subida masiva inicial):** Un script de carga (patrón `apply-migration-*.ts` con service_role) recorre `/gestoria/{BACANAL,HABANA}/<año>/<periodo>/*.pdf`, mapea cada fichero a `{empresa_id, ejercicio, periodo, tipo}`, lo sube al bucket con el path canónico y hace upsert de la fila `modelos_aeat` con `pdf_url`. HOSTELBAR se excluye.

---

## Contexto

### Referencias
- `supabase/migrations/041_gestoria_modelos_aeat.sql` — tabla `modelos_aeat` (ya tiene `pdf_url` y `fichero_aeat_url`), enums `modelo_aeat_tipo` / `modelo_aeat_periodo`, RLS por empresa vía `profiles`.
- `supabase/migrations/096_documentos_storage.sql` — patrón de bucket privado + policies RLS por empresa con `storage.foldername(name)[1]` = `empresa_id`, whitelist MIME, upsert del bucket.
- `src/features/logistica/actions/albaranes-actions.ts` (líneas 258–329) — patrón `subirDocumentoAlbaran` (upload → guardar path → `remove()` de compensación si falla) y `getDocumentoAlbaranSignedUrl` (`createSignedUrl(path, 60*10)`).
- `src/lib/supabase/get-context.ts` — `getAppContext()` (supabase, userId, empresaId por empresa activa).
- `src/features/gestoria/modelos/actions/modelos-actions.ts` — `listModelos`, `asegurarModelosDelPeriodo` (genera los combos por defecto del ejercicio), `crearModeloSiNoExiste`.
- `src/features/gestoria/modelos/components/ModelosView.tsx` / `ModeloCard.tsx` — vista actual (recuadros trimestrales + anuales) donde se añade el icono de PDF.
- `src/features/gestoria/modelos/types/modelos.ts` — `ModeloTipo`, `MODELO_PERIODOS_VALIDOS`, `PLAZOS_PRESENTACION`, `periodoALabel`.

### Datos de entrada (los 48 PDFs de `/gestoria`)
- **Empresas**: HABANA `00000000-0000-0000-0000-000000000001`, BACANAL `fe2ea3c4-aa28-41ce-a135-bf196ab5dc47`. NO HOSTELBAR.
- **Mapeo de carpeta de periodo → enum**: `1T→Q1`, `2T→Q2`, `3T→Q3`, `4T→Q4`, `ANUAL→ANUAL`.
- **Tipos presentes en los ficheros**: 303, 111 (trimestrales); 190, 200, 347, 390, PYG, BALANCE, LIBRO_MAYOR (anuales). Todos dentro de alcance.
- El nombre real del fichero es libre (p. ej. `IVA 303 PRIMER TRIMESTRE 24.pdf`); el tipo se infiere del nombre en el script de carga y se documenta un mapa explícito fichero→tipo para los casos ambiguos.

### Modelo de Datos

Ampliación del enum existente (migración idempotente, versionada como fichero `.sql`):

```sql
-- Ampliar modelo_aeat_tipo con los tipos anuales/documentales que faltan.
-- ALTER TYPE ADD VALUE es idempotente con IF NOT EXISTS (PG12+).
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS '200';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS '190';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS 'PYG';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS 'BALANCE';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS 'LIBRO_MAYOR';
```

Bucket privado (patrón 096):

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('modelos-aeat-pdf', 'modelos-aeat-pdf', false, 26214400, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies read/insert/update/delete: foldername(name)[1] = empresa_id
-- vía user_empresas OR profiles (idéntico patrón 096).
```

Reutiliza `modelos_aeat` tal cual (una fila = `(empresa_id, tipo, periodo, ejercicio)` único; `pdf_url` guarda el path del bucket). No se crea tabla nueva.

### Arquitectura Propuesta (Feature-First)
```
src/features/gestoria/modelos/
├── actions/modelos-pdf-actions.ts    # subirModeloPdf() + getModeloPdfSignedUrl()
├── actions/modelos-config-actions.ts # get/save de la config del submódulo (por empresa)
├── components/ModeloCard.tsx          # + icono PDF clicable (URL firmada, pestaña nueva)
├── components/ModelosView.tsx         # + huecos anuales PYG/Balance/Libro Mayor + icono ajustes junto al selector de ejercicio
├── components/ModelosConfigDialog.tsx # dialog de ajustes del submódulo
├── actions/modelos-actions.ts         # asegurarModelosDelPeriodo: añadir PYG/BALANCE/LIBRO_MAYOR anuales
└── types/modelos.ts                   # ModeloTipo += '200'|'190'|'PYG'|'BALANCE'|'LIBRO_MAYOR'; periodos válidos

scripts/
└── cargar-modelos-gestoria.ts         # carga masiva inicial de los 48 PDFs (service_role)
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Esquema — enum ampliado + bucket privado
**Objetivo**: Migración `.sql` idempotente que amplía `modelo_aeat_tipo` (`200`, `190`, `PYG`, `BALANCE`) y crea el bucket privado `modelos-aeat-pdf` con MIME `application/pdf` y policies RLS por empresa (patrón 096).
**Validación**: Migración aplicada; el bucket existe y es privado; `ALTER TYPE` no rompe re-ejecución; las policies replican exactamente el patrón de 096.

### Fase 2: Tipos + catálogo anual con huecos PYG/Balance/Libro Mayor
**Objetivo**: Ampliar `ModeloTipo` y los mapas de `types/modelos.ts`; ajustar `asegurarModelosDelPeriodo` para que cada ejercicio genere SIEMPRE filas placeholder anuales de PYG, BALANCE y LIBRO_MAYOR (sin `pdf_url`) para ambas empresas; clasificar PYG/BALANCE/LIBRO_MAYOR/200/190/347 en el grupo ANUALES de la vista.
**Validación**: Al abrir un ejercicio sin PDFs, aparecen los recuadros PYG, Balance y Libro Mayor como huecos pendientes; `MODELO_PERIODOS_VALIDOS` y `grupoDeModelo` cubren los nuevos tipos.

### Fase 3: Server action de subida + URL firmada
**Objetivo**: Crear `subirModeloPdf()` (getAppContext → upload al path `<empresa_id>/<ejercicio>/<periodo>/<tipo>_<timestamp>.pdf` → guardar `pdf_url` en la fila `modelos_aeat` → `remove()` de compensación si falla el guardado) y `getModeloPdfSignedUrl()` (`createSignedUrl`, ~10 min), siguiendo el patrón de albaranes.
**Validación**: Subida y firma funcionan; ante fallo de persistencia se limpia el objeto subido; sin `empresaId` devuelve error controlado.

### Fase 4: UI — icono de PDF clicable en cada recuadro
**Objetivo**: En `ModeloCard`, si la fila tiene `pdf_url`, mostrar un icono clicable que llame a `getModeloPdfSignedUrl()` y abra el PDF en pestaña nueva; si no tiene, marcar el recuadro como hueco pendiente (coherente con la regla «0 calculado ≠ sin calcular»). El clic del icono no debe navegar al editor del modelo.
**Validación**: Icono visible solo con PDF; abre el documento correcto en pestaña nueva; los huecos se distinguen visualmente.

### Fase 5: Icono de ajustes + configuración del submódulo Modelos
**Objetivo**: Añadir junto al selector de ejercicio (en `ModelosView`) un icono de ajustes siguiendo el patrón universal de configuración de submódulo del proyecto, que abre `ModelosConfigDialog`. La config se guarda por empresa (`modelos-config-actions.ts`, coherente con el mecanismo de config de otros submódulos). Dos ajustes (ver sección «Ajustes del submódulo (definidos)»): **(1) Tipos de modelo visibles por empresa** (toggles; los desactivados no generan recuadro/hueco) y **(2) Recordatorios de plazos** (opt-in, días de antelación, vía motor de notificaciones existente usando `PLAZOS_PRESENTACION`).
**Validación**: El icono aparece junto al selector de ejercicio con el mismo estilo que en otros submódulos; abre el dialog; desactivar un tipo lo oculta para esa empresa; activar recordatorios emite el aviso en el plazo configurado; la config persiste por empresa y se refresca en los consumidores (patrón refreshKey).

### Fase 6: Carga masiva de los 48 PDFs
**Objetivo**: Script `scripts/cargar-modelos-gestoria.ts` (service_role) que recorre `/gestoria/{BACANAL,HABANA}`, mapea fichero → `{empresa_id, ejercicio, periodo, tipo}` (con mapa explícito para nombres ambiguos, excluyendo LIBRO MAYOR y HOSTELBAR), sube al bucket con el path canónico y hace upsert de la fila `modelos_aeat` con `pdf_url`. Idempotente (re-ejecutable sin duplicar).
**Validación**: Los 48 PDFs quedan subidos y enlazados; recuento por empresa/ejercicio correcto; re-ejecución no duplica filas ni objetos huérfanos.

### Fase 7: Validación Final
**Objetivo**: Sistema funcionando end-to-end para BACANAL y HABANA.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright/manual: cada recuadro con PDF abre el documento firmado en pestaña nueva
- [ ] PYG, Balance y Libro Mayor aparecen como huecos en ejercicios sin PDF
- [ ] El icono de ajustes junto al selector de ejercicio abre la config y persiste por empresa
- [ ] Criterios de éxito cumplidos

---

## Ajustes del submódulo (definidos)

El icono de ajustes junto al selector de ejercicio abre `ModelosConfigDialog` con la configuración por empresa (`empresa_id`), persistida vía `modelos-config-actions.ts` y refrescada en los consumidores (patrón `refreshKey`). Ajustes:

1. **Tipos de modelo visibles por empresa** — Toggle activar/desactivar por tipo (`303`, `111`, `190`, `347`, `390`, `200`, `PYG`, `BALANCE`, `LIBRO_MAYOR`). Los tipos desactivados no generan recuadro ni hueco anual para esa empresa. Por defecto: todos activos. Guardado como lista de tipos activos en la config de la empresa.
2. **Recordatorios de plazos de presentación** — Por cada modelo/periodo, aviso automático antes de su fecha límite. Config: activar/desactivar recordatorios y con cuántos días de antelación (ej. 7 días). Reutiliza `PLAZOS_PRESENTACION` de `types/modelos.ts` y el motor de notificaciones/alertas existente (`emitirNotificacion()` + resolver, PRP-064/065) — el recordatorio se dirige al responsable de gestoría/dirección de esa empresa. Por defecto: desactivado (opt-in).

_Ambos ajustes son por empresa y no cruzan datos entre BACANAL y HABANA (RLS por `empresa_id`)._

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error encontrado durante la implementación.

_(vacío — se completa en ejecución)_

---

## Gotchas

- [ ] `ALTER TYPE ... ADD VALUE` NO puede ejecutarse dentro de un bloque de transacción junto a usos del nuevo valor en algunos entornos; aislar la ampliación del enum de las inserciones que lo usan (dos statements/migraciones o commit intermedio).
- [ ] Path del bucket: `foldername(name)[1]` DEBE ser el `empresa_id` para que las policies RLS (patrón 096) autoricen — respetar exactamente `<empresa_id>/<ejercicio>/<periodo>/<tipo>_<timestamp>.pdf`.
- [ ] La restricción `unique (empresa_id, tipo, periodo, ejercicio)` de `modelos_aeat` implica que solo hay un PDF por combinación: la carga masiva debe hacer upsert, no insert.
- [ ] Carpetas `1T/2T/3T/4T/ANUAL` ↔ enum `Q1/Q2/Q3/Q4/ANUAL`: no confundir.
- [ ] Nombres de fichero libres (ej. `IVA 303 PRIMER TRIMESTRE 24.pdf`, `LIBRO MAYOR 2024 HABANA SYSTEM SL.pdf`): el tipo se infiere por número de modelo o palabra clave (PYG, BALANCE, LIBRO MAYOR) dentro del nombre; documentar mapa explícito para ambiguos.
- [ ] Excluir HOSTELBAR y NO tocar la parte de extracción/parseo de datos (queda para PRP posterior).
- [ ] El icono de PDF va dentro de un `<Link>` que navega al editor: parar propagación del clic para que abra el PDF y no navegue.
- [ ] Migraciones SIEMPRE como fichero `.sql` idempotente versionado (regla de memoria).

## Anti-Patrones

- NO crear una tabla nueva: reutilizar `modelos_aeat` (`pdf_url` ya existe).
- NO hacer el bucket público: privado + `createSignedUrl` temporal.
- NO hardcodear los `empresa_id` en el código de la app (solo en el script de carga puntual).
- NO incluir HOSTELBAR ni el parseo de datos internos.
- NO omitir la compensación (`remove`) si falla el guardado del path.

---

*PRP pendiente aprobación. No se ha modificado código.*
