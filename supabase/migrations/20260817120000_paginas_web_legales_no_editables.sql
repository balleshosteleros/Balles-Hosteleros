-- Páginas legales: contenido derivado, no editable a mano.
--
-- POR QUÉ:
-- La política de privacidad, el aviso legal y la política de cookies llevan
-- datos que identifican a la empresa ante la ley: razón social, CIF, domicilio
-- y correo para ejercer derechos. Esos datos tienen UNA fuente — Ajustes →
-- Datos generales (empresas.datos_generales) — y deben salir siempre de ahí.
--
-- Si cualquiera pudiera reescribirlos dentro del editor de la web, tendríamos
-- el CIF en dos sitios distintos y acabarían divergiendo. Un documento legal
-- con un CIF equivocado o un domicilio viejo no cumple el RGPD, y el problema
-- no se detecta hasta que alguien reclama.
--
-- Por eso estas páginas se marcan aquí como generadas: el editor las muestra en
-- solo lectura y el servidor rechaza guardar cambios sobre ellas. Para
-- cambiarlas se corrigen los datos en Ajustes y se regeneran.

alter table public.paginas_web
  add column if not exists legal_tipo text;

alter table public.paginas_web
  add column if not exists legal_generada_at timestamptz;

-- Solo los tres tipos contemplados (o NULL = página normal, editable).
do $$
begin
  alter table public.paginas_web
    add constraint paginas_web_legal_tipo_chk
    check (legal_tipo is null or legal_tipo in ('privacidad', 'aviso_legal', 'cookies'));
exception
  when duplicate_object then null;
end $$;

comment on column public.paginas_web.legal_tipo is
  'Si no es NULL, la página es un documento legal generado desde empresas.datos_generales. No se edita a mano: se regenera.';

comment on column public.paginas_web.legal_generada_at is
  'Última vez que se regeneró el texto legal a partir de los datos de la empresa.';

-- Una empresa no puede tener dos veces el mismo documento legal.
create unique index if not exists paginas_web_legal_tipo_unico
  on public.paginas_web (empresa_id, legal_tipo)
  where legal_tipo is not null;
