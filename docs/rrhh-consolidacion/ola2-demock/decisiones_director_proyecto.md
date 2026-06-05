# Decisiones para el director del proyecto

**Fecha:** 2026-06-01
**Para:** responsable del proyecto Balles Hosteleros
**De qué va:** decisiones de negocio (no técnicas) que hay que tomar antes de seguir construyendo Recursos Humanos.

---

## Antes de empezar: ¿por qué este documento?

Hemos preparado un plan para terminar de convertir el módulo de **Recursos Humanos** en algo 100% operativo. Hoy una parte funciona de verdad (empleados, fichajes, firmas, reclutamiento, solicitudes) y otra parte está "de muestra" (pantallas que enseñan datos de ejemplo pero todavía no guardan nada real): salarios, pagos, bonus, calendarios, formación, ratios, etc.

Antes de ponernos a construir, hay **8 decisiones que no son de programación, sino de negocio**: dependen de **cómo quieres que funcione el restaurante**, no de cómo se escribe el código. Por eso las decides tú.

Cómo leer esto: cada decisión tiene **qué hay que decidir**, **por qué importa**, **las opciones** y **nuestra recomendación**. No hace falta que entiendas la parte técnica; con que elijas una opción en cada punto, nosotros nos encargamos del resto. Si dudas en alguna, la marcamos y la hablamos.

> Ninguna de estas cosas está construida todavía. Son elecciones **previas**. Tomarlas ahora evita rehacer trabajo después.

---

## Decisión 1 — ¿Cuál es el salario "oficial" de cada persona? *(D1)*

**Qué hay que decidir.**
Ahora mismo la cifra del salario aparece en varios sitios que no se hablan entre sí: el **contrato** de cada empleado, una **tabla de salarios por puesto** (una especie de plantilla orientativa por categoría) y la **nómina** mensual. Hay que decidir cuál manda, para que las cifras no se contradigan entre pantallas.

**Por qué importa.**
De esta cifra beben los **pagos/nóminas**, los **bonus** y los **ratios de coste de personal**. Si no está claro cuál es la buena, los números no cuadrarán de una pantalla a otra y se pierde la confianza en el sistema.

**Opciones.**
- **A) Manda el contrato.** El salario oficial de cada persona es el que figura en su contrato firmado. La tabla por puesto queda solo como orientación.
- **B) Manda la tabla por puesto.** Se define un salario por categoría/puesto y cada persona hereda el de su puesto.
- **C) Una jerarquía clara (recomendada).** Cada cosa tiene su papel: el **contrato** es la verdad legal de cada persona; la **tabla por puesto** es una referencia orientativa; la **nómina** es lo que realmente se pagó cada mes. El sistema usa la más fiable disponible en cada caso.

**Nuestra recomendación: opción C.** Es la que evita que existan tres cifras distintas peleándose, y deja cada dato con un dueño claro.

---

## Decisión 2 — ¿El sistema debe guardar el dinero pagado "en efectivo extra"? *(D2)*

**Qué hay que decidir.**
Los datos de muestra actuales incluyen un campo de **"efectivo extra"** (dinero al margen de la nómina). Hay que decidir si eso se guarda o no en el sistema.

**Por qué importa.**
Guardar pagos fuera de nómina tiene **implicaciones legales y fiscales**. No es una decisión técnica: es de gestión y conviene consultarlo con la gestoría.

**Opciones.**
- **A) No guardarlo (recomendada).** El sistema solo maneja cifras oficiales. Es lo más limpio y sin riesgo.
- **B) Guardarlo pero marcado como información interna**, que nunca aparezca en informes ni exportaciones oficiales.
- **C) Guardarlo como un dato más del salario.** **No recomendada** por el riesgo legal/fiscal.

**Nuestra recomendación: opción A**, salvo que la gestoría indique otra cosa. Es una decisión que conviene confirmar con vuestro asesor antes de construir.

---

## Decisión 3 — Los "Bonus": ¿solo se describen, o el sistema los calcula? *(D3)*

**Qué hay que decidir.**
Hoy los bonus están descritos con palabras (por ejemplo: *"si la facturación supera 15.000 €, 300 €"*). Hay que decidir si el sistema solo **guarda y muestra** esas reglas, o si además debe **calcular automáticamente** cuánto le toca a cada uno.

**Por qué importa.**
Calcular automáticamente suena bien, pero necesita que el sistema reciba datos fiables de los que hoy depende el bonus (facturación, inventarios, inspecciones…), y esos datos en su mayoría **todavía no están conectados**. Sería "un motor sin gasolina".

**Opciones.**
- **A) Solo describir (recomendada).** El sistema guarda y muestra las reglas del bonus de forma clara y ordenada; los importes se deciden a mano por ahora. Aporta valor enseguida y deja la puerta abierta al cálculo automático más adelante, sin rehacer nada.
- **B) Calcular automáticamente.** Mucho más trabajo y, sobre todo, requiere conectar antes las fuentes de datos. Recomendable como fase posterior, no ahora.

**Nuestra recomendación: opción A.** Empezar por describir bien y, cuando los datos estén conectados, dar el paso al cálculo.

---

## Decisión 4 — Formación: ¿unificamos las dos "formaciones" o las dejamos separadas? *(D4)*

**Qué hay que decidir.**
Hoy conviven **dos experiencias de formación** que no se hablan: (1) un **portal de cursos** (tipo academia online, con vídeos y lecciones) y (2) un **recorrido de bienvenida** por el que pasa el empleado nuevo al entrar por primera vez. Hay que decidir si se juntan en un solo sitio.

**Por qué importa.**
Tener dos formaciones distintas confunde al empleado y obliga a mantener el contenido por duplicado.

**Opciones.**
- **A) Unificar (recomendada).** Convertir el recorrido de bienvenida en un "curso de bienvenida" dentro de la academia. Así hay un único lugar para toda la formación y el contenido de bienvenida se puede editar fácilmente.
- **B) Dejarlas separadas.** Se mantienen las dos experiencias en paralelo. Más confuso y doble mantenimiento.

**Nuestra recomendación: opción A.** Un solo sitio para la formación, más fácil de mantener y de entender.

---

## Decisión 5 — El calendario de ausencias: ¿solo muestra, o también deja pedir desde ahí? *(D5)*

**Qué hay que decidir.**
Las **vacaciones, bajas y permisos** ya se gestionan de verdad en la sección de **"Solicitudes"** (el empleado lo pide, el responsable lo aprueba). El calendario los enseña de forma visual. Hay que decidir si el calendario es **solo una vista** de lo que ya existe, o si los botones de "Registrar…" del calendario también deben **crear** solicitudes nuevas.

**Por qué importa.**
La sección de Solicitudes ya hace bien lo importante (controla los días disponibles, los plazos de preaviso, avisa por correo…). Duplicar esa lógica en el calendario es fuente de errores e inconsistencias.

**Opciones.**
- **A) Solo mostrar (recomendada).** El calendario pinta lo que hay en Solicitudes; para crear algo se va a Solicitudes. Sencillo y sin riesgo de descuadres.
- **B) Permitir crear también desde el calendario.** Más cómodo, pero duplica el proceso de solicitud. Se puede añadir más adelante reutilizando el flujo que ya existe.

**Nuestra recomendación: opción A** ahora, y valorar la B como mejora futura.

---

## Decisión 6 — Ratios y previsiones: el "previsto" necesita histórico que aún no hay *(D6)*

**Qué hay que decidir.**
La pantalla de **ratios** (coste de personal frente a facturación, etc.) ya puede mostrar **datos reales actuales** (facturación, horas trabajadas y reservas existen de verdad). Pero la parte de **"previsión"** y "desviación frente a lo previsto" necesita el **histórico del año anterior**, que la base de datos actual todavía no tiene. Hay que decidir qué hacemos con la previsión mientras tanto.

**Por qué importa.**
Sin histórico, una previsión sería inventada. Mostrar números que parecen reales pero no lo son hace daño a la confianza.

**Opciones.**
- **A) Mostrar lo real ahora y dejar la previsión como "pendiente de histórico" (recomendada).** Los ratios actuales funcionan ya; la previsión aparece como "disponible cuando haya histórico", de forma honesta.
- **B) Esperar e incorporar primero el histórico real** para que las previsiones funcionen desde el principio (más preparación inicial).
- **C) Seguir mostrando previsiones inventadas.** **No recomendada.**

**Nuestra recomendación: opción A.** Damos valor real ya y somos honestos con lo que aún no se puede calcular.

---

## Decisión 7 — Los turnos: que vivan en un solo sitio *(D7)*

**Qué hay que decidir.**
Los **turnos** aparecen en más de una pantalla. El módulo de **"Horarios"** ya los gestiona de verdad; el calendario tiene su propia copia "de muestra". Hay que decidir que los turnos vivan en **un único sitio** (Horarios) y que el calendario simplemente los lea de ahí.

**Por qué importa.**
Tener lo mismo en varios sitios hace que tarde o temprano dejen de coincidir y nadie sepa cuál es el bueno.

**Opciones.**
- **A) Los turnos viven solo en Horarios (recomendada).** El calendario los muestra leyéndolos de Horarios.
- **B) El calendario mantiene sus propios turnos.** **No recomendada**: duplica (o triplica) el mismo dato.

**Nuestra recomendación: opción A.** Un único origen para los turnos.

---

## Decisión 8 — Fichar fuera de turno: ¿solo avisamos, o lo bloqueamos? *(D8)*

**Qué hay que decidir.**
Vamos a conectar el **horario previsto** (quién debería trabajar y cuándo) con los **fichajes reales** (cuándo fichó cada uno). Hay que decidir cómo de estricto: que el sistema solo **avise** de las desviaciones (llegó tarde, hizo horas de más…), o que además **impida fichar** si es fuera del turno asignado.

**Por qué importa.**
En hostelería los turnos cambian a última hora (refuerzos, coberturas, imprevistos). Bloquear el fichaje podría impedir registrar trabajo que de verdad se hizo, y eso tiene implicaciones laborales.

**Opciones.**
- **A) Solo avisar de las desviaciones (recomendada).** El sistema marca lo que no encaja, pero nunca impide fichar el trabajo realmente realizado.
- **B) Bloquear los fichajes fuera de turno.** Más control, pero arriesgado: podría dejar fuera trabajo real. Si se quiere, puede ofrecerse más adelante como opción activable por restaurante.

**Nuestra recomendación: opción A.** Avisar sí, bloquear no (al menos de inicio).

---

## Resumen rápido

| # | Decisión | Nuestra recomendación |
|---|----------|------------------------|
| 1 | ¿Cuál es el salario oficial de cada persona? | Jerarquía clara: contrato = verdad legal, tabla por puesto = referencia, nómina = lo pagado |
| 2 | ¿Guardar el "efectivo extra" en el sistema? | No guardarlo (confirmar con la gestoría) |
| 3 | Bonus: ¿describir o calcular? | Describir ahora; calcular más adelante |
| 4 | Formación: ¿unificar las dos? | Unificar en un solo sitio |
| 5 | Calendario de ausencias: ¿solo mostrar o crear? | Solo mostrar; crear desde Solicitudes |
| 6 | Ratios: ¿qué hacer con la previsión? | Mostrar lo real ya; previsión "pendiente de histórico" |
| 7 | Turnos: ¿dónde viven? | Solo en Horarios; el calendario los lee |
| 8 | Fichar fuera de turno: ¿avisar o bloquear? | Solo avisar, no bloquear |

---

## ✅ DECISIONES TOMADAS POR EL DIRECTOR

**Fecha de decisión:** 2026-06-05
**Decididas por:** responsable del proyecto (Iván / balleshosteleros@gmail.com)

| # | Decisión | Lo elegido | ¿Coincide con la recomendación? |
|---|----------|-----------|----------------------------------|
| 1 | Salario oficial | **Opción B — Manda la tabla por puesto.** Cada empleado hereda el salario de su categoría/puesto. **Matiz del director:** al crear un empleado nuevo, el sistema debe **preguntar a quien lo está creando si quiere heredar** las condiciones del puesto (no se aplica a ciegas; queda como valor por defecto editable). | No (recom. era C) |
| 2 | Efectivo extra | **Opción C — Guardarlo como un dato más del salario.** ✅ **Confirmado por la gestora del director (2026-06-05): se puede construir ya.** Queda como dato normal del salario. | No (recom. era A) |
| 3 | Bonus | **Opción A — Solo describir.** El sistema guarda y muestra las reglas; los importes se deciden a mano por ahora. | Sí |
| 4 | Formación | **Opción A — Unificar.** El recorrido de bienvenida se convierte en un "curso de bienvenida" dentro de la academia. | Sí |
| 5 | Calendario de ausencias | **Opción A — Solo mostrar.** El calendario pinta lo de Solicitudes; para crear se va a Solicitudes. | Sí |
| 6 | Ratios y previsiones | **Opción A — Mostrar lo real ya** y dejar la previsión como "pendiente de histórico". | Sí |
| 7 | Turnos | **Opción A — Solo viven en Horarios.** El calendario los lee de ahí. | Sí |
| 8 | Fichar fuera de turno | **Opción B — Bloquear los fichajes fuera de turno.** Más control. (Recom. era solo avisar; el director opta por bloquear.) | No (recom. era A) |

### Notas para implementación
- **D1:** el flujo de alta de empleado debe ofrecer "heredar condiciones del puesto" como opción explícita (sí/no) al creador, con los valores del puesto precargados pero editables.
- **D2:** ✅ **Confirmado por la gestora (2026-06-05). Vía libre para construir** el "efectivo extra" como dato normal del salario.
- **D8:** al bloquear fichajes fuera de turno, considerar desde el diseño un mecanismo de excepción/override por responsable para coberturas e imprevistos de última hora (evitar perder trabajo realmente realizado).

---

## ¿Y ahora qué?

- Con que elijas una opción en cada punto (o nos digas "vamos con todas las recomendadas"), tenemos vía libre para empezar a construir.
- El orden lógico de construcción empieza por **dejar reales los empleados y los salarios**, porque casi todo lo demás depende de eso.
- Hay además **dos asuntos urgentes de seguridad/errores** que conviene comentar aparte (uno sobre el acceso a contraseñas de aplicaciones y otro sobre un guardado que hoy falla en silencio). No son decisiones de negocio, pero sí cosas a las que dar prioridad.

Cualquier duda en alguna de las 8, la vemos juntos antes de decidir.

---

## 🔧 ASUNTOS URGENTES — estado (actualizado 2026-06-05)

### Asunto 1 — Seguridad de las contraseñas de apps (módulo `/accesos`, PRP-043) → ✅ CORREGIDO

**Verificación con la base de datos real (Management API, 2026-06-05):** el diagnóstico del discovery OLA2-15 era **más pesimista que la realidad**. En producción **sí existían y eran correctas** la RLS de revelado (intersección de roles: solo ve la contraseña quien es director de la app o tiene el rol asignado a esa credencial) y todas las funciones de seguridad. **No había puerta abierta de filtración; el cifrado no era "teatro".**

El riesgo real era de **reproducibilidad/auditoría**: las 3 tablas, RLS, funciones, índices y triggers estaban aplicados **a mano sobre prod, sin ninguna migración `.sql`**. Un entorno limpio (CI, empresa nueva, recreación de BD) se quedaba sin ellos y `/accesos` se rompía sin red de seguridad.

**Corregido:**
- Nueva migración versionada `supabase/migrations/20260605120000_accesos_prp043_versionar_schema_rls.sql` que captura **exactamente** el estado vivo (idempotente: no-op en prod, completo en entornos limpios). Aplicada y verificada (RLS activa, 2 políticas por tabla, sin avisos del advisor de seguridad).
- Documentada la clave de cifrado `CREDENCIALES_ENCRYPTION_KEY` en `.env.example` (obligatoria, `openssl rand -hex 32`, aviso de no rotar a la ligera).
- **Pendiente menor (no urgente):** procedimiento formal de rotación de la clave de cifrado (PRP-043 lo dejaba como "Fase 7 opcional"). Reservado a Fernando junto con el resto del módulo.

### Asunto 2 — Boarding guardaba "en silencio" (OLA2-04) → ✅ YA RESUELTO EN REMOTO

Lo cerró Fernando en `origin/main` (commits `35c8d23` + `f698193`: *"boarding real - lee/escribe BD y retira mock"*). Solo falta **bajarlo a local** (`git pull --rebase`).
