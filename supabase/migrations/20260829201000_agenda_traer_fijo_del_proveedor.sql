-- Completa la separacion anterior. Al bajar los fijos al secundario de la ficha
-- de proveedor, la agenda se quedo sin ellos: solo miraba su propio campo, que
-- para entonces ya estaba vaciado. Se traen desde la ficha, que es la fuente
-- real de los contactos automaticos.
UPDATE public.contactos_agenda ca
SET telefono      = COALESCE(ca.telefono, pr.telefono_principal),
    telefono_fijo = COALESCE(ca.telefono_fijo, pr.telefono_secundario)
FROM public.proveedores pr
WHERE ca.categoria = 'proveedores'
  AND ca.origen = 'proveedor'
  AND ca.empresa_id = pr.empresa_id
  AND ca.empresa_contacto = pr.nombre_comercial
  AND (ca.telefono IS NULL OR ca.telefono_fijo IS NULL);
