# PRP-030: Gestoría — submódulo MODELOS (AEAT) con categorización IA

> **Estado**: PENDIENTE APROBACIÓN
> **Fecha**: 2026-04-18
> **Proyecto**: Balles-Hosteleros
> **Ruta**: `/gestoria/modelos`
> **Feature dir**: `src/features/gestoria/modelos/`
> **Depende de**: `facturas` (módulo Contabilidad), `contactos_contables`, `empresas`, Gemini (`src/lib/ia/gemini.ts`)

---

## Objetivo

Construir un **submódulo MODELOS** dentro de Gestoría que genere automáticamente los borradores de los **modelos oficiales trimestrales y anuales de la AEAT** (303 IVA, 130 IRPF, 111 retenciones profesionales, 115 retenciones alquileres, 390 resumen anual IVA, 347 operaciones con terceros), con **formato idéntico al oficial** de Hacienda, a partir de las **facturas ya registradas en la base de datos**. La **IA categoriza automáticamente** cada factura al epígrafe correspondiente de cada modelo, permitiendo al usuario **revisar, corregir y presentar** el borrador con un click.

## Por Qué

| Problema | Solución |
|----------|----------|
| El restaurante paga cada trimestre a una asesoría entre 150 y 400 € por modelo sólo para que clasifiquen facturas y rellenen casillas. | Categorización IA automática + formato oficial = gestoría interna sin coste recurrente. |
| Clasificar manualmente 300-800 facturas por trimestre a los epígrafes correctos de AEAT es tedioso y propenso a error. | Un solo click: Gemini categoriza todo, el humano sólo revisa excepciones. |
| Los modelos oficiales (303, 130, etc.) tienen un formato PDF muy estricto con casillas numeradas: quien no lo reproduce fiel, se confunde y presenta mal. | Plantillas 1:1 al PDF oficial de AEAT con casillas mapeadas a los datos calculados. |
| Cruzar facturas con contactos para el modelo 347 (operaciones > 3.005,06 €/año con el mismo tercero) a mano es un dolor. | Agregación automática por `contacto_id` + filtro por umbral anual. |
| No existe trazabilidad entre factura → casilla → modelo presentado (si Hacienda pregunta, cuesta horas rehacer el origen). | Tabla de asignaciones `factura_id ↔ modelo_id ↔ casilla` con log de cambios. |
| Cambios de última hora (una factura rectificativa, un contacto mal clasificado) obligan a rehacer todo. | Recálculo incremental: tocar una factura → recalcular sólo el modelo afectado en < 2 s. |

**Valor de negocio**:
- Ahorro directo: ~1.500-3.000 €/año por empresa en asesoría externa.
- Cierre de trimestre en **minutos en vez de días**.
- Auditoría fiscal sin sobresaltos: trazabilidad completa factura → casilla → presentación.
- Diferenciador competitivo claro frente a Holded / Quipu / Contasimple (que no generan formato oficial, sólo resúmenes).

## Qué

### Criterios de Éxito

- [ ] Existe ruta `/gestoria/modelos` (privada, rol `GERENCIA`/`ADMIN`) enlazada desde sidebar Gestoría.
- [ ] La vista principal muestra un **listado de modelos por periodo** (2026-Q1, 2026-Q2, 2026-Q3, 2026-Q4, 2026 anual) con estado: `BORRADOR`, `REVISADO`, `PRESENTADO`.
- [ ] Los **6 modelos oficiales** están implementados con plantilla 1:1 al PDF oficial AEAT:
  - **303** (IVA trimestral) — casillas 01-88
  - **130** (IRPF estimación directa trimestral) — casillas 01-19
  - **111** (Retenciones rendimientos del trabajo/profesionales trimestral) — casillas 01-28
  - **115** (Retenciones alquileres trimestral) — casillas 01-06
  - **390** (Resumen anual IVA) — casillas 01-660 agrupadas
  - **347** (Operaciones con terceros > 3.005,06 €/año)
- [ ] La **IA categoriza automáticamente** cada factura al epígrafe/casilla de cada modelo en < 15 s para 500 facturas.
- [ ] El usuario puede **reasignar manualmente** una factura a otro epígrafe; la IA aprende de esa corrección (se guarda en `reglas_categorizacion_ia`).
- [ ] Cada modelo se puede **exportar a PDF oficial** descargable (formato idéntico al AEAT, imprimible y presentable físicamente o subible a Sede Electrónica).
- [ ] Cada modelo se puede **exportar a fichero AEAT** (formato `.303`, `.130`, etc.) para subir directo a Sede Electrónica sin retecleo.
- [ ] La suma de todas las casillas **cuadra con los totales de Contabilidad** (base imponible, IVA soportado, IVA repercutido, retenciones). Check automático con alerta si no cuadra.
- [ ] Trazabilidad: desde cada casilla del modelo se puede hacer **drill-down** a la lista de facturas que la componen.
- [ ] Historial: los modelos presentados quedan **inmutables** (snapshot congelado con fecha de presentación y hash).
- [ ] Alertas de plazo: si el trimestre cierra en < 7 días y el modelo sigue en BORRADOR, aparece badge rojo y notificación.

### Comportamiento Esperado (Happy Path)

1. Gerente entra en `/gestoria/modelos` el 10 de abril de 2026.
2. Ve 6 tarjetas: `303 Q1`, `130 Q1`, `111 Q1`, `115 Q1` (todos `BORRADOR`), `390 2025` (`PRESENTADO`), `347 2025` (`PRESENTADO`).
3. El badge de `303 Q1` marca "⚠ Cierra en 10 días".
4. Click en `303 Q1` → entra al editor del modelo.
5. La IA ya ha **precategorizado** las 312 facturas del trimestre (se corrió automáticamente la noche anterior o se lanza on-demand).
6. Ve el modelo 303 con **todas las casillas rellenas** y un panel lateral "12 facturas sin clasificar (necesitan revisión humana)".
7. Click en una factura dudosa → ve la explicación de la IA ("no encontré epígrafe claro, posibles: 01 o 03") y elige.
8. Una vez las 12 resueltas, el modelo queda en verde: cuadra con Contabilidad.
9. Click en "Vista previa" → se abre el PDF oficial AEAT generado, idéntico al original.
10. Click en "Marcar como presentado" → snapshot inmutable, genera fichero `.303` descargable para subir a Sede Electrónica.
11. Entra en `/gestoria/modelos/347/2025` → ve listado agrupado por contacto, sólo aparecen los 14 contactos que superan 3.005,06 €/año; exporta PDF.

---

## Contexto

### Referencias (patrones existentes)

- **Feature-first en Gestoría**: `src/features/gestoria/` ya tiene `presentaciones/` (seguir misma estructura de actions/components/data/services/types).
- **Sidebar Gestoría**: `src/features/layout/components/app-sidebar.tsx:59` (`gestoriaSubs`) — añadir entrada `MODELOS` con icono `FileSpreadsheet` o `FileBarChart`.
- **App layout**: `src/features/layout/components/app-layout.tsx` — añadir `/gestoria/modelos` a `SECTION_TITLES` y `SECTION_ICONS`.
- **Facturas ya existentes**: tabla `public.facturas` (migración `.claude/migrations/007_contabilidad.sql`) con campos `base_imponible`, `iva_pct`, `iva_importe`, `total`, `tipo` (COMPRA/VENTA), `contacto_id`, `fecha_emision`. Es el **origen único de datos**.
- **Contactos**: tabla `contactos_contables` con `documento` (NIF) y `tipo` (EMPRESA/AUTONOMO/PARTICULAR) — clave para modelo 347.
- **IA Gemini**: `src/lib/ia/gemini.ts` (`geminiJSON`) con structured output — patrón ya usado en `src/features/direccion/presentaciones/services/ia-presentacion.ts`. Gratis (tier free), suficiente para ~500 facturas/batch.
- **ImpuestosView existente**: `src/features/contabilidad/components/ImpuestosView.tsx` — sólo muestra tabla resumen, NO genera formato oficial. El nuevo submódulo lo reemplaza/complementa.
- **Branding por empresa** (para el header del PDF): `src/features/direccion/presentaciones/services/branding-service.ts` — patrón de snapshot de logo + datos fiscales.

### Arquitectura Propuesta (Feature-First)

```
src/features/gestoria/modelos/
├── actions/
│   ├── modelos-actions.ts          # list/create/update/presentar modelo
│   ├── categorizacion-actions.ts   # reasignar factura a casilla manual
│   └── export-actions.ts           # generar PDF + fichero AEAT
├── components/
│   ├── ModelosView.tsx             # listado + estado por periodo
│   ├── ModeloCard.tsx              # tarjeta con estado y alertas
│   ├── editors/
│   │   ├── Modelo303Editor.tsx     # formato oficial 303 (casillas 01-88)
│   │   ├── Modelo130Editor.tsx
│   │   ├── Modelo111Editor.tsx
│   │   ├── Modelo115Editor.tsx
│   │   ├── Modelo390Editor.tsx
│   │   └── Modelo347Editor.tsx
│   ├── CasillaInput.tsx            # input con drill-down a facturas origen
│   ├── FacturasSinClasificar.tsx   # panel lateral de revisión
│   └── PDFPreviewDialog.tsx        # preview antes de presentar
├── services/
│   ├── categorizacion-ia.ts        # prompt + Gemini + structured output
│   ├── calculo-303.ts              # lógica pura: facturas → casillas 303
│   ├── calculo-130.ts
│   ├── calculo-111.ts
│   ├── calculo-115.ts
│   ├── calculo-390.ts
│   ├── calculo-347.ts
│   ├── pdf-generator.ts            # react-pdf o pdfme → PDF oficial
│   └── fichero-aeat.ts             # exporta formato .303 etc. (texto posicional)
├── data/
│   ├── epigrafes-303.ts            # catálogo oficial de epígrafes + mapping casilla
│   ├── epigrafes-130.ts
│   ├── epigrafes-111.ts
│   ├── epigrafes-115.ts
│   └── plantillas-pdf/             # assets PDF base de cada modelo (fondos oficiales)
└── types/
    └── modelos.ts                  # tipos Modelo, Casilla, Asignacion, EstadoModelo
```

### Modelo de Datos (Supabase)

```sql
-- ─── MODELOS AEAT ──────────────────────────────────────────
-- Un registro = un modelo de un periodo concreto para una empresa
create type public.modelo_aeat_tipo as enum ('303','130','111','115','390','347');
create type public.modelo_aeat_periodo as enum ('Q1','Q2','Q3','Q4','ANUAL');
create type public.modelo_aeat_estado as enum ('BORRADOR','REVISADO','PRESENTADO');

create table if not exists public.modelos_aeat (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  tipo                public.modelo_aeat_tipo not null,
  periodo             public.modelo_aeat_periodo not null,
  ejercicio           integer not null,       -- 2026
  estado              public.modelo_aeat_estado not null default 'BORRADOR',
  -- datos calculados: { "01": 12345.67, "02": ..., "88": ... }
  casillas            jsonb not null default '{}',
  -- snapshot de datos fiscales empresa al presentar (NIF, razón social, etc.)
  snapshot_empresa    jsonb,
  fecha_presentacion  timestamptz,
  hash_snapshot       text,                    -- hash inmutable del JSON al presentar
  pdf_url             text,                    -- URL del PDF generado en Storage
  fichero_aeat_url    text,                    -- URL del .303 etc.
  ia_corrida_en       timestamptz,             -- cuándo corrió la IA por última vez
  ia_tokens_input     integer,
  ia_tokens_output    integer,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (empresa_id, tipo, periodo, ejercicio)
);

-- ─── ASIGNACIONES factura → casilla ────────────────────────
-- Una fila por cada factura que entra en un modelo (con su casilla)
create table if not exists public.asignaciones_modelo (
  id              uuid primary key default gen_random_uuid(),
  modelo_id       uuid not null references public.modelos_aeat(id) on delete cascade,
  factura_id      uuid not null references public.facturas(id) on delete cascade,
  casilla         text not null,              -- "01", "29", "BI-I-4", etc.
  importe         numeric not null,            -- importe que aporta a esa casilla
  tipo_aporte     text not null default 'base',-- 'base' | 'iva' | 'retencion'
  origen          text not null default 'ia',  -- 'ia' | 'manual' | 'regla'
  confianza_ia    numeric,                     -- 0-1 (sólo si origen='ia')
  explicacion_ia  text,                        -- razonamiento del modelo
  creada_por      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index on public.asignaciones_modelo (modelo_id);
create index on public.asignaciones_modelo (factura_id);

-- ─── REGLAS APRENDIDAS DE CORRECCIONES HUMANAS ─────────────
create table if not exists public.reglas_categorizacion_ia (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  patron          jsonb not null,              -- {contacto_id}, {concepto_contiene}, {tipo_iva}
  modelo_tipo     public.modelo_aeat_tipo not null,
  casilla         text not null,
  activa          boolean not null default true,
  veces_aplicada  integer not null default 0,
  created_at      timestamptz not null default now()
);

-- RLS (patrón estándar empresa)
alter table public.modelos_aeat enable row level security;
alter table public.asignaciones_modelo enable row level security;
alter table public.reglas_categorizacion_ia enable row level security;

create policy "modelos_aeat_empresa" on public.modelos_aeat
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));
create policy "asignaciones_modelo_empresa" on public.asignaciones_modelo
  for all using (modelo_id in (select id from public.modelos_aeat where empresa_id in (select empresa_id from public.profiles where id = auth.uid())));
create policy "reglas_categorizacion_empresa" on public.reglas_categorizacion_ia
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));
```

### Datos de Referencia Oficiales (research AEAT)

- **Modelo 303** (IVA trimestral): plazo 1-20 abril / julio / octubre / enero (Q4). Casillas críticas: 01-06 (base imponible tipo general 21 %), 07-09 (10 %), 10-12 (4 %), 28-39 (IVA soportado), 64-69 (resultado).
- **Modelo 130** (IRPF estimación directa simplificada): mismos plazos que 303. Casillas 01-03 (ingresos computables), 04-05 (gastos), 07-08 (base), 17-19 (resultado).
- **Modelo 111** (retenciones trabajadores + profesionales): mismos plazos. Casilla 01-02 (trabajadores), 03-04 (profesionales IRPF 15 %/7 %).
- **Modelo 115** (retenciones alquileres 19 %): mismos plazos. Casilla 01-02 (importe base + retención).
- **Modelo 390** (resumen anual IVA): hasta 30 enero año siguiente. Consolida los 4 trimestres del 303.
- **Modelo 347** (operaciones con terceros > 3.005,06 € IVA incl/año): hasta 28 febrero año siguiente. Agrupa por NIF del contacto.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Migración BD + tipos + catálogos oficiales
**Objetivo**: Tablas `modelos_aeat`, `asignaciones_modelo`, `reglas_categorizacion_ia` creadas con RLS. Catálogos de epígrafes oficiales de los 6 modelos en `data/`.
**Validación**: `npm run typecheck` pasa; script `scripts/apply-migration-012.ts` aplica sin error; RLS protege cross-tenant.

### Fase 2: Motor de cálculo puro (sin IA) de los 6 modelos
**Objetivo**: Servicios `calculo-303.ts`, `calculo-130.ts`, `calculo-111.ts`, `calculo-115.ts`, `calculo-390.ts`, `calculo-347.ts` que, dado un array de facturas con casilla ya asignada, devuelven el JSON de casillas calculado. Lógica pura, testeable, sin efectos.
**Validación**: tests unitarios con fixtures de facturas reales del trimestre actual; suma de casillas cuadra con `ImpuestosView` existente.

### Fase 3: Categorización IA con Gemini
**Objetivo**: Servicio `categorizacion-ia.ts` que toma N facturas de un trimestre + tipo de modelo y devuelve `[{factura_id, casilla, confianza, explicacion}]` usando Gemini structured output. Incluye aplicación previa de `reglas_categorizacion_ia` antes de llamar a IA (para facturas repetidas no gastar tokens).
**Validación**: categorización de 300 facturas en < 15 s; precisión > 90 % en dataset de prueba; facturas sin clasificar se marcan con `confianza < 0.6`.

### Fase 4: Listado de modelos + estado
**Objetivo**: Ruta `/gestoria/modelos` con `ModelosView.tsx` que muestra las tarjetas de los 6 modelos del periodo actual + alertas de plazo. Server actions `listModelos`, `crearModeloSiNoExiste`.
**Validación**: UI carga < 1 s; al cambiar empresa en contexto, recarga; badge rojo si quedan < 7 días.

### Fase 5: Editor de modelo 303 (plantilla oficial)
**Objetivo**: `Modelo303Editor.tsx` con layout fiel al PDF oficial (casillas numeradas idénticas), drill-down por casilla, panel lateral "facturas sin clasificar", botón "Correr IA", "Marcar revisado".
**Validación**: Playwright screenshot contra imagen oficial del 303 → diferencia visual < 5 %; cuadra con suma de facturas.

### Fase 6: Editores 130, 111, 115
**Objetivo**: Replicar patrón del 303 para los 3 modelos trimestrales restantes.
**Validación**: cada uno cuadra con su fuente (facturas, nóminas, alquileres).

### Fase 7: Editores anuales 390 y 347
**Objetivo**: Modelo 390 consume los 4 trimestres del 303; Modelo 347 agrupa por `contacto_id` con filtro > 3.005,06 €.
**Validación**: 390 cuadra con Q1+Q2+Q3+Q4; 347 sólo incluye contactos por encima del umbral.

### Fase 8: Exportación PDF oficial + fichero AEAT
**Objetivo**: Servicio `pdf-generator.ts` genera PDF idéntico al oficial (con `@react-pdf/renderer` o `pdfme`); servicio `fichero-aeat.ts` genera `.303`, `.130`, etc. con formato posicional exacto AEAT. Ambos se suben a Storage y guardan URL en el modelo.
**Validación**: PDF descargado es presentable en imprenta; fichero `.303` se acepta en Sede Electrónica sandbox sin error de validación.

### Fase 9: Presentación e inmutabilidad
**Objetivo**: Botón "Marcar como presentado" genera snapshot inmutable (`hash_snapshot`), congela el JSON de casillas, bloquea edición posterior, registra fecha. Historial visible.
**Validación**: intentar editar modelo presentado devuelve error; hash verificable; auditoría visible.

### Fase 10: Alertas de plazo + validación cuadre
**Objetivo**: Cron diario que marca modelos con `< 7 días` hasta plazo → badge rojo + notificación. Servicio `validarCuadre()` que compara casillas con tabla `facturas` y alerta si hay desviación > 1 €.
**Validación**: simular fecha próxima → alerta aparece; introducir factura desfasada → cuadre avisa.

### Fase 11: Validación Final
**Objetivo**: Sistema funcionando end-to-end con datos reales de 2026-Q1.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright genera el 303 del Q1 completo en < 20 s
- [ ] PDF comparado con el oficial AEAT: idéntico visualmente
- [ ] Fichero `.303` valida en Sede Electrónica (entorno pruebas AEAT)
- [ ] Categorización IA ≥ 90 % de facturas sin intervención humana
- [ ] Cuadre automático con Contabilidad: diferencia 0,00 €
- [ ] Todos los criterios de éxito cumplidos

---

## Aprendizajes (Self-Annealing)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

_(vacío — se rellena durante ejecución)_

---

## Gotchas

- [ ] **Casillas 303 cambian año a año** — AEAT publica nueva orden cada diciembre; catalogar en `data/epigrafes-303.ts` con versión por ejercicio (`2025`, `2026`), nunca hardcodear.
- [ ] **IVA deducible parcial** (vehículos al 50 %, bares con zona privada) — la IA debe detectar y aplicar proporción; hoy las facturas no guardan ese dato → **añadir campo `iva_deducible_pct` en `facturas`** (migración incremental, no romper).
- [ ] **Modelo 347 excluye operaciones ya declaradas en otros modelos** (alquileres del 115, retenciones del 111) — no duplicar.
- [ ] **Facturas rectificativas** suman con signo negativo en base + iva → el motor debe respetar el signo; no usar `ABS()`.
- [ ] **Régimen recargo de equivalencia** (común en comercio minorista pero no en hostelería) → confirmar que todas las empresas del SaaS son régimen general; si no, bloquear o avisar.
- [ ] **Gemini structured output + responseSchema** ya documentado en `src/lib/ia/gemini.ts`: pasar schema tipado, no JSON string.
- [ ] **PDF oficial AEAT tiene campos de código de barras tipo PDF417** — no obligatorio para borrador físico; imprescindible sólo para presentación presencial que hoy ya no se usa → podemos omitir.
- [ ] **`.303` es texto posicional con encoding ISO-8859-1** (no UTF-8) — cuidado al escribir el fichero.
- [ ] **Snapshot de empresa al presentar**: razón social, NIF, epígrafe IAE — cambian con el tiempo; guardar copia en `snapshot_empresa` igual que se hace en `presentaciones.branding_snapshot`.
- [ ] **Plazo 20 abril cae en fin de semana** (año 2026 → sábado): AEAT amplía a lunes hábil → calcular con `business-days` lib, no `+3 meses`.
- [ ] **Storage privado obligatorio**: los PDF contienen NIF + datos fiscales → bucket `modelos_aeat` con RLS `private`; URLs firmadas de 5 min.
- [ ] **Rate-limit Gemini free**: 15 RPM; batch de 100 facturas por llamada para respetar límite.

## Anti-Patrones

- NO duplicar lógica ya existente en `src/features/contabilidad/` — reusar `listFacturas` y tipos.
- NO hardcodear epígrafes ni casillas en los componentes; todo desde `data/epigrafes-*.ts`.
- NO dejar que la IA escriba directo en `modelos_aeat.casillas` — la IA sólo produce `asignaciones_modelo`; las casillas las calcula el servicio puro con esas asignaciones (separación IA / cálculo).
- NO permitir edición de modelo `PRESENTADO` (bloqueo DB + UI).
- NO confiar en la IA al 100 %: siempre mostrar panel "facturas sin clasificar" y alertar si cuadre falla.
- NO omitir RLS cross-empresa — datos fiscales son críticos.
- NO usar `any` en tipos de casillas: tipar con `CasillaId = "01" | "02" | ... | "88"` estricto.
- NO generar el PDF con HTML → print (queda distinto en cada navegador); usar generador PDF determinista.

---

*PRP pendiente aprobación. No se ha modificado código.*
