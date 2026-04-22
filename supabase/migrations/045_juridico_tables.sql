-- ============================================================
-- 045_juridico_tables.sql — Módulo Jurídico (consolidado)
--
-- La migración 010 declaraba procesos_juridicos con empresa_id text
-- y nunca llegó a aplicarse en esta BD. Creamos aquí todo el módulo
-- con los tipos reales (uuid), siguiendo el patrón de 038_carta_digital.
--
-- Tablas:
--   procesos_juridicos        (proceso legal base)
--   partes_juridicas          (demandantes, abogados, peritos…)
--   documentos_juridicos      (demandas, sentencias, recursos…)
--   plazos_judiciales         (vistas, notificaciones, pagos)
--   costes_judiciales         (honorarios, tasas, costas)
--
-- Vista:
--   procesos_juridicos_resumen
-- ============================================================

-- ─── 1. PROCESOS JURÍDICOS ─────────────────────────────────
create table if not exists public.procesos_juridicos (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  titulo             text not null,
  tipo               text not null default 'Otro',
  estado             text not null default 'PENDIENTE',
  gravedad           text not null default 'LEVE',
  descripcion        text,
  responsable        text,
  abogado            text,
  fecha_inicio       date default current_date,
  fecha_vista        date,
  fecha_resolucion   date,
  importe_reclamado  numeric(12,2) default 0,
  num_expediente     text,
  juzgado            text,
  referencia         text,
  coste_acumulado    numeric(12,2) default 0,
  notas              text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_procjur_empresa
  on public.procesos_juridicos(empresa_id, created_at desc);
create index if not exists idx_procjur_estado
  on public.procesos_juridicos(empresa_id, estado);

create or replace function public.set_procjur_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists procjur_updated_at on public.procesos_juridicos;
create trigger procjur_updated_at
  before update on public.procesos_juridicos
  for each row execute function public.set_procjur_updated_at();

-- ─── 2. PARTES INTERESADAS ─────────────────────────────────
create table if not exists public.partes_juridicas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  rol             text not null
                    check (rol in ('Demandante','Demandado','Abogado defensa','Abogado contrario',
                                   'Perito','Testigo','Juez','Mediador','Otro')),
  tipo_persona    text not null default 'Fisica'
                    check (tipo_persona in ('Fisica','Juridica')),
  nombre          text not null,
  cif_dni         text,
  telefono        text,
  email           text,
  bufete          text,
  colegio_num     text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_partes_proceso on public.partes_juridicas(proceso_id);
create index if not exists idx_partes_empresa on public.partes_juridicas(empresa_id);

create or replace function public.set_partes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists partes_updated_at on public.partes_juridicas;
create trigger partes_updated_at
  before update on public.partes_juridicas
  for each row execute function public.set_partes_updated_at();

-- enlazar abogado principal a partes_juridicas (opcional)
alter table public.procesos_juridicos
  add column if not exists abogado_id uuid
    references public.partes_juridicas(id) on delete set null;

-- ─── 3. DOCUMENTOS JURÍDICOS ───────────────────────────────
create table if not exists public.documentos_juridicos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  nombre          text not null,
  categoria       text not null default 'Otro'
                    check (categoria in ('Demanda','Requerimiento','Escrito','Resolución',
                                          'Notificación','Contrato','Comunicación','Informe',
                                          'Anexo','Otro')),
  descripcion     text,
  fecha_documento date,
  fecha_recepcion date,
  plazo_respuesta date,
  estado          text not null default 'Pendiente revisar'
                    check (estado in ('Pendiente revisar','Revisado','Respondido','Archivado')),
  url             text,
  tipo_mime       text,
  confidencial    boolean not null default false,
  subido_por      text,
  subido_por_uid  uuid references auth.users(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_docjur_proceso on public.documentos_juridicos(proceso_id);
create index if not exists idx_docjur_empresa on public.documentos_juridicos(empresa_id);

create or replace function public.set_docjur_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists docjur_updated_at on public.documentos_juridicos;
create trigger docjur_updated_at
  before update on public.documentos_juridicos
  for each row execute function public.set_docjur_updated_at();

-- ─── 4. PLAZOS JUDICIALES ──────────────────────────────────
create table if not exists public.plazos_judiciales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  nombre          text not null,
  tipo            text not null default 'Otro'
                    check (tipo in ('Vista oral','Junta conciliacion','Tramite','Sentencia',
                                     'Recurso','Notificacion','Pago','Otro')),
  fecha           date not null,
  hora            time,
  juzgado         text,
  sala            text,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','Celebrado','Aplazado','Anulado')),
  resultado       text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_plazos_proceso on public.plazos_judiciales(proceso_id);
create index if not exists idx_plazos_fecha
  on public.plazos_judiciales(empresa_id, fecha) where estado = 'Pendiente';

create or replace function public.set_plazos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists plazos_updated_at on public.plazos_judiciales;
create trigger plazos_updated_at
  before update on public.plazos_judiciales
  for each row execute function public.set_plazos_updated_at();

-- ─── 5. COSTES JUDICIALES ──────────────────────────────────
create table if not exists public.costes_judiciales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  concepto        text not null,
  tipo            text not null default 'Honorarios abogado'
                    check (tipo in ('Honorarios abogado','Honorarios perito','Tasa judicial',
                                     'Costas','Indemnizacion','Otro')),
  importe         numeric(12,2) not null,
  fecha           date not null default current_date,
  pagado          boolean not null default false,
  fecha_pago      date,
  notas           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_costes_proceso on public.costes_judiciales(proceso_id);

-- ─── 6. ACTUALIZACIONES (timeline del proceso) ────────────
create table if not exists public.actualizaciones_juridicas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  proceso_id    uuid not null references public.procesos_juridicos(id) on delete cascade,
  texto         text not null,
  fecha         date not null default current_date,
  apuntado_por  text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_actjur_proceso
  on public.actualizaciones_juridicas(proceso_id, fecha desc);

-- ─── 7. RLS ────────────────────────────────────────────────
alter table public.procesos_juridicos       enable row level security;
alter table public.partes_juridicas         enable row level security;
alter table public.documentos_juridicos     enable row level security;
alter table public.plazos_judiciales        enable row level security;
alter table public.costes_judiciales        enable row level security;
alter table public.actualizaciones_juridicas enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'procesos_juridicos','partes_juridicas','documentos_juridicos',
    'plazos_judiciales','costes_judiciales','actualizaciones_juridicas'
  ]
  loop
    execute format('drop policy if exists "%1$s_read" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_manage" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_read" on public.%1$s for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));',
      t);
    execute format(
      'create policy "%1$s_manage" on public.%1$s for all to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())) with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));',
      t);
  end loop;
end $$;

-- ─── 8. VISTA: procesos_juridicos_resumen ──────────────────
create or replace view public.procesos_juridicos_resumen as
select
  pj.id,
  pj.empresa_id,
  pj.titulo,
  pj.tipo,
  pj.estado,
  pj.gravedad,
  pj.fecha_inicio,
  pj.importe_reclamado,
  pj.coste_acumulado,
  count(distinct dj.id)                                              as num_documentos,
  count(distinct plj.id) filter (where plj.estado = 'Pendiente')     as plazos_pendientes,
  min(plj.fecha)         filter (where plj.estado = 'Pendiente')     as proximo_plazo
from public.procesos_juridicos pj
left join public.documentos_juridicos dj on dj.proceso_id = pj.id
left join public.plazos_judiciales plj on plj.proceso_id = pj.id
group by pj.id;

-- ─── 9. SEED DATA ──────────────────────────────────────────
-- Balles Hosteleros  → 00000000-0000-0000-0000-000000000001
-- Bacanal Tapas Demo → d3b0aaaa-0000-0000-0000-000000000001

insert into public.procesos_juridicos
  (id, empresa_id, titulo, tipo, estado, gravedad, abogado, descripcion, fecha_inicio, importe_reclamado)
values
  -- Balles Hosteleros
  ('a1111111-1111-1111-1111-000000000001','00000000-0000-0000-0000-000000000001',
   'Reclamación por despido improcedente – Ex empleado J.L.',
   'Reclamación judicial','EN PROCESO','GRAVE','Bufete García & Asociados',
   'Ex empleado reclama despido improcedente. Demanda presentada en Juzgado Social nº3.',
   '2026-01-15', 18500),
  ('a1111111-1111-1111-1111-000000000002','00000000-0000-0000-0000-000000000001',
   'Sanción municipal por ruido – Terraza nocturna',
   'Sanción administrativa','REVISIÓN','MEDIA','Ana Beltrán (interna)',
   'Expediente sancionador por exceso de decibelios en horario nocturno. Multa propuesta: 3.000 €.',
   '2026-02-20', 3000),
  ('a1111111-1111-1111-1111-000000000003','00000000-0000-0000-0000-000000000001',
   'Reclamación de proveedor – Factura impagada',
   'Reclamación contra empresa','PENDIENTE','LEVE','Carlos Mendoza (interno)',
   'Proveedor de bebidas reclama factura de 2.400 € supuestamente impagada.',
   '2026-03-01', 2400),
  ('a1111111-1111-1111-1111-000000000004','00000000-0000-0000-0000-000000000001',
   'Inspección de trabajo – Control de horarios',
   'Procedimiento interno','CERRADO','MEDIA','Ana Beltrán (interna)',
   'Inspección de trabajo sobre registro horario. Resolución favorable sin sanción.',
   '2025-11-10', 0),
  ('a1111111-1111-1111-1111-000000000005','00000000-0000-0000-0000-000000000001',
   'Expediente disciplinario – Empleado M.R.',
   'Expediente laboral','ESCALADO','MUY GRAVE','Carlos Mendoza (interno)',
   'Expediente por falta muy grave: abandono de puesto reiterado sin justificación.',
   '2026-03-20', 0),
  ('a1111111-1111-1111-1111-000000000006','00000000-0000-0000-0000-000000000001',
   'Licencia de actividad – Renovación 2026',
   'Sanción administrativa','ARCHIVADO','LEVE','Despacho Ruiz Legal',
   'Renovación de licencia de actividad. Tramitada y concedida sin incidencias.',
   '2025-09-01', 0),
  -- Bacanal Tapas Demo
  ('b2222222-2222-2222-2222-000000000001','d3b0aaaa-0000-0000-0000-000000000001',
   'Reclamación de cliente por intoxicación alimentaria',
   'Reclamación judicial','EN PROCESO','MUY GRAVE','Bufete García & Asociados',
   'Cliente presenta denuncia por supuesta intoxicación. Informe del laboratorio de sanidad solicitado.',
   '2026-02-10', 12000),
  ('b2222222-2222-2222-2222-000000000002','d3b0aaaa-0000-0000-0000-000000000001',
   'Sanción por terraza – Ocupación de vía pública',
   'Sanción administrativa','PENDIENTE','MEDIA','Marta Domínguez (interna)',
   'Expediente del Ayuntamiento por exceso de mobiliario en terraza. Multa propuesta: 1.500 €.',
   '2026-03-15', 1500),
  ('b2222222-2222-2222-2222-000000000003','d3b0aaaa-0000-0000-0000-000000000001',
   'Contrato de alquiler – Renegociación condiciones',
   'Procedimiento interno','CERRADO','LEVE','Despacho Ruiz Legal',
   'Renegociación del contrato de alquiler del local. Reducción del 8% en la renta mensual.',
   '2026-01-05', 0),
  ('b2222222-2222-2222-2222-000000000004','d3b0aaaa-0000-0000-0000-000000000001',
   'Reclamación laboral – Horas extra no pagadas',
   'Expediente laboral','REVISIÓN','GRAVE','Marta Domínguez (interna)',
   'Ex empleada reclama 45 horas extra no abonadas. Pendiente de cruzar con registros de fichaje.',
   '2026-04-01', 1800)
on conflict (id) do nothing;

insert into public.actualizaciones_juridicas (empresa_id, proceso_id, texto, fecha, apuntado_por) values
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000001',
   'Recibida notificación judicial. Se asigna al bufete externo.','2026-01-18','Ana Beltrán'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000001',
   'Acto de conciliación programado para el 15 de febrero.','2026-02-01','Bufete García'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000001',
   'Conciliación sin acuerdo. Se procede a juicio oral.','2026-02-16','Bufete García'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000002',
   'Recibida notificación del Ayuntamiento. Revisión de mediciones.','2026-02-22','Ana Beltrán'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000002',
   'Presentadas alegaciones con informe acústico favorable.','2026-03-05','Ana Beltrán'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000003',
   'Verificado con contabilidad: pago realizado pero no reflejado por error bancario.','2026-03-10','Carlos Mendoza'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000004',
   'Documentación entregada al inspector.','2025-11-15','Ana Beltrán'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000004',
   'Resolución favorable. Sin sanción.','2025-12-20','Ana Beltrán'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000005',
   'Abierto expediente tras tercer abandono registrado.','2026-03-21','Carlos Mendoza'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000005',
   'Audiencia con el empleado realizada. Niega los hechos.','2026-03-28','Carlos Mendoza'),
  ('00000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-000000000005',
   'Escalado a dirección para decisión final.','2026-04-02','Ana Beltrán'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000001',
   'Recibida denuncia. Se contacta con el seguro.','2026-02-12','Bufete García'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000001',
   'Informe de sanidad: no se encontraron irregularidades.','2026-03-05','Bufete García'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000001',
   'Pendiente de resolución judicial.','2026-03-20','Bufete García'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000002',
   'Revisión de la licencia de ocupación vigente.','2026-03-18','Marta Domínguez'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000003',
   'Reunión con propietario. Propuesta de reducción presentada.','2026-01-15','Despacho Ruiz Legal'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000003',
   'Acuerdo alcanzado. Firma del nuevo contrato.','2026-02-01','Despacho Ruiz Legal'),
  ('d3b0aaaa-0000-0000-0000-000000000001','b2222222-2222-2222-2222-000000000004',
   'Recopilando registros de fichaje del periodo reclamado.','2026-04-03','Marta Domínguez');

-- notify PostgREST so it reloads the schema cache
notify pgrst, 'reload schema';
