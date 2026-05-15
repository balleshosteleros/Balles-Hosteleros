-- ============================================================
-- 20260513150000_contabilidad_rls_hardening.sql
-- Endurece las policies *_write/_manage que estaban abiertas
-- (`using (true) with check (true)`) en las tablas creadas por
-- la migración legacy. Cada policy ahora filtra por empresa
-- (directa o vía tabla padre).
-- ============================================================

-- Padres con empresa_id (text): contactos_contabilidad, facturas, transacciones,
-- elaboraciones, partidas, equipos_frio, inventarios,
-- descuentos, vencimientos, encuestas, publicaciones

drop policy if exists "cc_write" on public.contactos_contabilidad;
create policy "cc_write" on public.contactos_contabilidad for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "fact_write" on public.facturas;
create policy "fact_write" on public.facturas for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "tx_write" on public.transacciones;
create policy "tx_write" on public.transacciones for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "elab_write" on public.elaboraciones;
create policy "elab_write" on public.elaboraciones for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "part_write" on public.partidas;
create policy "part_write" on public.partidas for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "eq_write" on public.equipos_frio;
create policy "eq_write" on public.equipos_frio for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "inv_write" on public.inventarios;
create policy "inv_write" on public.inventarios for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "desc_write" on public.descuentos;
create policy "desc_write" on public.descuentos for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "venc_write" on public.vencimientos;
create policy "venc_write" on public.vencimientos for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "enc_write" on public.encuestas;
create policy "enc_write" on public.encuestas for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "pub_write" on public.publicaciones;
create policy "pub_write" on public.publicaciones for all to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));

-- Hijas: filtro vía tabla padre
drop policy if exists "rt_write" on public.registros_temperatura;
create policy "rt_write" on public.registros_temperatura for all to authenticated
  using (equipo_id in (
    select e.id from public.equipos_frio e
    where e.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ))
  with check (equipo_id in (
    select e.id from public.equipos_frio e
    where e.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ));

drop policy if exists "li_write" on public.lineas_inventario;
create policy "li_write" on public.lineas_inventario for all to authenticated
  using (inventario_id in (
    select i.id from public.inventarios i
    where i.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ))
  with check (inventario_id in (
    select i.id from public.inventarios i
    where i.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ));

drop policy if exists "fe_manage" on public.facturas_etiquetas;
create policy "fe_manage" on public.facturas_etiquetas for all to authenticated
  using (factura_id in (
    select f.id from public.facturas f
    where f.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ))
  with check (factura_id in (
    select f.id from public.facturas f
    where f.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ));

drop policy if exists "te_manage" on public.transacciones_etiquetas;
create policy "te_manage" on public.transacciones_etiquetas for all to authenticated
  using (transaccion_id in (
    select t.id from public.transacciones t
    where t.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ))
  with check (transaccion_id in (
    select t.id from public.transacciones t
    where t.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ));

drop policy if exists "lf_manage" on public.lineas_factura;
create policy "lf_manage" on public.lineas_factura for all to authenticated
  using (factura_id in (
    select f.id from public.facturas f
    where f.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ))
  with check (factura_id in (
    select f.id from public.facturas f
    where f.empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())
  ));
