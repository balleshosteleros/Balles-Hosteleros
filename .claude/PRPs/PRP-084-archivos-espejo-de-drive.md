# PRP-084 — Archivos: espejo en vivo de Google Drive

**Estado:** propuesto, pendiente de aprobación
**Fecha:** 2026-09-03
**Sustituye a:** PRP-079 (Archivos Drive propio) y PRP-081 (importador Drive → Archivos)

---

## 1. Por qué

Hoy el módulo Archivos **copia** los ficheros de Google Drive a Cloudflare R2 y
los guarda como filas en la tabla `documentos`. Se decidió cambiar de rumbo por
dos motivos medidos el 2026-09-03:

1. **Coste.** El archivo real de las tres empresas ronda **1 TB** (BALLES ~600 GB
   + HABANA + BACANAL). En R2 a 0,015 $/GB·mes eso son **~180 €/año**. Un plan
   **Google One de 2 TB cuesta 9,99 €/mes ≈ 120 €/año** y cubre las tres
   empresas. Google sale más barato y además ya se usa para correo, calendario
   y Meet.
2. **Duplicidad.** Mantener el mismo TB en dos sitios no aporta nada: el
   original ya vive en Drive y ahí se seguirá trabajando.

**Decisión:** los archivos generales de empresa **viven en Drive**. El software
no los copia: los **muestra en vivo**. Lo que cambie en Drive aparece en el
software sin importar nada.

---

## 2. Qué NO cambia (importante)

Sigue viviendo **dentro del software**, en Supabase Storage, todo lo que
necesita permisos por rol y trazabilidad:

- Nóminas · firmas · contratos · documentación de empleados
- Facturas y albaranes de logística
- CVs y documentación de candidatos
- Cierres, informes de gerencia, documentos jurídicos
- Grabaciones y vídeos de formación (siguen en **R2**, egress gratis)

Ese material **no** se toca en este PRP. La regla es: *si el software controla
quién lo ve por rol, se queda dentro.*

---

## 3. Modelo de acceso (decidido)

Cada usuario **conecta su propia cuenta de Google**, igual que ya hace con Gmail
y Calendar. Ve exactamente lo que Google le deje ver:

- Conecta el correo de empresa → ve las carpetas de esa empresa.
- Conecta un correo personal → no ve nada de la empresa.

El acceso lo concede la empresa **en Drive**, no el software.

**Dos secciones, como en Drive:**

```
Archivos
|- Mi unidad           <- archivos propios de la cuenta conectada
`- Compartido conmigo  <- carpetas que la empresa le comparte
```

**No hay "Unidades compartidas":** son exclusivas de Google Workspace y aqui se
usa **Google One**, que no las tiene. El caso del gerente que solo debe ver una
carpeta se resuelve con **"Compartido conmigo"**: la carpeta vive en la Mi unidad
de la cuenta de empresa y se comparte con su correo. Compartir carpetas entre
cuentas Gmail es gratuito y no requiere Workspace.

**Limitacion asumida de Google One:** los archivos pertenecen a la cuenta que
los creo, no a la organizacion. Si se pierde el acceso a la cuenta de empresa se
pierde la propiedad. Con Workspace + Unidades compartidas los archivos serian de
la organizacion. Se acepta porque las cuentas de empresa son de la casa, no de
un empleado concreto.

**Por qué es seguro aquí:** solo el **área administrativa** tiene correo de
empresa, y solo ellos trabajan desde ordenador. El módulo es **exclusivo de
escritorio**, coherente con la norma de que en móvil no van los botones de
configuración. Un encargado ni tiene correo de empresa ni entra por ordenador.

**Consecuencia aceptada:** para esta parte concreta, el aislamiento por empresa
lo gobierna Google, no `puedeVer()`. Es un cambio consciente respecto a la regla
general de ecosistema aislado, acotado a archivos generales.

---

## 4. Alcance

### 4.1 Módulo nuevo: "Archivos" (espejo de Drive)

- **Ubicación:** barra superior de escritorio, **entre Calendario y Meet**
  (`app-layout.tsx`, bloque de integraciones).
- **Identidad visual:** logo y colores de Google Drive, mismo patrón de
  cabecera, badges y estados que `GmailDrawer` y `CalendarDrawer`.
- **Apertura:** `Sheet` lateral maximizable, idéntico al resto de herramientas.
- **Contenido:** árbol de carpetas y ficheros leído **en vivo** por la API de
  Drive. Nada se guarda en Supabase ni en R2.
- **Acciones (SOLO LECTURA):** navegar carpetas, buscar, previsualizar, abrir en
  Drive (pestana nueva) y **descargar**. **No se sube, no se renombra, no se
  borra ni se mueve nada desde el software.** Drive es la unica fuente de verdad
  y solo se edita alli. Decidido asi para que el software no pueda estropear el
  archivo real; si mas adelante se echa de menos subir, se anade aparte.
- **Solo escritorio.** La ruta móvil `(mobile)/m/archivos` se retira.

### 4.2 Se retira

- `ArchivosExplorador`, `ImportarDrivePanel`, `ArchivosConfigPanel`,
  `ArchivosMobile` (≈2 100 líneas)
- `archivos-actions.ts`, `importar-drive-actions.ts`, `uso-actions.ts`
  (≈1 870 líneas)
- `miniaturas.ts`, `miniaturas-servidor.ts`, `compartir.ts`
- `/api/archivos/drive/importar`, `/api/archivos/drive/inventario`
- `/api/cron/archivos-importacion`
- Los daemons de `.dev-daemon/` (subir-hb, subir-local, miniaturas-todo,
  vigilantes) — ya parados el 2026-09-03
- Filas de `documentos` del importador + objetos R2 bajo `empresa_<id>/archivos/`

Coherente con la regla de **cero deuda: lo que no se usa se borra**.

### 4.3 NO se toca

- `empresa_<id>/grabaciones/` y `empresa_<id>/formacion/` en R2 — no existen en
  Drive, son originales del software.
- Los 21 buckets de Supabase Storage.
- La tabla `recordings` y las cuotas por empresa.

---

## 5. Técnico

**Scope OAuth:** `drive.readonly` **ya está pedido** en
`src/app/api/google/connect/route.ts:22`. No hace falta reconsentimiento.

**Infra reutilizable:** `src/lib/google/api.ts` y `src/lib/google/accounts.ts`
ya resuelven token, refresh y cuenta activa. El módulo se apoya en ellos igual
que Gmail y Calendar.

**Sin base de datos.** No hay tabla nueva ni migración. Todo se lee de Drive en
cada petición, con caché corta en memoria para no repetir llamadas al navegar.

**Endpoints nuevos (todos GET, sin escritura):**
- `GET /api/google/drive/listar` - hijos de un `folderId`; sin `folderId`
  devuelve las dos raices (Mi unidad y Compartido conmigo)
- `GET /api/google/drive/buscar` - busqueda por nombre
- `GET /api/google/drive/ver` - proxy de previsualizacion y **descarga**

---

## 6. Fases

**Fase 1 — Verificación previa (bloqueante).** Confirmar que cada fichero subido
a R2 bajo `archivos/` existe en Drive. Ya verificado que los scripts **solo
leían** (`readdirSync`/`statSync`/`createReadStream`, sin `unlink` ni `rename`,
y Drive montado en solo lectura `dr-x`), pero se contrasta el inventario antes
de borrar nada.

**Fase 2 — Módulo nuevo.** API de Drive + `DriveDrawer` con la identidad visual
de Drive, colocado entre Calendario y Meet. Coexiste con el módulo viejo.

**Fase 3 — Validación.** Iván abre el módulo, navega las carpetas de las tres
empresas y confirma que ve lo mismo que en Drive.

**Fase 4 — Retirada.** Solo tras el OK de la fase 3: se borra el módulo viejo,
los daemons, las filas de `documentos` del importador y los objetos R2 de
`archivos/`.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Borrar en R2 algo que no esté en Drive | Fase 1 bloqueante; borrado quirúrgico solo de `archivos/` |
| Usuario sin acceso en Drive no ve nada | Es el comportamiento buscado; mensaje claro en la UI |
| Cuota de la API de Drive | Caché corta y paginación |
| Perder grabaciones/formación al limpiar R2 | Prefijo acotado: nunca `grabaciones/` ni `formacion/` |

---

## 8. Decisiones cerradas (2026-09-03)

- **Raiz:** no se fija carpeta. Se muestran **"Mi unidad"** y **"Compartido
  conmigo"** de la cuenta conectada, y Google decide que entra en cada una.
- **Unidades compartidas:** descartadas, requieren Workspace.
- **Permisos:** solo lectura + descarga. Sin subida ni edicion.

---

## 9. Coste final

| Concepto | Antes | Después |
|---|---|---|
| Archivo general (~1 TB) | R2 ~180 €/año | Google One 2 TB — **120 €/año** |
| Grabaciones y formación | R2 (poco volumen) | R2, sin cambio |
| Documentos con permisos | Supabase Storage | Supabase Storage, sin cambio |
