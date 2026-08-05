-- Storage: políticas multiempresa (arreglo del bug que impedía subir documentos en Cierres)
--
-- PROBLEMA
-- 23 políticas de storage.objects resolvían la empresa así:
--     (storage.foldername(name))[1] IN (SELECT p.empresa_id FROM usuarios p WHERE p.user_id = auth.uid())
-- Eso solo contempla la empresa PRINCIPAL del usuario (usuarios.empresa_id), pero la app es
-- multiempresa: la empresa activa sale de la cookie y puede ser cualquiera de usuario_empresas.
-- El servidor firma la URL de subida con la empresa ACTIVA (empresaId/_pendientes/...) y, al subir
-- el binario desde el navegador, la política rechazaba el objeto por no coincidir con la principal.
-- Efecto: con la empresa "equivocada" activa la subida fallaba siempre; con empresa_id NULL, nunca.
--
-- SOLUCIÓN
-- Usar el helper canónico del proyecto empresas_del_usuario_text() / empresas_del_usuario(),
-- que hace UNION de usuarios + usuario_empresas (mismo patrón que documentacion, modelos_aeat_pdf
-- y estudios_apertura_fotos, que ya funcionaban bien).
--
-- Se respeta la forma de comparación original de cada política:
--   · texto  → (storage.foldername(name))[1] contra empresas_del_usuario_text()
--   · uuid   → ((storage.foldername(name))[1])::uuid contra empresas_del_usuario()
--   · slug   → split_part(name,'/',1) contra empresas.slug de empresas_del_usuario()
-- No se amplían permisos: solo se pasa de "empresa principal" a "empresas del usuario".
-- Idempotente: DROP IF EXISTS + CREATE en cada política.

-- ---------------------------------------------------------------------------
-- 1) Cierres (gerencia) — bucket cierres-documentos [comparación por TEXTO]
-- ---------------------------------------------------------------------------
drop policy if exists cierres_docs_read on storage.objects;
create policy cierres_docs_read on storage.objects for select to authenticated
using (
  bucket_id = 'cierres-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists cierres_docs_insert on storage.objects;
create policy cierres_docs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'cierres-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists cierres_docs_update on storage.objects;
create policy cierres_docs_update on storage.objects for update to authenticated
using (
  bucket_id = 'cierres-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists cierres_docs_delete on storage.objects;
create policy cierres_docs_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'cierres-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

-- ---------------------------------------------------------------------------
-- 2) Informes (gerencia) — bucket gerencia-informes [TEXTO]
-- ---------------------------------------------------------------------------
drop policy if exists informes_docs_read on storage.objects;
create policy informes_docs_read on storage.objects for select to authenticated
using (
  bucket_id = 'gerencia-informes'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists informes_docs_insert on storage.objects;
create policy informes_docs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'gerencia-informes'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists informes_docs_update on storage.objects;
create policy informes_docs_update on storage.objects for update to authenticated
using (
  bucket_id = 'gerencia-informes'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists informes_docs_delete on storage.objects;
create policy informes_docs_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'gerencia-informes'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

-- ---------------------------------------------------------------------------
-- 3) Jurídico — bucket juridico-documentos [TEXTO]
-- ---------------------------------------------------------------------------
drop policy if exists juridico_docs_read on storage.objects;
create policy juridico_docs_read on storage.objects for select to authenticated
using (
  bucket_id = 'juridico-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists juridico_docs_insert on storage.objects;
create policy juridico_docs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'juridico-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists juridico_docs_update on storage.objects;
create policy juridico_docs_update on storage.objects for update to authenticated
using (
  bucket_id = 'juridico-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists juridico_docs_delete on storage.objects;
create policy juridico_docs_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'juridico-documentos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

-- ---------------------------------------------------------------------------
-- 4) Logística · albaranes — bucket logistica-albaranes [UUID, rol public]
--    Se conserva el rol `public` original (el acceso lo acota auth.uid() del helper).
-- ---------------------------------------------------------------------------
drop policy if exists logistica_albaranes_read on storage.objects;
create policy logistica_albaranes_read on storage.objects for select
using (
  bucket_id = 'logistica-albaranes'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

drop policy if exists logistica_albaranes_insert on storage.objects;
create policy logistica_albaranes_insert on storage.objects for insert
with check (
  bucket_id = 'logistica-albaranes'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

drop policy if exists logistica_albaranes_update on storage.objects;
create policy logistica_albaranes_update on storage.objects for update
using (
  bucket_id = 'logistica-albaranes'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

drop policy if exists logistica_albaranes_delete on storage.objects;
create policy logistica_albaranes_delete on storage.objects for delete
using (
  bucket_id = 'logistica-albaranes'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

-- ---------------------------------------------------------------------------
-- 5) Logística · facturas — bucket logistica-facturas [UUID, rol public]
-- ---------------------------------------------------------------------------
drop policy if exists logistica_facturas_read on storage.objects;
create policy logistica_facturas_read on storage.objects for select
using (
  bucket_id = 'logistica-facturas'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

drop policy if exists logistica_facturas_insert on storage.objects;
create policy logistica_facturas_insert on storage.objects for insert
with check (
  bucket_id = 'logistica-facturas'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

drop policy if exists logistica_facturas_update on storage.objects;
create policy logistica_facturas_update on storage.objects for update
using (
  bucket_id = 'logistica-facturas'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

drop policy if exists logistica_facturas_delete on storage.objects;
create policy logistica_facturas_delete on storage.objects for delete
using (
  bucket_id = 'logistica-facturas'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

-- ---------------------------------------------------------------------------
-- 6) Empleados · docs (solo el INSERT estaba roto; el resto ya usaba el UNION) [UUID]
-- ---------------------------------------------------------------------------
drop policy if exists empleados_docs_insert on storage.objects;
create policy empleados_docs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'empleados-docs'
  and ((storage.foldername(name))[1])::uuid in (select public.empresas_del_usuario())
);

-- ---------------------------------------------------------------------------
-- 7) Listados por SLUG de empresa (carta y páginas web)
--    Aquí la primera carpeta es el slug, no el id: se traduce vía empresas.
-- ---------------------------------------------------------------------------
drop policy if exists carta_fotos_list_propio on storage.objects;
create policy carta_fotos_list_propio on storage.objects for select to authenticated
using (
  bucket_id = 'carta-fotos'
  and split_part(name, '/', 1) in (
    select e.slug from public.empresas e
    where e.id in (select public.empresas_del_usuario())
  )
);

drop policy if exists paginas_web_assets_list_propio on storage.objects;
create policy paginas_web_assets_list_propio on storage.objects for select to authenticated
using (
  bucket_id = 'paginas-web-assets'
  and split_part(name, '/', 1) in (
    select e.slug from public.empresas e
    where e.id in (select public.empresas_del_usuario())
  )
);
