-- Backfill de usuarios.departamento desde usuarios.rol_label.
--
-- Motivo: en el modal "Personas con acceso" (y en general en las listas de la
-- familia "canal") la línea secundaria se compone como `puesto · departamento`.
-- Varios empleados mostraban SOLO una palabra (p. ej. Diego → "CACHIMBEROS",
-- Maria Paula → "CAMAREROS", Mireya → "JEFE DE SALA") porque su ficha de
-- `usuarios` tenía `departamento = NULL`, y el render descarta el vacío con
-- filter(Boolean). El puesto sí se resolvía bien; lo que faltaba era el depto.
--
-- En este sistema `usuarios.rol_label` ES el nombre del departamento (el rol de
-- un usuario = su departamento: una camarera de SALA tiene rol SALA). Por eso el
-- dato correcto para rellenar `departamento` es exactamente `rol_label`.
--
-- Alcance: SOLO usuarios que tienen ficha de EMPLEADO. Así excluimos cuentas que
-- son solo acceso/usuario y nunca se dieron de alta como empleado (p. ej.
-- Fernando Maroto, usuario de DIRECCIÓN sin ficha) — su ficha incompleta es
-- esperada y no debe tocarse.
--
-- Idempotente: solo actúa sobre filas con departamento NULL; re-ejecutarla no
-- cambia nada.

update public.usuarios u
set departamento = u.rol_label
where u.departamento is null
  and u.rol_label is not null
  and exists (
    select 1
    from public.empleados e
    where e.user_id = u.user_id
  );
