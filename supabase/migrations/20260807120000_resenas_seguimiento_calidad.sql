-- Seguimiento de calidad dentro de la ficha de cada reseña (petición de Ivan, 2026-08-07).
--
-- La persona de calidad venía llevando esto en una hoja de cálculo aparte
-- ("BACANAL 2026 · AGENDAS"): por dónde entró el cliente, cuándo se registró,
-- cuándo vino, si cogió el teléfono, en qué punto está la gestión, quién la
-- lleva y las observaciones del closer. Esos datos pasan a vivir dentro de la
-- propia reseña para que no haya dos sitios donde mirar.
--
-- OJO: `estado` (el kanban: nuevo_comensal / excelente / …) NO se toca. Lo que
-- se añade es `estado_gestion`, que es otra cosa: el seguimiento comercial de
-- la llamada. Son dos ejes distintos y conviven.
--
-- Idempotente: se puede ejecutar las veces que haga falta.

ALTER TABLE public.resenas
  ADD COLUMN IF NOT EXISTS plataforma text,
  ADD COLUMN IF NOT EXISTS fecha_registro date,
  ADD COLUMN IF NOT EXISTS fecha_sesion date,
  ADD COLUMN IF NOT EXISTS coge_telefono text,
  ADD COLUMN IF NOT EXISTS estado_gestion text,
  ADD COLUMN IF NOT EXISTS observaciones_closer text,
  ADD COLUMN IF NOT EXISTS gestionada_por uuid;

-- Quién la gestiona: usuario de la plataforma. Si se borra el usuario la
-- reseña se queda (el histórico de calidad no se pierde), solo pierde el "quién".
ALTER TABLE public.resenas
  DROP CONSTRAINT IF EXISTS resenas_gestionada_por_fkey;

ALTER TABLE public.resenas
  ADD CONSTRAINT resenas_gestionada_por_fkey
  FOREIGN KEY (gestionada_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Todos los desplegables admiten NULL: recién llegada de Google, la reseña
-- todavía no está gestionada y esos campos están en blanco a propósito.
-- Sin dato NO es lo mismo que un dato en negativo.

ALTER TABLE public.resenas
  DROP CONSTRAINT IF EXISTS resenas_plataforma_check;

ALTER TABLE public.resenas
  ADD CONSTRAINT resenas_plataforma_check
  CHECK (plataforma IS NULL OR plataforma IN (
    'go_high_level',
    'cover_manager',
    'google',
    'otro'
  ));

ALTER TABLE public.resenas
  DROP CONSTRAINT IF EXISTS resenas_coge_telefono_check;

ALTER TABLE public.resenas
  ADD CONSTRAINT resenas_coge_telefono_check
  CHECK (coge_telefono IS NULL OR coge_telefono IN (
    'si',
    'no',
    'sin_telefono'
  ));

ALTER TABLE public.resenas
  DROP CONSTRAINT IF EXISTS resenas_estado_gestion_check;

ALTER TABLE public.resenas
  ADD CONSTRAINT resenas_estado_gestion_check
  CHECK (estado_gestion IS NULL OR estado_gestion IN (
    'pendiente_llamada',
    'no_quiere_llamada',
    'pendiente_visitarnos',
    'no_quiere_volver',
    'mando_whatsapp',
    'vuelve_cliente',
    'se_revisa_resena'
  ));

CREATE INDEX IF NOT EXISTS resenas_estado_gestion_idx
  ON public.resenas (empresa_id, estado_gestion);

CREATE INDEX IF NOT EXISTS resenas_gestionada_por_idx
  ON public.resenas (empresa_id, gestionada_por);

COMMENT ON COLUMN public.resenas.plataforma IS
  'Por dónde entró el cliente: go_high_level | cover_manager | google | otro. NULL = sin informar.';
COMMENT ON COLUMN public.resenas.fecha_registro IS
  'Fecha en que el cliente se registró en la plataforma de origen.';
COMMENT ON COLUMN public.resenas.fecha_sesion IS
  'Fecha en que el cliente vino al restaurante.';
COMMENT ON COLUMN public.resenas.coge_telefono IS
  'si | no | sin_telefono. NULL = todavía no se ha llamado.';
COMMENT ON COLUMN public.resenas.estado_gestion IS
  'Seguimiento comercial de la llamada. NO confundir con `estado` (columna del kanban).';
COMMENT ON COLUMN public.resenas.observaciones_closer IS
  'Notas libres de quien llama al cliente.';
COMMENT ON COLUMN public.resenas.gestionada_por IS
  'Usuario que lleva esta reseña (auth.users.id).';
