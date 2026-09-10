-- La jornada del contrato pasa a ser COMPLETA o PARCIAL (cuántas horas), no
-- "Completa"/"Partida" (que para un gestor significa un tramo o dos).
--
-- El valor viajaba a la gestoria etiquetado "Jornada": un puesto de 16 h marcado
-- "Partida" le decia al gestor "jornada partida", no "media jornada". Mismo tipo
-- de fallo que el de bruto/neto: palabra correcta dentro, equivocada fuera.
--
-- A partir de ahora lo deduce el horario (`jornadaDesdeHorario`): 40 h o mas es
-- completa. Esta migracion solo normaliza lo ya grabado con esa misma regla.
-- Idempotente: al segundo pase no queda ningun "Partida" que convertir.

update puesto_salarios
set jornada_contrato = case
      when coalesce(horas_semanales, 0) >= 40 then 'Completa'
      else 'Parcial'
    end,
    updated_at = now()
where jornada_contrato is not null
  and jornada_contrato not in ('Completa', 'Parcial');

update empleado_condiciones
set jornada_contrato = case
      when coalesce(horas_semanales, 0) >= 40 then 'Completa'
      else 'Parcial'
    end,
    updated_at = now()
where jornada_contrato is not null
  and jornada_contrato not in ('Completa', 'Parcial');
