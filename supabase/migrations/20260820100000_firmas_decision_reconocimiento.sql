-- Decisión del trabajador sobre el RECONOCIMIENTO MÉDICO (voluntario).
-- Se guarda al firmar el documento de tipo `reconocimiento_medico`: el trabajador
-- elige SÍ o NO en la pantalla de firma y la casilla elegida se estampa en el PDF.
-- NULL en el resto de documentos (contrato interno, sanciones, etc.). Idempotente.

alter table public.firmas_documentos
  add column if not exists decision_reconocimiento text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'firmas_documentos_decision_reconocimiento_chk'
  ) then
    alter table public.firmas_documentos
      add constraint firmas_documentos_decision_reconocimiento_chk
      check (decision_reconocimiento is null or decision_reconocimiento in ('si', 'no'));
  end if;
end $$;

comment on column public.firmas_documentos.decision_reconocimiento is
  'Reconocimiento médico: decisión del trabajador al firmar (si = desea realizárselo, no = renuncia). NULL en el resto de documentos.';
