# PRP-052: Cupones de sala — etiqueta informativa con código auto, stock y validación

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-03
> **Proyecto**: Balles-Hosteleros (módulo Sala / Reservas)

---

## Objetivo

Construir un sistema de **cupones puramente informativos** que se adjuntan a una reserva como una etiqueta. El restaurante crea cupones desde `/sala/cupones` con un código auto-generado de 6 caracteres alfanuméricos. Al crear o editar una reserva (interna o pública), se puede introducir ese código manualmente y el sistema valida en tiempo real (existe, no caducado, día/turno permitido, queda stock). Si es válido, el cupón queda registrado en la reserva (código + título visible al cliente). **No tiene precio, no afecta a la política de cancelación, no afecta a `tipo_categoria`, no afecta al POS, no afecta a `importe_pagado`.** Son universos completamente independientes.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy `reserva_codigos` existe como stub con un modelo confuso (3 tipos de promoción, min/max personas, `es_descuento` booleano, `nombre` editable…) que no se ajusta al cupón que queremos. Producción está vacía (0 filas), así que es seguro rediseñar. | DROP + RECREATE `reserva_codigos` con un modelo limpio: código auto 6 chars, 3 tipos de beneficio (porcentaje / importe / producto_gratis), 2 títulos (interno y cliente), stock por reservas o personas, caducidad, días, turnos. |
| El campo "código promocional" del form público hoy se guarda sin validar (sin stock, sin caducidad, sin días, sin turnos). | Validación dura en server (admin + público) ANTES de crear la reserva. Si falla, error claro y no se crea reserva. |
| El stock nunca se descuenta. | RPC atómica `consumir_stock_cupon(codigo_id, personas)` que suma 1 si `unidad_stock='reservas'` o `personas` si `unidad_stock='personas'`. |
| Mezclar cupón con `tipo_categoria='cupon'` (pago anticipado) o con política de cancelación causa confusión. | Cupón es **etiqueta informativa**, sin relación con ninguno de los dos. Pueden coexistir libremente. |

**Valor de negocio**: regalos de bienvenida, promos de cumpleaños, premios a influencers — sin contabilidad ni descuentos automáticos, el restaurante aplica el cupón a discreción. Visible para el cliente con dos datos: código + título.

## Qué

### Criterios de Éxito

- [ ] `reserva_codigos` rediseñada con el modelo nuevo. Migración sin pérdida de datos relevantes (producción vacía).
- [ ] Al crear cupón, el código se genera automáticamente: 6 chars `[A-Z0-9]` aleatorios, único por empresa, no editable por nadie.
- [ ] Admin puede definir 3 tipos de beneficio: `porcentaje` (10 = 10%), `importe` (10 = 10 €) o `producto_gratis` con descripción libre (ej: "Botella de cava 75 cl").
- [ ] Admin define `unidad_stock` (`reservas` o `personas`) + `stock_total`. Opcional: `fecha_caducidad`, `dias_semana[]`, `turnos[]`.
- [ ] Admin define 2 títulos: `titulo_interno` (obligatorio) y `titulo_cliente` (opcional, fallback al interno).
- [ ] Validación al canjear (server, admin + público) devuelve uno de: `OK`, `NO_EXISTE`, `INACTIVO`, `CADUCADO`, `AGOTADO`, `DIA_NO_PERMITIDO`, `TURNO_NO_PERMITIDO`.
- [ ] RPC `consumir_stock_cupon` atómica: si `unidad_stock='reservas'` suma 1, si `unidad_stock='personas'` suma `num_personas`. Rechaza con `AGOTADO` si supera `stock_total`.
- [ ] Stock NO se devuelve nunca al cancelar / no-show / borrar reserva. Documentado.
- [ ] Reserva con cupón guarda solo: `codigo_id` (FK) y `codigo` (snapshot text del código de 6 chars). Nada más. NO toca `tipo_categoria`, NO toca `importe_pagado`, NO toca `politicas_*`.
- [ ] UI: submódulo `/sala/cupones` con lista + crear/editar siguiendo BARRA HORIZONTAL 1. Sentence case en todo. Sin duplicar título de página.
- [ ] UI: form de reserva (interno y público) añade campo "Código de cupón" con validación inline tolerante (no marca error mientras se teclea prefijo válido). Al validar OK muestra chip con título del cliente.
- [ ] Cliente final, en su pantalla de éxito y en email de confirmación, ve dos datos: `Cupón: K7M2X9 — Tu regalo de bienvenida`.
- [ ] RLS multi-tenant con `empresas_del_usuario()` / `_text()`. Cupones siempre por empresa (Habana ≠ Bacanal).
- [ ] Cambios universales: se aplican a TODAS las empresas presentes y futuras, sin tocar ninguna empresa concreta.

### Comportamiento Esperado

**Crear cupón (admin)**
1. Admin entra a `/sala/cupones`. Ve lista vacía con barra horizontal `+ Nuevo`.
2. Click `+ Nuevo` → drawer con campos:
   - **Código** (auto-generado, read-only, con botón "Copiar"). Ejemplo: `K7M2X9`.
   - **Título interno** (obligatorio, lo ve el restaurante).
   - **Título para el cliente** (opcional; placeholder: "Si lo dejas vacío, el cliente verá el título interno").
   - **Tipo de beneficio**: radio `Porcentaje` / `Importe en €` / `Producto gratis`.
   - **Valor**:
     - Si Porcentaje → input numérico 1-100.
     - Si Importe → input numérico ≥ 0.
     - Si Producto gratis → input texto corto ("Botella de cava 75 cl").
   - **Unidad de stock**: radio `Por reservas` / `Por personas`.
   - **Stock total**: input numérico ≥ 1.
   - **Fecha de caducidad**: date picker opcional ("Sin caducidad" si vacío).
   - **Días permitidos**: chips multi-select lun-dom. Por defecto todos seleccionados.
   - **Turnos permitidos**: chips multi-select Comida / Cena. Por defecto ambos.
   - **Activo**: switch (default ON).
3. Guardar → INSERT con `codigo` auto, `stock_consumido=0`.

**Canjear cupón en reserva (admin o público)**
1. Empleado o cliente rellena la reserva. En la sección "Cupón" hay un input "Código (6 caracteres)".
2. Al escribir y hacer blur (con debounce 300 ms), action `validarCuponAction(codigo, empresaId, fecha, turno)` devuelve:
   - `OK` → muestra chip verde "✅ Cupón válido: <título cliente>"
   - `NO_EXISTE` → "❌ No existe ningún cupón con ese código"
   - `INACTIVO` → "❌ Cupón inactivo"
   - `CADUCADO` → "❌ Cupón caducado el dd/mm/yyyy"
   - `AGOTADO` → "❌ Cupón agotado (50/50)"
   - `DIA_NO_PERMITIDO` → "❌ Cupón válido solo lun-jue"
   - `TURNO_NO_PERMITIDO` → "❌ Cupón válido solo en cenas"
3. Al guardar la reserva con cupón válido:
   - Server re-valida (defensa en profundidad).
   - Llama `consumir_stock_cupon(codigo_id, num_personas_o_1)`. Si falla por concurrencia, NO crea reserva.
   - INSERT reserva con `codigo_id` + `codigo` (snapshot del texto del código).
4. El campo `tipo_categoria` se queda como esté (probablemente `gratis`). Política de cancelación independiente.

**Cliente final**
- Pantalla de éxito: bloque destacado "Cupón aplicado: `K7M2X9` — Tu regalo de bienvenida".
- Email de confirmación: misma info.
- En el listado/detalle de la reserva en admin: chip "Cupón K7M2X9" en `ReservaFlagsChips`; al pasar el cursor muestra tooltip con título interno y descripción.

**Lo que NO hace v1**
- No genera cupones automáticos desde campañas / cumpleaños / reseñas.
- No se conecta al POS para aplicar descuento real al ticket.
- No alimenta `v_campanas_atribucion`. Esa vista es solo para campañas (PRP-046).
- No restringe por nº personas mín/máx.
- No tiene fecha de inicio (solo caducidad).

---

## Contexto

### Referencias (código existente)

- `src/features/sala/data/reservas.ts:179-215` — tipos viejos `ReservaCodigo*` a reemplazar.
- `src/features/sala/actions/reserva-codigos-actions.ts` — CRUD viejo; rehacer.
- `src/features/sala/components/reservas/config/CodigosTab.tsx` — pestaña dentro de config; **mover a submódulo propio `/sala/cupones`**.
- `src/features/sala/components/reservas/config/CodigoForm.tsx` — form viejo; reemplazar.
- `src/features/sala/actions/reservas-actions.ts:241-422` — `createReserva` / `updateReserva`; añadir validación + consumo si viene `codigoCupon`.
- `src/features/reservar-publica/actions/crear-reserva-publica.ts:60-77` — bloque "Código → solo aviso" a reemplazar por validar + consumir.
- `src/features/reservar-publica/actions/comprobar-cliente-publico.ts` — patrón para action de validación inline.
- `src/features/reservar-publica/components/ReservaPublicaForm.tsx` — añadir campo cupón con feedback inline.
- `src/features/sala/components/reservas/ReservaFlagsChips.tsx` — añadir chip "Cupón K7M2X9".
- `src/features/sala/components/ReservasView.tsx` — mostrar código en fila.
- `src/lib/email/templates/reserva-confirmada.ts` — añadir bloque cupón.
- Memorias relevantes: `feedback_barra_horizontal_1.md`, `feedback_capitalizacion_textos_ui.md`, `feedback_titulo_pagina.md`, `feedback_validaciones_inline.md`, `feedback_cambios_multi_tenant.md`, `project_rls_helper_empresas_del_usuario.md`, `project_horarios_comida_cena_no_solapan.md`.

### Estado actual de BD

- `reserva_codigos` existe con 0 filas. Columnas viejas: `nombre, descripcion, tipo_promocion, min_personas, max_personas, fecha_inicio, fecha_fin, stock_total, stock_consumido, turnos (enum), restriccion_especial, es_descuento, porcentaje_descuento, dias_semana, activo`. Se DROPea entera.
- `reservas.codigo_id UUID NULL REFERENCES reserva_codigos(id)` ya existe → se mantiene.
- `reservas.codigo_nombre TEXT NULL` ya existe → se renombra a `codigo` (text del código de 6 chars, snapshot).
- `tipo_categoria CHECK IN ('gratis','politica','cupon')` se mantiene, pero el cupón NO la fija automáticamente. Es responsabilidad del operador si quiere marcarla.

### Arquitectura Propuesta (Feature-First)

```
src/features/sala/
├── cupones/                                # NUEVO submódulo
│   ├── data/
│   │   └── cupones.ts                      # tipos + constantes
│   ├── actions/
│   │   ├── cupones-actions.ts              # CRUD admin
│   │   └── validar-cupon-action.ts         # validación inline (admin + público)
│   ├── lib/
│   │   └── validar-cupon.ts                # helper puro de validación
│   └── components/
│       ├── CuponesView.tsx                 # lista + barra horizontal 1
│       ├── CuponDrawer.tsx                 # crear/editar
│       └── CuponInputReserva.tsx           # input compartido para form reserva
├── data/reservas.ts                        # +campo codigoCupon en Reserva
├── actions/reservas-actions.ts             # +rama cupón en create/update
└── components/reservas/
    ├── ReservaFlagsChips.tsx               # +chip "Cupón K7M2X9"
    └── ReservasView.tsx                    # +mostrar código en fila

src/features/reservar-publica/
├── actions/
│   ├── crear-reserva-publica.ts            # +validar + consumir cupón
│   └── validar-cupon-publico-action.ts     # action pública (anon-friendly)
└── components/
    └── ReservaPublicaForm.tsx              # +CuponInputReserva

src/app/(main)/sala/
└── cupones/page.tsx                        # ruta nueva
```

### Modelo de Datos (DDL)

```sql
-- ============================================================
-- Migración 1: DROP reserva_codigos viejo (vacío) y RECREATE
-- ============================================================

-- Primero limpiar referencias en reservas (también vacías):
ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_codigo_id_fkey;

ALTER TABLE public.reservas
  RENAME COLUMN codigo_nombre TO codigo;

DROP TABLE IF EXISTS public.reserva_codigos CASCADE;

CREATE TABLE public.reserva_codigos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  codigo                TEXT NOT NULL CHECK (codigo ~ '^[A-Z0-9]{6}$'),
  titulo_interno        TEXT NOT NULL CHECK (length(titulo_interno) BETWEEN 1 AND 120),
  titulo_cliente        TEXT NULL CHECK (titulo_cliente IS NULL OR length(titulo_cliente) BETWEEN 1 AND 120),

  beneficio_tipo        TEXT NOT NULL CHECK (beneficio_tipo IN ('porcentaje','importe','producto_gratis')),
  beneficio_valor       NUMERIC(10,2) NULL,           -- porcentaje (1-100) o importe (>=0)
  producto_descripcion  TEXT NULL CHECK (producto_descripcion IS NULL OR length(producto_descripcion) BETWEEN 1 AND 200),

  unidad_stock          TEXT NOT NULL CHECK (unidad_stock IN ('reservas','personas')),
  stock_total           INT NOT NULL CHECK (stock_total >= 1),
  stock_consumido       INT NOT NULL DEFAULT 0 CHECK (stock_consumido >= 0),

  fecha_caducidad       DATE NULL,
  dias_semana           TEXT[] NOT NULL DEFAULT ARRAY['lun','mar','mie','jue','vie','sab','dom']::TEXT[],
  turnos                TEXT[] NOT NULL DEFAULT ARRAY['COMIDA','CENA']::TEXT[],

  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Coherencia beneficio / valor / descripcion
  CONSTRAINT cupon_beneficio_coherente CHECK (
    (beneficio_tipo = 'porcentaje'      AND beneficio_valor BETWEEN 1 AND 100 AND producto_descripcion IS NULL)
    OR (beneficio_tipo = 'importe'      AND beneficio_valor >= 0              AND producto_descripcion IS NULL)
    OR (beneficio_tipo = 'producto_gratis' AND beneficio_valor IS NULL        AND producto_descripcion IS NOT NULL)
  ),

  -- Stock consumido no supera total
  CONSTRAINT cupon_stock_no_supera_total CHECK (stock_consumido <= stock_total),

  -- Código único por empresa
  CONSTRAINT cupon_codigo_unico_empresa UNIQUE (empresa_id, codigo)
);

CREATE INDEX reserva_codigos_empresa_idx ON public.reserva_codigos(empresa_id);
CREATE INDEX reserva_codigos_codigo_idx  ON public.reserva_codigos(empresa_id, codigo);

-- FK desde reservas
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_codigo_id_fkey
    FOREIGN KEY (codigo_id) REFERENCES public.reserva_codigos(id) ON DELETE SET NULL;

-- updated_at trigger (reutilizar trigger existente set_updated_at)
CREATE TRIGGER reserva_codigos_set_updated_at
  BEFORE UPDATE ON public.reserva_codigos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.reserva_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserva_codigos_select_empresa
  ON public.reserva_codigos FOR SELECT TO authenticated
  USING (empresa_id = ANY (public.empresas_del_usuario()));

CREATE POLICY reserva_codigos_insert_empresa
  ON public.reserva_codigos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = ANY (public.empresas_del_usuario()));

CREATE POLICY reserva_codigos_update_empresa
  ON public.reserva_codigos FOR UPDATE TO authenticated
  USING (empresa_id = ANY (public.empresas_del_usuario()))
  WITH CHECK (empresa_id = ANY (public.empresas_del_usuario()));

CREATE POLICY reserva_codigos_delete_empresa
  ON public.reserva_codigos FOR DELETE TO authenticated
  USING (empresa_id = ANY (public.empresas_del_usuario()));

-- ============================================================
-- Migración 2: RPC generar_codigo_cupon (helper interno)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generar_codigo_cupon(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_chars  TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_code   TEXT;
  v_attempt INT := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * 36)::INT + 1, 1);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM public.reserva_codigos
      WHERE empresa_id = p_empresa_id AND codigo = v_code
    ) THEN
      RETURN v_code;
    END IF;

    v_attempt := v_attempt + 1;
    IF v_attempt > 50 THEN
      RAISE EXCEPTION 'No se pudo generar código único tras 50 intentos';
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_codigo_cupon(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_codigo_cupon(UUID) TO authenticated, service_role;

-- ============================================================
-- Migración 3: RPC consumir_stock_cupon (atómica, service_role)
-- ============================================================
CREATE OR REPLACE FUNCTION public.consumir_stock_cupon(
  p_codigo_id UUID,
  p_personas  INT
) RETURNS public.reserva_codigos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.reserva_codigos;
  v_consume INT;
BEGIN
  IF p_personas < 1 THEN
    RAISE EXCEPTION 'personas inválidas';
  END IF;

  SELECT * INTO v_row FROM public.reserva_codigos WHERE id = p_codigo_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NO_EXISTE'; END IF;
  IF NOT v_row.activo THEN RAISE EXCEPTION 'INACTIVO'; END IF;

  v_consume := CASE WHEN v_row.unidad_stock = 'personas' THEN p_personas ELSE 1 END;

  IF v_row.stock_consumido + v_consume > v_row.stock_total THEN
    RAISE EXCEPTION 'AGOTADO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.reserva_codigos
    SET stock_consumido = stock_consumido + v_consume,
        updated_at      = NOW()
    WHERE id = p_codigo_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_stock_cupon(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_stock_cupon(UUID, INT) TO service_role;

-- ============================================================
-- Migración 4: RPC validar_cupon (pública, anon + authenticated)
-- ============================================================
-- Devuelve ok + motivo + datos públicos del cupón. NUNCA expone stock_total / stock_consumido.
CREATE OR REPLACE FUNCTION public.validar_cupon(
  p_empresa_id UUID,
  p_codigo     TEXT,
  p_fecha      DATE,
  p_turno      TEXT  -- 'COMIDA' o 'CENA'
) RETURNS TABLE (
  ok                    BOOLEAN,
  motivo                TEXT,
  cupon_id              UUID,
  titulo_cliente_efectivo TEXT,
  beneficio_tipo        TEXT,
  beneficio_valor       NUMERIC,
  producto_descripcion  TEXT,
  fecha_caducidad       DATE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v public.reserva_codigos;
  v_dia_key TEXT;
  v_codigo_norm TEXT;
BEGIN
  v_codigo_norm := UPPER(regexp_replace(COALESCE(p_codigo,''), '\s+', '', 'g'));
  IF v_codigo_norm !~ '^[A-Z0-9]{6}$' THEN
    RETURN QUERY SELECT FALSE, 'NO_EXISTE', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::DATE;
    RETURN;
  END IF;

  SELECT * INTO v FROM public.reserva_codigos
    WHERE empresa_id = p_empresa_id AND codigo = v_codigo_norm LIMIT 1;

  IF v.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'NO_EXISTE', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::DATE;
    RETURN;
  END IF;

  IF NOT v.activo THEN
    RETURN QUERY SELECT FALSE, 'INACTIVO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno), v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;

  IF v.fecha_caducidad IS NOT NULL AND p_fecha > v.fecha_caducidad THEN
    RETURN QUERY SELECT FALSE, 'CADUCADO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno), v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;

  v_dia_key := (ARRAY['dom','lun','mar','mie','jue','vie','sab'])[EXTRACT(DOW FROM p_fecha)::INT + 1];
  IF NOT (v_dia_key = ANY (v.dias_semana)) THEN
    RETURN QUERY SELECT FALSE, 'DIA_NO_PERMITIDO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno), v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;

  IF p_turno IS NOT NULL AND NOT (p_turno = ANY (v.turnos)) THEN
    RETURN QUERY SELECT FALSE, 'TURNO_NO_PERMITIDO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno), v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;

  IF v.stock_consumido >= v.stock_total THEN
    RETURN QUERY SELECT FALSE, 'AGOTADO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno), v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v.id, COALESCE(v.titulo_cliente, v.titulo_interno), v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_cupon(UUID, TEXT, DATE, TEXT) TO anon, authenticated;
```

### Server Actions

| Archivo | Cambio |
|---|---|
| `src/features/sala/cupones/actions/cupones-actions.ts` | NUEVO. `listCuponesAction`, `createCuponAction` (genera código vía RPC), `updateCuponAction`, `togglarActivoCuponAction`, `deleteCuponAction`. |
| `src/features/sala/cupones/actions/validar-cupon-action.ts` | NUEVO. Wrapper de RPC `validar_cupon` para form admin. |
| `src/features/reservar-publica/actions/validar-cupon-publico-action.ts` | NUEVO. Wrapper público con slug → empresa_id. |
| `src/features/sala/cupones/lib/validar-cupon.ts` | NUEVO. Helper puro server-side que llama a la RPC. |
| `src/features/sala/actions/reservas-actions.ts` | Si `codigoCupon` viene: validar (RPC), llamar `consumir_stock_cupon` con `num_personas`, snapshot `codigo` + `codigo_id` en reserva. Si falla, abortar sin crear reserva. |
| `src/features/reservar-publica/actions/crear-reserva-publica.ts` | Reemplazar bloque "solo aviso" por el mismo flujo. |

### Componentes UI

| Archivo | Cambio |
|---|---|
| `src/features/sala/cupones/components/CuponesView.tsx` | NUEVO. BARRA HORIZONTAL 1 (`+ Nuevo` + buscar + 3 iconos). Tabla con columnas: código (mono), título interno, tipo beneficio, valor, stock (`X/Y`), caducidad, días, turnos, estado. |
| `src/features/sala/cupones/components/CuponDrawer.tsx` | NUEVO. Form crear/editar. Código read-only con botón "Copiar". Validación inline tolerante. |
| `src/features/sala/cupones/components/CuponInputReserva.tsx` | NUEVO. Input compartido (admin + público) con feedback ✅/❌ y debounce 300 ms. |
| `src/features/sala/components/reservas/ReservaFlagsChips.tsx` | +chip "Cupón K7M2X9" cuando `reserva.codigo` no es null. Tooltip con título interno + beneficio. |
| `src/features/sala/components/ReservasView.tsx` | Mostrar `codigo` en columna opcional. Incluir `CuponInputReserva` en ReservaDrawer. |
| `src/features/reservar-publica/components/ReservaPublicaForm.tsx` | Incluir `CuponInputReserva` antes de submit. |
| `src/app/(main)/sala/cupones/page.tsx` | NUEVO. Server component que renderiza `CuponesView`. |
| `src/lib/email/templates/reserva-confirmada.ts` | Bloque opcional "Cupón aplicado: <código> — <título cliente>". |
| `src/features/layout/components/app-sidebar.tsx` | Añadir entrada "Cupones" bajo Sala. |
| `src/features/sala/components/reservas/config/CodigosTab.tsx` | ELIMINAR (la pestaña ya no vive en config; se mueve a su propio submódulo). |

---

## Blueprint (Assembly Line)

### Fase 1: Migración BD — DROP/RECREATE reserva_codigos + RPC helpers
**Objetivo**: tabla nueva con CHECKs, RLS multi-tenant, índices, trigger updated_at, RPC `generar_codigo_cupon`.
**Validación**: `\d reserva_codigos`; INSERT manual respeta CHECKs (porcentaje fuera de 1-100 falla, producto sin descripción falla, etc.); RLS aísla Habana vs Bacanal.

### Fase 2: Migración BD — RPC consumir_stock_cupon + validar_cupon
**Objetivo**: las 2 RPCs. Consumo atómico; validación pública sin filtrar stock interno.
**Validación**: 2 llamadas concurrentes a `consumir_stock_cupon` con stock 1 → solo 1 pasa; `validar_cupon` devuelve cada motivo en pruebas manuales.

### Fase 3: Tipos + data + acciones admin (`cupones/`)
**Objetivo**: nuevo módulo `features/sala/cupones` con tipos, actions CRUD, helper validación.
**Validación**: `npm run typecheck` OK; creación de cupón desde script de prueba devuelve código de 6 chars único.

### Fase 4: UI submódulo /sala/cupones
**Objetivo**: `CuponesView` + `CuponDrawer` + ruta `/sala/cupones` + entrada en sidebar. BARRA HORIZONTAL 1, sentence case, sin duplicar título.
**Validación**: visual; crear, editar, pausar/reactivar, borrar funcionan.

### Fase 5: Input cupón en reservas (admin)
**Objetivo**: `CuponInputReserva` integrado en ReservaDrawer admin. Validación inline + consumo en `createReservaAction`/`updateReservaAction`. Chip "Cupón XXXXXX" en `ReservaFlagsChips`.
**Validación**: Playwright: crear reserva con cupón válido (chip aparece, stock baja); con cupón inexistente (error inline, no se guarda); con cupón agotado (error).

### Fase 6: Input cupón en /reservar/[slug] (público)
**Objetivo**: misma UI en form público. RPC pública `validar_cupon` por slug → empresa. Email confirmación incluye bloque cupón.
**Validación**: Playwright: cliente reserva con cupón válido (pantalla éxito + email lo muestran); con cupón caducado, error inline.

### Fase 7: Eliminar legado y QA final
**Objetivo**: borrar `CodigosTab`, `CodigoForm`, viejas actions, tipos viejos. Verificar `git grep "ReservaCodigo"` vacío salvo en módulo nuevo (renombrar a `Cupon`).
**Validación**:
- [ ] `npm run typecheck` y `npm run build` OK.
- [ ] Playwright end-to-end:
  - [ ] Admin crea cupón `Welcome` (porcentaje 10%, stock 5 reservas, caducidad +30d, todos días, ambos turnos) → código auto generado.
  - [ ] Cliente público reserva con ese código para 4 personas → reserva guarda `codigo` + `codigo_id`; stock 1/5.
  - [ ] 2º cliente reserva con mismo código → 2/5.
  - [ ] Crear cupón `BebidaCava` (producto_gratis, descripción "Botella de cava 75 cl", stock 10 personas) → reserva de 4 personas baja stock a 4/10.
  - [ ] Cancelar reserva → stock NO se devuelve.
  - [ ] Admin intenta editar campo `codigo` → bloqueado (read-only).
  - [ ] Cupón caducado: error "Cupón caducado el dd/mm".
  - [ ] Habana no ve cupones de Bacanal (RLS).
- [ ] `mcp__supabase__get_advisors` sin warnings nuevos.

---

## Gotchas

- [ ] **Producción está vacía** → DROP de `reserva_codigos` seguro. Si en algún momento alguien siembra antes de aplicar la migración, hay que vaciar primero.
- [ ] El cupón **NO toca `tipo_categoria`**. Si una reserva tiene cupón Y `tipo_categoria='politica'` Y `importe_pagado>0`, son 3 cosas independientes que coexisten.
- [ ] Stock NUNCA se devuelve al cancelar/no-show/borrar. Decidido por simplicidad y para evitar fraude (mismo principio que tickets PRP-051).
- [ ] `consumir_stock_cupon` solo desde service_role. NUNCA desde anon/authenticated directamente.
- [ ] `validar_cupon` NO devuelve `stock_total`/`stock_consumido`. Solo `ok` + motivo + datos públicos (anti-fraude).
- [ ] Código auto-generado siempre por la RPC `generar_codigo_cupon`; nunca aceptarlo del cliente en el INSERT.
- [ ] Validación tolerante en el input: hasta que el usuario no ha escrito 6 chars (o ha hecho blur), NO mostrar error.
- [ ] Cuando `unidad_stock='personas'` y la reserva trae 4 personas, consume 4 unidades aunque el cupón "se aplique a 1 reserva". Dejar claro en el form: helper text "El stock se descontará en función del número de personas de la reserva".
- [ ] Multi-tenant: cupones por empresa. Habana y Bacanal pueden tener códigos idénticos (`K7M2X9` en ambas) sin colisión, porque el UNIQUE es `(empresa_id, codigo)`.

## Anti-Patrones

- NO crear lógica de descuento automático en el POS (out of scope v1).
- NO alimentar `v_campanas_atribucion` desde cupones.
- NO mezclar con tickets (PRP-051): son tablas, flujos y propósitos distintos.
- NO permitir editar el `codigo` desde ninguna UI.
- NO devolver stock al cancelar/no-show.
- NO mostrar stock interno en la RPC pública.
- NO fijar `tipo_categoria='cupon'` automáticamente al aplicar cupón.
- NO leer/escribir `stock_consumido` directamente desde el cliente.
- NO tocar empresa concreta en migraciones.

---

*PRP pendiente aprobación. No se ha modificado código.*
