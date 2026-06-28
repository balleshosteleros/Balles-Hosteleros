-- Marca de "el usuario ya eligió SU contraseña".
--
-- Contexto: al contratar (Reclutamiento → Empleado) el sistema crea el usuario
-- con una contraseña ALEATORIA que el empleado nunca conoce. Hasta que el
-- empleado no establezca su propia contraseña (vía el correo "Crea tu
-- contraseña"), no debe poder entrar al sistema — ni siquiera con Google.
--
-- `password_set = false` por defecto → cubre a TODOS los empleados ya
-- existentes: la próxima vez que entren se les forzará a elegir contraseña.
-- Se pone a `true` cuando el usuario completa `updatePassword` por sí mismo.
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.usuarios.password_set IS
  'true cuando el usuario ha establecido su propia contraseña (no la temporal generada en el alta). Mientras sea false, el login (incluido Google) se bloquea y se le pide elegir contraseña por correo.';
