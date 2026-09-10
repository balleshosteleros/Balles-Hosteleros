-- Completar los datos que faltaban en el catalogo de puestos tras la migracion.
-- Idempotente: solo rellena huecos, nunca pisa un dato ya puesto a mano.

-- 1) Tipo de contrato por defecto: indefinido en todo puesto que no lo tenga.
update puestos
set tipo_contrato_defecto = 'indefinido', updated_at = now()
where tipo_contrato_defecto is null or btrim(tipo_contrato_defecto) = '';

-- 2) Departamento validador: DIRECCION de la propia empresa.
update puestos p
set validador_departamento_id = d.id, updated_at = now()
from departamentos d
where d.empresa_id = p.empresa_id
  and d.nombre ilike 'DIRECC%'
  and p.validador_departamento_id is null;

-- 3) Convenio colectivo: normalizar la variante sin tilde y rellenar los vacios.
update puestos
set convenio_colectivo = 'Hostelería de Madrid', updated_at = now()
where convenio_colectivo is null
   or btrim(convenio_colectivo) = ''
   or convenio_colectivo = 'Hosteleria Madrid';

-- 4) Descripcion vacia: la del propio nombre del puesto como punto de partida.
update puestos
set descripcion = nombre, updated_at = now()
where descripcion is null or btrim(descripcion) = '';

-- 5) HABANA / SEGURIDAD no tenia fila de condiciones (nivel 1). Se crea con los
--    valores de referencia del convenio, alineados con el resto de puestos base.
insert into puesto_salarios (
  empresa_id, puesto_id, nivel, salario_bruto, efectivo_extra,
  jornada_contrato, horas_semanales, dias_libres, vacaciones,
  horario_semanal, objetivos, estado
)
select p.empresa_id, p.id, 1, 1400.00, 0,
       'Completa', 40, 2, '30 días',
       '[]'::jsonb, '[]'::jsonb, 'activo'
from puestos p
where p.nombre = 'SEGURIDAD'
  and not exists (
    select 1 from puesto_salarios ps where ps.puesto_id = p.id and ps.nivel = 1
  );
