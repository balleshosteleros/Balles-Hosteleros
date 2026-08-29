-- Elimina `correoGeneral` de `empresas.datos_generales`.
--
-- MOTIVO: era un correo comodín al que caían las cascadas cuando faltaba el
-- correo del departamento (RRHH, gestoría, gerencia, jurídico…). No vale para
-- nada: cada envío usa el correo de SU departamento, y un comodín solo sirve
-- para mandar un mensaje a un buzón que no le corresponde. Ninguna plantilla lo
-- tenía elegido como destino y ninguna empresa operativa lo tenía relleno.
--
-- El único valor guardado (BALLES HOSTELEROS) está también en
-- `empresas.email_contacto`, así que no se pierde ningún dato.
--
-- IDEMPOTENTE: `- 'correoGeneral'` sobre un JSONB que ya no tiene la clave lo
-- deja igual, así que la migración se puede reejecutar sin efecto.

update empresas
set datos_generales = datos_generales - 'correoGeneral'
where datos_generales ? 'correoGeneral';
