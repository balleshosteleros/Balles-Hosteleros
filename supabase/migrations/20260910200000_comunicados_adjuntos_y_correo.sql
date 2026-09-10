-- ============================================================
-- COMUNICADOS: documentos adjuntos DE VERDAD + envío por correo
--
-- PROBLEMA
-- El formulario de Gerencia → Comunicados tenía un botón "Adjuntar documento"
-- que no abría el explorador de archivos ni subía nada: solo pintaba un nombre
-- inventado ("documento_1.pdf") que se perdía al guardar. La tabla ni siquiera
-- tenía dónde guardar el adjunto. Quien lo usaba creía haber mandado el
-- documento y al empleado no le llegaba nada.
--
-- Además el correo del comunicado solo salía por el cron de los recurrentes:
-- al publicar uno a mano no se enviaba a nadie por email.
--
-- SOLUCIÓN
--   1. `adjuntos` (jsonb): metadatos de los archivos ya subidos al bucket.
--   2. `enviar_email` (bool): decisión explícita de mandarlo también por correo.
--   3. `email_enviado_at`: sello de cuándo salió, para no repetir el envío si el
--      comunicado se vuelve a guardar.
--   4. Bucket privado `comunicados-adjuntos`, con el mismo tope y las mismas
--      políticas multiempresa que el resto de documentos (50 MB,
--      `empresas_del_usuario_text()`).
--
-- Los comunicados RECURRENTES ya mandaban correo desde el cron; se les marca
-- `enviar_email = true` para que sigan comportándose igual y no se queden mudos.
--
-- Idempotente.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1) Columnas
-- ---------------------------------------------------------------------------
alter table public.comunicados
  add column if not exists adjuntos jsonb not null default '[]'::jsonb,
  add column if not exists enviar_email boolean not null default false,
  add column if not exists email_enviado_at timestamptz;

comment on column public.comunicados.adjuntos is
  'Documentos adjuntos ya subidos al bucket comunicados-adjuntos: [{path,name,size,mime}]. Vacío = sin adjuntos.';
comment on column public.comunicados.enviar_email is
  'true = al publicarlo, además del aviso en la app, se manda por correo a los destinatarios.';
comment on column public.comunicados.email_enviado_at is
  'Instante en que salió el correo. Evita reenviarlo al volver a guardar el comunicado.';

-- Los recurrentes venían mandando correo por el cron desde siempre: se respeta.
update public.comunicados
set enviar_email = true
where recurrencia is distinct from 'sin_repeticion'
  and enviar_email is not true;

-- ---------------------------------------------------------------------------
-- 2) Bucket privado de adjuntos (50 MB, el tope estándar de documentos)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('comunicados-adjuntos', 'comunicados-adjuntos', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 52428800
where id = 'comunicados-adjuntos'
  and file_size_limit is distinct from 52428800;

-- ---------------------------------------------------------------------------
-- 3) Políticas multiempresa — path `<empresa_id>/<...>` [comparación por TEXTO]
--
-- Lectura para CUALQUIER usuario de la empresa: el adjunto lo tiene que poder
-- abrir la plantilla entera, no solo quien lo publicó. Escritura y borrado, lo
-- mismo que en los demás buckets de documentos; quién puede publicar un
-- comunicado ya lo decide el permiso de la pantalla de Gerencia.
-- ---------------------------------------------------------------------------
drop policy if exists comunicados_adjuntos_read on storage.objects;
create policy comunicados_adjuntos_read on storage.objects for select to authenticated
using (
  bucket_id = 'comunicados-adjuntos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists comunicados_adjuntos_insert on storage.objects;
create policy comunicados_adjuntos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'comunicados-adjuntos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists comunicados_adjuntos_update on storage.objects;
create policy comunicados_adjuntos_update on storage.objects for update to authenticated
using (
  bucket_id = 'comunicados-adjuntos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);

drop policy if exists comunicados_adjuntos_delete on storage.objects;
create policy comunicados_adjuntos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'comunicados-adjuntos'
  and (storage.foldername(name))[1] in (select public.empresas_del_usuario_text())
);
