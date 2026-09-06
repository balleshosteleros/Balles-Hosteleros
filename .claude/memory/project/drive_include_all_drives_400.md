---
name: drive_include_all_drives_400
description: includeItemsFromAllDrives sin corpora=allDrives devuelve 400 en cuentas Google One y deja Drive mudo
metadata:
  type: project
---

`includeItemsFromAllDrives=true` en la API de Drive **exige** ir acompanado de
`corpora=allDrives`. Sin el, Google responde **400** — y solo en cuentas que NO
son Workspace. Nosotros usamos Google One, asi que fallaba siempre: "Mi unidad"
salia vacia con "No se ha podido leer Google Drive" aunque la cuenta estuviera
perfectamente conectada.

**Por que:** el sintoma enganya. Parece un problema de conexion o de scope
(`drive.readonly` estaba bien pedido), pero es la query la que Google rechaza.

**Como aplicar:** en `/api/google/drive/*` usar solo `supportsAllDrives=true`
(inofensivo, resuelve accesos directos). Nunca `includeItemsFromAllDrives` sin
`corpora`. Las rutas propagan ahora el `status` real de Google y el panel
distingue 403 (falta permiso → reconectar) de un fallo pasajero.
