# Nómina prevista y parte a la gestoría — APLAZADO (09/09/2026)

Decisión de Iván: **de momento se deja lo más sencillo**. Las nóminas se piden a la
gestoría **iguales todos los meses**, y lo único que se le comunica son las **bajas
médicas**. El sistema de avisar días que faltan y ajustes de nómina se hará más adelante.

**NO implementar** hasta que Iván lo pida:
- Cálculo de nómina prevista antes de que lleguen las nóminas.
- Parte mensual a la gestoría con días trabajados, horas, ausencias y extras.
- Comparación previsto vs. real en Pagos.

## Diseño ya acordado, para cuando se retome

Una sola fórmula sirve para los dos modos de pago, sin caso especial:

> **nómina prevista = base + (horas trabajadas − horas de contrato) × precio hora extra**

- MENSUAL: base = salario bruto, horas de contrato = su jornada del mes.
- HORAS: base = 0 y horas de contrato = 0 → todas sus horas se pagan a su precio.
  Encaja porque a los de modo HORAS se les puso el precio de hora extra igual al normal.

La base de horas YA EXISTE: `horasMes()` en `src/features/rrhh/services/horas/horas-mes.ts`
devuelve teóricas, normales, extras y **balance**. La usan Pagos, Horarios y Mi Panel.

## Reglas de descuento (verificadas en el sistema)

`tipos_ausencia.remunerada` ya está bien puesto y decide solo:
vacaciones (sí remunerada → no descuenta) · baja médica (sí → prestación) ·
permiso (no → descuenta) · baja de contrato (no → descuenta).

Importe: **día = bruto mensual ÷ 30** (siempre 30, tenga el mes los días que tenga).
Hora = bruto anual ÷ jornada anual del convenio.
⏳ Falta confirmar con la gestoría: **jornada anual** del convenio de hostelería de Madrid
(¿1.800 h?) y si las **pagas extras están prorrateadas**.

## ⚠️ No se puede penalizar con un importe fijo

El Estatuto de los Trabajadores (art. 58.3) prohíbe las **multas de haber**: solo se puede
dejar de pagar lo no trabajado, ni un euro más. La vía legal para que una falta cueste más
es la **suspensión de empleo y sueldo** como sanción disciplinaria (tipificada en convenio,
por escrito y proporcional) — y eso ya lo cubre el módulo de sanción disciplinaria de
Gerencia. Ver [[modo_pago_puesto]].

## ⏳ Pendiente sin decidir

"Permiso" está marcado como NO remunerado en bloque, y mezcla dos cosas: hay permisos que
por ley se pagan (boda, fallecimiento, mudanza, médico). Habría que separar
**permiso retribuido** (no descuenta) de **no retribuido** (descuenta). Iván lo deja para
más adelante.
