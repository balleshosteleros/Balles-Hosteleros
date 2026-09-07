-- Marca de EMPRESA MATRIZ: la empresa que gestiona el propio software.
--
-- No es un restaurante, así que:
--   1) Habilita los módulos internos del proveedor (PRODUCTO), invisibles para
--      cualquier empresa cliente aunque cree un departamento con ese nombre.
--   2) Queda fuera del sembrado canónico de hostelería (ver src/lib/seeds/sync.ts),
--      para que los departamentos que se le retiren no vuelvan solos.
--
-- Idempotente: se puede aplicar tantas veces como haga falta.

alter table public.empresas
  add column if not exists es_matriz boolean not null default false;

comment on column public.empresas.es_matriz is
  'Empresa que gestiona el propio software. Habilita los módulos internos del proveedor y la excluye del sembrado canónico de hostelería.';

-- Solo puede haber UNA matriz en el sistema.
create unique index if not exists empresas_una_sola_matriz
  on public.empresas ((true))
  where es_matriz;

update public.empresas
   set es_matriz = true
 where slug = 'balles-hosteleros'
   and es_matriz is distinct from true;
