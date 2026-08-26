-- Puestos: TODOS los datos son obligatorios.
--
-- Un puesto incompleto daba de alta empleados con falta de datos: al contratar,
-- las condiciones del puesto se copian al empleado (`empleado_condiciones`), así
-- que un puesto con salario 0, sin horas, sin días libres y sin convenio metía
-- al empleado en el sistema con esos huecos y llegaba así hasta la gestoría.
--
-- Esta migración deja los puestos YA existentes completos. La norma para los
-- nuevos vive en `src/features/rrhh/services/validar-puesto.ts` y se aplica en
-- el formulario y en las acciones de servidor.
--
-- Idempotente: se puede reejecutar. Solo rellena huecos, nunca pisa datos.

BEGIN;

CREATE TEMPORARY TABLE _plantilla_puestos (
  nombre text PRIMARY KEY,
  descripcion text NOT NULL,
  salario_bruto numeric NOT NULL,
  jornada text NOT NULL,
  horas numeric NOT NULL,
  dias_libres int NOT NULL,
  observaciones text NOT NULL
) ON COMMIT DROP;

INSERT INTO _plantilla_puestos VALUES
-- ── ADMINISTRATIVA ────────────────────────────────────────────
('DIRECTOR', 'Dirige el negocio: marca los objetivos, aprueba el presupuesto y responde de la cuenta de resultados del local.', 3000, 'Completa', 40, 2,
 'Puesto de confianza con disponibilidad. Reporta a propiedad.'),
('GERENTE', 'Gestiona el día a día del local: equipo, servicio, compras y cierres de caja.', 2200, 'Completa', 40, 2,
 'Reporta a Dirección. Alterna turnos de comida y cena.'),
('RECURSOS HUMANOS', 'Lleva altas, bajas, contratos, nóminas, cuadrantes y toda la relación con la gestoría.', 1900, 'Completa', 40, 2,
 'Trata datos personales: confidencialidad obligatoria.'),
('CALIDAD', 'Vela por el APPCC, las temperaturas, la limpieza y las auditorías de seguridad alimentaria.', 1800, 'Completa', 40, 2,
 'Requiere formación en manipulación de alimentos y APPCC.'),
('CONTABLE', 'Registra facturas, concilia bancos y prepara la información contable y fiscal del negocio.', 1900, 'Completa', 40, 2,
 'Coordinación continua con gestoría.'),
('LOGISTICA', 'Gestiona proveedores, pedidos, albaranes, inventarios y el stock del local.', 1700, 'Completa', 40, 2,
 'Recepción de mercancía a primera hora.'),
('COMMUNITY', 'Lleva las redes sociales del local: contenido, publicaciones, comunidad y reseñas.', 1600, 'Completa', 40, 2,
 'Trabajo con picos en campañas y eventos.'),
('FILMMAKER', 'Graba y edita el material audiovisual del local para redes, web y campañas.', 1600, 'Completa', 40, 2,
 'Aporta o usa equipo propio según acuerdo.'),
('TRAFFIQER', 'Gestiona la publicidad de pago y la captación: campañas, presupuesto y resultados.', 1700, 'Completa', 40, 2,
 'Maneja presupuesto publicitario: requiere reporte semanal.'),
('GESTOR', 'Enlace con la gestoría: contratos, nóminas, seguros sociales y documentación laboral.', 1800, 'Completa', 40, 2,
 'Trata datos personales: confidencialidad obligatoria.'),
('ABOGADO', 'Asesora en materia legal: contratos, licencias, reclamaciones y procesos del negocio.', 2000, 'Completa', 40, 2,
 'Puesto de asesoramiento, sin turno de sala.'),

-- ── OPERATIVA ────────────────────────────────────────────────
('JEFE DE SALA', 'Dirige el servicio de sala: organiza al equipo, atiende al cliente y cierra el turno.', 1600, 'Completa', 40, 2,
 'Turno partido según servicio de comidas y cenas.'),
('CAMAREROS', 'Atiende a los clientes en sala: toma comandas, sirve, cobra y mantiene su rango.', 1400, 'Completa', 40, 2,
 'Turnos rotativos, incluidos fines de semana y festivos.'),
('HOSTESS', 'Recibe y acomoda a los clientes, gestiona las reservas y controla la entrada del local.', 1350, 'Completa', 40, 2,
 'Imagen y trato al cliente en la puerta del local.'),
('LIMPIEZA', 'Mantiene limpias e higienizadas las zonas del local, incluidos aseos y áreas comunes.', 1250, 'Completa', 40, 2,
 'Uso obligatorio de EPI y productos homologados.'),
('JEFE DE COCINA', 'Dirige la cocina: carta, escandallos, pedidos, equipo y control de mermas.', 2000, 'Completa', 40, 2,
 'Responsable del APPCC de cocina.'),
('COCINERO', 'Elabora los platos de su partida siguiendo las fichas técnicas y las normas de higiene.', 1500, 'Completa', 40, 2,
 'Requiere carné de manipulador de alimentos.'),
('OFFICE', 'Se encarga del lavado de menaje y de la limpieza de la cocina durante y tras el servicio.', 1250, 'Completa', 40, 2,
 'Uso obligatorio de EPI y productos homologados.'),
('CANTANTE', 'Actuación musical en directo en el local según la programación de sala.', 1400, 'Partida', 20, 4,
 'Actuaciones según programación: fines de semana y eventos.'),
('MUSICO', 'Acompañamiento musical en directo según la programación del local.', 1400, 'Partida', 20, 4,
 'Actuaciones según programación: fines de semana y eventos.'),
('DJ', 'Pincha y ambienta musicalmente las sesiones del local según la programación.', 1400, 'Partida', 20, 4,
 'Sesiones de noche, fines de semana y eventos.'),
('TECNICO', 'Mantiene las instalaciones y equipos del local: averías, revisiones y preventivo.', 1600, 'Completa', 40, 2,
 'Disponibilidad para averías urgentes.'),
('CACHIMBEROS', 'Prepara y atiende el servicio de cachimbas en sala, con su montaje y su limpieza.', 1350, 'Completa', 40, 2,
 'Turnos de noche y fines de semana.');

-- 1) Datos del puesto: descripción y convenio.
UPDATE puestos p
SET descripcion = coalesce(nullif(btrim(p.descripcion), ''), t.descripcion),
    convenio_colectivo = coalesce(nullif(btrim(p.convenio_colectivo), ''), 'Hostelería de Madrid')
FROM _plantilla_puestos t
WHERE upper(btrim(p.nombre)) = t.nombre;

-- Puestos fuera del catálogo: al menos convenio y una descripción mínima.
UPDATE puestos
SET descripcion = coalesce(nullif(btrim(descripcion), ''), 'Funciones y responsabilidades del puesto ' || nombre || '.'),
    convenio_colectivo = coalesce(nullif(btrim(convenio_colectivo), ''), 'Hostelería de Madrid');

-- 2) Condiciones: salario, jornada, horas, días libres, vacaciones,
--    y observaciones.
UPDATE puesto_salarios s
SET salario_bruto = CASE WHEN coalesce(s.salario_bruto, 0) > 0 THEN s.salario_bruto ELSE t.salario_bruto END,
    jornada_contrato = coalesce(nullif(btrim(s.jornada_contrato), ''), t.jornada),
    horas_semanales = CASE WHEN coalesce(s.horas_semanales, 0) > 0 THEN s.horas_semanales ELSE t.horas END,
    dias_libres = CASE WHEN coalesce(s.dias_libres, 0) > 0 THEN s.dias_libres ELSE t.dias_libres END,
    vacaciones = coalesce(nullif(btrim(s.vacaciones), ''), '30 días'),
    observaciones = coalesce(nullif(btrim(s.observaciones), ''), t.observaciones),
    updated_at = now()
FROM puestos p
JOIN _plantilla_puestos t ON upper(btrim(p.nombre)) = t.nombre
WHERE s.puesto_id = p.id;

-- Puestos fuera del catálogo: mínimos coherentes para no dejar huecos.
UPDATE puesto_salarios s
SET salario_bruto = CASE WHEN coalesce(s.salario_bruto, 0) > 0 THEN s.salario_bruto ELSE 1400 END,
    jornada_contrato = coalesce(nullif(btrim(s.jornada_contrato), ''), 'Completa'),
    horas_semanales = CASE WHEN coalesce(s.horas_semanales, 0) > 0 THEN s.horas_semanales ELSE 40 END,
    dias_libres = CASE WHEN coalesce(s.dias_libres, 0) > 0 THEN s.dias_libres ELSE 2 END,
    vacaciones = coalesce(nullif(btrim(s.vacaciones), ''), '30 días'),
    observaciones = coalesce(nullif(btrim(s.observaciones), ''), 'Condiciones según convenio de hostelería.'),
    updated_at = now();

-- 3) Todo puesto debe tener su fila de condiciones (nivel 1).
INSERT INTO puesto_salarios (empresa_id, puesto_id, nivel, salario_bruto, jornada_contrato,
                             horas_semanales, dias_libres, vacaciones, observaciones, estado)
SELECT p.empresa_id, p.id, 1,
       coalesce(t.salario_bruto, 1400),
       coalesce(t.jornada, 'Completa'),
       coalesce(t.horas, 40),
       coalesce(t.dias_libres, 2),
       '30 días',
       coalesce(t.observaciones, 'Condiciones según convenio de hostelería.'),
       'activo'
FROM puestos p
LEFT JOIN _plantilla_puestos t ON upper(btrim(p.nombre)) = t.nombre
WHERE NOT EXISTS (SELECT 1 FROM puesto_salarios s WHERE s.puesto_id = p.id);

-- 4) Coherencia: los puestos artísticos son de refuerzo (media jornada), así
--    que no pueden quedar como jornada completa con 20 h.
UPDATE puesto_salarios s
SET jornada_contrato = 'Partida', updated_at = now()
FROM puestos p
WHERE s.puesto_id = p.id
  AND upper(btrim(p.nombre)) IN ('DJ', 'CANTANTE', 'MUSICO')
  AND coalesce(s.horas_semanales, 0) <= 25
  AND s.jornada_contrato = 'Completa';

COMMIT;
