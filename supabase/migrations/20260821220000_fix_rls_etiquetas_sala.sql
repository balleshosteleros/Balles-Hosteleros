-- Arregla la seguridad (RLS) de las etiquetas de sala, que no dejaba usarlas.
--
-- EL FALLO: las cuatro políticas comparaban `empresa_id` contra el `id` de la
-- PROPIA FILA en vez de contra las empresas del usuario:
--
--   empresa_id IN (SELECT sala_etiquetas.id FROM empresas_del_usuario())
--                         ^^^^^^^^^^^^^^^^^ la fila, no la empresa
--
-- `empresas_del_usuario()` devuelve una columna sin nombrar, así que
-- `SELECT sala_etiquetas.id` dentro del subselect se resuelve contra la tabla
-- de fuera (referencia correlacionada) y compara el id de la etiqueta con el
-- de la empresa. Nunca coinciden, así que la condición era siempre falsa: ni se
-- podían crear categorías ni se veían las etiquetas ya existentes (16 en la
-- base de datos, invisibles).
--
-- LA CORRECCIÓN: comparar contra la columna que devuelve la función, dándole un
-- alias explícito para que no haya ambigüedad posible.
--
-- Idempotente.

-- ── Categorías de etiquetas ─────────────────────────────────────────────────
drop policy if exists "etiq_cat_rw" on public.sala_etiqueta_categorias;

create policy "etiq_cat_rw"
  on public.sala_etiqueta_categorias for all
  using (empresa_id in (select e from empresas_del_usuario() as e))
  with check (empresa_id in (select e from empresas_del_usuario() as e));

-- ── Etiquetas ───────────────────────────────────────────────────────────────
drop policy if exists "etiq_rw" on public.sala_etiquetas;

create policy "etiq_rw"
  on public.sala_etiquetas for all
  using (empresa_id in (select e from empresas_del_usuario() as e))
  with check (empresa_id in (select e from empresas_del_usuario() as e));

-- ── Asignación de etiquetas a CLIENTES ──────────────────────────────────────
-- La tabla no tiene `empresa_id`: la empresa la pone el cliente al que apunta.
drop policy if exists "cliente_etiq_rw" on public.sala_cliente_etiquetas;

create policy "cliente_etiq_rw"
  on public.sala_cliente_etiquetas for all
  using (
    exists (
      select 1 from public.clientes_sala c
      where c.id = sala_cliente_etiquetas.cliente_id
        and c.empresa_id in (select e from empresas_del_usuario() as e)
    )
  )
  with check (
    exists (
      select 1 from public.clientes_sala c
      where c.id = sala_cliente_etiquetas.cliente_id
        and c.empresa_id in (select e from empresas_del_usuario() as e)
    )
  );

-- ── Asignación de etiquetas a RESERVAS ──────────────────────────────────────
drop policy if exists "reserva_etiq_rw" on public.sala_reserva_etiquetas;

create policy "reserva_etiq_rw"
  on public.sala_reserva_etiquetas for all
  using (
    exists (
      select 1 from public.reservas r
      where r.id = sala_reserva_etiquetas.reserva_id
        and r.empresa_id in (select e from empresas_del_usuario() as e)
    )
  )
  with check (
    exists (
      select 1 from public.reservas r
      where r.id = sala_reserva_etiquetas.reserva_id
        and r.empresa_id in (select e from empresas_del_usuario() as e)
    )
  );
