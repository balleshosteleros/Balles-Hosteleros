---
name: prompt-compressor
description: Comprime y optimiza prompts en español antes de enviarlos a Claude Terminal (Claude Code, Antigravity CLI, claude-cli). Reduce el consumo de tokens eliminando muletillas, relleno y palabras innecesarias, y sustituyendo términos por sinónimos más cortos, siempre preservando el significado original. Úsala cuando el usuario pida "comprimir prompt", "ahorrar tokens", "optimizar instrucción", "reducir prompt", "acortar mensaje para Claude", o cuando pegue un prompt largo en español pidiendo una versión más corta. También actívala cuando el usuario muestre instrucciones verbosas con frases como "por favor", "me gustaría que", "necesito que", "podrías", o cuando pegue texto largo seguido de "para Claude Code" o "para terminal". La salida muestra el prompt original y el optimizado lado a lado con conteo de tokens y porcentaje de ahorro.
---

# Prompt Compressor

Comprime prompts en español para Claude Terminal usando modo agresivo, manteniendo significado exacto y preservando elementos técnicos.

## Cuándo activar esta skill

Actívate cuando el usuario:
- Pide explícitamente comprimir, optimizar, acortar o reducir un prompt
- Menciona "ahorrar tokens" o "reducir tokens"
- Pega un prompt largo en español y pide una versión más corta para terminal
- Habla de Claude Code, Antigravity, o claude-cli y muestra una instrucción verbosa

## Flujo de trabajo

### Paso 1: Detectar el prompt a optimizar

El prompt a comprimir es el texto en español que el usuario quiere mandar a Claude Terminal. Si el usuario pega varios bloques, pregunta cuál es el que quiere comprimir.

### Paso 2: Aplicar las reglas de compresión

Aplica las reglas en este orden estricto:

**1. Preservar SIEMPRE sin tocar (zonas blindadas):**
- Rutas de archivos: `/home/user/proyecto/`, `./src/index.ts`, `C:\Users\...`
- Comandos shell: `npm install`, `git push`, `pnpm dev`, `docker run`
- Nombres de variables y funciones: `userId`, `getUserData()`, `MAX_RETRIES`
- Bloques de código entre backticks (` `código` ` o ``` ```código``` ```)
- Términos técnicos en inglés: `pull request`, `merge`, `deploy`, `endpoint`, `webhook`, `API`, `JWT`, `OAuth`, `commit`, `branch`
- URLs, emails, IDs, hashes, tokens
- Nombres propios de productos/servicios: Vercel, Neon, Stripe, Supabase, GitHub, Next.js
- Cifras, fechas, versiones: `v2.3.1`, `Node 20`, `puerto 3000`

**2. Eliminar muletillas y relleno (lista exhaustiva en `references/filler-words.md`):**
Quítalas por completo. Ejemplos:
- "por favor", "si puedes", "si no es mucha molestia"
- "me gustaría que", "quiero que", "necesito que", "quisiera que"
- "podrías", "te pido que", "te encargo que"
- "oye Claude", "hola Claude", "Claude,"
- "a ver si puedes", "intenta", "trata de"
- "como bien sabes", "seguramente sabes que"
- "muy", "bastante", "realmente", "francamente"
- "detalladamente", "cuidadosamente", "minuciosamente" (a menos que sea crítico)
- "posteriormente" → "luego" o eliminar si el orden ya es claro

**3. Sustituir por sinónimos más cortos (tabla completa en `references/synonym-map.md`):**
- "realizar" → "hacer"
- "modificaciones" → "cambios"
- "necesario" → "útil" (o eliminar)
- "implementar" → "hacer" o "crear"
- "verificar" → "revisar"
- "identificar" → "detectar" o "ver"
- "posibles errores" → "errores"
- "código fuente" → "código"
- "en relación a" / "con respecto a" → "sobre"
- "a través de" → "con" o "por"
- "de acuerdo con" → "según"
- "sin embargo" → "pero"
- "asimismo" / "además" → "y"

**4. Simplificar frases largas:**
- "Necesito que revises cuidadosamente este código" → "Revisa este código"
- "Quiero que analices detalladamente el código fuente completo" → "Analiza el código"
- "Me gustaría que me indiques cuáles son los errores" → "Lista los errores"

**5. Convertir a comando imperativo directo:**
Cambia preguntas y deseos por imperativos:
- "¿Podrías agregar un botón?" → "Agrega un botón"
- "Me gustaría tener un endpoint" → "Crea un endpoint"
- "Quiero que el código haga X" → "Haz X"

**6. Corregir ortografía solo si afecta claridad:**
No reescribas estilo, solo errores que confunden el sentido.

**7. Quitar contexto inútil:**
- "Estoy trabajando en un proyecto y" → eliminar si lo siguiente ya basta
- "Como sabes, este archivo..." → eliminar
- Saludos, despedidas, agradecimientos → eliminar

### Paso 3: Contar tokens

Usa la regla aproximada para español: **1 token ≈ 3.5 caracteres** (más conservador que inglés que es ~4).

```python
def estimar_tokens(texto: str) -> int:
    return max(1, round(len(texto) / 3.5))
```

Calcula:
- `tokens_original`
- `tokens_optimizado`
- `tokens_ahorrados = tokens_original - tokens_optimizado`
- `porcentaje_ahorro = (tokens_ahorrados / tokens_original) * 100`

### Paso 4: Presentar resultado

Usa exactamente este formato de salida en markdown:

```
## 🔴 Original
> [prompt original tal cual]

## 🟢 Optimizado
> [prompt comprimido]

## 📊 Ahorro
- Tokens originales: **X**
- Tokens optimizados: **Y**
- Tokens ahorrados: **Z** (**N%** de reducción)

## 📋 Listo para copiar
```
[prompt optimizado de nuevo, en bloque de código para fácil copiado]
```
```

### Paso 5: Validación final antes de entregar

Antes de mostrar el resultado, verifica internamente:
- [ ] ¿Se preservaron todas las rutas, comandos, variables y bloques de código?
- [ ] ¿El significado técnico es idéntico?
- [ ] ¿Si quito una palabra más, se pierde precisión? Si sí, devuélvela.
- [ ] ¿La versión optimizada sigue siendo clara para Claude?

Si alguna palabra "corta" pierde precisión técnica, **conserva la original**. La meta es ahorro real, no compresión ciega.

## Regla de oro

> **Mejor un prompt 30% más corto que se entienda perfecto, que uno 60% más corto que pierda intención.**

## Casos edge

- **Prompt ya optimizado**: Si el ahorro estimado es < 10%, dilo: "Este prompt ya está bien optimizado. Ahorro mínimo posible (X tokens, N%). ¿Procedo igual?"
- **Prompt en inglés**: Avisa que la skill está calibrada para español y pregunta si optimizar igual.
- **Prompt mixto código + texto**: Comprime solo la parte de texto natural, el código queda intacto.
- **Prompt con instrucciones críticas múltiples**: No fusiones instrucciones distintas en una sola frase aunque ahorre tokens. Mantén una instrucción por oración.

## Referencias

Para listas más completas consulta:
- `references/filler-words.md` — diccionario de muletillas y relleno a eliminar
- `references/synonym-map.md` — tabla extendida de sinónimos cortos
- `references/examples.md` — ejemplos de antes/después con análisis
