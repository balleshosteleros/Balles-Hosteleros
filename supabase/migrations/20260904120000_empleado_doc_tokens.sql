-- ============================================================================
-- Enlace propio para que el EMPLEADO suba su documentación a su ficha.
--
-- Hasta ahora la documentación identificativa (DNI, certificado bancario, vida
-- laboral) solo entraba por dos vías: el proceso de selección, o a mano desde
-- la ficha. Para un empleado ya dado de alta el circuito era manual — el
-- trabajador lo mandaba por correo, RRHH lo reenviaba a Dirección y Dirección
-- lo subía— y por el camino los datos bancarios pasaban por varios buzones.
--
-- Con esta tabla cada empleado recibe un enlace ÚNICO y personal: sube el
-- documento y entra directo en su ficha, sin intermediarios.
--
-- Mismo patrón que `gestoria_contrato_tokens` y `gestoria_baja_doc_tokens`:
-- token hash-only (nunca se guarda en claro), expiración, y escritura solo por
-- service-role porque el enlace se usa SIN sesión.
-- Idempotente.
-- ============================================================================

create table if not exists public.empleado_doc_tokens (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  -- Qué documento se le pide: mismas claves que la subida manual de la ficha
  -- (dni_anverso | dni_reverso | iban | ss).
  tipo_doc        text not null,
  token_hash      text not null,                        -- HMAC-SHA256 del token (PII)
  expira_en       timestamptz not null,
  -- Trazabilidad del ciclo de vida:
  enviado_en      timestamptz not null default now(),   -- tick 1 (correo de petición)
  recordatorio_en timestamptz,                          -- tick 2 (recordatorio)
  subido_en       timestamptz,                          -- tick 3 (el empleado sube)
  doc_path        text,                                 -- ruta en empleados-docs
  created_at      timestamptz not null default now(),
  constraint empleado_doc_tokens_tipo_chk
    check (tipo_doc in ('dni_anverso', 'dni_reverso', 'iban', 'ss'))
);

create index if not exists empleado_doc_tokens_hash_idx
  on public.empleado_doc_tokens (token_hash);
create index if not exists empleado_doc_tokens_empresa_idx
  on public.empleado_doc_tokens (empresa_id);
-- Para el barrido de recordatorios: pendientes = sin subir y sin recordar aún.
create index if not exists empleado_doc_tokens_pendientes_idx
  on public.empleado_doc_tokens (empresa_id, subido_en, recordatorio_en);

-- Un enlace vivo por empleado y tipo de documento: al reenviar la petición se
-- reutiliza la fila (nuevo token) en vez de acumular enlaces válidos sueltos.
create unique index if not exists empleado_doc_tokens_empleado_tipo_uk
  on public.empleado_doc_tokens (empleado_id, tipo_doc);

alter table public.empleado_doc_tokens enable row level security;

-- Solo lectura para usuarios de la empresa. La escritura va por service-role:
-- el enlace lo abre el empleado sin sesión iniciada.
drop policy if exists empleado_doc_tokens_sel on public.empleado_doc_tokens;
create policy empleado_doc_tokens_sel on public.empleado_doc_tokens
  for select using (empresa_id in (select empresas_del_usuario()));
