# PRP-023: Sistema de Ayuda y Soporte con filtrado por Rol

**Estado:** PENDIENTE DE APROBACIÓN
**Creado:** 2026-04-11
**Consolida:** PRP-003, PRP-020, PRP-021
**Origen:** Recordatorios SAAS — consolidado tras decisión del usuario de empezar por Opción A

---

## 🎯 Objetivo

Añadir a la app un **sistema dual de Ayuda + Soporte** accesible desde toda la aplicación, con dos botones persistentes y dos experiencias distintas, ambas respetando el rol del usuario autenticado.

**Estado final:**

1. Un **botón "Soporte"** visible en todas las páginas autenticadas que al pulsarlo abre un **chat** (tipo Intercom) donde el usuario puede preguntar dudas sobre su trabajo.
2. Un **botón "Ayuda"** justo debajo del de Soporte, que al pulsarlo abre un **centro de ayuda** con preguntas frecuentes (FAQ) e índice lateral navegable.
3. **Ambos** filtran el contenido según el **rol** del usuario:
   - Un `empleado` solo ve FAQs y puede preguntar sobre su área
   - Un `director` ve contenido más amplio y puede preguntar sobre métricas, RRHH, etc.
   - El chat de soporte **avisa al usuario** si pregunta algo que no corresponde a su rol, sin revelar información privada.

---

## 💡 Por qué

- **Reduce tickets repetitivos al admin:** en vez de que cada empleado pregunte al gerente por WhatsApp, tiene ayuda auto-servida dentro de la app.
- **Onboarding más fluido:** nuevos empleados pueden resolver dudas sin interrumpir a nadie.
- **Respeta la jerarquía y privacidad:** un empleado no puede "curiosear" info que solo debería ver un director.
- **Primer caso de uso de IA dentro de la app:** valida el patrón para futuras features con IA (onboarding automático, análisis de métricas, etc.).

---

## 🔨 Qué

### Funcionalidad — Botones persistentes
- Dos botones en la parte inferior-derecha del `app-sidebar.tsx`, con el botón **Soporte** encima del de **Ayuda**
- Iconos de `lucide-react` (ya instalado): `LifeBuoy` para Soporte, `HelpCircle` para Ayuda
- Ambos abren un **panel lateral derecho** (drawer) sin cerrar la página actual — para que el usuario no pierda contexto

### Funcionalidad — Botón "Ayuda" → Centro de FAQs
- Drawer lateral con:
  - **Barra de búsqueda** arriba
  - **Índice lateral** izquierdo: lista de categorías (Reservas, Cocina, Logística, RRHH, etc.)
  - **Panel derecho:** preguntas + respuestas de la categoría seleccionada
- Solo muestra las categorías y preguntas que el rol del usuario puede ver
- Contenido estático: archivos markdown en `src/content/faqs/*.md` con frontmatter `visible_to: [roles...]`

### Funcionalidad — Botón "Soporte" → Chat
- Drawer lateral con interfaz de chat (estilo ChatGPT minimalista)
- El chat envía cada mensaje a un **endpoint `/api/soporte-chat`** que:
  1. Recibe el mensaje + el contexto del rol del usuario (desde `auth-context`)
  2. Llama a un LLM (via Vercel AI SDK + OpenRouter) con un **system prompt dinámico según rol**
  3. Stream la respuesta de vuelta al cliente
- El system prompt incluye:
  - El rol del usuario
  - La lista de temas permitidos para ese rol
  - Una regla explícita: *"Si el usuario pregunta algo fuera de su rol, responde amablemente que esa información no le corresponde y sugiere consultar con su superior."*

### Criterios de éxito
- [ ] Usuario con rol `empleado` ve solo las FAQs marcadas para su rol
- [ ] Usuario con rol `director` ve todas las FAQs
- [ ] El chat de soporte nunca filtra información que el rol no debería ver
- [ ] El chat avisa al usuario cuando pregunta fuera de su rol
- [ ] Los botones son visibles en todas las páginas autenticadas del grupo `(main)`
- [ ] Funciona en móvil (los drawers se adaptan a full-screen)

---

## 📚 Contexto técnico

### Ya existe en el proyecto
- `src/features/auth/contexts/auth-context.tsx` → expone `hasRole(role)` y `canAccess(path)`
- `src/features/layout/components/app-sidebar.tsx` → lugar donde meter los dos botones
- `supabase/migrations/002_align_profiles_and_roles.sql` → tabla `user_roles` con 6 roles
- **Roles disponibles:** `admin`, `director`, `gerencia`, `responsable`, `empleado`, `solo_lectura`
- Iconos de `lucide-react` ya instalados

### Hay que añadir
- **Vercel AI SDK** (`ai` + `@ai-sdk/react`) — NO instalado todavía
- **Provider de OpenRouter** (`@openrouter/ai-sdk-provider`) o configuración directa — NO instalado
- **Variable de entorno** `OPENROUTER_API_KEY` — hay que añadir al `.env.local` Y a Vercel (Production, Preview, Development)
- **Componente `Drawer` de shadcn/ui** si no existe todavía
- **Sistema de FAQs:** carpeta `src/content/faqs/` con archivos `.md` + parser de frontmatter

### Referencias a consultar durante la implementación
- [Vercel AI SDK docs — chat UI](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)
- [OpenRouter + Vercel AI SDK](https://openrouter.ai/docs/quickstart)
- shadcn `Sheet` component (para el drawer lateral)

---

## 🗺️ Blueprint de implementación

### Fase 1 — Scaffolding y botones (sin funcionalidad todavía)
- Instalar dependencias necesarias
- Añadir 2 botones en `app-sidebar.tsx` con iconos
- Crear dos componentes stub: `<AyudaDrawer />` y `<SoporteDrawer />`
- Cada botón abre su drawer respectivo (vacío por ahora)
- **Deliverable:** los botones se ven, abren paneles vacíos, no rompen nada

### Fase 2 — Centro de Ayuda (FAQ estático con filtro por rol)
- Crear estructura `src/content/faqs/` con 3-4 markdown de ejemplo por categoría
- Parser que lee los `.md` en build time (usando `fs` en server component)
- Componente `<AyudaDrawer />` con: búsqueda, índice lateral, panel de contenido
- Filtro por rol usando `hasRole()` del auth-context
- **Deliverable:** el botón de Ayuda funciona end-to-end con contenido real filtrado por rol

### Fase 3 — Soporte Chat con IA
- Añadir `OPENROUTER_API_KEY` a `.env.local` y a Vercel
- Crear route handler `src/app/api/soporte-chat/route.ts` con streaming
- System prompt dinámico según rol del usuario
- Componente `<SoporteDrawer />` con interfaz de chat (useChat hook de Vercel AI SDK)
- **Deliverable:** el chat funciona, responde según rol, avisa si pregunta fuera

### Fase 4 — Pulido y deploy
- QA con Playwright (los criterios de éxito)
- Commit + push → deploy automático a Vercel
- **Deliverable:** en producción en `sistema.balleshosteleros.com`

---

## 🧠 Aprendizajes (Self-Annealing)

_Se rellenará durante la implementación con bugs encontrados, fixes, y decisiones que habría que documentar para futuros PRPs similares._

---

## ❓ Preguntas pendientes para el usuario (antes de empezar Fase 1)

Necesito que me contestes **3 cosas** antes de arrancar:

### 1. ¿Chat con IA de verdad o chat humano?

- **(a) IA:** usa Vercel AI SDK + OpenRouter. Respuestas instantáneas, 24/7, barato (~$0.01 por conversación). Requiere que le des de alta una cuenta en https://openrouter.ai y me pases la API key. Ideal para tu caso porque mencionas filtrado por rol y avisos automáticos.

- **(b) Humano:** los mensajes se guardan en una tabla `tickets` de Supabase y a ti te llega un email/notificación. Tú (o un responsable) respondes desde un panel admin. Más lento pero sin coste de IA.

**Mi recomendación: (a) IA.** Tu descripción ya habla de "chat inteligente que avise si preguntan fuera de rol" — eso es IA.

### 2. ¿Dónde vive el contenido de las FAQs?

- **(a) Archivos markdown en el repo:** los editas en Antigravity, commit → deploy. Ventaja: versionado, revisable. Desventaja: necesitas saber git.

- **(b) Tabla Supabase editable:** creamos una página admin donde tú metes/editas FAQs sin tocar código. Más trabajo ahora, más cómodo luego.

**Mi recomendación: (a) markdown para la v1** — empezamos rápido, y si lo necesitas editar a menudo montamos la tabla después.

### 3. ¿Dónde ponemos los dos botones?

- **(a) En el `app-sidebar` abajo del todo** (persistente en el desktop). Móvil: accesibles desde el menú hamburguesa.
- **(b) Flotantes en la esquina inferior derecha** tipo Intercom (burbuja).
- **(c) En el header superior** al lado del avatar del usuario.

**Mi recomendación: (a) en el sidebar** porque ya tienes uno y queda integrado, sin elementos flotantes que tapen contenido.

---

> 🤖 Este PRP fue auto-generado por **watchdog.sh** y consolidado a mano tras decisión del usuario.
> Contéstame las 3 preguntas y arranco la Fase 1 con **/bucle-agentico**.
