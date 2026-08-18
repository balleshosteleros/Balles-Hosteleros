-- Sala → Música: listas de reproducción propias que sustituyen a Spotify.
--
-- POR QUÉ:
-- Hasta ahora la música de los locales sonaba desde una cuenta de Spotify. Eso
-- tiene dos problemas reales: la licencia de Spotify no cubre el uso comercial
-- en un local abierto al público, y la empresa no controla QUÉ suena — cualquiera
-- con el móvil vinculado cambia la lista y aparece música que no corresponde al
-- momento del servicio.
--
-- El modelo aquí es el contrario: la EMPRESA define las listas y los archivos
-- (MP3 propios, subidos a R2, no streaming de terceros), y el equipo del local
-- solo elige entre lo ya preparado y pulsa Play. Quien puede añadir o quitar
-- canciones se controla con el permiso "MÚSICA" de Ajustes → Roles; dar al Play
-- lo puede hacer cualquiera que vea SALA.
--
-- Los horarios existen porque una lista de copas sonando a las 9 de la mañana es
-- un error de servicio. Una lista con horario queda BLOQUEADA fuera de su franja
-- y no deja pulsar Play. `sin_horario = true` la deja disponible siempre.
--
-- La tabla de reproductores es lo que permite que el ordenador conectado a los
-- altavoces sea el que suena, mientras un encargado lo controla desde su móvil:
-- el equipo de altavoces se marca una vez como reproductor del local y va leyendo
-- su propio estado; quien manda solo escribe en esa fila.
--
-- Idempotente: se puede ejecutar las veces que haga falta.

-- ─── Canciones: biblioteca de archivos de la empresa ────────────────────────

CREATE TABLE IF NOT EXISTS public.musica_canciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  artista text,
  -- Duración en segundos, leída del propio archivo al subirlo.
  duracion_seg integer NOT NULL DEFAULT 0,
  -- Clave del objeto en R2 (bucket compartido). Ver src/shared/lib/r2.ts.
  r2_key text NOT NULL,
  -- Tamaño real en bytes: es lo que se suma para la cuota de música.
  bytes bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'audio/mpeg',
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS musica_canciones_empresa_idx
  ON public.musica_canciones (empresa_id);

-- Un mismo archivo no se sube dos veces para la misma empresa.
CREATE UNIQUE INDEX IF NOT EXISTS musica_canciones_empresa_r2key_uidx
  ON public.musica_canciones (empresa_id, r2_key);

-- ─── Listas de reproducción ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.musica_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  -- Etiqueta de uso: Desayuno, Comida, Tarde, Cena, Copas, Ambiente tranquilo,
  -- Fin de semana… Texto libre para no tener que migrar al añadir una nueva.
  etiqueta text,
  favorita boolean NOT NULL DEFAULT false,
  -- true = suena a cualquier hora. false = solo dentro de sus franjas horarias.
  sin_horario boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS musica_listas_empresa_idx
  ON public.musica_listas (empresa_id);

-- ─── Canciones dentro de cada lista (orden explícito) ───────────────────────

CREATE TABLE IF NOT EXISTS public.musica_lista_canciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lista_id uuid NOT NULL REFERENCES public.musica_listas(id) ON DELETE CASCADE,
  cancion_id uuid NOT NULL REFERENCES public.musica_canciones(id) ON DELETE CASCADE,
  posicion integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS musica_lista_canciones_lista_idx
  ON public.musica_lista_canciones (lista_id, posicion);

CREATE INDEX IF NOT EXISTS musica_lista_canciones_empresa_idx
  ON public.musica_lista_canciones (empresa_id);

-- La misma canción no se repite dentro de una lista.
CREATE UNIQUE INDEX IF NOT EXISTS musica_lista_canciones_uidx
  ON public.musica_lista_canciones (lista_id, cancion_id);

-- ─── Franjas horarias por lista ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.musica_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lista_id uuid NOT NULL REFERENCES public.musica_listas(id) ON DELETE CASCADE,
  -- Días de la semana ISO: 1 = lunes … 7 = domingo.
  dias smallint[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}'::smallint[],
  -- "HH:MM" en hora LOCAL de la empresa (ver `empresas.zona_horaria`).
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS musica_horarios_lista_idx
  ON public.musica_horarios (lista_id);

CREATE INDEX IF NOT EXISTS musica_horarios_empresa_idx
  ON public.musica_horarios (empresa_id);

-- ─── Reproductor del local (el equipo conectado a los altavoces) ────────────
--
-- Una fila por empresa. El equipo de altavoces la lee en tiempo real y obedece;
-- quien controla desde el móvil solo escribe aquí. `comando_seq` se incrementa
-- en cada orden para que el reproductor distinga una orden nueva de un eco de
-- su propio estado.

CREATE TABLE IF NOT EXISTS public.musica_reproductor (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  lista_id uuid REFERENCES public.musica_listas(id) ON DELETE SET NULL,
  cancion_id uuid REFERENCES public.musica_canciones(id) ON DELETE SET NULL,
  -- Posición dentro de la lista (índice), para saber qué toca al pasar de canción.
  indice integer NOT NULL DEFAULT 0,
  reproduciendo boolean NOT NULL DEFAULT false,
  volumen smallint NOT NULL DEFAULT 70,
  -- Última orden recibida: play | pause | siguiente | anterior | stop | volumen.
  comando text,
  comando_seq bigint NOT NULL DEFAULT 0,
  -- Identificador del navegador marcado como reproductor del local.
  device_id text,
  device_nombre text,
  actualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

do $$
begin
  alter table public.musica_reproductor
    add constraint musica_reproductor_volumen_chk
    check (volumen >= 0 and volumen <= 100);
exception
  when duplicate_object then null;
end $$;

-- ─── Cuota de música por empresa ────────────────────────────────────────────
--
-- La música vive dentro de los 500 GB por empresa, pero con su propio tope para
-- que nadie llene el almacenamiento subiendo discografías enteras. 5 GB ≈ 1.250
-- canciones ≈ 85 horas: de sobra para cubrir todos los servicios con variedad.

CREATE TABLE IF NOT EXISTS public.musica_cuota (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  bytes_limit bigint NOT NULL DEFAULT (5 * 1024 * 1024 * 1024),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bytes consumidos por la música de cada empresa (solo canciones activas).
CREATE OR REPLACE VIEW public.musica_uso_por_empresa AS
SELECT
  e.id AS empresa_id,
  COALESCE(SUM(c.bytes) FILTER (WHERE c.activo), 0)::bigint AS bytes_used,
  COALESCE(q.bytes_limit, 5 * 1024 * 1024 * 1024)::bigint AS bytes_limit
FROM public.empresas e
LEFT JOIN public.musica_canciones c ON c.empresa_id = e.id
LEFT JOIN public.musica_cuota q ON q.empresa_id = e.id
GROUP BY e.id, q.bytes_limit;

ALTER VIEW public.musica_uso_por_empresa SET (security_invoker = on);
GRANT SELECT ON public.musica_uso_por_empresa TO authenticated;

-- ─── RLS: cada empresa ve y gestiona solo su música ─────────────────────────

ALTER TABLE public.musica_canciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS musica_canciones_read ON public.musica_canciones;
CREATE POLICY musica_canciones_read
  ON public.musica_canciones FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
DROP POLICY IF EXISTS musica_canciones_write ON public.musica_canciones;
CREATE POLICY musica_canciones_write
  ON public.musica_canciones FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

ALTER TABLE public.musica_listas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS musica_listas_read ON public.musica_listas;
CREATE POLICY musica_listas_read
  ON public.musica_listas FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
DROP POLICY IF EXISTS musica_listas_write ON public.musica_listas;
CREATE POLICY musica_listas_write
  ON public.musica_listas FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

ALTER TABLE public.musica_lista_canciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS musica_lista_canciones_read ON public.musica_lista_canciones;
CREATE POLICY musica_lista_canciones_read
  ON public.musica_lista_canciones FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
DROP POLICY IF EXISTS musica_lista_canciones_write ON public.musica_lista_canciones;
CREATE POLICY musica_lista_canciones_write
  ON public.musica_lista_canciones FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

ALTER TABLE public.musica_horarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS musica_horarios_read ON public.musica_horarios;
CREATE POLICY musica_horarios_read
  ON public.musica_horarios FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
DROP POLICY IF EXISTS musica_horarios_write ON public.musica_horarios;
CREATE POLICY musica_horarios_write
  ON public.musica_horarios FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

ALTER TABLE public.musica_reproductor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS musica_reproductor_read ON public.musica_reproductor;
CREATE POLICY musica_reproductor_read
  ON public.musica_reproductor FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
DROP POLICY IF EXISTS musica_reproductor_write ON public.musica_reproductor;
CREATE POLICY musica_reproductor_write
  ON public.musica_reproductor FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

ALTER TABLE public.musica_cuota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS musica_cuota_read ON public.musica_cuota;
CREATE POLICY musica_cuota_read
  ON public.musica_cuota FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
DROP POLICY IF EXISTS musica_cuota_write ON public.musica_cuota;
CREATE POLICY musica_cuota_write
  ON public.musica_cuota FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

-- ─── Realtime: el equipo de altavoces obedece órdenes al instante ───────────

do $$
begin
  alter publication supabase_realtime add table public.musica_reproductor;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

COMMENT ON TABLE public.musica_canciones IS
  'Biblioteca de archivos de música de la empresa, almacenados en R2. Se suben desde Sala → Música; no hay descarga desde internet.';
COMMENT ON TABLE public.musica_listas IS
  'Listas que la empresa deja preparadas. El equipo del local solo elige entre estas y pulsa Play.';
COMMENT ON COLUMN public.musica_listas.sin_horario IS
  'true = disponible a cualquier hora. false = solo dentro de las franjas de musica_horarios; fuera de ellas la lista aparece bloqueada.';
COMMENT ON TABLE public.musica_horarios IS
  'Franjas en las que una lista puede sonar. Días ISO 1=lunes..7=domingo, horas en zona horaria de la empresa.';
COMMENT ON TABLE public.musica_reproductor IS
  'Estado del equipo conectado a los altavoces (uno por empresa). Permite controlar la música desde el móvil mientras suena en ese equipo.';
COMMENT ON TABLE public.musica_cuota IS
  'Tope de almacenamiento de música por empresa (default 5 GB ≈ 85 horas), dentro de los 500 GB generales.';
