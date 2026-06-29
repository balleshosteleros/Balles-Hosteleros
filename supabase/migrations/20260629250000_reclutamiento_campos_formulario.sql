-- ============================================================
-- Configuración real de los campos del formulario de candidatura
-- (Reclutamiento → Config → Candidatos). 1 fila por empresa, vive en
-- `reclutamiento_config.campos_formulario` (jsonb).
--
-- Forma: { "<clave>": { "activo": bool, "obligatorio": bool }, ... }
--
-- Campos FIJOS (siempre obligatorios, no configurables, NO van en el jsonb):
--   nombre, apellidos, email, telefono.
-- Campos CONFIGURABLES (activo/obligatorio):
--   cv, carta_presentacion, genero, ubicacion, disponibilidad,
--   experiencia_previa, como_nos_conocio.
--
-- El formulario público (`FormCandidaturaPublica`) y el endpoint
-- (`/api/empleo/candidatura`) leen esta config para mostrar/exigir cada campo.
-- ============================================================

alter table public.reclutamiento_config
  add column if not exists campos_formulario jsonb not null default '{
    "cv":                 { "activo": true,  "obligatorio": true  },
    "carta_presentacion": { "activo": true,  "obligatorio": false },
    "genero":             { "activo": true,  "obligatorio": true  },
    "ubicacion":          { "activo": true,  "obligatorio": true  },
    "disponibilidad":     { "activo": true,  "obligatorio": true  },
    "experiencia_previa": { "activo": true,  "obligatorio": true  },
    "como_nos_conocio":   { "activo": true,  "obligatorio": true  }
  }'::jsonb;

comment on column public.reclutamiento_config.campos_formulario is
  'Config de campos del formulario público de candidatura por empresa: { clave: { activo, obligatorio } }. nombre/apellidos/email/telefono son fijos (siempre obligatorios) y no se incluyen.';
