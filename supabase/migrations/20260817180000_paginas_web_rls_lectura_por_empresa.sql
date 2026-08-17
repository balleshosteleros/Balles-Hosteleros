-- Lectura pública: una web tiene MÁS de una página.
--
-- POR QUÉ:
-- La policy anterior solo dejaba leer públicamente la página enganchada al
-- dominio. Con una sola página (una one-page) funcionaba, pero en cuanto la web
-- tiene varias — /politica-de-privacidad, /aviso-legal, /politica-de-cookies —
-- esas páginas devolvían 404 al visitante: existen y están publicadas, pero no
-- tienen fila propia en paginas_web_dominios porque cuelgan del mismo dominio
-- que la portada.
--
-- Eso rompía una obligación legal: la política de privacidad tiene que ser
-- accesible desde cualquier página y enlazable desde los formularios.
--
-- Nuevo criterio: publicada + de una empresa que tenga al menos un dominio
-- verificado. Sigue sin exponer borradores ni empresas sin web activa.

drop policy if exists paginas_web_public_read on public.paginas_web;

create policy paginas_web_public_read on public.paginas_web
  for select
  to anon, authenticated
  using (
    estado = 'PUBLICADA'::pagina_web_estado
    and empresa_id in (
      select d.empresa_id
      from public.paginas_web_dominios d
      where d.estado = 'VERIFICADO'::dominio_estado
    )
  );
