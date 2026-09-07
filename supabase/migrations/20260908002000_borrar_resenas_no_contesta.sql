-- Fuera las 11.458 fichas de "No contesta": no son valoraciones de nadie.
--
-- Vinieron de Go High Level, donde cada comensal era una ficha en un tablero y
-- los que no respondían al WhatsApp acababan en una columna llamada "No
-- contesta ❌". Al traerlas aquí se convirtieron en 11.458 filas de `resenas`,
-- y eso es un error de concepto: esa gente NO valoró nada.
--
-- El criterio, dicho por Iván (07-09-2026): es exactamente lo mismo que un
-- cliente que reservó por CoverManager y nunca contestó a la encuesta. De esos
-- no hay ninguna fila que diga "no valoró" — simplemente no tienen valoración.
-- Un cliente que no opinó se ve igual venga de la reserva o del WhatsApp; lo
-- único que cambia es el `origen`, y solo lo tiene quien SÍ dijo algo.
--
-- No se pierde ningún dato: ninguna de las 11.458 tenía nota, ni comentario, ni
-- gestión de calidad, ni responsable. Eran una fila vacía con un nombre y un
-- teléfono que ya están en la ficha del cliente.
--
-- Si algún día hace falta saber a quién se le pidió opinión y no contestó, ese
-- sitio ya existe y es otro: los ENVÍOS de petición de valoración
-- (`reserva_email_envios`), que es donde el software distingue a quien no
-- contestó de quien nunca fue preguntado.
--
-- El importador (`scripts/importar-oportunidades-ghl.ts`) ya no las trae, así
-- que volver a pasar el CSV no las resucita.
--
-- Idempotente.

DELETE FROM public.resenas
WHERE estado = 'no_contesta';
