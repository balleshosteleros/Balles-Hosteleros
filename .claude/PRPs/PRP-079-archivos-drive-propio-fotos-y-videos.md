# PRP-079 — Archivos: el Drive propio del software (fotos y vídeos)

**Estado:** IMPLEMENTADO — 2026-08-27
**Sustituye a:** Google Drive como almacén de fotos y vídeos de la empresa

---

## 1. Por qué

Las fotos y vídeos de la empresa vivían en Google Drive. Dos problemas: subir
mucho contenido es lento (Drive limita el ritmo), y nos vamos de Google
Workspace (PRP-077), así que esa memoria visual quedaría fuera del software.

Objetivo: **toda la memoria visual dentro de Balles**, en Cloudflare R2, con
carpetas por departamento y subida masiva desde la galería del iPhone.

---

## 2. Qué se construyó

Herramienta **Archivos** en la barra superior, **antes de Tareas** (icono de
carpeta, color cyan). No pertenece a ningún departamento: es transversal, como
el correo o el calendario. Mismo patrón visual y de apertura que el resto de
herramientas (Sheet lateral).

```
Archivos
├── 📁 Cocina              (solo si ves el departamento Cocina)
│   ├── 📁 Platos 2026
│   └── 🖼 🎬 archivos
├── 📁 Marketing           (solo si ves Marketing)
└── ...
```

### Visibilidad (decisión de Iván)

- Una carpeta raíz por departamento, creada automáticamente por la BD (trigger
  en `empresas` + backfill). No se crean ni se borran a mano.
- Subcarpetas libres dentro, con la profundidad que haga falta.
- **La carpeta solo aparece si el rol tiene ese departamento visible.** Si no,
  no sale en la lista: no existe para ese usuario (ni en gris ni con candado).
- Se resuelve en SERVIDOR con `bh_departamentos_usuario`, que lee
  `empresa_roles.permisos[].ver`. La RLS aísla la empresa pero **no** el
  departamento, por eso nunca se confía en el cliente.

### Acciones (decisión de Iván)

| Acción | Quién |
|---|---|
| Ver / descargar / subir / crear subcarpeta | Todo el que vea el departamento |
| **Borrar archivo** | **Solo quien lo subió** + DIRECCIÓN |
| Borrar subcarpeta | Solo si está vacía; quien la creó + DIRECCIÓN |
| Renombrar carpeta raíz | Nadie (son del sistema) |

---

## 3. Subida desde el iPhone

Botón **Subir** → selector de fotos nativo de iOS (`accept="image/*,video/*"
multiple`) → se marcan todas las fotos y vídeos de una vez → suben **en
paralelo (cola de 4) y directos a R2** con URL firmada, con barra de progreso
por archivo.

El archivo **no pasa por el servidor**: no hay límite de body ni cuello de
botella. Mismo mecanismo ya probado en grabaciones y cierres.

### Lo que NO se puede hacer

Que al pulsar **Compartir** en la app Fotos aparezca el icono de Balles se llama
**Web Share Target**, y **Safari/iOS no lo soporta** — solo Android. Limitación
de Apple, no del software. Requeriría una app nativa con Share Extension
(Capacitor/React Native + 99 $/año de Apple + App Store): proyecto aparte.

Alternativa que sí funciona hoy: arrastrar y soltar en Split View.

---

## 4. Modelo de datos

Se **ampliaron** `carpetas_documentos` y `documentos` en vez de crear tablas
nuevas: `documentos` estaba VACÍA (0 filas) y `carpetas_documentos` solo tenía
6 carpetas sin uso. Cero deuda, no conviven dos sistemas de carpetas.

`carpetas_documentos` + `departamento` (clave canónica), `es_raiz`.
`documentos` + `departamento`, `r2_key`, `miniatura_key`, `ancho`, `alto`,
`duracion_seg`, `subido_por`. `storage_path` pasa a NULL-able y un CHECK obliga
a que haya `storage_path` o `r2_key`.

Ruta en R2: `empresa_{id}/archivos/{DEPARTAMENTO}/{archivo_id}.{ext}`.

### ⚠️ Clave canónica — trampa importante

`departamento` guarda la clave **`bh_canon`** (`RRHH`, `LOGISTICA`), no el
nombre largo; `nombre` guarda el texto legible (`RECURSOS HUMANOS`). Es
obligatorio porque `bh_departamentos_usuario` devuelve las claves canónicas.
Comparando contra el nombre largo, **RRHH y LOGÍSTICA no veían su propia
carpeta**. Verificado en producción tras el arreglo: DIRECCIÓN ve 11, GERENCIA
5, cada departamento la suya.

### Tope por archivo: 2 GB

**No** son los 50 MB de documentos: ese límite existe porque los PDF pasan por
Supabase Storage. Aquí va directo a R2, y un vídeo de un minuto de iPhone son
100-170 MB. El límite real es la cuota de 500 GB por empresa, compartida con
las grabaciones.

---

## 5. Qué quedó fuera

- Icono de Balles en la hoja de Compartir de iOS (imposible sin app nativa).
- Edición de fotos o vídeos dentro del software.
- Compartir archivos con enlace público hacia fuera.
- Migrar automáticamente lo que hoy está en Google Drive (se decide aparte).
- Vista específica de móvil dentro de `/m` (el drawer ya es responsive).
- Opciones de configuración en Ajustes: por ahora el panel solo muestra el uso
  de almacenamiento. Iván decidirá qué opciones meter.

---

## 6. Archivos

- `src/features/archivos/` — tipos, actions, componentes, miniaturas
- `src/app/api/archivos/ver/route.ts` — servir/descargar con URL firmada
- `.claude/migrations/013_archivos_drive_propio.sql`
- Integración: `herramientas.ts`, `app-layout.tsx`, `ajustes.ts`,
  `HerramientasTab.tsx`
