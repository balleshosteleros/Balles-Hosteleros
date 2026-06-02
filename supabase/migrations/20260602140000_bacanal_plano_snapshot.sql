-- Snapshot del plano de RESTAURANTE BACANAL tras ajustes en UI (2026-06-02).
--
-- Idempotente: si el local ya tiene mesas, no hace nada (prod queda intacto).
-- En entornos limpios siembra salas + zonas + mesas + decoraciones + plano.
--
-- Estructura:
--   Sala "Terraza" (orden 0): Terraza Exterior, Terraza Cubierta
--   Sala "Sala"   (principal): Barra, Altas, Cuadrado, Super VIP, VIP, Cristalera, Redondas

DO $$
DECLARE
  v_local       uuid := 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'; -- Restaurante Bacanal
  v_terr        uuid;
  v_sala        uuid;
  v_plano       uuid;
  z_te          uuid; -- Terraza Exterior
  z_tc          uuid; -- Terraza Cubierta
  z_barra       uuid;
  z_altas       uuid;
  z_cuadrado    uuid;
  z_svip        uuid;
  z_vip         uuid;
  z_cristalera  uuid;
  z_redondas    uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM mesas WHERE local_id = v_local) THEN
    RAISE NOTICE 'BACANAL ya tiene mesas; snapshot omitido.';
    RETURN;
  END IF;

  -- Salas
  INSERT INTO salas (local_id, nombre, orden, es_principal)
  VALUES (v_local, 'Terraza', 0, false) RETURNING id INTO v_terr;

  INSERT INTO salas (local_id, nombre, orden, es_principal)
  VALUES (v_local, 'Sala', 1, true) RETURNING id INTO v_sala;

  -- Zonas - Terraza
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden)
  VALUES (v_local, v_terr, 'Terraza Exterior', '#FDE68A', 1) RETURNING id INTO z_te;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden)
  VALUES (v_local, v_terr, 'Terraza Cubierta', '#A7F3D0', 2) RETURNING id INTO z_tc;

  -- Zonas - Sala
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Barra',      '#FBCFE8',  4, 172,  57) RETURNING id INTO z_barra;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Altas',      '#FECACA',  5,  20, 302) RETURNING id INTO z_altas;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Cuadrado',   '#BFDBFE',  6, 427, 267) RETURNING id INTO z_cuadrado;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Super VIP',  '#E9D5FF',  7, 683,  67) RETURNING id INTO z_svip;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'VIP',        '#DDD6FE',  8, 700, 174) RETURNING id INTO z_vip;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Cristalera', '#A5F3FC',  9, 601, 380) RETURNING id INTO z_cristalera;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Redondas',   '#FED7AA', 10, 747, 383) RETURNING id INTO z_redondas;

  -- Mesas Terraza Exterior (TE1..TE16) - grid 4x4
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_te, 'TE1',  4, 4, 'BAJA', 'cuadrada', 345.00, 200.00),
    (v_local, z_te, 'TE2',  4, 4, 'BAJA', 'cuadrada', 345.00, 290.00),
    (v_local, z_te, 'TE3',  4, 4, 'BAJA', 'cuadrada', 345.00, 380.00),
    (v_local, z_te, 'TE4',  4, 4, 'BAJA', 'cuadrada', 345.00, 470.00),
    (v_local, z_te, 'TE5',  4, 4, 'BAJA', 'cuadrada', 260.00, 200.00),
    (v_local, z_te, 'TE6',  4, 4, 'BAJA', 'cuadrada', 260.00, 290.00),
    (v_local, z_te, 'TE7',  4, 4, 'BAJA', 'cuadrada', 260.00, 380.00),
    (v_local, z_te, 'TE8',  4, 4, 'BAJA', 'cuadrada', 260.00, 470.00),
    (v_local, z_te, 'TE9',  4, 4, 'BAJA', 'cuadrada', 175.00, 200.00),
    (v_local, z_te, 'TE10', 4, 4, 'BAJA', 'cuadrada', 175.00, 290.00),
    (v_local, z_te, 'TE11', 4, 4, 'BAJA', 'cuadrada', 175.00, 380.00),
    (v_local, z_te, 'TE12', 4, 4, 'BAJA', 'cuadrada', 175.00, 470.00),
    (v_local, z_te, 'TE13', 4, 4, 'BAJA', 'cuadrada',  90.00, 200.00),
    (v_local, z_te, 'TE14', 4, 4, 'BAJA', 'cuadrada',  90.00, 290.00),
    (v_local, z_te, 'TE15', 4, 4, 'BAJA', 'cuadrada',  90.00, 380.00),
    (v_local, z_te, 'TE16', 4, 4, 'BAJA', 'cuadrada',  90.00, 470.00);

  -- Mesas Terraza Cubierta (TI1..TI6)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_tc, 'TI1', 4, 4, 'BAJA', 'cuadrada', 460.00, 200.00),
    (v_local, z_tc, 'TI2', 4, 4, 'BAJA', 'cuadrada', 540.00, 200.00),
    (v_local, z_tc, 'TI3', 4, 4, 'BAJA', 'cuadrada', 460.00, 285.00),
    (v_local, z_tc, 'TI4', 4, 4, 'BAJA', 'cuadrada', 540.00, 285.00),
    (v_local, z_tc, 'TI5', 4, 4, 'BAJA', 'cuadrada', 460.00, 370.00),
    (v_local, z_tc, 'TI6', 2, 2, 'BAJA', 'cuadrada', 540.00, 370.00);

  -- Mesas Barra (B1)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_barra, 'B1', 3, 3, 'BARRA', 'cuadrada', 164.98, 85.27);

  -- Mesas Altas (A1..A8)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_altas, 'A1', 4, 4, 'ALTA',  'cuadrada', 220.15, 323.90),
    (v_local, z_altas, 'A2', 4, 4, 'ALTA',  'cuadrada', 149.16, 323.53),
    (v_local, z_altas, 'A3', 4, 4, 'ALTA',  'cuadrada',  78.72, 323.92),
    (v_local, z_altas, 'A4', 5, 5, 'ALTA',  'cuadrada', 220.54, 243.15),
    (v_local, z_altas, 'A5', 5, 5, 'ALTA',  'cuadrada', 149.88, 241.99),
    (v_local, z_altas, 'A6', 5, 5, 'ALTA',  'cuadrada',  80.06, 242.74);

  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y, rotation, width, height) VALUES
    (v_local, z_altas, 'A7', 1, 4, 'ALTA',  'rectangular',  0.00,  81.80, 270, 96.40, 60.07);

  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_altas, 'A8', 1, 4, 'MEDIA', 'cuadrada',  17.37, 180.14);

  -- Mesas Cuadrado (C1..C5)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_cuadrado, 'C1', 2, 2, 'BAJA', 'cuadrada', 317.07, 244.21),
    (v_local, z_cuadrado, 'C2', 2, 2, 'BAJA', 'cuadrada', 320.19, 322.67),
    (v_local, z_cuadrado, 'C3', 2, 2, 'BAJA', 'cuadrada', 386.84, 322.55),
    (v_local, z_cuadrado, 'C4', 2, 2, 'BAJA', 'cuadrada', 451.04, 321.57),
    (v_local, z_cuadrado, 'C5', 2, 2, 'BAJA', 'cuadrada', 517.42, 319.77);

  -- Mesas Super VIP (SV1..SV3)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_svip, 'SV1', 3, 3, 'ALTA', 'cuadrada', 617.94,  99.19),
    (v_local, z_svip, 'SV2', 2, 2, 'ALTA', 'cuadrada', 690.02, 100.32),
    (v_local, z_svip, 'SV3', 3, 3, 'ALTA', 'cuadrada', 757.40,  99.64);

  -- Mesas VIP (V1..V4)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_vip, 'V1', 3, 3, 'MEDIA', 'cuadrada', 663.59, 266.70),
    (v_local, z_vip, 'V2', 3, 3, 'MEDIA', 'cuadrada', 663.32, 201.63),
    (v_local, z_vip, 'V3', 3, 3, 'MEDIA', 'cuadrada', 733.28, 267.44),
    (v_local, z_vip, 'V4', 3, 3, 'MEDIA', 'cuadrada', 732.94, 203.94);

  -- Mesas Cristalera (CR1..CR4)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_cristalera, 'CR1', 2, 2, 'BAJA', 'cuadrada', 581.89, 407.46),
    (v_local, z_cristalera, 'CR2', 2, 2, 'BAJA', 'cuadrada', 581.84, 470.71),
    (v_local, z_cristalera, 'CR3', 2, 2, 'BAJA', 'cuadrada', 648.22, 407.34),
    (v_local, z_cristalera, 'CR4', 2, 2, 'BAJA', 'cuadrada', 650.42, 470.57);

  -- Mesas Redondas (R1..R2)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_redondas, 'R1', 6, 6, 'BAJA', 'redonda', 724.02, 413.34);

  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y, width, height) VALUES
    (v_local, z_redondas, 'R2', 6, 6, 'BAJA', 'redonda', 786.63, 412.31, 61.21, 61.21);

  -- Decoraciones - Terraza
  INSERT INTO sala_decoraciones (sala_id, tipo, x, y, rotation, width, height) VALUES
    (v_terr, 'pasillo', 443.04, 484.44, 0, 220.00, 32.00);

  -- Decoraciones - Sala
  INSERT INTO sala_decoraciones (sala_id, tipo, x, y, rotation, width, height) VALUES
    (v_sala, 'barra',    82.22, 152.05, 0, 220.00, 40.00),
    (v_sala, 'pasillo',  78.63, 399.41, 0, 220.00, 32.00),
    (v_sala, 'pasillo',  87.95, 205.12, 0, 220.00, 32.00),
    (v_sala, 'pasillo', 301.06, 399.68, 0, 220.00, 32.00),
    (v_sala, 'pasillo', 308.90, 204.79, 0, 220.00, 32.00),
    (v_sala, 'pasillo', 593.61, 342.09, 0, 220.00, 32.00),
    (v_sala, 'wc',      589.55, 261.26, 0,  50.00, 50.00);

  -- Plano principal: reutilizar el existente o crear uno nuevo
  SELECT id INTO v_plano FROM planos WHERE local_id = v_local AND es_principal LIMIT 1;
  IF v_plano IS NULL THEN
    INSERT INTO planos (local_id, nombre, es_principal)
    VALUES (v_local, 'Bacanal Fuenlabrada', true)
    RETURNING id INTO v_plano;
  END IF;

  INSERT INTO plano_salas (plano_id, sala_id) VALUES (v_plano, v_terr) ON CONFLICT DO NOTHING;
  INSERT INTO plano_salas (plano_id, sala_id) VALUES (v_plano, v_sala) ON CONFLICT DO NOTHING;
END $$;
