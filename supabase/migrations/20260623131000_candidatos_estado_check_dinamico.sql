-- Los ESTADOS (columnas del pipeline) NO son una lista fija: se definen en cada
-- "plantilla de estados" del reclutamiento, y el usuario puede crear estados
-- personalizados (clave generada por slug del nombre). Un CHECK que enumera los
-- 10 estados semilla rompía (violación de constraint → "Error desconocido") en
-- cuanto se movía un candidato a un estado personalizado.
--
-- La fase SÍ es fija (3 canónicas + alias legacy), así que ese CHECK se mantiene.
-- El estado pasa a ser libre: lo gobierna la plantilla, no la BD.
ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_estado_check;
