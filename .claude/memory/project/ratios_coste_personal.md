# Ratios de coste de personal (Gerencia) — reconstruido 06/09/2026

Antes eran datos inventados (semana congelada del 30/03/2026 y sueldos a mano).
Ahora salen de datos reales. `src/features/gerencia/actions/ratios-actions.ts`.

## DOS MODOS (botón arriba a la derecha)

- **Pagos reales**: coste = `rrhh_pagos.nomina + ss_empresa`. Dato exacto de la gestoría.
  Solo existe con el mes cerrado y los pagos subidos; si no hay, cae a estimación y lo avisa.
  ⚠️ En este modo las **ausencias NO se suman aparte**: ya están dentro de la nómina.
  Las horas fichadas solo REPARTEN ese total entre áreas, departamentos y puestos.
- **Estimación**: horas fichadas × coste/hora, más las ausencias por sus días. Aproximado,
  pero sirve para ver cómo va el mes en curso sin esperar al cierre.

## ⚠️ ERROR QUE HUBO (no repetirlo)

1. **Doble cómputo de vacaciones**: un asalariado cobra igual fiche 150 h o 90. El resultado
   de horas × coste/hora YA es su sueldo del mes con vacaciones dentro; sumarlas aparte las
   duplica. Karen: cobra 1.600 €/mes y solo sus horas ya daban 1.651 €.
2. **Comparar mezclando empresas**: agosto daba 17.418 € de nómina, pero eran BACANAL +
   HABANA sumadas. Los ratios de la pantalla SÍ filtran bien (7 `.eq("empresa_id")`); el
   fallo estuvo en las consultas de verificación. **Todo número de coste se mira por empresa.**

## Cifras reales de agosto 2026 (modo Pagos reales)

| Empresa | Facturación | Coste personal | % |
|---|---|---|---|
| HABANA | 26.580,94 € | 5.600,68 € | **21,1 %** |
| BACANAL | 13.660,76 € | 11.818,16 € | **86,5 %** |

BACANAL se dispara porque las 10 personas de vacaciones de agosto (140 días) eran TODAS
suyas: facturó la mitad y pagó el doble. Es real, no un error.

## Proyección a fin de mes

Solo sobre un mes en curso. La facturación pendiente se estima con la **media de cada día de
la semana** de los 90 días anteriores (un sábado factura ~7x un lunes: HABANA 2.229 € vs
279 €), no con una media plana. El coste se proyecta al ritmo que lleva. Si hay menos de 14
días de histórico no se proyecta nada.
⚠️ Solo hay ventas desde junio de 2026: no hay año anterior con el que comparar.

## Cómo se calcula

- **Horas**: `fichajes.horas_totales` (ya viene con la pausa descontada) filtrando por
  `fecha` entre el rango. La medianoche no corta el turno: `fecha` es el día al que
  pertenece, aunque salga a las 3 de la mañana.
- **Coste/hora**: es un CAMPO PROPIO, `coste_hora`, en `puesto_salarios` y en
  `empleado_condiciones` (migración `20260907000000`). Se define en el PUESTO y se copia a
  las condiciones del EMPLEADO al contratar o promocionar, quedando congelado en su
  histórico. Si está vacío se deduce con `costeHoraDe()`
  (`src/features/rrhh/lib/coste-hora.ts`): `bruto × 12 ÷ (52 × horas_semanales)`.
  El coste guardado es BRUTO; encima se le suma la **Seguridad Social de empresa**.
  ⚠️ El helper vive en `lib/` y NO en `services/condiciones-puesto.ts` porque ese lleva
  `server-only` y la pantalla del puesto (cliente) también necesita la fórmula.
- **Origen del salario**: primero `empleado_condiciones` vigente (`vigente_hasta` nulo);
  si no la tiene, el salario del PUESTO (`puesto_salarios`) y se avisa en pantalla.
  Decisión de Iván: hoy solo hay 1 fila de condiciones en toda la base, así que sin este
  respaldo los ratios saldrían vacíos. Ver [[condiciones_empleado_fuentes]].
- **Ausencias** (decisión de Iván, 06/09/2026): las vacaciones NO se prorratean subiendo el
  precio de la hora. Se apuntan por sus DÍAS REALES desde `solicitudes_personal`
  (`tipo='ausencia'`, `estado='aprobada'`) y cuestan **el bruto mensual entre 30** por día,
  que es como se pagan de verdad. Se separan por subtipo: vacaciones, permisos y bajas.
  Razonamiento de Iván: si alguien está de vacaciones, otro ficha por él y esas horas ya
  cuentan; prorratear además sería contar dos veces. **El multiplicador sigue siendo ×12**,
  no ×13.
- **Seguridad Social de empresa**: `empresa_rrhh_config.seguridad_social_empresa_pct`,
  editable en **Ajustes → RRHH → Coste de personal**. Por defecto **35 %**. Se multiplica
  tanto al coste/hora como al día de ausencia: el bruto es lo que cobra el trabajador, y la
  empresa paga eso por encima. NO es un valor de manual: sale de dividir
  `rrhh_pagos.ss_empresa` entre `rrhh_pagos.nomina` en las 120 nóminas cargadas, donde se
  mueve muy estable entre 34,4 % y 36,6 % (media 35,8 %), redondeado a 35.
  ⚠️ Ojo al comparar: contra el sueldo TEÓRICO del puesto daba un 16 % engañoso, porque en
  agosto casi nadie cobró el mes entero. El bueno es contra la nómina realmente cobrada.
- **% de coste de personal** = (trabajado + ausencias) ÷ facturación. Meter las ausencias
  cambia mucho el número: agosto pasa de 29,7 % a **48,3 %** (7.490 € de vacaciones que
  antes no se veían: 140 días, 10 personas, 53,50 €/día). Y con el 35 % de Seguridad Social
  encima, agosto queda en **65,2 %** (16.124 € trabajado + 10.112 € ausencias).
- **Facturación**: `pos_tickets` COBRADO por `cerrado_at`.
- **% coste de personal** = coste ÷ facturación. Sin ventas es `null`, NUNCA 0.

## ⚠️ `fichajes.empleado_id` es el id de USUARIO, no el de la ficha

Los 277 fichajes apuntan a `usuarios.user_id`, no a `empleados.id`. Por eso los costes se
indexan por `user_id`. Es el mismo choque que rompía las sanciones disciplinarias.
Ver [[empleado_vs_usuario]].

## Agrupaciones

Área / departamento / puesto, todas del PUESTO principal del empleado (`empleado_puestos`
→ `puestos` → `departamentos`), no del campo `departamento` del fichaje, que viene vacío.

**`departamentos.area` YA EXISTE en la BD**: OPERATIVA (sala, cocina, artistas,
mantenimiento) y ADMINISTRATIVA (gerencia, RRHH, logística, contabilidad...). No hay que
inventar la clasificación.

Periodo: día / semana / mes / trimestre / año con `useCalendarRange` compartido
(`src/shared/components/calendar/`). La serie se muestra un escalón por debajo del rango
elegido: un mes se desglosa en días; un año, en meses.

## Cifras reales verificadas (agosto 2026)

1.390,79 h · 13.844,89 € de coste · 40.241,70 € facturado · **34,4 % de coste de personal**.
Coste/hora ejemplo: GERENTE 12,69 €, JEFE DE SALA 9,23 €, COCINERO 8,65 €.

## Pendiente

- **Horas extras**: `fichajes.tipo` distingue NOR/EXT pero solo hay 3 fichajes marcados como
  EXT en toda la base. Iván quiere verlas aparte con su propio coste; antes hay que
  comprobar si de verdad se marcan al fichar.
- **Bonus**: van como complemento mensual por persona, no repartidos por día. Sin implementar.

- 703 líneas de mock huérfanas sin borrar (falta permiso): `src/features/rrhh/data/ratios.ts`
  y `src/features/rrhh/components/ratios/{RatiosTablaPersonal,RatiosPrevisiones}.tsx`.
- Las previsiones (año anterior × factor de tendencia) NO se han reconstruido: los factores
  del mock estaban cableados (1.08, 1.12). Haría falta comparar con el año anterior real.
- Los fichajes solo cubren 01/08/2026 → 05/09/2026: fuera de ahí, 0 horas.
