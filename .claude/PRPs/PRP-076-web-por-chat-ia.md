# PRP-076: Web por chat con IA (estilo Claude/ChatGPT)

**Estado:** PENDIENTE
**Fecha:** 2026-08-07
**Pedido por:** Iván Ballesteros

---

## Objetivo

Que un cliente cree y modifique la web de su restaurante **hablando con una IA**,
igual que hablaría con Claude o ChatGPT: describe lo que quiere, adjunta capturas
de pantalla de referencia, y la web se construye sola. Sin arrastrar bloques ni
entender de "componentes".

El editor de bloques actual NO se elimina: pasa a ser la vista avanzada para
quien quiera afinar. El chat es la puerta de entrada por defecto.

## Por qué

Poner bloques es demasiado complicado para el perfil real de cliente (hostelero,
no informático). Hoy cualquiera monta una web hablando con una IA. Si el software
no lo ofrece, el cliente lo hará fuera.

Además reduce soporte: la mayoría de peticiones ("cambia el título", "pon esta
foto") hoy acaban en una llamada.

## Coste (verificado)

La infraestructura IA **ya existe** en el proyecto: `src/lib/ia/openrouter.ts`
(chat de soporte) y `src/lib/ia/gemini.ts` (lectura de nóminas). No hay que
construir tubería nueva.

- Modelo actual: `google/gemini-2.5-flash` — de los baratos del mercado.
- Conversación típica de cambios: **céntimos**.
- Estimación: **< 1 € por cliente y año** con uso normal.
- Con capturas adjuntas sube (las imágenes gastan más tokens), pero sigue en
  céntimos por conversación.

**Conclusión: el coste NO es el factor limitante.** Lo asume la empresa sin
problema. El factor limitante es el trabajo de hacerlo seguro.

## Riesgos reales (esto es lo que hay que resolver bien)

1. **El cliente puede tumbar su web hablando.** Un "cámbialo todo" mal
   interpretado y la web se rompe de cara al público.
   → Mitigación: los cambios de la IA van SIEMPRE a borrador. Publicar es un
   acto aparte y explícito. Nunca se toca lo publicado en vivo.

2. **Referencias ambiguas.** "Quita eso" — ¿el qué? La IA debe preguntar en vez
   de adivinar cuando no esté clara la referencia.

3. **Pérdida de trabajo.** Debe existir deshacer: cada intervención de la IA
   guarda la versión anterior de los bloques, recuperable con un botón.

4. **Alucinación de estructura.** La IA debe devolver bloques del catálogo real
   (`bloques-catalogo.ts`), validados con Zod (`bloque-schemas.ts`) antes de
   guardar. Si no valida, se descarta y se avisa — nunca se guarda basura.

## Fases

**Fase 1 — Retoque de textos (la más segura, empezar aquí)**
Chat lateral en el editor. Solo modifica textos de bloques que ya existen.
No crea, no borra, no reordena. Cambios a borrador + deshacer.
Cubre el ~80% de las peticiones reales de un cliente.

**Fase 2 — Cambios estructurales + incrustaciones (decidido 2026-08-07)**
Añadir, quitar y reordenar bloques por conversación. Requiere que la IA
devuelva el árbol de bloques completo validado contra los esquemas Zod.

Incluye que la IA pueda **incrustar contenido de terceros** a petición del
cliente: mapas, formularios de Google, vídeos, reservas, redes, pedidos a
domicilio, entradas… Criterio de Iván: *"todo lo que un restaurante pueda
querer, métemelo todo"*. Máxima libertad de contenido — es su web y su
responsabilidad; el software no opina sobre textos ni fotos.

La lista vive en `services/incrustaciones-permitidas.ts` (~60 dominios). NO es
un muro: existe porque un iframe ejecuta código de un tercero dentro de la
página, y si ese tercero es malicioso el daño lo sufre **quien visita la web**
(un comensal reservando), no el cliente — y la reclamación acabaría en Balles.
Cuando alguien pida un sitio que no esté, se añade en dos minutos y la IA lo
dice en vez de fallar en silencio.

La biblioteca lateral queda **plegada por defecto** (icono para desplegarla):
la vía principal de construir es hablando; la manual sigue ahí como salida.

**Fase 3 — Capturas de referencia**
Adjuntar imágenes en el chat ("quiero algo así"). La IA extrae estilo,
estructura y tono. Requiere modelo con visión (Gemini ya la tiene).

**Fase 4 — Web nueva desde cero por conversación**
"Hazme una web para mi restaurante de X, con estas fotos". Genera la web
completa en borrador partiendo de una plantilla prototipo común.

**Fase 5 — Plantilla prototipo multi-cliente**
Web base de la que parten todos los clientes nuevos, que la IA personaliza.
Las webs terminadas de HABANA y BACANAL sirven de referencia real.

## Contexto técnico

- Editor actual: `src/features/marketing/pagina-web/`
- Catálogo de bloques: `data/bloques-catalogo.ts`
- Validación: `services/bloque-schemas.ts` (Zod) — reutilizar tal cual
- Cliente IA: `src/lib/ia/openrouter.ts` — patrón a seguir
- Precedente de chat con contexto: `src/app/api/soporte/chat/route.ts` (RAG por rol)
- Los bloques viven en `paginas_web.bloques` (JSONB) — un solo campo, fácil de
  versionar para el deshacer.

## Orden acordado con el cliente

Primero cerrar lo pendiente de dominios (conectar `pruebas.grupohabana.es` y
`pruebas.bacanalmadrid.com`, ver las webs funcionando). Después arrancar este PRP
por la Fase 1.

## Criterios de éxito

- Un cliente sin conocimientos técnicos cambia el título de su web hablando.
- Ningún cambio de la IA afecta a la web publicada sin confirmación explícita.
- Existe deshacer de al menos la última intervención.
- Ningún bloque inválido llega a guardarse en base de datos.
