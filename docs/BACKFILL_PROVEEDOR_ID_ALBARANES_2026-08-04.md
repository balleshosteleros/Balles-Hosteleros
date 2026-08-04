# Backfill `albaranes.proveedor_id` — 2026-08-04 (PRP-073 TASK-208)

Empareja `proveedor_nombre` (snapshot) contra `proveedores.nombre_comercial` / `razon_social`
de la misma empresa, normalizado (minúsculas, espacios colapsados). **Solo coincidencia
inequívoca**: ambiguos y sin match quedan aquí, sin adivinar.

- Albaranes sin `proveedor_id` al inicio: **31**
- Actualizados (match inequívoco): **27**
- Sin match (proveedor no dado de alta con ese nombre): **4**
- Ambiguos (más de un proveedor con el mismo nombre): **0**

## Sin match (quedan con proveedor_id null — se resolverán al tocarlos o al dar de alta el proveedor)

| Albarán | Empresa | Nombre en el albarán |
| --- | --- | --- |
| ALB-2026-005 | fe2ea3c4… | SERPESKA |
| ALB-2026-009 | fe2ea3c4… | SERPESKA |
| ALB-2026-019 | fe2ea3c4… | SERPESKA |
| ALB-2026-016 | 00000000… | DISBESA |

## Ambiguos

(ninguno)
