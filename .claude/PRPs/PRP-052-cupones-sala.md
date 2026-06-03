# PRP-052: Cupones de sala — códigos promocionales con vigencia, stock y descuento real

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-02
> **Proyecto**: Balles-Hosteleros (módulo Sala / Reservas)

---

## Objetivo

Convertir los actuales "códigos promocionales" de reservas (`reserva_codigos`, hoy stub que solo guarda el texto del código en la reserva) en cupones **realmente funcionales**: validados al introducirlos (vigencia, día de la semana, turno, personas, stock), consumidos atómicamente al confirmar la reserva, vinculados a la reserva por id, surface‑ados como chip y, cuando el cupón es de descuento, expuestos al POS como porcentaje a aplicar.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy un código promocional se introduce en la reserva pero NO se valida: la fecha de fin, los días, el stock, el min/max personas y los turnos se ignoran. Solo se enlaza por nombre. | Validación dura en server (admin y público) con mismas reglas que el panel de configuración, antes de insertar la reserva. |
| El stock del cupón nunca se descuenta. Un cupón con "stock 50" se puede usar infinitas veces. | RPC atómica `consumir_stock_cupon` invocada en la creación de reserva (igual patrón que tickets en PRP-051, pero NO bloquea por no-show). |
| El descuento (% sobre la cuenta) no llega a sala/POS. Hoy se queda en el panel de configuración. | Snapshot del % en la reserva (`cupon_porcentaje_descuento`) y chip "Cupón −X%" en `ReservasView` / `ReservaFlagsChips`, listo para que el POS lo lea cuando se cablée. |
| `tipo_categoria='cupon'` hoy significa "pago anticipado" y NO está conectado con `reserva_codigos`. Son dos conceptos sin relación. | Mantener `cupon` como semántica de "reserva con cupón" y diferenciarlo del nuevo `ticket` (PRP-051, pago real). Un cupón aplicado fija `tipo_categoria='cupon'` automáticamente y, si tiene importe prepagado real, se sigue rellenando `importe_pagado`. |
| Códigos de tipo "grupo" o "contador de personas" no descuentan del aforo ni se reportan en métricas de campaña. | Que el código aplicado quede registrado en `reservas.codigo_id` (ya existe) + nuevo `cupon_aplicado_at` y se cuente en `v_campanas_atribucion` para medir ROI de campañas. |

**Valor de negocio**: campañas promocionales (influencers, prensa, eventos especiales) con stock real garantizado, control de fraude (no se reusa un código agotado), atribución medible y un puente claro hacia el POS para aplicar el descuento en el ticket.

## Qué

### Criterios de Éxito

- [ ] Al introducir un código en `/reservar/<slug>` o en el formulario interno de reservas, el server valida: existe, está activo, está dentro de `fecha_inicio`/`fecha_fin`, día actual de la semana está permitido (o `dias_semana` vacío), turno de la reserva está cubierto por `turnos`, personas ∈ `[min_personas, max_personas]` (o `max=-1`), y queda stock (`stock_total=0` → ilimitado).
- [ ] RPC `consumir_stock_cupon(codigo_id, unidades)` resta atómicamente y rechaza con `'AGOTADO'` si supera `stock_total`. `unidades = personas` si `tipo_promocion='grupo'`, en otro caso `unidades = 1`.
- [ ] Stock NO se devuelve nunca (igual regla que tickets): cancelar / no-show / cambio de fecha / borrar reserva NO incrementa stock hacia abajo. Documentado en gotchas.
- [ ] Reserva con cupón aplicado guarda: `codigo_id`, `codigo_nombre` (snapshot), `cupon_porcentaje_descuento` (snapshot si el cupón era de descuento), `cupon_aplicado_at` (timestamp), `tipo_categoria='cupon'`.
- [ ] Mensajes de error claros y específicos en cliente público: "Código no válido", "Código caducado", "Código agotado", "Código no válido para este número de personas", "Código no válido para este turno", "Código no válido este día de la semana". Sin filtrar información de stock interna.
- [ ] Si la reserva ya tiene `tipo_categoria='cupon'` con `importe_pagado` (pago anticipado manual desde admin) y además se aplica un código, ambos conviven (importe_pagado intacto, `cupon_porcentaje_descuento` añadido).
- [ ] `ReservaFlagsChips` muestra un chip "Cupón −X%" cuando hay descuento, y mantiene el chip "Cupón pagado Y€" cuando hay `importe_pagado`. Se pueden ver los dos a la vez.
- [ ] `ReservasView` muestra el código aplicado (texto del cupón) como dato visible en la fila, además del chip.
- [ ] La vista `v_campanas_atribucion` se amplía para contar reservas con cupón aplicado por tipo (`restaurante_contador`, `grupo`, `descuento`) y para cruzar con `origen` (UTM).
- [ ] El input público de "Código promocional" en `/reservar/<slug>` valida en tiempo real con un `comprobar-codigo-publico.ts` (mismo patrón que `comprobar-cliente-publico.ts`) y muestra ✅/❌ antes del submit.
- [ ] `CodigosTab` muestra columna "Stock consumido" actualizada en vivo después de cada reserva (refetch o realtime), y badge rojo cuando `stock_consumido >= stock_total`.
- [ ] Toda política RLS nueva usa `empresas_del_usuario()` / `empresas_del_usuario_text()`. Migraciones afectan a TODAS las empresas presentes y futuras (sin tocar empresa concreta).
- [ ] Reglas UI activas aplicadas: BARRA HORIZONTAL 1 en `CodigosTab`, sentence case en labels/títulos, header sin duplicar título de la vista, validaciones inline tolerantes (no muestran error mientras el usuario escribe un prefijo aún válido).

### Comportamiento Esperado

**Configuración (admin restaurante)**
1. Admin entra a Sala → Configuración → Reservas → pestaña "Códigos promocionales".
2. La pestaña ahora se titula "Cupones" en el header (sentence case) y mantiene el patrón BARRA HORIZONTAL 1.
3. Crea/edita un cupón con el formulario actual (campos ya existen: nombre, descripción, tipo, min/max personas, fechas, stock, turnos, restricción, %descuento, días).
4. La lista muestra ahora: nombre · tipo · turnos · vigencia · `stock_consumido / stock_total` · personas permitidas · días · estado.
5. Cuando `stock_consumido >= stock_total` y stock no es 0/ilimitado: badge "Agotado" en rojo y el cupón deja de aplicarse aunque siga `activo=true`.

**Flujo público (cliente final)**
1. Cliente abre `/reservar/<slug>?o=instagram` o `/reservar/<slug>/<keyword>`.
2. Rellena fecha/hora/personas/datos.
3. (Opcional) Introduce un código promocional. Al cambiar el campo (debounced) se llama a `comprobarCodigoPublicoAction`:
   - Si pasa todas las validaciones → ✅ "Cupón válido: 10% de descuento" (o el detalle del tipo).
   - Si falla → ❌ con el motivo concreto.
4. Al confirmar:
   - `findOrLinkClienteSala` resuelve cliente.
   - Si hay código → server re‑valida (defensa en profundidad) y llama `consumir_stock_cupon`. Si falla, devuelve error y NO crea reserva.
   - `asignarMesaAutomatica` asigna mesa.
   - INSERT en `reservas` con `codigo_id`, `codigo_nombre`, `cupon_porcentaje_descuento`, `cupon_aplicado_at`, `tipo_categoria='cupon'`.
5. Pantalla de éxito incluye recordatorio del cupón aplicado: "Tu cupón <NOMBRE> dará 10% en el restaurante".

**Flujo admin (reserva interna)**
1. Empleado abre `+ Nueva reserva` en `/sala/reservas`.
2. Rellena datos y selecciona en el desplegable de "Tipo" el valor `Cupón` (UI ya existe), o introduce un código en un nuevo campo opcional "Código promocional" del formulario.
3. Submit: si hay código, mismo flujo de validación + consumo de stock que el público.

**Aplicación en sala / POS (out of scope v1 pero preparado)**
- El POS lee `reservas.cupon_porcentaje_descuento` y lo aplica al ticket. v1 solo expone el dato; el cableado real al ticket se hace cuando el POS esté listo.

---

## Contexto

### Referencias (código existente — usar como patrón)
- `src/features/sala/data/reservas.ts:179-215` — tipos `ReservaCodigo*` y labels. Añadir campo `stockConsumido` ya existe; añadir `cuponPorcentajeDescuento` a `Reserva`.
- `src/features/sala/actions/reserva-codigos-actions.ts` — CRUD admin; patrón a seguir para añadir RPC consumo.
- `src/features/sala/components/reservas/config/CodigosTab.tsx` — lista actual; añadir badge "Agotado", contador en vivo, renombrar título a "Cupones".
- `src/features/sala/components/reservas/config/CodigoForm.tsx` — formulario admin; ya cubre todos los campos necesarios.
- `src/features/sala/actions/reservas-actions.ts:241-422` — `createReserva` / `updateReserva`; añadir rama de validación + consumo de cupón.
- `src/features/reservar-publica/actions/crear-reserva-publica.ts:60-77` — lógica actual "solo aviso" que hay que reemplazar por validación dura + consumo de stock.
- `src/features/reservar-publica/actions/comprobar-cliente-publico.ts` — patrón para `comprobarCodigoPublicoAction` (dry-run validación).
- `src/features/reservar-publica/components/ReservaPublicaForm.tsx` — añadir feedback ✅/❌ del cupón en el campo "Código promocional".
- `src/features/sala/components/reservas/ReservaFlagsChips.tsx:75-77` — chip "Cupón pagado X€"; añadir chip paralelo "Cupón −X%".
- `src/features/sala/components/ReservasView.tsx:556,820,860,1138` — manejo de `tipoCategoria='cupon'` y `importePagado`; añadir tratamiento de descuento y campo `codigoNombre`.
- `src/features/sala/actions/analitica-origen-actions.ts` — para extender `v_campanas_atribucion` con métricas de cupón.
- Memoria `project_reservas_tipo_y_etiqueta.md` — `tipo_categoria` (gratis/politica/cupon) gobierna política/garantía/importe; alinear con cuponPorcentajeDescuento.
- Memoria `project_reservas_dedup_cliente.md` — `find_or_link_cliente_sala` para vincular cliente.
- Memoria `project_rls_helper_empresas_del_usuario.md` — RLS obligatorio multi-tenant.
- Memoria `project_campanas_marketing_atribucion.md` — PRP-046: `v_campanas_atribucion` a extender.
- Memoria `feedback_barra_horizontal_1.md` — toolbar minimalista por defecto.
- Memoria `feedback_capitalizacion_textos_ui.md` — sentence case en toda UI.
- Memoria `feedback_titulo_pagina.md` — no duplicar título de la vista.
- Memoria `feedback_validaciones_inline.md` — validaciones tolerantes mientras se teclea.
- Memoria `feedback_cambios_multi_tenant.md` — cambios al software, no a empresa concreta.

### Estado actual de BD (consultado en código)
- `reserva_codigos`: tabla creada con columnas `nombre`, `descripcion`, `tipo_promocion`, `min_personas`, `max_personas`, `fecha_inicio`, `fecha_fin`, `stock_total`, `stock_consumido`, `turnos`, `restriccion_especial`, `es_descuento`, `porcentaje_descuento`, `dias_semana`, `activo`. RLS multi-tenant existente.
- `reservas`: ya tiene `codigo_id UUID NULL REFERENCES reserva_codigos(id)` y `codigo_nombre TEXT NULL`. NO tiene `cupon_porcentaje_descuento` ni `cupon_aplicado_at`. `tipo_categoria` con CHECK `IN ('gratis','politica','cupon')`.
- `reserva_codigos.stock_consumido` ya existe pero nunca se incrementa hoy.
- RPCs existentes: `empresas_del_usuario`, `find_or_link_cliente_sala`, `try_reservar_slot`, `registrar_visita_cliente_sala`.

### Arquitectura Propuesta (Feature-First)

Reutilizar las features existentes (no crear feature nueva):

```
src/features/sala/
├── data/
│   └── reservas.ts                       # +campo cuponPorcentajeDescuento, cuponAplicadoAt en Reserva
├── actions/
│   ├── reserva-codigos-actions.ts        # +validarCupon(codigoId, ctx)
│   └── reservas-actions.ts               # +rama cupón en create/update (validar + consumir)
└── components/reservas/
    ├── ReservaFlagsChips.tsx             # +chip "Cupón −X%"
    ├── ReservasView.tsx                  # +mostrar código aplicado en fila
    └── config/
        └── CodigosTab.tsx                # +badge "Agotado", contador en vivo, título "Cupones"

src/features/reservar-publica/
├── actions/
│   ├── comprobar-codigo-publico.ts       # NUEVO: validación dry-run
│   └── crear-reserva-publica.ts          # reemplazar "solo aviso" por validar + consumir
└── components/
    └── ReservaPublicaForm.tsx            # +feedback ✅/❌ del código

src/features/sala/lib/
└── validar-cupon.ts                      # NUEVO: pura helper compartida (admin + público + server)
```

### Modelo de Datos (DDL final propuesto)

```sql
-- ============================================================
-- Migración 1: columnas snapshot de cupón en reservas
-- ============================================================
ALTER TABLE public.reservas
  ADD COLUMN cupon_porcentaje_descuento NUMERIC(5,2)
    CHECK (cupon_porcentaje_descuento IS NULL
           OR (cupon_porcentaje_descuento >= 0 AND cupon_porcentaje_descuento <= 100)),
  ADD COLUMN cupon_aplicado_at          TIMESTAMPTZ;

-- Coherencia: si hay descuento o timestamp, debe existir codigo_id
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_cupon_coherente CHECK (
    (cupon_porcentaje_descuento IS NULL AND cupon_aplicado_at IS NULL)
    OR codigo_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS reservas_codigo_id_idx
  ON public.reservas (codigo_id) WHERE codigo_id IS NOT NULL;

-- ============================================================
-- Migración 2: RPC consumo atómico de stock de cupón
-- ============================================================
CREATE OR REPLACE FUNCTION public.consumir_stock_cupon(
  p_codigo_id UUID,
  p_unidades  INT
) RETURNS public.reserva_codigos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.reserva_codigos;
BEGIN
  IF p_unidades <= 0 THEN
    RAISE EXCEPTION 'unidades inválidas';
  END IF;

  -- stock_total = 0 significa ilimitado (convención existente del módulo)
  UPDATE public.reserva_codigos
    SET stock_consumido = stock_consumido + p_unidades,
        updated_at      = NOW()
    WHERE id = p_codigo_id
      AND activo = TRUE
      AND (stock_total = 0
           OR stock_consumido + p_unidades <= stock_total)
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'AGOTADO' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_stock_cupon(UUID, INT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consumir_stock_cupon(UUID, INT)
  TO service_role;
-- Se llama desde Server Action con admin client; NUNCA expuesta a anon.

-- ============================================================
-- Migración 3: RPC pública (SECURITY DEFINER) para validar un código
-- ============================================================
-- Devuelve estructura mínima: existencia + razón de invalidez si no aplica.
-- NO devuelve stock_consumido ni stock_total.
CREATE OR REPLACE FUNCTION public.validar_codigo_publico(
  p_empresa_slug TEXT,
  p_codigo       TEXT,
  p_fecha        DATE,
  p_turno        TEXT,    -- 'COMIDA' | 'CENA'
  p_personas     INT
) RETURNS TABLE (
  ok                     BOOLEAN,
  motivo                 TEXT,     -- null si ok=true
  tipo_promocion         TEXT,
  es_descuento           BOOLEAN,
  porcentaje_descuento   NUMERIC,
  nombre                 TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id UUID;
  v_codigo     public.reserva_codigos;
  v_dia_key    TEXT;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_empresa_slug;
  IF v_empresa_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'NO_EXISTE', NULL::TEXT, NULL::BOOLEAN, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_codigo
    FROM public.reserva_codigos
    WHERE empresa_id = v_empresa_id
      AND nombre = UPPER(regexp_replace(p_codigo, '\s+', '', 'g'))
    LIMIT 1;

  IF v_codigo.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'NO_EXISTE', NULL::TEXT, NULL::BOOLEAN, NULL::NUMERIC, NULL::TEXT; RETURN;
  END IF;
  IF NOT v_codigo.activo THEN
    RETURN QUERY SELECT FALSE, 'INACTIVO', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;
  IF p_fecha < v_codigo.fecha_inicio OR p_fecha > v_codigo.fecha_fin THEN
    RETURN QUERY SELECT FALSE, 'FUERA_DE_VIGENCIA', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;
  IF p_personas < v_codigo.min_personas OR (v_codigo.max_personas <> -1 AND p_personas > v_codigo.max_personas) THEN
    RETURN QUERY SELECT FALSE, 'PERSONAS_FUERA_DE_RANGO', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;
  IF v_codigo.turnos = 'comida' AND p_turno <> 'COMIDA' THEN
    RETURN QUERY SELECT FALSE, 'TURNO_NO_PERMITIDO', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;
  IF v_codigo.turnos = 'cena' AND p_turno <> 'CENA' THEN
    RETURN QUERY SELECT FALSE, 'TURNO_NO_PERMITIDO', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;
  v_dia_key := (ARRAY['dom','lun','mar','mie','jue','vie','sab'])[EXTRACT(DOW FROM p_fecha)::INT + 1];
  IF array_length(v_codigo.dias_semana, 1) IS NOT NULL
     AND NOT (v_dia_key = ANY (v_codigo.dias_semana)) THEN
    RETURN QUERY SELECT FALSE, 'DIA_NO_PERMITIDO', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;
  IF v_codigo.stock_total <> 0 AND v_codigo.stock_consumido >= v_codigo.stock_total THEN
    RETURN QUERY SELECT FALSE, 'AGOTADO', v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_codigo.tipo_promocion, v_codigo.es_descuento, v_codigo.porcentaje_descuento, v_codigo.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_codigo_publico(TEXT, TEXT, DATE, TEXT, INT)
  TO anon, authenticated;

-- ============================================================
-- Migración 4: extender v_campanas_atribucion con cupones
-- ============================================================
-- Solo se modifica la vista para añadir columnas:
--   reservas_con_cupon, reservas_cupon_descuento, reservas_cupon_grupo.
-- (DDL exacto se genera en Fase 1 al consultar la vista vigente.)
```

### Endpoints / Server Actions a crear o editar

| Archivo | Cambio |
|---|---|
| `src/features/sala/lib/validar-cupon.ts` | NUEVO: helper puro `validarCuponContexto({codigo, fecha, turno, personas})` que llama a la RPC o reutiliza la lógica del lado server. |
| `src/features/sala/actions/reserva-codigos-actions.ts` | +`getCodigoByNombre(nombre)` (admin), reexponer contador de stock. |
| `src/features/sala/actions/reservas-actions.ts` | En `createReservaAction` / `updateReservaAction`: si `codigoNombre` viene, validar + `consumir_stock_cupon` + fijar `tipo_categoria='cupon'` + snapshot `cupon_porcentaje_descuento`/`cupon_aplicado_at`. |
| `src/features/reservar-publica/actions/comprobar-codigo-publico.ts` | NUEVO: server action que recibe `(slug, codigo, fecha, turno, personas)` y devuelve `{ok, motivo, porcentajeDescuento, tipoPromocion, nombre}`. Llama `validar_codigo_publico` RPC. |
| `src/features/reservar-publica/actions/crear-reserva-publica.ts` | Reemplazar el bloque "Código → solo aviso" por validación dura + consumo de stock; revertir reserva si stock se agota entre validación y submit. |

### Componentes UI

| Archivo | Cambio |
|---|---|
| `src/features/sala/components/reservas/config/CodigosTab.tsx` | Renombrar título a "Cupones"; añadir badge "Agotado" cuando aplica; refrescar tras crear reserva (revalidatePath o realtime). |
| `src/features/sala/components/reservas/config/CodigoForm.tsx` | Sin cambios estructurales; revisar sentence case y BARRA HORIZONTAL 1 si falta. |
| `src/features/sala/components/reservas/ReservaFlagsChips.tsx` | Nuevo chip "Cupón −X%" cuando `cuponPorcentajeDescuento != null`. Compatible con chip "Cupón pagado Y€" existente. |
| `src/features/sala/components/ReservasView.tsx` | Mostrar `codigoNombre` en fila si está; tratar `cuponPorcentajeDescuento` en el form admin (nuevo campo opcional "Código promocional"). |
| `src/features/reservar-publica/components/ReservaPublicaForm.tsx` | Campo "Código promocional" con debounce + feedback ✅/❌ con motivo. Validación tolerante (no muestra error mientras se teclea un prefijo válido). |

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas las genera `/bucle-agentico` mapeando contexto justo antes de cada fase. Validar (typecheck + build + Playwright) al final de cada fase.

### Fase 1: Migración BD — columnas snapshot + índices
**Objetivo**: Añadir `cupon_porcentaje_descuento`, `cupon_aplicado_at` y CHECK de coherencia en `reservas`. Crear índice de `codigo_id`.
**Validación**: `\d reservas` muestra columnas; INSERT con descuento y sin `codigo_id` falla por CHECK; con `codigo_id` pasa.

### Fase 2: Migración BD — RPC consumo atómico
**Objetivo**: `consumir_stock_cupon(codigo_id, unidades)` SECURITY DEFINER, no expuesta a anon ni authenticated.
**Validación**: dos llamadas concurrentes desde service_role no superan `stock_total`; `stock_total=0` (ilimitado) jamás falla; `unidades<=0` lanza error.

### Fase 3: Migración BD — RPC pública de validación
**Objetivo**: `validar_codigo_publico(slug, codigo, fecha, turno, personas)` con todas las reglas (vigencia, turnos, días, personas, agotado, activo). Expuesta a anon.
**Validación**: probar cada motivo en una empresa de pruebas; nunca devuelve `stock_total`/`stock_consumido`.

### Fase 4: Migración BD — extender v_campanas_atribucion
**Objetivo**: añadir métricas de cupón a la vista (reservas con cupón, por tipo, por origen).
**Validación**: SELECT en la vista devuelve nuevas columnas; ROI por origen sigue cuadrando con los datos preexistentes.

### Fase 5: Helper compartido y action pública de validación
**Objetivo**: `src/features/sala/lib/validar-cupon.ts` + `src/features/reservar-publica/actions/comprobar-codigo-publico.ts` (paralelo a `comprobar-cliente-publico.ts`).
**Validación**: typecheck pasa; tests manuales devuelven motivos correctos para cada caso límite.

### Fase 6: Integración admin — reservas con cupón
**Objetivo**: extender `reservas-actions.ts` (create/update) con rama de cupón: validar → consumir_stock → fijar `tipo_categoria='cupon'` + snapshot descuento. Añadir campo opcional "Código promocional" al form admin.
**Validación**: Playwright crea reserva interna con cupón válido; reserva queda con `codigo_id`, `cupon_porcentaje_descuento`, `tipo_categoria='cupon'`. Intentar con cupón agotado devuelve error.

### Fase 7: Integración pública — comprobar-codigo + crear-reserva
**Objetivo**: feedback ✅/❌ en `ReservaPublicaForm` + reemplazar el bloque "solo aviso" en `crear-reserva-publica.ts` por validar + consumir.
**Validación**: Playwright completa `/reservar/<slug>` con cupón válido; segundo intento con stock agotado muestra "Cupón agotado"; cupón fuera de vigencia muestra motivo correcto.

### Fase 8: UI — chips y lista de cupones
**Objetivo**: chip "Cupón −X%" en `ReservaFlagsChips`; mostrar `codigoNombre` en `ReservasView`; badge "Agotado" en `CodigosTab` y refresco en vivo tras cada reserva.
**Validación**: visual sobre datos sembrados; revisión sentence case; reglas BARRA HORIZONTAL 1.

### Fase 9: Pulido + multi-tenant + analítica
**Objetivo**: comprobar que ninguna migración referencia empresa concreta; revisar RLS con `empresas_del_usuario()`; verificar advisors Supabase sin warnings; documentar gotcha "stock no se devuelve".
**Validación**: `mcp__supabase__get_advisors` sin warnings nuevos; `grep -ri "uppercase" src/features/sala/components/reservas/config/Codigos*` vacío; `v_campanas_atribucion` muestra ROI de cupones.

### Fase 10: Validación Final (QA end-to-end Playwright)
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Checklist Playwright:
  - [ ] Admin crea cupón `INFLUENCERA` (tipo descuento, 15%, stock 10, válido este mes, todos los turnos, todos los días, 2-6 personas).
  - [ ] Cliente A reserva por `/reservar/<slug>?o=instagram` para 4 personas con `INFLUENCERA` → reserva queda con `tipo_categoria='cupon'`, `cupon_porcentaje_descuento=15`, `codigo_nombre='INFLUENCERA'`.
  - [ ] Stock pasa a 1/10 (no 9/10: consume 1 cuando es descuento) → corregir si la decisión final es "consume = 1 siempre que no sea tipo grupo".
  - [ ] Cliente B intenta con `INFLUENCERA` y 7 personas → "Código no válido para este número de personas".
  - [ ] Cliente B intenta con cupón fuera de vigencia → "Código caducado".
  - [ ] Cliente B intenta con cupón solo-comida en turno CENA → "Código no válido para este turno".
  - [ ] Admin crea cupón `GRUPO20` (tipo grupo, stock 20 personas) → cliente reserva 8 personas y stock pasa a 8/20.
  - [ ] Admin cancela esa reserva → stock NO se devuelve (sigue 8/20). Documentado.
  - [ ] ReservasView muestra fila con chip "Cupón −15%" e indica el código aplicado.
  - [ ] `v_campanas_atribucion` cuenta la reserva del origen `instagram` con cupón.
- [ ] `mcp__supabase__get_advisors` sin warnings nuevos.

---

## Aprendizajes (Self-Annealing)

> Se rellena durante implementación con cada bug y fix encontrados.

---

## Gotchas

- [ ] `stock_total = 0` significa ilimitado (convención preexistente del módulo y del CodigoForm). NO cambiar a NULL para no romper datos sembrados.
- [ ] Stock NUNCA se devuelve: cancelar / no-show / cambio de fecha / borrar reserva NO toca `stock_consumido` (igual regla que tickets en PRP-051). Si en el futuro se decide devolver, hacerlo opt-in por configuración.
- [ ] Decisión a confirmar en Fase 6: `consumir_stock_cupon` para tipo `grupo` consume `personas`; para `restaurante_contador` y `descuento` consume `1` por reserva. Documentar en código y en formulario.
- [ ] La RPC pública `validar_codigo_publico` NO debe devolver `stock_total`/`stock_consumido` (anti-fraude). Solo devolver `ok` + motivo + datos públicos del cupón.
- [ ] `consumir_stock_cupon` solo se invoca desde server action con admin client. NUNCA expuesta a anon ni authenticated.
- [ ] Defensa en profundidad: validar también dentro de `consumir_stock_cupon` (vía CHECK del UPDATE), porque el cliente puede haber pasado validación y aun así llegar agotado por concurrencia.
- [ ] El campo `tipo_categoria='cupon'` ya existe con significado "pago anticipado"; al aplicar un código se fija el mismo valor pero pueden coexistir descuento (% en `cupon_porcentaje_descuento`) y pago anticipado (`importe_pagado`). Diferenciar en chips y en ReservasView.
- [ ] Diferencia clara entre PRP-051 (ticket: producto vendible con pago real) y PRP-052 (cupón: código promocional con descuento o registro de promoción). No mezclar tablas ni columnas.
- [ ] Multi-tenant: las migraciones no deben referenciar UUIDs de empresas concretas. La regla `empresas_del_usuario()` aplica a presentes y futuras (memoria `feedback_cambios_multi_tenant.md`).
- [ ] BARRA HORIZONTAL 1 obligatoria en CodigosTab: `+ Nuevo` izquierda, buscar + 3 iconos derecha. Filtros/toggles en fila aparte (memoria `feedback_barra_horizontal_1.md`).
- [ ] Sentence case en todos los strings de UI: "Cupones", "Agotado", "Cupón aplicado", no "CUPONES" (memoria `feedback_capitalizacion_textos_ui.md`). El nombre del cupón en sí (RUBIACRIOLLA) sí va en mayúsculas porque es un código.
- [ ] Validación inline tolerante: no marcar el código como inválido mientras el usuario teclea un prefijo aún válido; el feedback ✅/❌ se calcula con debounce y solo cuando el campo deja de cambiar (memoria `feedback_validaciones_inline.md`).

## Anti-Patrones

- NO crear feature nueva — vive dentro de `features/sala` y `features/reservar-publica`.
- NO duplicar la lógica de validación entre admin y público — usar el helper `validar-cupon.ts` o la RPC `validar_codigo_publico`.
- NO leer/escribir `stock_consumido` desde el cliente: SIEMPRE vía `consumir_stock_cupon`.
- NO devolver stock al cancelar / no-show / borrar reserva — regla explícita.
- NO exponer `consumir_stock_cupon` a anon/authenticated.
- NO romper la convención `stock_total = 0 ⇒ ilimitado`.
- NO mezclar el flujo de tickets (PRP-051) con cupones (este PRP) — tablas, RPCs y rama de código separadas.
- NO usar `any` en zod ni en server actions.
- NO tocar ninguna empresa concreta en seeds o migraciones.

---

*PRP pendiente aprobación. No se ha modificado código.*
