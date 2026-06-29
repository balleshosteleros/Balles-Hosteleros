-- Candidatos: dos señales nuevas para la ficha de reclutamiento.
--
--  1. visto_at: marca cuándo se revisó por primera vez al candidato. Se rellena
--     automáticamente al abrir su ficha. null = aún sin revisar. Sustituye al
--     antiguo flag (de solo-memoria) «marcar como no visto»: ahora persiste y
--     se pinta un tick en la tarjeta del pipeline para saber de un vistazo
--     cuáles ya se han mirado.
--
--  2. fase_actualizada_at: fecha del ÚLTIMO cambio de fase. Sirve para el
--     contador de «días en la fase actual», que se reinicia a cero cada vez que
--     el candidato cambia de fase. Se rellena en cada movimiento de fase/vacante.
--     Backfill al created_at para que los candidatos existentes cuenten desde su
--     inscripción (mejor aproximación disponible sin historial completo).
--
-- Aplica a todas las empresas, presentes y futuras. Idempotente.

alter table public.candidatos
  add column if not exists visto_at            timestamptz,
  add column if not exists fase_actualizada_at timestamptz;

-- Backfill: los candidatos existentes empiezan a contar desde su inscripción.
update public.candidatos
   set fase_actualizada_at = created_at
 where fase_actualizada_at is null;
