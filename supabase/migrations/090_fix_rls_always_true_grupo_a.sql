-- ============================================================
-- 090_fix_rls_always_true_grupo_a.sql
--
-- Bloque B del audit de seguridad — Grupos 1, 2 y organigrama.
-- Reemplaza políticas RLS "USING (true)" / "WITH CHECK (true)"
-- por políticas que filtran por empresa del usuario autenticado.
--
-- TABLAS APARCADAS (no incluidas en esta migración):
--   - cronogramas_operativos, tareas: requieren tabla puente rol↔depts (M:N)
--   - accesos_apps: requiere rediseño (empresa_id + rol↔apps)
--   - escandallos_config_grupos: requiere añadir empresa_id
--   - nueva_receta_gatekeeper, nueva_receta_sub_estado: cadena via fase
--   - carta_item_likes, empresa_logos: revisión de público vs auth
-- ============================================================

-- Helper: empresa_ids del usuario autenticado
-- Usamos un patrón consistente: profiles.user_id = auth.uid() → empresa_id

-- ────────────────────────────────────────────────────────────
-- GRUPO 1: Tablas con empresa_id directo
-- ────────────────────────────────────────────────────────────

-- canales (chat por empresa)
DROP POLICY IF EXISTS "canales_read_auth"   ON public.canales;
DROP POLICY IF EXISTS "canales_insert"      ON public.canales;
DROP POLICY IF EXISTS "canales_update_auth" ON public.canales;
DROP POLICY IF EXISTS "canales_delete_auth" ON public.canales;

-- NOTA: canales.empresa_id es TEXT (bug de schema, debería ser uuid).
-- Casteamos profiles.empresa_id a text para que el IN funcione.
CREATE POLICY "canales_read" ON public.canales FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "canales_write" ON public.canales FOR ALL TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid()));

-- comunicados (empresa_id es TEXT — bug de schema, casteamos)
DROP POLICY IF EXISTS "comunicados_write" ON public.comunicados;
CREATE POLICY "comunicados_write" ON public.comunicados FOR ALL TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid()));

-- pedidos
DROP POLICY IF EXISTS "pedidos_write" ON public.pedidos;
CREATE POLICY "pedidos_write" ON public.pedidos FOR ALL TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));

-- nuevas_recetas (insert/update)
DROP POLICY IF EXISTS "recetas_insert" ON public.nuevas_recetas;
DROP POLICY IF EXISTS "recetas_update" ON public.nuevas_recetas;
CREATE POLICY "recetas_insert" ON public.nuevas_recetas FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "recetas_update" ON public.nuevas_recetas FOR UPDATE TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));

-- ────────────────────────────────────────────────────────────
-- GRUPO 2: Tablas hijas — filtran via tabla padre
-- ────────────────────────────────────────────────────────────

-- lineas_pedido → pedidos.empresa_id
DROP POLICY IF EXISTS "lineas_read"  ON public.lineas_pedido;
DROP POLICY IF EXISTS "lineas_write" ON public.lineas_pedido;
CREATE POLICY "lineas_read" ON public.lineas_pedido FOR SELECT TO authenticated
  USING (pedido_id IN (
    SELECT id FROM public.pedidos
    WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "lineas_write" ON public.lineas_pedido FOR ALL TO authenticated
  USING       (pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- albaranes_lineas → albaranes.empresa_id
DROP POLICY IF EXISTS "al_read"  ON public.albaranes_lineas;
DROP POLICY IF EXISTS "al_write" ON public.albaranes_lineas;
CREATE POLICY "al_read" ON public.albaranes_lineas FOR SELECT TO authenticated
  USING (albaran_id IN (
    SELECT id FROM public.albaranes
    WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "al_write" ON public.albaranes_lineas FOR ALL TO authenticated
  USING       (albaran_id IN (SELECT id FROM public.albaranes WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (albaran_id IN (SELECT id FROM public.albaranes WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- producto_composicion → productos.empresa_id (via producto_venta_id)
DROP POLICY IF EXISTS "pc_read"  ON public.producto_composicion;
DROP POLICY IF EXISTS "pc_write" ON public.producto_composicion;
CREATE POLICY "pc_read" ON public.producto_composicion FOR SELECT TO authenticated
  USING (producto_venta_id IN (
    SELECT id FROM public.productos
    WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "pc_write" ON public.producto_composicion FOR ALL TO authenticated
  USING       (producto_venta_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (producto_venta_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- ingredientes_proveedor → productos.empresa_id
DROP POLICY IF EXISTS "ip_read"  ON public.ingredientes_proveedor;
DROP POLICY IF EXISTS "ip_write" ON public.ingredientes_proveedor;
CREATE POLICY "ip_read" ON public.ingredientes_proveedor FOR SELECT TO authenticated
  USING (producto_id IN (
    SELECT id FROM public.productos
    WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "ip_write" ON public.ingredientes_proveedor FOR ALL TO authenticated
  USING       (producto_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (producto_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- producto_precios_compra → productos.empresa_id
DROP POLICY IF EXISTS "ppc_read"   ON public.producto_precios_compra;
DROP POLICY IF EXISTS "ppc_manage" ON public.producto_precios_compra;
CREATE POLICY "ppc_read" ON public.producto_precios_compra FOR SELECT TO authenticated
  USING (producto_id IN (
    SELECT id FROM public.productos
    WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "ppc_manage" ON public.producto_precios_compra FOR ALL TO authenticated
  USING       (producto_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (producto_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- producto_tarifa_precios → productos.empresa_id
DROP POLICY IF EXISTS "ptp_read"   ON public.producto_tarifa_precios;
DROP POLICY IF EXISTS "ptp_manage" ON public.producto_tarifa_precios;
CREATE POLICY "ptp_read" ON public.producto_tarifa_precios FOR SELECT TO authenticated
  USING (producto_id IN (
    SELECT id FROM public.productos
    WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "ptp_manage" ON public.producto_tarifa_precios FOR ALL TO authenticated
  USING       (producto_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (producto_id IN (SELECT id FROM public.productos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- escandallo_ingredientes → escandallos.empresa_id
DROP POLICY IF EXISTS "ei_write" ON public.escandallo_ingredientes;
CREATE POLICY "ei_write" ON public.escandallo_ingredientes FOR ALL TO authenticated
  USING       (escandallo_id IN (SELECT id FROM public.escandallos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (escandallo_id IN (SELECT id FROM public.escandallos WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- nueva_receta_cata → nuevas_recetas.empresa_id
DROP POLICY IF EXISTS "cata_write" ON public.nueva_receta_cata;
CREATE POLICY "cata_write" ON public.nueva_receta_cata FOR ALL TO authenticated
  USING       (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- nueva_receta_compra → nuevas_recetas.empresa_id
DROP POLICY IF EXISTS "compra_write" ON public.nueva_receta_compra;
CREATE POLICY "compra_write" ON public.nueva_receta_compra FOR ALL TO authenticated
  USING       (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- nueva_receta_historial → nuevas_recetas.empresa_id
DROP POLICY IF EXISTS "hist_write" ON public.nueva_receta_historial;
CREATE POLICY "hist_write" ON public.nueva_receta_historial FOR ALL TO authenticated
  USING       (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- nueva_receta_ingrediente → nuevas_recetas.empresa_id
DROP POLICY IF EXISTS "ing_write" ON public.nueva_receta_ingrediente;
CREATE POLICY "ing_write" ON public.nueva_receta_ingrediente FOR ALL TO authenticated
  USING       (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())))
  WITH CHECK  (receta_id IN (SELECT id FROM public.nuevas_recetas WHERE empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())));

-- mensajes → canales.empresa_id
DROP POLICY IF EXISTS "mensajes_read"   ON public.mensajes;
DROP POLICY IF EXISTS "mensajes_insert" ON public.mensajes;
CREATE POLICY "mensajes_read" ON public.mensajes FOR SELECT TO authenticated
  USING (canal_id IN (
    SELECT id FROM public.canales
    WHERE empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "mensajes_insert" ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (canal_id IN (
    SELECT id FROM public.canales
    WHERE empresa_id IN (SELECT p.empresa_id::text FROM profiles p WHERE p.user_id = auth.uid())
  ));

-- ────────────────────────────────────────────────────────────
-- ORGANIGRAMAS — visible para autenticados de la misma empresa
-- (la tabla usa empresa_slug, hay que joinear con empresas.slug)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read organigramas" ON public.organigramas;
CREATE POLICY "organigramas_read_empresa" ON public.organigramas FOR SELECT TO authenticated
  USING (empresa_slug IN (
    SELECT e.slug FROM public.empresas e
    WHERE e.id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));

-- ────────────────────────────────────────────────────────────
-- empresa_logos — política pública mantenida (logos de empresas son públicos
-- porque aparecen en login y carta digital pública). Si quieres restringirlo,
-- cambia esta política en una migración futura.
-- carta_item_likes — política pública intencional para que comensales puedan
-- dar like sin login. Mantenida.
-- ────────────────────────────────────────────────────────────
