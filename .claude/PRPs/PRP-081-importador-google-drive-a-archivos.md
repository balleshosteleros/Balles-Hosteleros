# PRP-081 — Importador de Google Drive → Archivos

**Estado:** IMPLEMENTADO — 2026-08-27
**Fecha:** 2026-08-27
**Objetivo:** vaciar los Drive de BACANAL y HABANA para dejar de pagar Google

---

## 1. Por qué

Toda la memoria visual y documental de las dos empresas vive en **unidades
compartidas** de Google Drive. Se quiere dejar de pagar Google (PRP-077), y
para eso hay que traerlo TODO a R2 antes de cancelar nada.

El conector de Drive de la conversación con el agente NO sirve: solo lee texto
de documentos, no descarga fotos, vídeos ni PDF. La migración tiene que
hacerla el propio software, servidor a servidor.

---

## 2. Decisiones de Iván (27-ago-2026)

| Punto | Decisión |
|---|---|
| Estructura | **Se replica tal cual**: mismos nombres, mismo árbol, todo el contenido |
| Destino | Cada carpeta de Drive entra **dentro de su departamento** del software |
| Empresa | **Se elige explícitamente** unidad compartida → empresa. BACANAL y HABANA no comparten NADA |
| Google Docs/Sheets | Se convierten a **`.xlsx` / `.docx` editables** (Office real) |
| Tipos y tamaño | Cualquiera. El único tope es la cuota de la empresa (PRP-079) |

### Sobre los Google Docs

Un Google Doc no es un archivo: vive solo en Google. Al migrarlo se exporta a
formato Office. Consecuencia que Iván acepta: **se pierde la edición online a
varias manos**. El archivo se descarga, se edita en Excel/Word y se vuelve a
subir.

⚠️ Hay hojas VIVAS (`AUDITORIA BACANAL 2026`, `SEGUIMIENTO`, `ANALITICA 2026`)
que alguien edita a diario. Al migrarlas cambia cómo trabaja esa persona.
Conviene revisarlas una a una antes de cancelar Drive: algunas quizá deban ser
una pantalla del software, no un archivo.

---

## 3. Cómo funciona

### Pantalla: Ajustes → Herramientas → Archivos → "Importar desde Drive"

1. **Conectar la cuenta de Google** que ve las unidades compartidas.
2. **Elegir unidad compartida** (lista real de Drive) **y empresa destino**.
   Los dos campos son obligatorios: sin empresa explícita no se importa nada.
3. **Mapear carpetas de primer nivel → departamento**. El software propone el
   emparejamiento por nombre (`1.DIRECCIÓN` → Dirección, `6.MARKETING` →
   Marketing) y el usuario corrige lo que no encaje. Lo que quede sin asignar
   NO se importa hasta que se le diga dónde va.
4. **Previsualización**: cuántos archivos, cuánto pesan, qué cabe en la cuota.
5. **Importar**. Corre en segundo plano con progreso visible y se puede parar.

### Copia servidor a servidor

Para cada archivo: `GET` a la API de Drive → `PUT` firmado a R2 → fila en
`documentos`. El fichero NO pasa por el navegador ni por la memoria del
servidor completo (va en streaming), así que un vídeo de 1 GB no lo tumba.

Google Docs/Sheets/Slides usan `files/export` en vez de `files/get`:
- Documento → `.docx`
- Hoja de cálculo → `.xlsx`
- Presentación → `.pptx`

### Reanudable e idempotente

Cada archivo importado guarda su `drive_file_id`. Si el proceso se corta (o se
lanza dos veces), lo ya copiado se salta: no se duplica nada y se puede
retomar donde se quedó. Imprescindible con miles de archivos.

---

## 4. Modelo de datos

`documentos` + `drive_file_id text` (único por empresa), para el salto de lo
ya importado.

Tabla nueva `archivos_importaciones`: una fila por importación, con la unidad
compartida de origen, la empresa destino, el mapeo elegido, el estado
(pendiente / en curso / terminada / parada), contadores y los errores por
archivo. Es lo que alimenta la pantalla de progreso y el informe final.

---

## 5. Permiso de Google que falta

Hay que añadir `https://www.googleapis.com/auth/drive.readonly` a los scopes
de `/api/google/connect`. **Solo lectura**: el importador NUNCA borra ni mueve
nada en Drive (regla ya asentada del conector). El borrado en Google lo hace
Iván a mano, cuando haya verificado que está todo.

Ojo: es un scope RESTRICTED de Google. Con la app en modo prueba funciona ya;
para producción abierta exigiría verificación. Como esto se usa una vez y
desde cuentas propias, no bloquea.

---

## 6. Fases

- **F1 — Permiso Drive.** Añadir el scope y comprobar que se listan las
  unidades compartidas reales.
- **F2 — Lectura del árbol.** Recorrer una unidad entera (carpetas y archivos,
  con paginación) y devolver el inventario: número de archivos y peso total.
- **F3 — Mapeo y previsualización.** Emparejar carpeta de primer nivel con
  departamento, avisar de lo no asignado y de si cabe en la cuota.
- **F4 — Copia.** Servidor a servidor, en streaming, con reintentos,
  reanudable y con progreso.
- **F5 — Pantalla.** Conectar, elegir, mapear, ver progreso, parar y reanudar.
- **F6 — Verificación.** Informe final: archivos copiados, fallidos y un
  recuento contra el origen. **Nada se cancela en Google hasta que cuadre.**

---

## 7. Dónde está

- `src/lib/google/drive.ts` — acceso a Drive (solo lectura): unidades, árbol,
  descarga en streaming y exportación de Google Docs a Office.
- `src/features/archivos/actions/importar-drive-actions.ts` — inventario,
  mapeo y copia servidor a servidor, reanudable.
- `src/features/archivos/components/ImportarDrivePanel.tsx` — la pantalla, en
  Ajustes → Herramientas → Archivos.
- `.claude/migrations/015_importador_drive.sql`
- Scope `drive.readonly` añadido en `/api/google/connect`.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cancelar Drive antes de tiempo | F6 obligatoria: informe que cuadre origen y destino ANTES de tocar Google |
| Límite de peticiones de Drive | Reintento con espera progresiva; la importación es reanudable |
| Un archivo enorme agota la función | Copia en streaming, nunca en memoria |
| Hojas vivas que dejan de editarse online | Revisarlas una a una en F6; algunas deben ser pantalla, no archivo |
| Mezclar empresas | Empresa destino obligatoria y explícita por importación |
