# Ejemplos de compresión

Cada ejemplo muestra: original → optimizado, con análisis de qué se quitó y por qué.

---

## Ejemplo 1: Petición simple verbosa

**Original** (24 tokens aprox)
> Oye Claude, necesito que por favor revises este archivo y me digas si encuentras errores o cosas que se puedan mejorar.

**Optimizado** (8 tokens aprox)
> Revisa este archivo. Detecta errores y mejoras.

**Análisis**:
- Quitado: "Oye Claude", "necesito que", "por favor", "me digas si encuentras", "cosas que se puedan"
- Convertido a imperativo directo
- Ahorro: ~67%

---

## Ejemplo 2: Análisis técnico verboso

**Original** (~30 tokens)
> Quiero que analices detalladamente el código fuente completo y posteriormente me indiques posibles errores.

**Optimizado** (~7 tokens)
> Analiza el código. Indica errores.

**Análisis**:
- Quitado: "Quiero que", "detalladamente", "fuente completo", "posteriormente", "posibles", "me"
- "código fuente" → "código"
- Ahorro: ~77%

---

## Ejemplo 3: Con rutas y comandos (preservar)

**Original**
> Me gustaría que ejecutes el comando `npm run build` en el directorio /home/ricardo/proyecto/frontend y luego verifiques si hay errores en la consola.

**Optimizado**
> Ejecuta `npm run build` en /home/ricardo/proyecto/frontend. Revisa errores en consola.

**Análisis**:
- Preservado intacto: `npm run build`, `/home/ricardo/proyecto/frontend`
- Quitado: "Me gustaría que", "y luego", "si hay"
- "verifiques" → "Revisa"
- Ahorro: ~40%

---

## Ejemplo 4: Con código y términos técnicos

**Original**
> Como bien sabes, estoy desarrollando una aplicación con Next.js y necesito que implementes un endpoint POST en la ruta `/api/users` que reciba un objeto con los campos `name` y `email`, y que posteriormente los guarde en la base de datos de Neon.

**Optimizado**
> Crea endpoint POST en `/api/users` que reciba `{name, email}` y los guarde en Neon DB.

**Análisis**:
- Preservado: Next.js, `/api/users`, `name`, `email`, Neon
- Quitado: "Como bien sabes", "estoy desarrollando una aplicación con", "necesito que", "un objeto con los campos", "y que posteriormente"
- "implementes" → "Crea"
- "base de datos de Neon" → "Neon DB"
- Ahorro: ~62%

---

## Ejemplo 5: Múltiples instrucciones (no fusionar)

**Original**
> Quisiera que primero crees un componente en React llamado `UserCard`, después le agregues estilos con Tailwind, y finalmente lo exportes desde el archivo index.

**Optimizado**
> Crea componente React `UserCard`. Agrega estilos Tailwind. Expórtalo desde index.

**Análisis**:
- Mantiene 3 oraciones separadas (3 instrucciones distintas)
- Preservado: `UserCard`, React, Tailwind, index
- Quitado: "Quisiera que", "primero", "después", "finalmente", "le", "lo", "el archivo"
- Ahorro: ~55%

---

## Ejemplo 6: Prompt ya optimizado (advertir)

**Original**
> Crea botón rojo en Header.tsx con onClick que llame a logout().

**Optimizado**
> Crea botón rojo en Header.tsx con onClick que llame a logout().

**Análisis**:
- Ya está optimizado. Ahorro < 10%.
- Respuesta: "Este prompt ya está bien optimizado. Ahorro mínimo posible (1 token, 5%). ¿Procedo igual?"

---

## Ejemplo 7: Caso con bloque de código (preservar todo el bloque)

**Original**
> Necesito que revises este código que te paso a continuación y me indiques si tiene algún problema:
> 
> ```js
> function suma(a, b) {
>   return a + b
> }
> ```

**Optimizado**
> Revisa este código e indica problemas:
> 
> ```js
> function suma(a, b) {
>   return a + b
> }
> ```

**Análisis**:
- Bloque de código intacto
- Quitado: "Necesito que", "que te paso a continuación", "me", "si tiene algún"
- Ahorro: ~25% (limitado porque el bloque es la mayor parte)

---

## Ejemplo 8: Hedges y suavizadores

**Original**
> Creo que tal vez sería bueno que me ayudes a refactorizar esta función, ya que pienso que está un poco larga y quizás se podría dividir.

**Optimizado**
> Refactoriza esta función. Está larga, divídela.

**Análisis**:
- Quitado todos los hedges: "Creo que", "tal vez", "sería bueno que", "me", "ya que pienso que", "un poco", "quizás se podría"
- Ahorro: ~70%
