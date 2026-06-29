-- Actividad del candidato: registrar el MOVIMIENTO ENTRE VACANTES como evento
-- propio. Hasta ahora moverCandidatoAVacante() insertaba en candidato_historial
-- una fila idéntica a un cambio de fase, de modo que en la pestaña «Actividad»
-- el movimiento se veía como una transición de fase (o, si la fase/estado no
-- cambiaban, como si el candidato hubiese estado en la vacante destino desde el
-- principio). Se añaden dos columnas denormalizadas con el título de la vacante
-- de origen y de destino (igual que usuario_nombre): cuando vacante_nueva_nombre
-- no es null, la fila es un movimiento de vacante y se renderiza como tal.
--
-- Aplica a todas las empresas, presentes y futuras. Idempotente.

alter table public.candidato_historial
  add column if not exists vacante_anterior_nombre text,
  add column if not exists vacante_nueva_nombre    text;
