# PRP-071 — Importador de fichas técnicas (escandallos) desde Excel, con emparejado asistido

> **Estado:** Propuesto · **Fecha:** 2026-06-30 · **Empresa piloto:** BACANAL
> **Origen:** coordinación con Fernando (nota `docs/LOGISTICA_COMPRAS_PARA_IVAN_siembra_vs_ingest.md`). Sustituye el ingest destructivo `run-ingest.ts` por un importador NO destructivo y revisado por el usuario.

## 1. Objetivo

Cargar las **fichas técnicas (escandallos) de los platos de BACANAL** desde el Excel
`docs/fichas-tecnicas/BACANAL - FICHAS TECNICAS PRODUCTO.xlsx` **sin tocar** proveedores
ni productos de compra ya sembrados. El sistema **propone** el emparejado de cada
ingrediente del Excel contra los productos/fichas que ya existen, y **el usuario confirma o corrige**
antes de escribir nada en la BD.

### Lo que NO se hace (anti-objetivos)
- ❌ NO se borra ni recrea nada (`proveedores`, `productos` de compra/venta). Se quitan TODOS los `delete()` del ingest actual.
- ❌ NO se inventan productos de compra a partir del Excel. Si un ingrediente no existe, se **lista** para revisión (decisión Iván).
- ❌ NO se importa a HABANA. La etiqueta "DELICATESES HABANA" del Excel es una **categoría obsoleta** que se ignora.

## 2. Contexto verificado (datos reales, 2026-06-30)

- **Excel PRODUCTO:** 59–60 hojas, una por plato. Layout por hoja:
  - fila 1 colA = nombre del plato; fila 5 colC = categoría de venta; colG fila5 = "DELICATESES HABANA" (IGNORAR).
  - Cabecera ingredientes: colG="INGREDIENTES", colJ="UNIDAD", colK="CANTIDAD".
  - Ingredientes desde 2 filas más abajo (hay fila vacía intermedia); colG=nombre, colJ=unidad, colK=cantidad.
  - Después: secciones ELABORACION (colD), GUARNICION, etc. (no son ingredientes).
- **Excel ELABORACIONES:** 38 hojas = sub-recetas (mayonesas, caldos, ragout, encurtidos…). Son los ingredientes "que se elaboran".
- **BD BACANAL:** 297 productos de compra (buen surtido de cocina), 204 de venta.
- **Tablas de escandallo:** `escandallos` (cabecera) + `escandallo_ingredientes` (líneas, FK `producto_id` nullable) → se **sincroniza** a `producto_composicion` vía `escandallos-actions.ts` (ya existe). El importador DEBE reutilizar esos actions, no escribir tablas a pelo.

### Simulación de emparejado (170 ingredientes únicos del Excel)
| Resultado | Nº | Trato |
|---|---|---|
| ✅ Exacto (auto) | 29 | se asigna solo |
| 🟡 Probable (sugerencia) | 34 | el usuario confirma/corrige |
| 🔴 Dudoso / sin match | 107 | revisión: de estos, la mayoría son **elaboraciones** (otra ficha) o **productos que faltan** (lubina, sepia, vieira, salmón, calamar…) |

**Conclusión:** los "ingredientes" son de **dos niveles**: productos de compra **o** sub-fichas (elaboraciones). El importador debe resolver ambos.

## 3. Modelo de datos (decisiones tomadas + verificado por exploración)

**El modelo YA soporta el anidado — no hace falta esquema nuevo.** Hallazgos:
- `productos.tipo` admite **`'compra' | 'venta' | 'elaboracion'`**. Las sub-recetas son productos `tipo='elaboracion'`.
- `escandallos.producto_id` (→ productos) vincula la ficha a su producto de venta/elaboración (migración `20260628010000`).
- Líneas en `ingredientes_ficha` (expuesta por actions como `escandallo_ingredientes`): `producto_id` (nullable, → productos compra **o** elaboración), `nombre`, `cantidad`, `unidad`, `merma_pct`, `prioridad`, `orden`. Sincroniza a `producto_composicion`.

Por tanto:
- **Sub-recetas = producto `tipo='elaboracion'`** que a su vez tiene su propio escandallo. Un ingrediente de un plato cuyo `producto_id` apunta a una elaboración = anidamiento, sin columnas nuevas.
- **Productos que faltan** (ni compra ni elaboración) → se **listan** al usuario; NO se crean automáticamente.
- ✅ **Probablemente Fase 2 (migración) NO es necesaria** — confirmar en Fase 1 que el anidado vía `tipo='elaboracion'` cubre el caso. Si lo cubre, se elimina la fase y no se toca esquema.

> Nota: BACANAL es **fuente única de logística** (HABANA quedó sin productos tras migración 2026-05-21). Confirma de nuevo que el destino es BACANAL.

## 4. Flujo de la pantalla (UI, módulo Cocina/Logística)

1. **Origen:** selector de empresa (default BACANAL) + Excel (sube archivo o usa el de `docs/fichas-tecnicas/`).
2. **Parseo + emparejado automático:** muestra tabla por plato → por ingrediente:
   `Excel "cebolla morada"  →  [sugerido: Cebolla 85%]  ▸ [✅ confirmar] [✏️ elegir otro ▾] [🧩 es elaboración ▾] [➕ falta]`
3. **Tipos de fila de revisión:**
   - **Exacto** → preseleccionado verde.
   - **Probable** → sugerencia editable (combobox con productos de compra + fichas existentes; regla: combobox dentro de Dialog, ver memoria).
   - **Es elaboración** → enlaza a una ficha existente o marca "crear desde Excel ELABORACIONES".
   - **Falta** → va a una lista aparte "Productos a dar de alta" (no bloquea; el plato se importa sin esa línea, marcada pendiente).
4. **Resumen previo:** "X platos, Y ingredientes emparejados, Z elaboraciones, W faltan". Botón **Importar**.
5. **Escritura (solo al confirmar):** crea/actualiza `escandallos` + `escandallo_ingredientes` vía actions existentes; sincroniza a `producto_composicion`. Idempotente por (empresa, nombre de plato).
6. **Informe final:** descargable — qué se creó, qué quedó pendiente, productos que faltan por dar de alta.

## 5. Emparejador (lógica)

- Normalización: minúsculas, sin acentos, sin paréntesis `(...)`, sin signos; tokens.
- Score = solapamiento de tokens + bonus por inclusión. Umbrales: ≥0.99 exacto · ≥0.55 probable · resto dudoso (ajustables).
- Candidatos = productos de compra de la empresa **+** fichas (elaboraciones) ya existentes.
- Siempre **el usuario decide** lo no-exacto (decisión Iván: "match aproximado, que me lo diga y yo confirmo").

## 6. Fases

- **Fase 1 ✅ COMPLETADA (2026-06-30)** — módulo `src/features/cocina/services/import-fichas/` (`types`, `parser`, `matcher`, `preview`, `index` + `verify.script.ts`). Sobre el Excel real: 59 platos, 173 ingredientes → 48 exactos / 50 probables / 90 dudosos / 44 sin candidato. Typecheck limpio. **No toca BD.**
- **Fase 2 — ❌ ELIMINADA.** Verificado que el anidado funciona sin esquema nuevo: `tipo='elaboracion'` ya existe en BACANAL (4 filas) y el matcher empareja contra ellas (p.ej. "Puré de patata" → "Pure de patatas" [elaboracion]). No se toca la BD.
- **Fase 3 ✅ COMPLETADA (2026-06-30)** — `import-fichas-actions.ts` (previewFichas) + `ImportFichasView` + `CorregirMatchDialog` (combobox en Dialog) + ruta `/cocina/importar-fichas`. Typecheck limpio.
- **Fase 4 ✅ COMPLETADA (2026-06-30)** — `importarFichas` reutiliza `createEscandallo`/`updateEscandallo`, idempotente por (empresa, nombre de plato) — reimportar actualiza, no duplica. Informe final (creadas/actualizadas/faltan/errores) + lista de "productos a dar de alta". Typecheck limpio.
  - ⚠️ **Limitación conocida:** el escandallo importado NO se enlaza aún a un `producto` de venta (`productoId`), así que no sincroniza a `producto_composicion` ni fija coste autoritativo. La ficha queda creada con sus ingredientes; el enlace a producto de venta es trabajo posterior (Fase 5 o aparte).
  - ⏳ **Pendiente de prueba en navegador** con el Excel real (sin runner E2E; validar manualmente).
- **Fase 5 — ELABORACIONES:** segundo Excel para crear las sub-fichas (`productos tipo='elaboracion'` + su escandallo) y enlazarlas a los platos.

## 7. Riesgos / notas

- ⚠️ El Excel PRODUCTO pesa **150 MB** (imágenes embebidas). **No commitear al repo** (añadir a `.gitignore` o mantener fuera). El parser solo necesita texto.
- ⚠️ Cambio de esquema (Fase 2) requiere **aprobación explícita** (regla de seguridad CLAUDE.md).
- Bug detectado por Fernando (hallazgo 3): el ingest viejo escribía en `producto_composicion` y el dashboard lee `escandallo_ingredientes`. Este importador escribe en `escandallo_ingredientes` y sincroniza → **resuelve** la inconsistencia.
- Bug hallazgo 4 (Fernando): `stock_temporada_reglas` no existe en esquema y rompe Temporadas en runtime → fuera de este PRP, pero anotado.

## 8. Aprobación

- [ ] Iván aprueba el plan y las 5 fases.
- [ ] Iván autoriza la migración de Fase 2 (cambio de esquema) cuando se llegue a ella.
