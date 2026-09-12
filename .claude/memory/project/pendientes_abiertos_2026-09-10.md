# Pendientes abiertos (traspaso 10/09/2026)

Los 5 puntos que quedaron en el aire, con el estado REAL comprobado en código y BD.

## 1. Pagos — COMPLETO, NO QUEDA NADA POR CARGAR (cerrado 12/09/2026)
Iván: *"¿qué tabla de nóminas dices? se te pasó todo ya de pagos"*. Efectivamente:
168 líneas de `rrhh_pagos`, enero–agosto 2026, BACANAL (93) y HABANA (75), una sola línea
por empleado y mes, los 8 meses confirmados y **0 descuadradas**. BALLES no tiene ninguna
porque no tiene empleados (0 activos): es la gestora, ver [[empresa_balles_hosteleros_gestora]].

- El reparto nómina/complemento no cambia ningún coste: Ratios suma `total`.
- ⚠️ **`ss_empresa` a 0 NO es un hueco de datos: es el valor REAL.** Las 46 líneas sin
  Seguridad Social son de gente que **no va por nómina**, cobra complemento y extras:
  Iván Ballesteros (1.250–1.500 €/mes), Sofía Terrón (100 €/mes, ver
  [[sofia_terron_siempre_complemento]]), Alberto Cieliczka (120–150 €/mes) y dos sueltas
  de Alejandro Mojica y Ruth González. 43 de esas 46 tienen además la nómina a 0.
  **Sin nómina no hay Seguridad Social de empresa. Poner un número ahí sería inventarlo
  e inflar el coste.** No tocar, y no volver a pedir la tabla.

### Lo único de verdad roto que salió al mirar

- **Karen Johanna Aguilar, HABANA, abril 2026 — CORREGIDO (12/09/2026).**
  El `total` decía 1.285 € (nómina 685,97 + complemento 599,03) y se había dejado fuera el
  bonus de 155 €. Iván confirmó que **cobró 1.440 €**: el dinero estaba bien pagado, lo
  que estaba mal era el número guardado. Ahora `total = 1.440,00` y las 168 líneas cuadran.
  ⚠️ **Cómo se hizo, porque hay DOS candados** (y hay que dejarlos los dos puestos):
  1. `trg_rrhh_pagos_lock` → congela la fila cuando la liquidación ya se envió.
  2. `trg_rrhh_pagos_lock_nomina` → `mes_nominas_confirmado()`: bloquea todo el MES si está
     confirmado en `rrhh_nominas_mes`. Los 8 meses de las 2 empresas están confirmados y la
     app NO tiene acción para desconfirmar un mes (`confirmado_en` solo se escribe).
  Se apagaron los dos triggers dentro de un bloque `DO` atómico (con `get diagnostics` +
  `raise` si no tocaba exactamente 1 fila, para que un error lo deshiciera todo), se
  corrigió el total, se dejó constancia en `comentario` y se volvieron a encender.
  **El mes NUNCA se desconfirmó**: era la alternativa mala, porque reabrir abril de HABANA
  habría abierto la nómina de toda la plantilla. Comprobado después: 3 de 3 triggers
  activos, mes cerrado, envío y marca de pagado intactos, 0 líneas descuadradas.
- **Alberto Cieliczka: RESUELTO (12/09/2026).** No estaba duplicado: una sola persona,
  mismo `user_id` (`a2601c39-…`) y una ficha por empresa, el espejo normal multiempresa.
  Salían dos nombres porque su ficha está **Inactiva** y la pantalla de Pagos solo lista
  activos: sus líneas caían por la rama de "externos", que pintaba la copia congelada
  `rrhh_pagos.empleado_nombre` en vez del nombre de la ficha.
  Arreglado en los dos frentes: el nombre bueno es **Alberto** (lo confirmó Iván; el
  apellido Cieliczka ya estaba bien, su correo es `wojciechjancieliczka@`), corregido en
  las 2 fichas, en `usuarios`, en los 8 fichajes y en las 4 líneas de pago aún no
  enviadas. Y `loadPagos`/`loadPagosRango` ahora resuelven el nombre por `empleado_id`
  contra la ficha (helper `nombresDeFicha`, incluidas las fichas inactivas), así que
  **el nombre sale igual en todas las pantallas** aunque la copia congelada diga otra cosa.
  Las 11 líneas con la liquidación ya enviada también se corrigieron (orden de Iván):
  eran dos erratas, "Albero" sin t en BACANAL y "Cielicka" sin z en HABANA. Como el
  trigger `rrhh_pagos_lock_confirmado()` congela `empleado_nombre` junto con los importes,
  se apagó SOLO `trg_rrhh_pagos_lock` dentro de un bloque atómico, se corrigió el texto y
  se volvió a encender (comprobado: los 3 triggers quedan activos). No se tocó ni un
  importe ni ninguna marca de envío. Las 15 líneas dicen ya "Alberto Cieliczka".

## 2. Puesto principal de Alejandro Mojica — CERRADO (12/09/2026)
Iván: "está bien, pues listo". No había triplicado. Queda como estaba.
En BD está bien: HABANA → GERENTE `es_principal = true`, LOGÍSTICA y RECURSOS
HUMANOS a false; BACANAL → GERENTE principal.
`src/features/gerencia/actions/ratios-actions.ts:222` coge el principal
(`asignaciones.find(p => p.es_principal)`) y el mapa de costes va indexado por
`user_id`, una sola entrada por persona: no hay triplicado en Ratios.
`rrhh_pagos` tampoco lo duplica.
Dato suelto: NO tiene fila en `empleado_condiciones` (ninguna de las dos fichas),
así que su coste sale del salario del PUESTO. Ver [[condiciones_empleado_fuentes]].

## 3. Consultas pendientes — BORRADO (12/09/2026)
Iván dio permiso ("bórralo si no existe"). Era una copia muerta del sistema de Ayuda:
página sin enlace en el menú y todo en memoria del navegador, sin guardar nada.
Se fue la cadena entera, comprobando antes que no colgaba nada vivo:
`app/(main)/consultas-pendientes/`, `ajustes/components/ConsultasPendientesView.tsx`,
`ajustes/components/ayuda/AyudaChat.tsx` (tampoco lo usaba nadie),
`ajustes/contexts/ayuda-context.tsx`, `ajustes/data/ayuda.ts`, el `<AyudaProvider>` de
`shared/providers.tsx` y las 2 entradas de `nav-routes.tsx`. `npx tsc --noEmit` limpio.
El sistema bueno sigue intacto: `/ayuda` + botón flotante de soporte sobre
`soporte_conocimiento`. ⚠️ La tabla `soporte_consultas` sigue existiendo y vacía, sin
código que la use: ahí es donde irían las dudas el día que se registren de verdad.

## 4. Preguntas frecuentes (antes "FAQs") — la tabla NO existe, la pantalla miente
🔤 **NOMBRE DECIDIDO (12/09/2026): "Preguntas frecuentes"**. "FAQ" no se entiende y ya
está fuera de todos los textos visibles (panel de Ayuda y la web `/software`).
La tabla se monta EN OTRA VENTANA: debe llamarse igual de sencillo.
`src/features/soporte/actions/faq-actions.ts` consulta `faqs` en 6 sitios y esa
tabla **no está en la base**. La migración `supabase/migrations/003_faqs.sql`
nunca se aplicó (numeración vieja, pre-timestamp).
Los errores se comen con `try/catch` → la pestaña de FAQs de `/ayuda` sale VACÍA
sin avisar, tanto al usuario como al admin (`faq-admin-panel.tsx`).
Decisión pendiente de Iván: crear la tabla (migración idempotente nueva con
`003_faqs.sql` dentro) o quitar las FAQs y quedarse solo con `soporte_conocimiento`.

## 5. Horas extras y bonus en Ratios — SIN IMPLEMENTAR
✅ **El precio de la hora extra YA está bien puesto (comprobado 12/09/2026)**, tal y como
lo dijo Iván: **10 €/h en TODOS los puestos, menos ARTISTAS, donde manda su precio/hora**
— CANTANTE y MÚSICO (BACANAL) **62,50 €**, DJ (HABANA) **18 €**. Campo
`puesto_salarios.precio_hora_extra` (y su espejo en `empleado_condiciones`), 58 puestos
repasados, ni una excepción suelta.
✅ Relleno el 12/09/2026 el único puesto que le faltaba el `coste_hora`:
HABANA → MANTENIMIENTO → **SEGURIDAD**, 8,0769 €/h (1.400 € × 12 ÷ (52 × 40)), el mismo
número que ya deducía la fórmula. Los 58 puestos tienen ya su coste/hora explícito.
Detalle en [[ratios_coste_personal]] (sección Pendiente): `fichajes.tipo` distingue
NOR/EXT pero solo hay 3 fichajes marcados EXT en toda la base, y el bonus va como
complemento mensual por persona, no repartido por día.

## 6. Alberto Cieliczka — baja revisada (12/09/2026)

**Bien:** Inactivo en las 2 empresas con `fecha_baja` 09/09/2026 en ambas; acceso al
software bloqueado (`usuarios.estado_acceso = 'Inactivo'`); sin material pendiente de
devolver (0 actas en `entregas_material`); nombre ya unificado en fichas, usuario,
fichajes, pagos y —corregido hoy— las 2 tarjetas de `candidatos`, que seguían con "Albero".

**Reclutamiento SÍ lo movió bien** (ojo: me equivoqué al leerlo la primera vez).
La columna del tablero es **`estado`**, no `fase` — ver [[candidato_fase_columna_y_vacante]].
Alberto está en `estado = 'empleado'` (columna **Empleado**) en las dos empresas, con su
vacante publicada y `activo = true`, igual que los otros 14 con ficha (8 BACANAL + 7 HABANA).
La columna Ex-empleados funciona: ya tiene 8 tarjetas (4 + 4, `estado = 'ex_empleado'`).

**Por qué "no aparece en empleados":** la pantalla RRHH → Empleados **abre filtrada a
Activos** (`FILTRO_DEFAULT_ESTADO_ACTIVO` en `EmpleadosView.tsx:36`, ver
[[filtro_estado_default_activo]]). Alberto está Inactivo, así que no sale hasta cambiar el
filtro a Inactivos. No es un fallo: es el filtro por defecto.

**Pasado a Ex-empleados el 12/09/2026** con el sí de Iván. Las 2 tarjetas quedan en
`fase = 'descartado'`, `estado = 'ex_empleado'`, con su apunte en `candidato_historial`
(la Actividad de la ficha). **No se le tocó la `fecha_baja`**: sigue el 09/09/2026, la
pactada, porque la regla dice que a quien ya está Inactivo no se le machaca con HOY
(descuadraría con la gestoría) — ver [[ex_empleado_inactivo_regla]]. Acceso ya bloqueado
y sin material que devolver.

**Pendiente de Iván:**

2. **Ficha sin completar**: le faltan `dni_nie`, `numero_ss`, `iban`, `direccion` y
   `fecha_nacimiento` → `perfil_completado = false`. Datos que hay que pedir, no inventar.
3. **`fecha_alta` no cuadra**: dice 15/05/2026 pero tiene pagos desde enero 2026.
   O el alta real es anterior, o hubo un contrato previo.
