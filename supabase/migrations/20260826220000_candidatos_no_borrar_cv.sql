-- Una candidatura (CV) NO se borra nunca: se queda para siempre en la base de
-- datos como historial. Decisión del usuario.
--
-- Motivo: una tarjeta borrada se lleva por delante el rastro de la persona —su
-- candidatura, sus notas, sus reseñas y, si llegó a ser empleado, el vínculo que
-- sostiene su offboarding. Ya pasó: una baja de contrato tramitada se quedó sin
-- tarjeta y el empleado nunca llegó a «Ex-empleados».
--
-- «Borrar» en la interfaz pasa a significar ARCHIVAR: la tarjeta se mueve a la
-- fase «Papelera», desaparece de la vista y el dato permanece.
--
-- Mismo criterio que `firmas_eventos`: el blindaje vive en la BD, no solo en el
-- código, para que tampoco pueda saltárselo un borrado manual desde el panel de
-- Supabase ni una server action olvidada.
--
-- Idempotente: se puede reejecutar sin efectos.

create or replace function public.candidatos_block_delete()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  raise exception
    'Una candidatura no se borra: muévela a la fase «Papelera» para archivarla.'
    using errcode = 'P0001';
end;
$$;

comment on function public.candidatos_block_delete() is
  'Impide borrar candidaturas. El CV es historial permanente; para retirarlo de la vista se mueve a la fase «Papelera».';

drop trigger if exists candidatos_no_delete on public.candidatos;

create trigger candidatos_no_delete
  before delete on public.candidatos
  for each row execute function public.candidatos_block_delete();
