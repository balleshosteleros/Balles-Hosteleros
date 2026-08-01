-- La política de lectura de `usuarios` solo permitía leer la fila propia si
-- auth.uid() = id. Pero la app consulta el perfil por `user_id`
-- (.eq("user_id", userId)). Para cualquier usuario cuyo id ≠ user_id, RLS
-- bloqueaba la lectura → el perfil (nombre, rol, avatar) nunca cargaba.
-- La política de UPDATE ya contemplaba ambas columnas; alineamos la de SELECT.
DROP POLICY IF EXISTS "Users can view own profile" ON public.usuarios;

CREATE POLICY "Users can view own profile"
  ON public.usuarios
  FOR SELECT
  USING (
    (SELECT auth.uid()) = id
    OR (SELECT auth.uid()) = user_id
  );
