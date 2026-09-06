# Drive: cuenta Google normal vs Workspace

El software **no pregunta** el tipo de cuenta: se lo pregunta a Google.
Decisión de Iván (6-sep-2026) tras plantearle preguntar vs detectar.

**Por qué no se pregunta:** mucha gente no sabe qué cuenta tiene. Si eligen mal
se llevan un Drive incompleto y la culpa se la lleva el software.

## Cómo se detecta
1. Al vincular, `userinfo` devuelve `hd` (hosted domain) solo si es Workspace →
   cookie `g_hd` (vacía = cuenta normal).
2. `/api/google/drive/secciones` pregunta a `drive/v3/drives`. Si Google
   devuelve unidades, existen y se pueden leer. **Manda esta**: es más fiable y
   funciona con las cuentas ya conectadas, que no tienen `g_hd`.

## Visual
**Idéntica en ambos casos** por exigencia de Iván: mismas pestañas, mismo
diseño. La única diferencia es que a una cuenta Workspace le aparecen sus
Unidades compartidas (icono `Building2`), porque existen.

## Al navegar dentro de una unidad compartida
Hay que mandar `driveId`, `corpora=drive` **e** `includeItemsFromAllDrives`.
Fuera de ahí ese último parámetro NO se pone: da 400 en cuentas normales
(ver `drive_include_all_drives_400.md`).
