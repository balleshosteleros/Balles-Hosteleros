-- ============================================================
-- SOLICITUDES DE ENTREGA DE MATERIAL
--
-- El trabajador pide una prenda o material desde Solicitudes (igual que pide
-- vacaciones). RRHH la aprueba o la deniega. Si la aprueba, se crea la entrega
-- en `entregas_material` exactamente igual que si RRHH la hubiera registrado a
-- mano, y le sale al trabajador en «Mis entregas».
--
-- Se apoya en la tabla que ya existe (`solicitudes_personal`): es una familia
-- mas de solicitud, con su propio `tipo`. Solo hay que ampliar los CHECK y
-- guardar QUE pide (tipo de material del catalogo) y en que talla.
--
-- Se pide UNA pieza por solicitud, igual que se entrega UNA pieza por entrega:
-- por eso no hay columna de cantidad. Para dos camisetas, dos solicitudes.
-- ============================================================

-- 1) Nueva familia de solicitud: 'entrega'
alter table public.solicitudes_personal
  drop constraint if exists solicitudes_personal_tipo_check;
alter table public.solicitudes_personal
  add constraint solicitudes_personal_tipo_check
  check (tipo in ('ausencia', 'trabajo', 'entrega'));

-- 2) Su subtipo
alter table public.solicitudes_personal
  drop constraint if exists solicitudes_personal_subtipo_check;
alter table public.solicitudes_personal
  add constraint solicitudes_personal_subtipo_check
  check (subtipo in (
    'baja_medica', 'vacaciones', 'permiso', 'baja_contrato',
    'horas_extras', 'dia_trabajado',
    'entrega_material'
  ));

comment on column public.solicitudes_personal.subtipo is
  'Subtipo de solicitud. Familia ausencia: baja_medica, vacaciones, permiso, baja_contrato. Familia trabajo: horas_extras, dia_trabajado. Familia entrega: entrega_material.';

-- 3) Que pide exactamente
--    Igual que en las entregas, se guarda el id del tipo Y su nombre congelado:
--    si manana se borra el tipo del catalogo, la solicitud sigue diciendo que
--    fue lo que pidio.
alter table public.solicitudes_personal
  add column if not exists entrega_tipo_id uuid
    references public.entregas_tipos_material(id) on delete set null,
  add column if not exists entrega_tipo_nombre text,
  add column if not exists entrega_talla text,
  -- Entrega creada al aprobar la solicitud. Permite ver a que dio lugar y
  -- evita que una misma solicitud genere dos entregas.
  add column if not exists entrega_id uuid
    references public.entregas_material(id) on delete set null;

comment on column public.solicitudes_personal.entrega_tipo_nombre is
  'Nombre congelado del tipo pedido: la solicitud no cambia si luego se borra el tipo del catalogo.';
comment on column public.solicitudes_personal.entrega_id is
  'Entrega generada al aprobar. NULL mientras esta pendiente o si se denego.';

-- Una solicitud de entrega tiene que decir QUE pide.
alter table public.solicitudes_personal
  drop constraint if exists solicitudes_personal_entrega_tipo_chk;
alter table public.solicitudes_personal
  add constraint solicitudes_personal_entrega_tipo_chk
  check (
    tipo <> 'entrega'
    or (entrega_tipo_nombre is not null and length(btrim(entrega_tipo_nombre)) > 0)
  );

-- Para localizar rapido la solicitud que origino una entrega.
create index if not exists solicitudes_personal_entrega_idx
  on public.solicitudes_personal (entrega_id)
  where entrega_id is not null;
