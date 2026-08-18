-- Música: el reproductor es POR LOCAL, no por empresa.
--
-- POR QUÉ:
-- La tabla nació con `empresa_id` como clave primaria: una sola fila por
-- empresa. Eso rompe en cuanto una empresa tiene dos locales, que es el caso
-- normal: al poner la lista de comidas en uno, el otro cambiaría de música solo,
-- porque ambos leen y escriben la MISMA fila.
--
-- Cada local necesita su propia música sonando, aunque sea la misma lista: el
-- restaurante puede ir por la canción 3 y la coctelería por la 7.
--
-- Se añade además `visto_en` para saber si el equipo marcado como altavoz sigue
-- realmente abierto: sin esa señal, un ordenador que se apagó seguiría constando
-- como el altavoz del local para siempre y nadie podría tomar el relevo sin
-- pisar a un equipo que quizá está sonando.
--
-- Idempotente: se puede ejecutar las veces que haga falta.

-- Se recrea la tabla porque cambia la clave primaria (de empresa_id a local_id).
-- No hay pérdida real: el módulo se estrenó el mismo día y no hay
-- reproducciones vivas que conservar.
DROP TABLE IF EXISTS public.musica_reproductor;

CREATE TABLE public.musica_reproductor (
  local_id uuid PRIMARY KEY REFERENCES public.locales(id) ON DELETE CASCADE,
  -- Se conserva para poder filtrar por empresa sin un JOIN en cada consulta y
  -- para que la política RLS sea directa.
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lista_id uuid REFERENCES public.musica_listas(id) ON DELETE SET NULL,
  cancion_id uuid REFERENCES public.musica_canciones(id) ON DELETE SET NULL,
  indice integer NOT NULL DEFAULT 0,
  reproduciendo boolean NOT NULL DEFAULT false,
  volumen smallint NOT NULL DEFAULT 70,
  comando text,
  comando_seq bigint NOT NULL DEFAULT 0,
  -- Navegador marcado como equipo de altavoces DE ESTE LOCAL. Solo uno: si otro
  -- se marca, releva al anterior (la app avisa antes de hacerlo).
  device_id text,
  device_nombre text,
  -- Señal de vida del equipo de altavoces. Sirve para saber si el que consta
  -- sigue realmente abierto o se quedó marcado tras cerrar el navegador.
  visto_en timestamptz,
  actualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT musica_reproductor_volumen_chk CHECK (volumen >= 0 AND volumen <= 100)
);

CREATE INDEX IF NOT EXISTS musica_reproductor_empresa_idx
  ON public.musica_reproductor (empresa_id);

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

do $$
begin
  alter publication supabase_realtime add table public.musica_reproductor;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

COMMENT ON TABLE public.musica_reproductor IS
  'Estado de la música de CADA LOCAL (una fila por local). Dos locales de la misma empresa suenan de forma independiente, aunque usen la misma lista.';
COMMENT ON COLUMN public.musica_reproductor.device_id IS
  'Navegador marcado como equipo de altavoces de este local. Solo uno a la vez: marcar otro releva al anterior.';
COMMENT ON COLUMN public.musica_reproductor.visto_en IS
  'Última señal de vida del equipo de altavoces. Si es antigua, el equipo que consta ya no está abierto y otro puede tomar el relevo sin avisar.';
